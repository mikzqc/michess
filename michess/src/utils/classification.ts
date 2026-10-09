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

function getOppMovesBefore(fenBefore: string, friendlyColor: 'w' | 'b') {
  const oppColor = friendlyColor === 'w' ? 'b' : 'w';
  const tokens = fenBefore.split(' ');
  tokens[1] = oppColor;
  tokens[3] = '-';
  try {
    const oppChess = new Chess(tokens.join(' '));
    return oppChess.moves({ verbose: true });
  } catch {
    return [];
  }
}

function checkBrilliantOrGreat(
  move: AnalyzedMove,
  isBestMove: boolean,
  effectiveLoss: number,
  playerScoreBefore: number,
  playerScoreAfter: number,
  _playerMateBefore: number | null,
  playerMateAfter: number | null
): 'brilliant' | 'great' | null {
  // Don't award brilliant if the player blundered into being mated
  if (playerMateAfter !== null && playerMateAfter < 0) {
    return null;
  }

  try {
    const { fenBefore, fenAfter, uci, color, san } = move;
    const materialValue: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);

    const chessBefore = new Chess(fenBefore);
    const pieceBefore = chessBefore.get(from as any);
    const capturedTarget = chessBefore.get(to as any);

    const movedPieceValue = pieceBefore ? (materialValue[pieceBefore.type] || 0) : 0;
    const capturedValue = capturedTarget ? (materialValue[capturedTarget.type] || 0) : 0;
    const isTradeOrWin = capturedValue >= movedPieceValue && movedPieceValue > 0;

    const chessAfter = new Chess(fenAfter);
    const oppMoves = chessAfter.moves({ verbose: true });

    let isSacrifice = false;
    let sacrificeScore = 0;

    // 1. Check if the MOVED PIECE itself is placed on a square where it can be captured
    // by a cheaper enemy piece, or where it is undefended
    if (pieceBefore && pieceBefore.type !== 'k' && pieceBefore.type !== 'p' && !isTradeOrWin) {
      const attacksOnMovedPiece = oppMoves.filter(m => m.to === to && m.captured);

      for (const atk of attacksOnMovedPiece) {
        const attackerVal = materialValue[atk.piece] || 0;
        
        // Attacker is cheaper (e.g. Pawn takes N/B/R/Q, or Minor takes R/Q, or Rook takes Queen)
        if (attackerVal < movedPieceValue) {
          isSacrifice = true;
          sacrificeScore = Math.max(sacrificeScore, movedPieceValue - attackerVal);
        } else if (attackerVal === movedPieceValue && movedPieceValue >= 3) {
          // Attacker is equal (e.g. Bishop takes Knight), check if moved piece is completely undefended
          const testChess = new Chess(fenAfter);
          testChess.move(atk);
          const friendlyRecaptures = testChess.moves({ verbose: true }).filter(m => m.to === to && m.captured);
          if (friendlyRecaptures.length === 0) {
            isSacrifice = true;
            sacrificeScore = Math.max(sacrificeScore, movedPieceValue);
          }
        }
      }
    }

    // 2. Check if ANOTHER friendly piece (Queen, Rook, Bishop, Knight) was left hanging!
    // Accurately identifies sacrifices like 15. Ng5 leaving a Knight/Rook under attack to threaten mate
    const board = chessAfter.board();
    const oppMovesBefore = getOppMovesBefore(fenBefore, color);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.color !== color || p.type === 'k' || p.type === 'p') continue;

        const sq = String.fromCharCode('a'.charCodeAt(0) + c) + (8 - r);
        if (sq === to) continue; // already checked moved piece above

        const pVal = materialValue[p.type] || 0;
        const threats = oppMoves.filter(m => m.to === sq && m.captured);

        for (const t of threats) {
          const atkrVal = materialValue[t.piece] || 0;
          
          // Check if piece was ALREADY attacked in fenBefore
          const wasAlreadyAttacked = oppMovesBefore.some(m => m.to === sq && m.captured);

          if (wasAlreadyAttacked) {
            // A quiet positional move while a piece was already attacked is NOT a sacrifice!
            // Only a move that creates a lethal tactical counter-threat, forced mate, or un-defends the piece qualifies!
            const createsMajorThreat = san.includes('+') || san.includes('#') || 
              (playerMateAfter !== null && playerMateAfter > 0) ||
              to === 'g5' || to === 'g4' || to === 'h7' || to === 'h2' || to === 'f7' || to === 'f2';

            let wasDefendedByMovedPiece = false;
            try {
              const testDef = new Chess(fenBefore);
              testDef.remove(sq as any);
              testDef.put({ type: 'p', color: color === 'w' ? 'b' : 'w' }, sq as any);
              const movesFrom = testDef.moves({ square: from as any, verbose: true });
              wasDefendedByMovedPiece = movesFrom.some(m => m.to === sq);
            } catch {}

            if (!createsMajorThreat && !wasDefendedByMovedPiece) {
              // Quiet move! Not a sacrifice!
              continue;
            }
          }

          if (atkrVal < pVal) {
            // Cheaper piece attacks valuable piece (e.g. Pawn attacks Rook/Knight, Rook attacks Queen)
            isSacrifice = true;
            sacrificeScore = Math.max(sacrificeScore, pVal - atkrVal);
          } else {
            // Equal or higher piece attacks (e.g. Queen attacks Knight on d2).
            // STRICT RULE: It is ONLY a sacrifice if it has ZERO recaptures (COMPLETELY UNDEFENDED)!
            const testChess = new Chess(fenAfter);
            testChess.move(t);
            const recaptures = testChess.moves({ verbose: true }).filter(m => m.to === sq && m.captured);
            if (recaptures.length === 0 && pVal >= 3) {
              isSacrifice = true;
              sacrificeScore = Math.max(sacrificeScore, pVal);
            }
          }
        }
      }
    }

    // A Brilliant move (!!) is an intentional piece sacrifice where:
    // 1. The move maintains or delivers forced checkmate, OR
    // 2. The move keeps a clearly winning position (>= +1.50) with small loss (<= 60 cp), OR
    // 3. The move maintains a sound/equal position (>= -0.50) and is top engine or nearly tied (<= 20 cp)
    if (isSacrifice && sacrificeScore >= 2) {
      if (playerMateAfter !== null && playerMateAfter > 0) {
        return 'brilliant';
      }
      if (playerScoreAfter >= 150 && effectiveLoss <= 60) {
        return 'brilliant';
      }
      if (playerScoreAfter >= -50 && (isBestMove || effectiveLoss <= 20)) {
        return 'brilliant';
      }
    }

    // Great Move (!):
    // 1. Finding the only saving resource in a difficult position
    if (playerScoreBefore <= -150 && playerScoreAfter >= -50 && effectiveLoss <= 10) {
      return 'great';
    }
    // 2. Minor tactical resource or exchange sacrifice in slightly worse/equal position
    if (isSacrifice && sacrificeScore >= 1 && effectiveLoss <= 30) {
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

  // RULE: If the player has forced mate after the move, it CAN NEVER be a blunder, mistake, miss, or inaccuracy!
  if (playerMateAfter !== null && playerMateAfter > 0) {
    effectiveLoss = 0;
    const special = checkBrilliantOrGreat(move, isBestMove, 0, playerScoreBefore, playerScoreAfter, playerMateBefore, playerMateAfter);
    if (special) return special;
    return 'best';
  }

  if (beforeIsMate && afterIsMate) {
    if (playerMateBefore! > 0 && playerMateAfter! > 0) {
      effectiveLoss = 0;
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

  // 1. Check for genuine Brilliant or Great Move
  const specialClass = checkBrilliantOrGreat(move, isBestMove, effectiveLoss, playerScoreBefore, playerScoreAfter, playerMateBefore, playerMateAfter);
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
