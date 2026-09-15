import type { MoveClassificationType } from './classification';

export interface EngineEvaluation {
  score?: {
    value: number; // centipawns or mate distance
    type: 'cp' | 'mate';
  };
  depth?: number;
  pv?: string;
  bestmove?: string;
}

export interface AnalyzedMove {
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  evalBefore: EngineEvaluation;
  evalAfter: EngineEvaluation;
  evalLoss: number;
  bestMove?: string;
  pv?: string;
  depth?: number;
  classification?: MoveClassificationType;
  accuracy?: number;
}
