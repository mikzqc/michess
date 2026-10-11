import type { MoveClassificationType } from './classification';
import type { EngineEvaluation } from './review';

export interface TacticalFacts {
  isCheck: boolean;
  isCheckmate: boolean;
  isCapture: boolean;
  capturedPiece?: string;
  movedPiece: string;
  isPromotion?: boolean;
  promotedTo?: string;
  isCastling?: boolean;
  hangingPiecesBefore: string[];
  hangingPiecesAfter: string[];
  materialBalanceChange: number;
}

export interface CoachMoveEvidence {
  gameTitle?: string;
  moveNumber: number;
  color: 'w' | 'b';
  playerColorName: 'White' | 'Black';
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  evalBefore?: EngineEvaluation;
  evalAfter?: EngineEvaluation;
  evalLoss: number;
  classification?: MoveClassificationType;
  bestMove?: string;
  bestMoveSan?: string;
  pv?: string;
  depth?: number;
  tacticalFacts: TacticalFacts;
  opening?: {
    name: string;
    eco?: string;
  };
}

export interface FallbackAttempt {
  model: string;
  error: string;
}

export interface CoachExplanation {
  summary: string;
  move_purpose: string;
  tactical_consequences: string;
  opponent_threat: string;
  better_move?: string;
  why_better?: string;
  lesson?: string;
  model?: string;
  cached?: boolean;
  generatedAt: number;
  fallback?: boolean;
  fallbackAttempts?: FallbackAttempt[];
  apiError?: string;
}

export interface CoachRequestPayload {
  evidence: CoachMoveEvidence;
}

export interface CoachApiResponse {
  success: boolean;
  explanation?: CoachExplanation;
  rawContent?: string;
  error?: string;
  model?: string;
  fallbackAttempts?: FallbackAttempt[];
  quotaExhausted?: boolean;
  rateLimited?: boolean;
}
