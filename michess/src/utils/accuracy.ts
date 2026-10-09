import type { EngineEvaluation } from '../types/review';
import type { AnalyzedMove } from '../types/review';

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

  // If player has forced checkmate after the move, it's 100% accurate!
  if (evalAfter.score?.type === 'mate') {
    const playerMate = color === 'w' ? evalAfter.score.value : -evalAfter.score.value;
    if (playerMate > 0) return 100;
  }

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

/**
 * Calculates overall game accuracy across all moves of a side.
 * Unlike a naive arithmetic mean, this accounts for move volatility and
 * penalizes blunders and mistakes so games with game-losing blunders
 * are not artificially inflated.
 */
export function calculateGameAccuracy(moves: AnalyzedMove[]): number {
  if (moves.length === 0) return 100;

  const moveAccs = moves.map(m => m.accuracy ?? 100);

  // Power mean with p = 0.6 to give realistic weight to game-deciding mistakes
  const p = 0.6;
  const sumPower = moveAccs.reduce((acc, val) => acc + Math.pow(Math.max(0.1, val), p), 0);
  const powerMean = Math.pow(sumPower / moves.length, 1 / p);

  // Proportionate deduction for blunders and mistakes
  const blunders = moves.filter(m => m.classification === 'blunder').length;
  const mistakes = moves.filter(m => m.classification === 'mistake').length;

  const blunderImpact = (blunders / moves.length) * 40;
  const mistakeImpact = (mistakes / moves.length) * 18;

  const finalAcc = Math.max(0, Math.min(100, powerMean - blunderImpact - mistakeImpact));
  return Math.round(finalAcc * 10) / 10;
}

/**
 * Realistic Performance Rating (Est. Elo) calculator based on accuracy,
 * blunders, mistakes, and move count.
 */
export function estimatePerformanceRating(
  accuracy: number | null,
  moves: AnalyzedMove[] = []
): number | null {
  if (accuracy === null || moves.length === 0) return null;

  const blunders = moves.filter(m => m.classification === 'blunder').length;
  const mistakes = moves.filter(m => m.classification === 'mistake').length;
  const inaccuracies = moves.filter(m => m.classification === 'inaccuracy').length;
  const totalMoves = moves.length;

  // Realistic Elo scale based on Chess.com / FIDE accuracy distributions
  let baseElo: number;
  if (accuracy < 55) {
    baseElo = Math.max(250, 300 + (accuracy / 55) * 400); // 300 - 700
  } else if (accuracy < 70) {
    baseElo = 700 + ((accuracy - 55) / 15) * 400; // 700 - 1100
  } else if (accuracy < 82) {
    baseElo = 1100 + ((accuracy - 70) / 12) * 400; // 1100 - 1500
  } else if (accuracy < 90) {
    baseElo = 1500 + ((accuracy - 82) / 8) * 350; // 1500 - 1850
  } else if (accuracy < 95) {
    baseElo = 1850 + ((accuracy - 90) / 5) * 400; // 1850 - 2250
  } else if (accuracy < 98) {
    baseElo = 2250 + ((accuracy - 95) / 3) * 350; // 2250 - 2600
  } else {
    baseElo = 2600 + Math.min(2, accuracy - 98) * 100; // 2600 - 2800
  }

  // Blunder and mistake penalties relative to game length
  const norm = Math.max(12, totalMoves);
  const blunderPenalty = (blunders / norm) * 1800;
  const mistakePenalty = (mistakes / norm) * 750;
  const inaccuracyPenalty = (inaccuracies / norm) * 150;

  const finalElo = Math.round(baseElo - blunderPenalty - mistakePenalty - inaccuracyPenalty);
  return Math.max(250, Math.min(2850, finalElo));
}
