import type { EngineEvaluation } from '../types/review';

/**
 * Calculates the accuracy of a single move (0 to 100).
 * Uses a win probability (winning chances) model:
 * 1. Convert centipawn eval to win probability for the player making the move.
 * 2. Calculate accuracy based on how much win probability was lost.
 * 
 * Win Probability formula: 1 / (1 + exp(-0.00368208 * cp))
 * Accuracy formula: 103.1668 * exp(-0.04354 * wpLoss * 100) - 3.1669
 */
export function calculateAccuracy(
  evalBefore: EngineEvaluation,
  evalAfter: EngineEvaluation,
  color: 'w' | 'b',
  isCheckmateMove: boolean,
  isBookMove: boolean
): number {
  if (isBookMove) return 100;
  if (isCheckmateMove) return 100;

  const getScore = (ev: EngineEvaluation) => {
    if (!ev.score) return 0;
    if (ev.score.type === 'mate') {
      // Mate in 3 for white = +9700, mate in -3 (black) = -9700
      return Math.sign(ev.score.value) * (10000 - Math.abs(ev.score.value) * 100);
    }
    return ev.score.value; // centipawns
  };

  const s1 = getScore(evalBefore);
  const s2 = getScore(evalAfter);

  // Both s1 and s2 are from White's perspective.
  // Convert them to the perspective of the player who made the move.
  // Positive means advantage for the player.
  const playerBefore = color === 'w' ? s1 : -s1;
  const playerAfter = color === 'w' ? s2 : -s2;

  // Win probability function: 1 / (1 + exp(-0.00368208 * cp))
  const getWinProb = (cp: number) => 1 / (1 + Math.exp(-0.00368208 * cp));

  const wpBefore = getWinProb(playerBefore);
  const wpAfter = getWinProb(playerAfter);
  
  // If the player improved their position (wpAfter > wpBefore), loss is 0.
  const wpLoss = Math.max(0, wpBefore - wpAfter);

  // Smooth diminishing-return formula
  const accuracy = 103.1668 * Math.exp(-0.04354 * wpLoss * 100) - 3.1669;

  // Clamp strictly between 0 and 100
  return Math.max(0, Math.min(100, accuracy));
}
