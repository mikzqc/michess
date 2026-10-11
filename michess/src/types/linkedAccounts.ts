export type LinkedAccountPlatform = 'chesscom' | 'lichess';

export interface LinkedAccountsConfig {
  chesscomUsername: string | null;
  lichessUsername: string | null;
  autoSync: boolean;
  lastSyncChesscom: number | null;
  lastSyncLichess: number | null;
}

export interface PlatformProfileInfo {
  username: string;
  avatarUrl?: string;
  rating?: number;
  title?: string;
}

export interface SyncResult {
  platform: LinkedAccountPlatform;
  gamesFetched: number;
  newGamesAdded: number;
  error?: string;
}
