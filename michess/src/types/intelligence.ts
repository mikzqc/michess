import type { MoveClassificationType } from './classification';
import type { GameSource } from './history';

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

export interface PhaseMetric {
  moveCount: number;
  acpl: number; // Average Centipawn Loss
  accuracy: number; // Average move accuracy (0-100)
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  bestMoves: number;
  misses: number;
}

export type MistakeType = 
  | 'missed_tactic' 
  | 'blunder' 
  | 'hanging_piece' 
  | 'missed_mate' 
  | 'endgame_mistake' 
  | 'opening_advantage_loss';

export interface DetectedMistake {
  id: string;
  gameId: string;
  opponent: string;
  date: string;
  moveNumber: number;
  san: string;
  uci: string;
  color: 'w' | 'b';
  fenBefore: string;
  fenAfter: string;
  bestMove?: string;
  pv?: string;
  evalBeforeVal?: number; // In centipawns or mate distance
  evalAfterVal?: number;
  evalLoss: number;
  classification: MoveClassificationType;
  phase: GamePhase;
  type: MistakeType;
  hangingPieceType?: 'q' | 'r' | 'b' | 'n' | 'p';
  explanation: string;
}

export interface GameIntelligenceAnalysis {
  gameId: string;
  pgn: string;
  date: string;
  opponent: string;
  userColor: 'w' | 'b';
  result: 'win' | 'loss' | 'draw' | '*';
  source: GameSource;
  opening?: {
    name: string;
    eco: string;
  };
  totalMoves: number;
  userAccuracy: number;
  userAcpl: number;
  phases: Record<GamePhase, PhaseMetric>;
  mistakes: DetectedMistake[];
  analyzedAt: number;
}

export type WeaknessCategory = 'tactics' | 'openings' | 'middlegame' | 'endgame' | 'calculation';
export type WeaknessSeverity = 'critical' | 'needs_work' | 'solid' | 'strength';

export interface WeaknessReport {
  category: WeaknessCategory;
  title: string;
  severity: WeaknessSeverity;
  score: number; // 0 (poor) to 100 (mastery)
  summary: string;
  stats: {
    label: string;
    value: string | number;
    subtext?: string;
  }[];
  examples: DetectedMistake[];
  recommendations: string[];
}

export type TrainingType = 'position_retry' | 'puzzle' | 'opening_explorer' | 'endgame_practice';

export interface TrainingRecommendation {
  id: string;
  type: TrainingType;
  title: string;
  description: string;
  actionText: string;
  category: WeaknessCategory;
  targetFen?: string;
  targetMove?: string;
  bestMove?: string;
  eco?: string;
  puzzleTheme?: string;
  mistake?: DetectedMistake;
}

export interface IntelligenceSummary {
  totalGames: number;
  totalGamesAnalyzed: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  overallAcpl: number;
  overallAccuracy: number;
  phaseBreakdown: Record<GamePhase, {
    accuracy: number;
    acpl: number;
    blunderRate: number; // per game
  }>;
  topOpenings: {
    name: string;
    eco: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
    acpl: number;
    accuracy: number;
  }[];
  trends: {
    gameIndex: number;
    date: string;
    opponent: string;
    acpl: number;
    accuracy: number;
    blunders: number;
  }[];
  weaknesses: WeaknessReport[];
  recurringMistakes: DetectedMistake[];
  blunderedPieces: Record<'q' | 'r' | 'b' | 'n' | 'p', number>;
  recommendations: TrainingRecommendation[];
}
