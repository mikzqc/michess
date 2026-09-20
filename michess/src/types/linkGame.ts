export interface LinkGame {
  id: string;
  invite_code: string;
  white_player: string | null;
  black_player: string | null;
  status: 'waiting' | 'active' | 'completed' | 'abandoned';
  fen: string;
  pgn: string;
  current_turn: 'w' | 'b';
  winner: string | null;
  // Phase 12: Time control fields
  time_control: string | null;
  initial_time_ms: number | null;
  increment_ms: number;
  white_time_ms: number | null;
  black_time_ms: number | null;
  last_move_at: string | null;
  draw_offer_by?: 'w' | 'b' | null;
  is_chaos?: boolean;
  created_at: string;
  updated_at: string;
}
