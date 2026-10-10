export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface GameMessage {
  id: string;
  game_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

export interface BlockedUser {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface MessageReport {
  id?: string;
  reporter_id: string;
  reported_user_id: string;
  message_id?: string;
  message_type: 'direct' | 'game';
  reason: string;
  details?: string;
  created_at?: string;
}
