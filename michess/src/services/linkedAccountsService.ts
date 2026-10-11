import { parsePgnMetadata } from '../utils/importUtils';
import type { HistoryGame } from '../types/history';
import type { PlatformProfileInfo } from '../types/linkedAccounts';

/**
 * Validates whether a Chess.com username exists via public API.
 */
export async function validateChesscomUser(username: string): Promise<{ valid: boolean; profile?: PlatformProfileInfo; error?: string }> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return { valid: false, error: 'Username cannot be empty.' };

  try {
    const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(cleanUsername)}`);
    if (res.status === 404) {
      return { valid: false, error: `Chess.com user "${username}" was not found.` };
    }
    if (!res.ok) {
      return { valid: false, error: `Chess.com API error (HTTP ${res.status}).` };
    }

    const data = await res.json();
    return {
      valid: true,
      profile: {
        username: data.username || cleanUsername,
        avatarUrl: data.avatar,
        title: data.title
      }
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Failed to connect to Chess.com API.' };
  }
}

/**
 * Validates whether a Lichess username exists via public API.
 */
export async function validateLichessUser(username: string): Promise<{ valid: boolean; profile?: PlatformProfileInfo; error?: string }> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return { valid: false, error: 'Username cannot be empty.' };

  try {
    const res = await fetch(`https://lichess.org/api/user/${encodeURIComponent(cleanUsername)}`);
    if (res.status === 404) {
      return { valid: false, error: `Lichess user "${username}" was not found.` };
    }
    if (!res.ok) {
      return { valid: false, error: `Lichess API error (HTTP ${res.status}).` };
    }

    const data = await res.json();
    const blitzRating = data.perfs?.blitz?.rating;
    const rapidRating = data.perfs?.rapid?.rating;
    const rating = rapidRating || blitzRating;

    return {
      valid: true,
      profile: {
        username: data.username || cleanUsername,
        title: data.title,
        rating
      }
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Failed to connect to Lichess API.' };
  }
}

/**
 * Fetches recent games from Chess.com for a player and transforms them into HistoryGame records.
 */
export async function fetchRecentChesscomGames(username: string, max: number = 30): Promise<HistoryGame[]> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return [];

  const archivesRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(cleanUsername)}/games/archives`);
  if (!archivesRes.ok) {
    if (archivesRes.status === 404) throw new Error(`User "${username}" not found on Chess.com.`);
    throw new Error(`Chess.com archives error: HTTP ${archivesRes.status}`);
  }

  const { archives } = await archivesRes.json();
  if (!archives || archives.length === 0) return [];

  const rawGames: any[] = [];
  // Traverse archives backwards starting with the most recent month
  for (let i = archives.length - 1; i >= 0; i--) {
    const monthRes = await fetch(archives[i]);
    if (!monthRes.ok) continue;
    const { games } = await monthRes.json();
    if (games && games.length > 0) {
      // Reverse to get newest games first
      const reversed = [...games].reverse();
      rawGames.push(...reversed);
    }
    if (rawGames.length >= max) break;
  }

  const sliced = rawGames.slice(0, max);
  const historyGames: HistoryGame[] = [];

  for (const g of sliced) {
    if (!g.pgn) continue;

    const match = g.url?.match(/chess\.com\/game\/.*?\/([0-9]+)/);
    const id = match ? `chesscom-${match[1]}` : `chesscom-${g.end_time || Date.now()}`;
    const parsed = parsePgnMetadata(g.pgn, id);

    if (parsed.isValid) {
      // Match timestamp from end_time or date
      const timestamp = g.end_time ? g.end_time * 1000 : Date.now();
      historyGames.push({
        id,
        pgn: g.pgn,
        white: parsed.white || g.white?.username || 'White',
        black: parsed.black || g.black?.username || 'Black',
        result: parsed.result || '*',
        date: parsed.date || new Date(timestamp).toISOString().split('T')[0],
        event: parsed.event || 'Chess.com Game',
        opening: parsed.opening,
        startingFen: parsed.startingFen,
        source: 'chesscom',
        timestamp,
        reviewed: false,
        moveCount: parsed.moveCount || 0,
        externalUrl: g.url
      });
    }
  }

  return historyGames;
}

/**
 * Fetches recent games from Lichess for a player and transforms them into HistoryGame records.
 */
export async function fetchRecentLichessGames(username: string, max: number = 30): Promise<HistoryGame[]> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return [];

  const response = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(cleanUsername)}?max=${max}&pgnInJson=true&opening=true`, {
    headers: { 'Accept': 'application/x-ndjson' }
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error(`User "${username}" not found on Lichess.`);
    throw new Error(`Lichess API error: HTTP ${response.status}`);
  }

  const text = await response.text();
  if (!text.trim()) return [];

  const lines = text.split('\n').filter(l => l.trim());
  const historyGames: HistoryGame[] = [];

  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      const id = `lichess-${data.id}`;
      const pgn = data.pgn || '';
      if (!pgn) continue;

      const parsed = parsePgnMetadata(pgn, id);
      const timestamp = data.createdAt || (data.lastMoveAt ? data.lastMoveAt : Date.now());
      const openingName = data.opening?.name || parsed.opening;

      historyGames.push({
        id,
        pgn,
        white: data.players?.white?.user?.name || parsed.white || 'White',
        black: data.players?.black?.user?.name || parsed.black || 'Black',
        result: parsed.result || (data.winner === 'white' ? '1-0' : data.winner === 'black' ? '0-1' : '1/2-1/2'),
        date: parsed.date || new Date(timestamp).toISOString().split('T')[0],
        event: data.speed ? `Lichess ${data.speed}` : parsed.event,
        opening: openingName,
        startingFen: parsed.startingFen,
        source: 'lichess',
        timestamp,
        reviewed: false,
        moveCount: parsed.moveCount || 0,
        externalUrl: `https://lichess.org/${data.id}`
      });
    } catch {}
  }

  return historyGames;
}
