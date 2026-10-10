export interface Opening {
  name: string;
  eco: string;
}

export type OpeningsDB = Record<string, Opening>;

let cachedOpenings: OpeningsDB | null = null;

export async function getOpeningsDB(): Promise<OpeningsDB> {
  if (cachedOpenings) return cachedOpenings;
  try {
    const res = await fetch('/openings.json');
    if (res.ok) {
      cachedOpenings = await res.json();
      return cachedOpenings!;
    }
  } catch (e) {
    console.error('Failed to load openings', e);
  }
  return {};
}

// Converts an array of SAN moves like ['e4', 'e5', 'Nf3'] 
// into a normalized PGN string: "1. e4 e5 2. Nf3"
export function formatMovesToPGN(moves: string[]): string {
  let pgn = '';
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) {
      if (i > 0) pgn += ' ';
      pgn += `${Math.floor(i / 2) + 1}. ${moves[i]}`;
    } else {
      pgn += ` ${moves[i]}`;
    }
  }
  return pgn;
}

// Converts a PGN move text (e.g. "1. e4 e5 2. Nf3") into an array of SAN moves ['e4', 'e5', 'Nf3']
export function parsePGNToMoves(pgn: string): string[] {
  if (!pgn) return [];
  // Strip comments in braces or brackets
  const clean = pgn.replace(/\{[^}]*\}/g, '').replace(/\[[^\]]*\]/g, '');
  const tokens = clean.trim().split(/\s+/).filter(Boolean);
  const moves: string[] = [];
  for (const token of tokens) {
    // Skip move numbers like "1.", "12...", "1..."
    if (/^\d+\.+$/.test(token)) continue;
    // Skip results
    if (token === '1-0' || token === '0-1' || token === '1/2-1/2' || token === '*') continue;
    moves.push(token);
  }
  return moves;
}

// Finds the longest matching opening for a given move history
export function findOpening(moves: string[], db: OpeningsDB): { opening: Opening | null, matchLength: number } {
  let longestMatch: Opening | null = null;
  let matchLength = 0;

  // Try progressively longer sequences starting from length 1 up to max 30 moves
  const maxSearchDepth = Math.min(moves.length, 30);
  
  for (let i = 1; i <= maxSearchDepth; i++) {
    const sequence = formatMovesToPGN(moves.slice(0, i));
    if (db[sequence]) {
      longestMatch = db[sequence];
      matchLength = i;
    }
  }

  return { opening: longestMatch, matchLength };
}

export interface ContinuationMove {
  san: string;
  count: number;
  frequencyPct: number;
  openingName?: string;
  eco?: string;
  sampleVariation?: string;
}

// Returns continuation moves with line counts from the opening database
export function getContinuations(moves: string[], db: OpeningsDB): ContinuationMove[] {
  const prefixLen = moves.length;
  const moveMap = new Map<string, {
    count: number;
    directName?: string;
    directEco?: string;
    sampleVariation?: string;
  }>();

  let totalVariations = 0;

  for (const [pgn, info] of Object.entries(db)) {
    const tokens = parsePGNToMoves(pgn);
    if (tokens.length <= prefixLen) continue;

    let matches = true;
    for (let i = 0; i < prefixLen; i++) {
      if (tokens[i] !== moves[i]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;

    const nextSan = tokens[prefixLen];
    const isDirectMatch = tokens.length === prefixLen + 1;

    let existing = moveMap.get(nextSan);
    if (!existing) {
      existing = { count: 0 };
      moveMap.set(nextSan, existing);
    }

    existing.count++;
    totalVariations++;

    if (isDirectMatch) {
      existing.directName = info.name;
      existing.directEco = info.eco;
    }
    if (!existing.sampleVariation && info.name) {
      existing.sampleVariation = info.name;
    }
  }

  const results: ContinuationMove[] = [];
  for (const [san, data] of moveMap.entries()) {
    results.push({
      san,
      count: data.count,
      frequencyPct: totalVariations > 0 ? Math.round((data.count / totalVariations) * 100) : 0,
      openingName: data.directName,
      eco: data.directEco,
      sampleVariation: data.sampleVariation
    });
  }

  return results.sort((a, b) => b.count - a.count);
}

export interface MainLineInfo {
  pgn: string;
  moves: string[];
  name: string;
  eco: string;
}

// Finds the most representative main line from the current position
export function getMainLine(moves: string[], db: OpeningsDB): MainLineInfo | null {
  const prefixLen = moves.length;
  let bestLine: { pgn: string; moves: string[]; info: Opening } | null = null;

  for (const [pgn, info] of Object.entries(db)) {
    const tokens = parsePGNToMoves(pgn);
    if (tokens.length < prefixLen) continue;

    let matches = true;
    for (let i = 0; i < prefixLen; i++) {
      if (tokens[i] !== moves[i]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;

    const isMainLine = info.name.toLowerCase().includes('main line');

    if (!bestLine) {
      bestLine = { pgn, moves: tokens, info };
    } else {
      const bestIsMainLine = bestLine.info.name.toLowerCase().includes('main line');
      if (isMainLine && !bestIsMainLine) {
        bestLine = { pgn, moves: tokens, info };
      } else if (tokens.length > bestLine.moves.length && (isMainLine || !bestIsMainLine)) {
        bestLine = { pgn, moves: tokens, info };
      }
    }
  }

  if (!bestLine) return null;
  return {
    pgn: bestLine.pgn,
    moves: bestLine.moves,
    name: bestLine.info.name,
    eco: bestLine.info.eco
  };
}

// Searches openings by name or ECO
export function searchOpenings(query: string, db: OpeningsDB, limit = 20): Array<{ pgn: string; opening: Opening; moves: string[] }> {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  const results: Array<{ pgn: string; opening: Opening; moves: string[] }> = [];

  for (const [pgn, info] of Object.entries(db)) {
    if (info.name.toLowerCase().includes(q) || info.eco.toLowerCase() === q) {
      results.push({
        pgn,
        opening: info,
        moves: parsePGNToMoves(pgn)
      });
      if (results.length >= limit) break;
    }
  }

  return results;
}
