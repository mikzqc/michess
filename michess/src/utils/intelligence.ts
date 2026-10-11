import { Chess } from 'chess.js';
import type { AnalyzedMove } from '../types/review';
import type {
  GamePhase,
  PhaseMetric,
  DetectedMistake,
  MistakeType,
  GameIntelligenceAnalysis,
  WeaknessReport,
  TrainingRecommendation,
  IntelligenceSummary
} from '../types/intelligence';
import type { GameSource } from '../types/history';

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

/**
 * Determines the chess phase of a position.
 * - Opening: moves 1 to 12.
 * - Endgame: total non-pawn material for each player <= 13 points, or <= 10 total pieces remaining.
 * - Middlegame: everything in between.
 */
export function determineGamePhase(fen: string, moveNumber: number): GamePhase {
  if (moveNumber <= 12) {
    return 'opening';
  }

  const boardPart = fen.split(' ')[0];
  let whiteNonPawn = 0;
  let blackNonPawn = 0;
  let totalPieces = 0;

  for (const char of boardPart) {
    if (char === '/' || (!isNaN(parseInt(char, 10)) && parseInt(char, 10) > 0)) {
      continue;
    }
    totalPieces++;
    const lower = char.toLowerCase();
    if (lower === 'k' || lower === 'p') continue;

    const val = PIECE_VALUES[lower] || 0;
    if (char === char.toUpperCase()) {
      whiteNonPawn += val;
    } else {
      blackNonPawn += val;
    }
  }

  // If pieces are heavily reduced or both sides have low non-pawn material (<= 13 points)
  if (totalPieces <= 10 || (whiteNonPawn <= 13 && blackNonPawn <= 13)) {
    return 'endgame';
  }

  return 'middlegame';
}

/**
 * Identifies if a piece was blundered/hung without compensation.
 */
export function detectHangingPiece(
  move: AnalyzedMove,
  fenBefore: string,
  fenAfter: string
): 'q' | 'r' | 'b' | 'n' | 'p' | undefined {
  if (move.evalLoss < 150) return undefined;

  try {
    const from = move.uci.slice(0, 2);
    const to = move.uci.slice(2, 4);
    const cBefore = new Chess(fenBefore);
    const movedPiece = cBefore.get(from as any);

    if (!movedPiece) return undefined;
    const movedVal = PIECE_VALUES[movedPiece.type] || 0;

    const cAfter = new Chess(fenAfter);
    const oppMoves = cAfter.moves({ verbose: true });

    // 1. Did player move piece to a square where it can be captured by a cheaper piece or for free?
    const directAttacks = oppMoves.filter(m => m.to === to && m.captured);
    for (const atk of directAttacks) {
      const atkVal = PIECE_VALUES[atk.piece] || 0;
      if (atkVal < movedVal) {
        return movedPiece.type as any;
      }
      if (atkVal === movedVal) {
        // Test if protected
        const sim = new Chess(fenAfter);
        sim.move(atk);
        const recaptures = sim.moves({ verbose: true }).filter(m => m.to === to && m.captured);
        if (recaptures.length === 0) {
          return movedPiece.type as any;
        }
      }
    }

    // 2. Was another friendly piece left hanging?
    const board = cAfter.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.color !== move.color || p.type === 'k') continue;
        const sq = String.fromCharCode('a'.charCodeAt(0) + c) + (8 - r);
        const pVal = PIECE_VALUES[p.type] || 0;
        if (pVal < 3) continue; // Focus on minors, rooks, queens

        const attacks = oppMoves.filter(m => m.to === sq && m.captured);
        for (const atk of attacks) {
          const atkVal = PIECE_VALUES[atk.piece] || 0;
          if (atkVal < pVal) return p.type as any;
          if (atkVal === pVal) {
            const sim = new Chess(fenAfter);
            sim.move(atk);
            const recaptures = sim.moves({ verbose: true }).filter(m => m.to === sq && m.captured);
            if (recaptures.length === 0) return p.type as any;
          }
        }
      }
    }
  } catch {}

  return undefined;
}

/**
 * Classifies the strategic nature of a mistake.
 */
export function classifyMistakeType(
  move: AnalyzedMove,
  phase: GamePhase,
  hangingPiece?: 'q' | 'r' | 'b' | 'n' | 'p'
): MistakeType {
  const evalBefore = move.evalBefore?.score;
  const evalAfter = move.evalAfter?.score;

  // Missed checkmate
  if (evalBefore?.type === 'mate') {
    const isFriendlyMate = move.color === 'w' ? evalBefore.value > 0 : evalBefore.value < 0;
    if (isFriendlyMate) {
      const afterIsFriendlyMate = evalAfter?.type === 'mate' && (move.color === 'w' ? evalAfter.value > 0 : evalAfter.value < 0);
      if (!afterIsFriendlyMate) {
        return 'missed_mate';
      }
    }
  }

  if (hangingPiece) {
    return 'hanging_piece';
  }

  if (move.classification === 'miss') {
    return 'missed_tactic';
  }

  if (phase === 'opening' && move.evalLoss >= 150) {
    return 'opening_advantage_loss';
  }

  if (phase === 'endgame' && move.evalLoss >= 150) {
    return 'endgame_mistake';
  }

  return 'blunder';
}

function createEmptyPhaseMetric(): PhaseMetric {
  return {
    moveCount: 0,
    acpl: 0,
    accuracy: 0,
    blunders: 0,
    mistakes: 0,
    inaccuracies: 0,
    bestMoves: 0,
    misses: 0
  };
}

/**
 * Analyzes all moves for a single game from the user's perspective.
 */
export function analyzeGameMovesForIntelligence(
  moves: AnalyzedMove[],
  userColor: 'w' | 'b',
  meta: {
    gameId: string;
    pgn: string;
    date: string;
    opponent: string;
    result: 'win' | 'loss' | 'draw' | '*';
    source: GameSource;
    opening?: { name: string; eco: string };
  }
): GameIntelligenceAnalysis {
  const userMoves = moves.filter(m => m.color === userColor);
  
  const phases: Record<GamePhase, PhaseMetric> = {
    opening: createEmptyPhaseMetric(),
    middlegame: createEmptyPhaseMetric(),
    endgame: createEmptyPhaseMetric()
  };

  const detectedMistakes: DetectedMistake[] = [];
  let totalUserLoss = 0;
  let totalUserAccuracy = 0;

  for (const move of userMoves) {
    const phase = determineGamePhase(move.fenBefore, move.moveNumber);
    const pMetric = phases[phase];

    pMetric.moveCount++;
    const loss = Math.min(1000, Math.max(0, move.evalLoss || 0));
    pMetric.acpl += loss;
    totalUserLoss += loss;

    const acc = move.accuracy ?? 85;
    pMetric.accuracy += acc;
    totalUserAccuracy += acc;

    const cls = move.classification || 'good';
    if (cls === 'blunder') pMetric.blunders++;
    else if (cls === 'mistake') pMetric.mistakes++;
    else if (cls === 'inaccuracy') pMetric.inaccuracies++;
    else if (cls === 'best' || cls === 'brilliant' || cls === 'great') pMetric.bestMoves++;
    else if (cls === 'miss') pMetric.misses++;

    // Check if this move constitutes an identifiable mistake
    if (cls === 'blunder' || cls === 'mistake' || cls === 'miss' || loss >= 150) {
      const hangingPiece = detectHangingPiece(move, move.fenBefore, move.fenAfter);
      const mistakeType = classifyMistakeType(move, phase, hangingPiece);

      let explanation = `Lost ${loss} centipawns.`;
      if (mistakeType === 'hanging_piece' && hangingPiece) {
        const pieceNames: Record<string, string> = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };
        explanation = `Left ${pieceNames[hangingPiece]} hanging without sufficient compensation.`;
      } else if (mistakeType === 'missed_mate') {
        explanation = `Overlooked a forced checkmate sequence.`;
      } else if (mistakeType === 'missed_tactic') {
        explanation = `Missed an opportunity to gain material or a decisive positional advantage.`;
      } else if (mistakeType === 'opening_advantage_loss') {
        explanation = `Played an inaccuracy in the opening that conceded the advantage.`;
      } else if (mistakeType === 'endgame_mistake') {
        explanation = `Critical inaccuracy in the endgame that compromised winning chances.`;
      } else {
        explanation = `Move significantly damaged the position (-${loss} cp).`;
      }

      detectedMistakes.push({
        id: `${meta.gameId}_m${move.moveNumber}_${move.color}`,
        gameId: meta.gameId,
        opponent: meta.opponent,
        date: meta.date,
        moveNumber: move.moveNumber,
        san: move.san,
        uci: move.uci,
        color: move.color,
        fenBefore: move.fenBefore,
        fenAfter: move.fenAfter,
        bestMove: move.bestMove,
        pv: move.pv,
        evalBeforeVal: move.evalBefore?.score?.value,
        evalAfterVal: move.evalAfter?.score?.value,
        evalLoss: loss,
        classification: cls,
        phase,
        type: mistakeType,
        hangingPieceType: hangingPiece,
        explanation
      });
    }
  }

  // Average phase metrics
  for (const ph of ['opening', 'middlegame', 'endgame'] as GamePhase[]) {
    const pm = phases[ph];
    if (pm.moveCount > 0) {
      pm.acpl = Math.round((pm.acpl / pm.moveCount) * 10) / 10;
      pm.accuracy = Math.round((pm.accuracy / pm.moveCount) * 10) / 10;
    }
  }

  const userMoveCount = userMoves.length || 1;
  const userAcpl = Math.round((totalUserLoss / userMoveCount) * 10) / 10;
  const userAccuracy = Math.round((totalUserAccuracy / userMoveCount) * 10) / 10;

  return {
    gameId: meta.gameId,
    pgn: meta.pgn,
    date: meta.date,
    opponent: meta.opponent,
    userColor,
    result: meta.result,
    source: meta.source,
    opening: meta.opening,
    totalMoves: userMoves.length,
    userAccuracy,
    userAcpl,
    phases,
    mistakes: detectedMistakes,
    analyzedAt: Date.now()
  };
}

/**
 * Generates the 5 category weakness reports from analyzed games.
 */
export function generateWeaknessReports(analyses: GameIntelligenceAnalysis[]): WeaknessReport[] {
  if (analyses.length === 0) return [];

  const totalGames = analyses.length;
  const allMistakes = analyses.flatMap(a => a.mistakes);

  // 1. TACTICS
  const missedTactics = allMistakes.filter(m => m.type === 'missed_tactic' || m.classification === 'miss');
  const missedMates = allMistakes.filter(m => m.type === 'missed_mate');
  const tacticsExamples = [...missedMates, ...missedTactics].slice(0, 3);
  const tacticsRatePerGame = (missedTactics.length + missedMates.length) / totalGames;

  let tacticsSeverity: WeaknessReport['severity'] = 'solid';
  let tacticsScore = 80;
  if (tacticsRatePerGame > 1.5 || missedMates.length >= 2) {
    tacticsSeverity = 'critical';
    tacticsScore = 45;
  } else if (tacticsRatePerGame > 0.8) {
    tacticsSeverity = 'needs_work';
    tacticsScore = 65;
  } else if (tacticsRatePerGame < 0.3) {
    tacticsSeverity = 'strength';
    tacticsScore = 92;
  }

  const tacticsReport: WeaknessReport = {
    category: 'tactics',
    title: 'Tactical Vision & Opportunities',
    severity: tacticsSeverity,
    score: tacticsScore,
    summary: tacticsSeverity === 'critical' || tacticsSeverity === 'needs_work'
      ? `You are missing an average of ${tacticsRatePerGame.toFixed(1)} tactical opportunities per game, including ${missedMates.length} checkmate chances.`
      : 'Your tactical alertness is sharp. You regularly capitalize on tactical shots and rarely miss checkmates.',
    stats: [
      { label: 'Missed Tactics', value: missedTactics.length, subtext: `${(missedTactics.length / totalGames).toFixed(1)} / game` },
      { label: 'Missed Checkmates', value: missedMates.length },
      { label: 'Tactical Accuracy', value: `${Math.max(50, Math.min(99, 100 - Math.round(tacticsRatePerGame * 25)))}%` }
    ],
    examples: tacticsExamples,
    recommendations: [
      'Solve 5-10 themed tactical puzzles daily focusing on discovery attacks and pins.',
      'Before choosing a move, always scan for all enemy checks, captures, and unprotected pieces.'
    ]
  };

  // 2. OPENING PREPARATION
  let openingMovesCount = 0;
  let openingTotalLoss = 0;
  let openingBlunders = 0;
  for (const a of analyses) {
    openingMovesCount += a.phases.opening.moveCount;
    openingTotalLoss += a.phases.opening.acpl * a.phases.opening.moveCount;
    openingBlunders += a.phases.opening.blunders;
  }
  const avgOpeningAcpl = openingMovesCount > 0 ? Math.round(openingTotalLoss / openingMovesCount) : 30;
  const openingExamples = allMistakes.filter(m => m.phase === 'opening').slice(0, 3);

  let openingSeverity: WeaknessReport['severity'] = 'solid';
  let openingScore = 78;
  if (avgOpeningAcpl > 60 || openingBlunders / totalGames >= 0.7) {
    openingSeverity = 'critical';
    openingScore = 50;
  } else if (avgOpeningAcpl > 40 || openingBlunders > 0) {
    openingSeverity = 'needs_work';
    openingScore = 68;
  } else if (avgOpeningAcpl < 25) {
    openingSeverity = 'strength';
    openingScore = 94;
  }

  const openingReport: WeaknessReport = {
    category: 'openings',
    title: 'Opening Principles & Preparation',
    severity: openingSeverity,
    score: openingScore,
    summary: openingSeverity === 'critical' || openingSeverity === 'needs_work'
      ? `Average centipawn loss in the opening is ${avgOpeningAcpl} cp. Early mistakes are putting you on the defensive early.`
      : 'Solid opening foundation. You consistently develop pieces smoothly and maintain equal or advantageous positions.',
    stats: [
      { label: 'Opening ACPL', value: `${avgOpeningAcpl} cp`, subtext: avgOpeningAcpl < 35 ? 'Solid' : 'High loss' },
      { label: 'Early Blunders', value: openingBlunders, subtext: 'In moves 1-12' },
      { label: 'Book Familiarity', value: `${Math.max(40, Math.min(95, 100 - avgOpeningAcpl))}%` }
    ],
    examples: openingExamples,
    recommendations: [
      'Review your opening lines with Michess Opening Explorer.',
      'Prioritize king safety (early castling) before launching flank attacks.'
    ]
  };

  // 3. MIDDLEGAME STRATEGY
  const hangingPieces = allMistakes.filter(m => m.type === 'hanging_piece');
  let mgMoves = 0;
  let mgLoss = 0;
  let mgBlunders = 0;
  for (const a of analyses) {
    mgMoves += a.phases.middlegame.moveCount;
    mgLoss += a.phases.middlegame.acpl * a.phases.middlegame.moveCount;
    mgBlunders += a.phases.middlegame.blunders;
  }
  const avgMgAcpl = mgMoves > 0 ? Math.round(mgLoss / mgMoves) : 40;
  const mgExamples = [...hangingPieces, ...allMistakes.filter(m => m.phase === 'middlegame')].slice(0, 3);

  let mgSeverity: WeaknessReport['severity'] = 'solid';
  let mgScore = 75;
  if (hangingPieces.length / totalGames >= 0.8 || avgMgAcpl > 65) {
    mgSeverity = 'critical';
    mgScore = 48;
  } else if (hangingPieces.length > 0 || avgMgAcpl > 45) {
    mgSeverity = 'needs_work';
    mgScore = 66;
  } else if (avgMgAcpl < 30 && hangingPieces.length === 0) {
    mgSeverity = 'strength';
    mgScore = 90;
  }

  const middlegameReport: WeaknessReport = {
    category: 'middlegame',
    title: 'Middlegame Strategy & Piece Safety',
    severity: mgSeverity,
    score: mgScore,
    summary: hangingPieces.length > 0
      ? `You left pieces hanging in ${hangingPieces.length} instances across analyzed games. Hanging pieces remain your primary strategic vulnerability.`
      : `Middlegame centipawn loss averages ${avgMgAcpl} cp. Positional plans are generally cohesive.`,
    stats: [
      { label: 'Hanging Pieces', value: hangingPieces.length, subtext: `${(hangingPieces.length / totalGames).toFixed(1)} / game` },
      { label: 'Middlegame ACPL', value: `${avgMgAcpl} cp` },
      { label: 'Middlegame Blunders', value: mgBlunders }
    ],
    examples: mgExamples,
    recommendations: [
      'Check every candidate move with a blunders check: "Does this leave any piece unprotected?"',
      'Improve piece coordination by securing outposts for your knights and centralizing rooks.'
    ]
  };

  // 4. ENDGAME TECHNIQUE
  let egMoves = 0;
  let egLoss = 0;
  let egBlunders = 0;
  for (const a of analyses) {
    egMoves += a.phases.endgame.moveCount;
    egLoss += a.phases.endgame.acpl * a.phases.endgame.moveCount;
    egBlunders += a.phases.endgame.blunders;
  }
  const avgEgAcpl = egMoves > 0 ? Math.round(egLoss / egMoves) : 40;
  const egMistakes = allMistakes.filter(m => m.phase === 'endgame');
  const egExamples = egMistakes.slice(0, 3);

  let egSeverity: WeaknessReport['severity'] = 'solid';
  let egScore = 76;
  if (egBlunders >= 3 || avgEgAcpl > 60) {
    egSeverity = 'critical';
    egScore = 52;
  } else if (egBlunders > 0 || avgEgAcpl > 45) {
    egSeverity = 'needs_work';
    egScore = 69;
  } else if (avgEgAcpl < 28) {
    egSeverity = 'strength';
    egScore = 92;
  }

  const endgameReport: WeaknessReport = {
    category: 'endgame',
    title: 'Endgame Technique & Conversion',
    severity: egSeverity,
    score: egScore,
    summary: egMistakes.length > 0
      ? `Identified ${egMistakes.length} inaccuracies in endgames with average ${avgEgAcpl} cp loss. Converting advantages into wins needs attention.`
      : 'Confident endgame play. You demonstrate good king activity and pawn promotion technique.',
    stats: [
      { label: 'Endgame ACPL', value: `${avgEgAcpl} cp` },
      { label: 'Endgame Mistakes', value: egMistakes.length },
      { label: 'Endgame Moves', value: egMoves }
    ],
    examples: egExamples,
    recommendations: [
      'Activate your king immediately once queens are exchanged.',
      'Practice fundamental rook endgames and pawn opposition.'
    ]
  };

  // 5. CALCULATION & MOVE ACCURACY
  const totalBlunders = allMistakes.filter(m => m.classification === 'blunder').length;
  const totalMistakes = allMistakes.filter(m => m.classification === 'mistake').length;
  const avgOverallAcpl = Math.round(analyses.reduce((s, a) => s + a.userAcpl, 0) / totalGames);
  const avgOverallAccuracy = Math.round(analyses.reduce((s, a) => s + a.userAccuracy, 0) / totalGames);
  const calcExamples = allMistakes.filter(m => m.classification === 'blunder').slice(0, 3);

  let calcSeverity: WeaknessReport['severity'] = 'solid';
  let calcScore = avgOverallAccuracy;
  if (totalBlunders / totalGames >= 1.5 || avgOverallAccuracy < 70) {
    calcSeverity = 'critical';
    calcScore = Math.min(calcScore, 55);
  } else if (totalBlunders / totalGames >= 0.8 || avgOverallAccuracy < 80) {
    calcSeverity = 'needs_work';
    calcScore = Math.min(calcScore, 72);
  } else if (avgOverallAccuracy >= 88) {
    calcSeverity = 'strength';
  }

  const calculationReport: WeaknessReport = {
    category: 'calculation',
    title: 'Calculation & Move Accuracy',
    severity: calcSeverity,
    score: calcScore,
    summary: `Overall accuracy is ${avgOverallAccuracy}% with ${avgOverallAcpl} average centipawn loss and ${(totalBlunders / totalGames).toFixed(1)} blunders per game.`,
    stats: [
      { label: 'Overall Accuracy', value: `${avgOverallAccuracy}%` },
      { label: 'Average ACPL', value: `${avgOverallAcpl} cp` },
      { label: 'Blunders / Game', value: (totalBlunders / totalGames).toFixed(1) },
      { label: 'Mistakes / Game', value: (totalMistakes / totalGames).toFixed(1) }
    ],
    examples: calcExamples,
    recommendations: [
      'Spend extra time on critical moves rather than playing instinctively.',
      'Calculate at least two half-moves deeper for your opponent before committing.'
    ]
  };

  return [tacticsReport, openingReport, middlegameReport, endgameReport, calculationReport];
}

/**
 * Generates actionable training recommendations based on detected weaknesses.
 */
export function generateTrainingRecommendations(
  analyses: GameIntelligenceAnalysis[],
  weaknesses: WeaknessReport[]
): TrainingRecommendation[] {
  const recommendations: TrainingRecommendation[] = [];
  const allMistakes = analyses.flatMap(a => a.mistakes);

  // 1. Position Retries (User's own game mistakes to retry!)
  const retryCandidates = allMistakes.filter(m => m.bestMove && m.bestMove !== '(none)' && m.evalLoss >= 150);
  for (let i = 0; i < Math.min(2, retryCandidates.length); i++) {
    const m = retryCandidates[i];
    recommendations.push({
      id: `retry_${m.id}`,
      type: 'position_retry',
      title: `Retry: Move ${m.moveNumber} vs ${m.opponent}`,
      description: `In your game played on ${m.date}, you played ${m.san} (${m.classification}). Can you find the engine's best move?`,
      actionText: 'Train This Position',
      category: m.phase === 'opening' ? 'openings' : (m.phase === 'endgame' ? 'endgame' : 'tactics'),
      targetFen: m.fenBefore,
      targetMove: m.san,
      bestMove: m.bestMove,
      mistake: m
    });
  }

  // 2. Tactical Puzzles
  const tacticalWeakness = weaknesses.find(w => w.category === 'tactics');
  if (tacticalWeakness && (tacticalWeakness.severity === 'critical' || tacticalWeakness.severity === 'needs_work')) {
    recommendations.push({
      id: 'rec_puzzles_tactics',
      type: 'puzzle',
      title: 'Practice Tactical Puzzles',
      description: 'Sharpen your calculation and reduce missed opportunities by solving curated puzzles.',
      actionText: 'Start Tactical Puzzles',
      category: 'tactics',
      puzzleTheme: 'tactics'
    });
  }

  // 3. Opening Line Review
  // Find opening with worst loss
  const openingsMap = new Map<string, { count: number; loss: number; eco: string }>();
  for (const a of analyses) {
    if (a.opening) {
      const existing = openingsMap.get(a.opening.name) || { count: 0, loss: 0, eco: a.opening.eco };
      existing.count++;
      existing.loss += a.userAcpl;
      openingsMap.set(a.opening.name, existing);
    }
  }

  let worstOpening: { name: string; eco: string; avgLoss: number } | null = null;
  for (const [name, data] of openingsMap.entries()) {
    const avgLoss = data.loss / data.count;
    if (!worstOpening || avgLoss > worstOpening.avgLoss) {
      worstOpening = { name, eco: data.eco, avgLoss };
    }
  }

  if (worstOpening) {
    recommendations.push({
      id: `rec_opening_${worstOpening.eco}`,
      type: 'opening_explorer',
      title: `Review: ${worstOpening.name} (${worstOpening.eco})`,
      description: `You have an average loss of ${Math.round(worstOpening.avgLoss)} cp in this line. Study the master moves and plans.`,
      actionText: 'Explore in Opening Book',
      category: 'openings',
      eco: worstOpening.eco
    });
  }

  // 4. Endgame Practice
  const endgameWeakness = weaknesses.find(w => w.category === 'endgame');
  if (endgameWeakness && (endgameWeakness.severity === 'critical' || endgameWeakness.severity === 'needs_work')) {
    recommendations.push({
      id: 'rec_endgame_practice',
      type: 'endgame_practice',
      title: 'Practice Endgame Technique',
      description: 'Master king activity and pawn conversion to close out winning endgames without slipping.',
      actionText: 'Practice Endgames',
      category: 'endgame',
      puzzleTheme: 'endgame'
    });
  }

  return recommendations;
}

/**
 * Aggregates complete Intelligence Summary from game analyses.
 */
export function computeIntelligenceSummary(
  totalGamesInHistory: number,
  analyses: GameIntelligenceAnalysis[]
): IntelligenceSummary {
  if (analyses.length === 0) {
    return {
      totalGames: totalGamesInHistory,
      totalGamesAnalyzed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      winRate: 0,
      overallAcpl: 0,
      overallAccuracy: 0,
      phaseBreakdown: {
        opening: { accuracy: 0, acpl: 0, blunderRate: 0 },
        middlegame: { accuracy: 0, acpl: 0, blunderRate: 0 },
        endgame: { accuracy: 0, acpl: 0, blunderRate: 0 }
      },
      topOpenings: [],
      trends: [],
      weaknesses: [],
      recurringMistakes: [],
      blunderedPieces: { q: 0, r: 0, b: 0, n: 0, p: 0 },
      recommendations: []
    };
  }

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let sumAcpl = 0;
  let sumAcc = 0;

  const phaseSums = {
    opening: { acc: 0, acpl: 0, blunders: 0, count: 0 },
    middlegame: { acc: 0, acpl: 0, blunders: 0, count: 0 },
    endgame: { acc: 0, acpl: 0, blunders: 0, count: 0 }
  };

  const blunderedPieces: Record<'q' | 'r' | 'b' | 'n' | 'p', number> = {
    q: 0, r: 0, b: 0, n: 0, p: 0
  };

  const openingsStats = new Map<string, {
    name: string;
    eco: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    acplSum: number;
    accSum: number;
  }>();

  const allMistakes: DetectedMistake[] = [];

  analyses.forEach(a => {
    if (a.result === 'win') wins++;
    else if (a.result === 'draw') draws++;
    else if (a.result === 'loss') losses++;

    sumAcpl += a.userAcpl;
    sumAcc += a.userAccuracy;

    for (const ph of ['opening', 'middlegame', 'endgame'] as GamePhase[]) {
      const pm = a.phases?.[ph];
      if (pm && pm.moveCount > 0) {
        phaseSums[ph].acc += pm.accuracy;
        phaseSums[ph].acpl += pm.acpl;
        phaseSums[ph].blunders += pm.blunders;
        phaseSums[ph].count++;
      }
    }

    a.mistakes.forEach(m => {
      allMistakes.push(m);
      if (m.hangingPieceType) {
        blunderedPieces[m.hangingPieceType] = (blunderedPieces[m.hangingPieceType] || 0) + 1;
      }
    });

    if (a.opening) {
      const key = a.opening.eco || a.opening.name;
      const cur = openingsStats.get(key) || {
        name: a.opening.name,
        eco: a.opening.eco,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        acplSum: 0,
        accSum: 0
      };
      cur.played++;
      if (a.result === 'win') cur.wins++;
      else if (a.result === 'draw') cur.draws++;
      else if (a.result === 'loss') cur.losses++;
      cur.acplSum += a.userAcpl;
      cur.accSum += a.userAccuracy;
      openingsStats.set(key, cur);
    }
  });

  const totalAnalyzed = analyses.length;
  const overallAcpl = Math.round((sumAcpl / totalAnalyzed) * 10) / 10;
  const overallAccuracy = Math.round((sumAcc / totalAnalyzed) * 10) / 10;
  const winRate = Math.round((wins / totalAnalyzed) * 100);

  const phaseBreakdown: Record<GamePhase, { accuracy: number, acpl: number, blunderRate: number }> = {
    opening: {
      accuracy: phaseSums.opening.count ? Math.round(phaseSums.opening.acc / phaseSums.opening.count) : 0,
      acpl: phaseSums.opening.count ? Math.round(phaseSums.opening.acpl / phaseSums.opening.count) : 0,
      blunderRate: Math.round((phaseSums.opening.blunders / totalAnalyzed) * 10) / 10
    },
    middlegame: {
      accuracy: phaseSums.middlegame.count ? Math.round(phaseSums.middlegame.acc / phaseSums.middlegame.count) : 0,
      acpl: phaseSums.middlegame.count ? Math.round(phaseSums.middlegame.acpl / phaseSums.middlegame.count) : 0,
      blunderRate: Math.round((phaseSums.middlegame.blunders / totalAnalyzed) * 10) / 10
    },
    endgame: {
      accuracy: phaseSums.endgame.count ? Math.round(phaseSums.endgame.acc / phaseSums.endgame.count) : 0,
      acpl: phaseSums.endgame.count ? Math.round(phaseSums.endgame.acpl / phaseSums.endgame.count) : 0,
      blunderRate: Math.round((phaseSums.endgame.blunders / totalAnalyzed) * 10) / 10
    }
  };

  const topOpenings = Array.from(openingsStats.values())
    .map(o => ({
      name: o.name,
      eco: o.eco,
      played: o.played,
      wins: o.wins,
      draws: o.draws,
      losses: o.losses,
      winRate: Math.round((o.wins / o.played) * 100),
      acpl: Math.round(o.acplSum / o.played),
      accuracy: Math.round(o.accSum / o.played)
    }))
    .sort((a, b) => b.played - a.played)
    .slice(0, 6);

  const trends = analyses.map((a, i) => ({
    gameIndex: i + 1,
    date: a.date,
    opponent: a.opponent,
    acpl: a.userAcpl,
    accuracy: a.userAccuracy,
    blunders: a.mistakes.filter(m => m.classification === 'blunder').length
  }));

  const weaknesses = generateWeaknessReports(analyses);
  const recommendations = generateTrainingRecommendations(analyses, weaknesses);

  return {
    totalGames: totalGamesInHistory,
    totalGamesAnalyzed: totalAnalyzed,
    wins,
    draws,
    losses,
    winRate,
    overallAcpl,
    overallAccuracy,
    phaseBreakdown,
    topOpenings,
    trends,
    weaknesses,
    recurringMistakes: allMistakes.slice(0, 20),
    blunderedPieces,
    recommendations
  };
}
