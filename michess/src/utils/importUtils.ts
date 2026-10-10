import { Chess } from 'chess.js';

export interface ImportedGameMeta {
  id: string; // Unique identifier to prevent duplicates
  white: string;
  black: string;
  result: string;
  date: string;
  event: string;
  opening: string;
  isValid: boolean;
  error?: string;
  pgn: string;
}

// Simple hash function for PGN if no ID is provided
function hashString(str: string): string {
  if (!str || typeof str !== 'string') return Math.random().toString(36).substring(2, 9);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export function parsePgnMetadata(pgn: string, providedId?: string): ImportedGameMeta {
  if (!pgn || typeof pgn !== 'string' || !pgn.trim()) {
    return {
      id: providedId || hashString(pgn || ''),
      white: 'Unknown',
      black: 'Unknown',
      result: '*',
      date: 'Unknown',
      event: 'Unknown',
      opening: 'Unknown',
      isValid: false,
      error: 'Empty or invalid PGN string.',
      pgn: pgn || ''
    };
  }

  try {
    const chess = new Chess();
    // Validate PGN by attempting to load it
    chess.loadPgn(pgn);
    
    // Some headers might be undefined, fall back to "Unknown"
    const header = chess.header();
    
    return {
      id: providedId || header['Link'] || header['Site'] || hashString(pgn),
      white: header['White'] || 'Unknown',
      black: header['Black'] || 'Unknown',
      result: header['Result'] || '*',
      date: header['Date'] || 'Unknown',
      event: header['Event'] || 'Unknown',
      opening: header['ECO'] || header['Opening'] || 'Unknown',
      isValid: true,
      pgn: pgn
    };
  } catch (err: any) {
    return {
      id: providedId || hashString(pgn),
      white: 'Unknown',
      black: 'Unknown',
      result: '*',
      date: 'Unknown',
      event: 'Unknown',
      opening: 'Unknown',
      isValid: false,
      error: err?.message || 'Invalid PGN format. Could not parse moves.',
      pgn: pgn
    };
  }
}

export async function fetchLichessGame(url: string): Promise<string> {
  // Lichess URL format: https://lichess.org/XXXXXXXX or https://lichess.org/XXXXXXXX/black
  const match = url.match(/lichess\.org\/([a-zA-Z0-9]{8,12})/);
  if (!match) {
    throw new Error('Invalid Lichess URL. Format should be https://lichess.org/12345678');
  }
  
  const gameId = match[1].slice(0, 8); // Lichess game IDs are 8 chars long for the game, 12 if including player color
  
  try {
    const response = await fetch(`https://lichess.org/game/export/${gameId}?clocks=false&evals=false&tags=true`);
    if (!response.ok) {
      if (response.status === 404) throw new Error('Game not found on Lichess.');
      throw new Error(`Lichess API returned ${response.status}`);
    }
    const pgn = await response.text();
    if (!pgn || pgn.trim() === '') throw new Error('Received empty PGN from Lichess.');
    return pgn;
  } catch (err: any) {
    throw new Error(`Failed to fetch from Lichess: ${err.message}. If this persists, please copy and paste the PGN directly.`);
  }
}

export async function fetchChesscomGame(url: string): Promise<string> {
  // Chess.com public URL format: https://www.chess.com/game/live/12345678 or /game/daily/...
  const match = url.match(/chess\.com\/game\/(live|daily)\/([0-9]+)/);
  if (!match) {
    throw new Error('Invalid Chess.com URL. Format should be https://www.chess.com/game/live/12345678');
  }
  
  // Note: Chess.com does not have a reliable open CORS endpoint for a single game ID without knowing the player username.
  // There is an undocumented endpoint: https://www.chess.com/callback/live/game/{id} which returns JSON containing the PGN,
  // but it is heavily restricted by Cloudflare and CORS.
  // We will attempt to fetch a known open proxy/API if available, but for strict client-side security, 
  // we will try chess.com's public api if possible or gracefully fail.
  // We will attempt the callback API, and if it fails, throw a clear CORS fallback error.
  
  const type = match[1];
  const id = match[2];
  
  try {
    const response = await fetch(`https://www.chess.com/callback/${type}/game/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data && data.game && data.game.pgn) {
      return data.game.pgn;
    } else {
      throw new Error('No PGN found in response');
    }
  } catch (err: any) {
    throw new Error(`Chess.com restricts direct browser retrieval. Please go to the game, click "Share", select "PGN", and paste it here instead.`);
  }
}

export async function fetchLichessUserGames(username: string, max: number): Promise<ImportedGameMeta[]> {
  try {
    const response = await fetch(`https://lichess.org/api/games/user/${username}?max=${max}&pgnInJson=true&opening=true`, {
      headers: { 'Accept': 'application/x-ndjson' }
    });
    if (!response.ok) {
      if (response.status === 404) throw new Error('User not found.');
      throw new Error(`Lichess API error: ${response.status}`);
    }
    const text = await response.text();
    if (!text.trim()) throw new Error('No games found for this user.');
    
    const lines = text.split('\n').filter(l => l.trim());
    const games = lines.map(l => {
      const data = JSON.parse(l);
      let pgn = data.pgn || '';
      // Lichess API returns raw PGN string, we just parse it.
      return parsePgnMetadata(pgn, `lichess-${data.id}`);
    });
    return games.filter(g => g.isValid);
  } catch (err: any) {
    throw new Error(`Failed to fetch Lichess games: ${err.message}`);
  }
}

export async function fetchChesscomUserGames(username: string, max: number): Promise<ImportedGameMeta[]> {
  try {
    const archivesRes = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
    if (!archivesRes.ok) {
      if (archivesRes.status === 404) throw new Error('User not found.');
      throw new Error(`Chess.com API error: ${archivesRes.status}`);
    }
    const { archives } = await archivesRes.json();
    if (!archives || archives.length === 0) {
      throw new Error('No games found for this user.');
    }

    const allGames: any[] = [];
    // Traverse backwards from most recent month
    for (let i = archives.length - 1; i >= 0; i--) {
      const monthRes = await fetch(archives[i]);
      if (!monthRes.ok) continue;
      const { games } = await monthRes.json();
      if (games && games.length > 0) {
        // Reverse so most recent games are first
        allGames.push(...games.reverse());
      }
      if (allGames.length >= max) break;
    }
    
    if (allGames.length === 0) throw new Error('No games found in recent archives.');

    const sliced = allGames.slice(0, max);
    const parsedGames = sliced.map(g => {
      // Chess.com has UUIDs or standard URLs.
      const match = g.url?.match(/chess\.com\/game\/.*?\/([0-9]+)/);
      const idStr = match ? `chesscom-${match[1]}` : undefined;
      return parsePgnMetadata(g.pgn, idStr);
    });

    return parsedGames.filter(g => g.isValid);
  } catch (err: any) {
    throw new Error(`Failed to fetch Chess.com games: ${err.message}`);
  }
}

