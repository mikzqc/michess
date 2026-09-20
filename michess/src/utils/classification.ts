import type { AnalyzedMove } from '../types/review';
import type { MoveClassificationType } from '../types/classification';
import { isBookMove } from './openingBook';
import { Chess } from 'chess.js';

// Thresholds in centipawn (cp) equivalent loss from the player's perspective.
export const CLASSIFICATION_THRESHOLDS = {
  EXCELLENT: 15,
  GOOD: 40,
  INACCURACY: 100,
  MISTAKE: 250,
  BLUNDER: 250, // > 250 is blunder
  WINNING_MARGIN: 250, // Advantage size where we start forgiving evaluation drops
};

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

  if (playerScoreBefore >= 300 && playerScoreAfter < 100 && effectiveLoss >= 200) return 'miss';

  if (effectiveLoss > CLASSIFICATION_THRESHOLDS.BLUNDER) return 'blunder';
  if (effectiveLoss > CLASSIFICATION_THRESHOLDS.MISTAKE) return 'mistake';
  if (effectiveLoss > CLASSIFICATION_THRESHOLDS.INACCURACY) return 'inaccuracy';
  if (effectiveLoss > CLASSIFICATION_THRESHOLDS.GOOD) return 'good';

  // For Best, Excellent, Great, Brilliant
  const isExcellentOrBest = isBestMove || effectiveLoss <= 5;
  
  if (isExcellentOrBest) {
    // Determine tactical Brilliance or Greatness
    // We check if the PV involves a material sacrifice that is objectively sound.
    try {
      const chess = new Chess(fenBefore);
      const materialValue = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
      
      let initialMaterial = 0;
      const boardBefore = chess.board();
      for (const row of boardBefore) {
        for (const piece of row) {
          if (piece) {
            if (piece.color === move.color) initialMaterial += materialValue[piece.type];
            else initialMaterial -= materialValue[piece.type];
          }
        }
      }

      // Apply our move
      const from = uci.substring(0, 2);
      const to = uci.substring(2, 4);
      const promotion = uci.length === 5 ? uci[4] : undefined;
      chess.move({ from, to, promotion });

      // Apply PV
      if (move.pv) {
        let pvMoves = move.pv.split(' ');
        if (pvMoves[0] === uci) pvMoves = pvMoves.slice(1);
        
        // Only look ahead a few moves (e.g. 5 plies) to see immediate material resolution
        const lookahead = Math.min(pvMoves.length, 5);
        for (let i = 0; i < lookahead; i++) {
          const m = pvMoves[i];
          if (!m) continue;
          try {
            chess.move({ from: m.substring(0, 2), to: m.substring(2, 4), promotion: m.length === 5 ? m[4] : undefined });
          } catch (e) {
            break;
          }
        }
      }

      let finalMaterial = 0;
      const boardAfter = chess.board();
      for (const row of boardAfter) {
        for (const piece of row) {
          if (piece) {
            if (piece.color === move.color) finalMaterial += materialValue[piece.type];
            else finalMaterial -= materialValue[piece.type];
          }
        }
      }

      const sacValue = initialMaterial - finalMaterial;

      // If we sacrificed material but the evaluation is still equal or better for us
      if (sacValue >= 3 && playerScoreAfter >= -100) {
        return 'brilliant';
      }
      if (sacValue > 0 && sacValue < 3 && playerScoreAfter >= -50) {
        return 'great';
      }
      
      // Additional criteria for Great Move:
      // Finding the only winning/drawing move in a very bad position
      if (playerScoreBefore <= -200 && playerScoreAfter > -100) {
         return 'great'; // Saved the game
      }
    } catch (e) {
      console.warn("Error calculating brilliant move", e);
    }

    if (effectiveLoss <= 5) return 'best';
    return 'excellent';
  }

  if (effectiveLoss <= CLASSIFICATION_THRESHOLDS.GOOD) {
    return 'good';
  }

  return 'unclassified';
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
