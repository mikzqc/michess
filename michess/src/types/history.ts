export interface HistoryGame {
  id: string;
  pgn: string;
  white: string;
  black: string;
  result: string;
  date: string;
  event?: string;
  opening?: string;
  startingFen?: string;
  source: 'local' | 'computer' | 'import';
  timestamp: number;
  reviewed: boolean;
  is_chaos?: boolean;
  whiteAccuracy?: number;
  blackAccuracy?: number;
  overallAccuracy?: number;
  moveCount: number;
  classifications?: Record<string, number>;
  syncStatus?: 'synced' | 'pending' | 'local';
  cloudId?: string; // The UUID from Supabase
}