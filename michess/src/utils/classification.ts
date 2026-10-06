import type { AnalyzedMove } from '../types/review';
import type { MoveClassificationType } from '../types/classification';
import { isBookMove } from './openingBook';
import { Chess } from 'chess.js';

// Thresholds in centipawn (cp) equivalent loss from the player's perspective.
export const CLASSIFICATION_THRESHOLDS = {
  BEST: 8,
  EXCELLENT: 22,
  GOOD: 45,
  INACCURACY: 110,
  MISTAKE: 220,
  BLUNDER: 220, // > 220 is blunder
  WINNING_MARGIN: 250, // Advantage size where we start forgiving evaluation drops
};

function checkBrilliantOrGreat(
  move: AnalyzedMove,
  isBestMove: boolean,
  effectiveLoss: number,
  playerScoreBefore: number,
  playerScoreAfter: number
): 'brilliant' | 'great' | null {
  // Only the engine's best move (or virtually tied with best move) can be Brilliant or Great
  if (!isBestMove && effectiveLoss > 5) return null;

  // Don't award brilliant if the player was already completely crushing (e.g. +600 cp)
  // or in a losing position (playerScoreAfter < -30)
  if (playerScoreBefore >= 600 || playerScoreAfter < -30) {
    if (playerScoreBefore <= -150 && playerScoreAfter >= -50) {
      return 'great'; // Game-saving defensive resource
    }
    return null;
  }

  try {
    const { fenBefore, uci, color, pv } = move;
    const chess = new Chess(fenBefore);

    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const promotion = uci.length === 5 ? uci[4] : undefined;

    const pieceBefore = chess.get(from as any);
    // Pawns and Kings are not piece sacrifices
    if (!pieceBefore || pieceBefore.type === 'p' || pieceBefore.type === 'k') {
      if (playerScoreBefore <= -150 && playerScoreAfter >= -50) {
        return 'great';
      }
      return null;
    }

    const materialValue: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const movedPieceValue = materialValue[pieceBefore.type] || 0;

    // Check what was captured on 'to'
    const capturedTarget = chess.get(to as any);
    const capturedValue = capturedTarget ? (materialValue[capturedTarget.type] || 0) : 0;

    // If the move captured equal or higher value, it's a trade or material win, NOT a sacrifice!
    // E.g. Rook takes Rook (5 for 5) or Knight takes Knight (3 for 3) is a trade, never Brilliant.
    if (capturedValue >= movedPieceValue) {
      if (playerScoreBefore <= -150 && playerScoreAfter >= -50) {
        return 'great';
      }
      return null;
    }

    // Material balance before the move
    let initialMaterialDiff = 0;
    for (const row of chess.board()) {
      for (const piece of row) {
        if (piece) {
          if (piece.color === color) initialMaterialDiff += materialValue[piece.type];
          else initialMaterialDiff -= materialValue[piece.type];
        }
      }
    }

    // Execute the move
    chess.move({ from, to, promotion });

    // Check if the piece is attacked by opponent
    const opponentMoves = chess.moves({ verbose: true });
    let isAttackedByOpponent = false;
    for (const opMove of opponentMoves) {
      if (opMove.to === to) {
        isAttackedByOpponent = true;
        break;
      }
    }

    // Follow the engine PV to see if the piece was genuinely surrendered without immediate recapture
    let pvMaterialDiff = initialMaterialDiff;
    if (pv) {
      const pvTokens = pv.trim().split(/\s+/);
      const pvMoves = pvTokens[0] === uci ? pvTokens.slice(1) : pvTokens;
      const lookahead = Math.min(pvMoves.length, 4);

      for (let i = 0; i < lookahead; i++) {
        const m = pvMoves[i];
        if (!m || m.length < 4) break;
        try {
          chess.move({
            from: m.substring(0, 2),
            to: m.substring(2, 4),
            promotion: m.length === 5 ? m[4] : undefined
          });
        } catch {
          break;
        }
      }

      let afterDiff = 0;
      for (const row of chess.board()) {
        for (const piece of row) {
          if (piece) {
            if (piece.color === color) afterDiff += materialValue[piece.type];
            else afterDiff -= materialValue[piece.type];
          }
        }
      }
      pvMaterialDiff = afterDiff;
    }

    // Net material sacrificed in PV
    const materialSacrificed = initialMaterialDiff - pvMaterialDiff;

    // A true Brilliant Move requires:
    // 1. The player is genuinely down at least 2 points of material in the resulting PV (e.g. piece for pawn, piece for nothing, exchange sacrifice).
    // 2. The position is sound/winning (playerScoreAfter >= -30).
    // 3. The move was the best move.
    if (materialSacrificed >= 2 && playerScoreAfter >= -30 && effectiveLoss <= 4) {
      return 'brilliant';
    }

    // If an attacked piece was left hanging (sacrificed) and evaluation is winning/clear
    if (isAttackedByOpponent && movedPieceValue >= 3 && materialSacrificed >= 1 && playerScoreAfter >= 0 && effectiveLoss <= 3) {
      return 'brilliant';
    }

    // Great move: minor tactical resource or finding the only defense in a bad position
    if (materialSacrificed >= 1 && playerScoreAfter >= -50) {
      return 'great';
    }
    if (playerScoreBefore <= -150 && playerScoreAfter >= -50) {
      return 'great';
    }
  } catch (err) {
    console.warn("Error checking brilliant/great move", err);
  }

  return null;
}

export function classifyMove(move: AnalyzedMove): MoveClassificationType {
  const { uci, bestMove, san, fenBefore } = move;

  if (san.includes('#')) return 'best';

  if (!move.evalBefore.score || !move.evalAfter.score) {
    return 'unclassified';
  }

  const isBestMove = bestMove === uci;

  const getCp = (ev: { type: 'cp' | 'mate', value: number }) => {
    if (ev.type === 'mate') {
      return Math.sign(ev.value) * (10000 - Math.abs(ev.value) * 100);
    }
    return ev.value;
  };

  // Both are from White's perspective natively (guaranteed by useGameReview.ts normalization)
  const beforeCp = getCp(move.evalBefore.score);
  const afterCp = getCp(move.evalAfter.score);
  
  // Convert to player's perspective
  const playerScoreBefore = move.color === 'w' ? beforeCp : -beforeCp;
  const playerScoreAfter = move.color === 'w' ? afterCp : -afterCp;
  
  // Raw loss in centipawns
  let effectiveLoss = Math.max(0, playerScoreBefore - playerScoreAfter);

  if (isBookMove(fenBefore, san)) return 'book';

  const beforeIsMate = move.evalBefore.score.type === 'mate';
  const afterIsMate = move.evalAfter.score.type === 'mate';
  const playerMateBefore = beforeIsMate ? (move.color === 'w' ? move.evalBefore.score.value : -move.evalBefore.score.value) : null;
  const playerMateAfter = afterIsMate ? (move.color === 'w' ? move.evalAfter.score.value : -move.evalAfter.score.value) : null;

  if (beforeIsMate && afterIsMate) {
    if (playerMateBefore! > 0 && playerMateAfter! > 0) {
      const delay = playerMateAfter! - playerMateBefore!;
      effectiveLoss = delay > 0 ? delay * 10 : 0;
    } else if (playerMateBefore! < 0 && playerMateAfter! < 0) {
      effectiveLoss = 0;
    }
  } else if (beforeIsMate && !afterIsMate) {
    if (playerMateBefore! > 0) {
      // Missed forced mate
      if (playerScoreAfter >= CLASSIFICATION_THRESHOLDS.WINNING_MARGIN * 2) {
        effectiveLoss = CLASSIFICATION_THRESHOLDS.INACCURACY;
      } else if (playerScoreAfter >= CLASSIFICATION_THRESHOLDS.WINNING_MARGIN) {
        effectiveLoss = CLASSIFICATION_THRESHOLDS.MISTAKE;
      } else {
        return 'miss';
      }
    } else {
      effectiveLoss = 0;
    }
  } else if (!beforeIsMate && afterIsMate) {
    if (playerMateAfter! < 0) {
      // Blundered into mate
      if (playerScoreBefore <= -CLASSIFICATION_THRESHOLDS.WINNING_MARGIN * 2) {
        effectiveLoss = CLASSIFICATION_THRESHOLDS.INACCURACY;
      } else {
        effectiveLoss = CLASSIFICATION_THRESHOLDS.BLUNDER + 100;
      }
    } else {
      effectiveLoss = 0;
    }
  } else {
    // Normal scaling - ONLY forgive drops if the player remains completely winning
    if (playerScoreBefore >= 400) {
      if (playerScoreAfter >= 400) {
        effectiveLoss = effectiveLoss / 3;
      } else if (playerScoreAfter >= 250) {
        effectiveLoss = effectiveLoss / 1.5;
      }
    }
    if (playerScoreBefore <= -400 && playerScoreAfter <= -400) {
      effectiveLoss = effectiveLoss / 3;
    }
  }

  // Missed winning opportunity
  if (playerScoreBefore >= 250 && playerScoreAfter < 100 && effectiveLoss >= 150) {
    return 'miss';
  }

  // 1. Check for genuine Brilliant or Great Move (strict criteria)
  const specialClass = checkBrilliantOrGreat(move, isBestMove, effectiveLoss, playerScoreBefore, playerScoreAfter);
  if (specialClass) return specialClass;

  // 2. Best Move: Engine's #1 move, or essentially tied with best move (<= 8 cp loss)
  if (isBestMove || effectiveLoss <= CLASSIFICATION_THRESHOLDS.BEST) {
    return 'best';
  }

  // 3. Clear tiers based on centipawn loss
  if (effectiveLoss <= CLASSIFICATION_THRESHOLDS.EXCELLENT) return 'excellent';
  if (effectiveLoss <= CLASSIFICATION_THRESHOLDS.GOOD) return 'good';
  if (effectiveLoss <= CLASSIFICATION_THRESHOLDS.INACCURACY) return 'inaccuracy';
  if (effectiveLoss <= CLASSIFICATION_THRESHOLDS.MISTAKE) return 'mistake';
  return 'blunder';
}

export function getClassificationExplanation(classification: MoveClassificationType): string {
  switch (classification) {
    case 'brilliant': return 'A difficult, objectively excellent tactical or positional move.';
    case 'great': return 'A particularly strong move that significantly improves or preserves your position.';
    case 'best': return 'This move matches the engine’s preferred move and maintains the position’s evaluation.';
    case 'excellent': return 'A very strong move with negligible evaluation loss.';
    case 'good': return 'A reasonable move with a small evaluation loss.';
    case 'book': return 'An established opening book move.';
    case 'inaccuracy': return 'A small but meaningful loss of evaluation.';
    case 'mistake': return 'A clear error that loses noticeable evaluation or an important advantage.';
    case 'miss': return 'A missed important opportunity or a failure to convert a major tactical advantage.';
    case 'blunder': return 'A severe error that causes major evaluation loss or drastically changes the game result.';
    default: return 'No classification available.';
  }
}
