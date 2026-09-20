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
