export interface MaterialState {
  whiteCaptured: string[]; // Pieces captured BY white (these are black pieces: p, n, b, r, q)
  blackCaptured: string[]; // Pieces captured BY black (these are white pieces: P, N, B, R, Q)
  whiteAdvantage: number;  // Positive if white is ahead
  blackAdvantage: number;  // Positive if black is ahead
}

const PIECE_VALUES: Record<string, number> = {
  'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9,
  'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9
};

const STARTING_COUNTS: Record<string, number> = {
  'p': 8, 'n': 2, 'b': 2, 'r': 2, 'q': 1,
  'P': 8, 'N': 2, 'B': 2, 'R': 2, 'Q': 1
};



export function calculateMaterial(fen: string): MaterialState {
  const boardFen = fen.split(' ')[0];
  
  const currentCounts: Record<string, number> = {
    'p': 0, 'n': 0, 'b': 0, 'r': 0, 'q': 0,
    'P': 0, 'N': 0, 'B': 0, 'R': 0, 'Q': 0
  };

  for (let i = 0; i < boardFen.length; i++) {
    const char = boardFen[i];
    if (currentCounts[char] !== undefined) {
      currentCounts[char]++;
    }
  }

  const whiteCaptured: string[] = []; // Black pieces missing
  const blackCaptured: string[] = []; // White pieces missing
  
  let whiteCapturedValue = 0;
  let blackCapturedValue = 0;

  // Check missing black pieces (captured by White)
  ['q', 'r', 'b', 'n', 'p'].forEach(piece => {
    const missing = Math.max(0, STARTING_COUNTS[piece] - currentCounts[piece]);
    for (let i = 0; i < missing; i++) {
      whiteCaptured.push(piece);
      whiteCapturedValue += PIECE_VALUES[piece];
    }
  });

  // Check missing white pieces (captured by Black)
  ['Q', 'R', 'B', 'N', 'P'].forEach(piece => {
    const missing = Math.max(0, STARTING_COUNTS[piece] - currentCounts[piece]);
    for (let i = 0; i < missing; i++) {
      blackCaptured.push(piece);
      blackCapturedValue += PIECE_VALUES[piece];
    }
  });
  
  const netAdvantage = whiteCapturedValue - blackCapturedValue;

  return {
    whiteCaptured,
    blackCaptured,
    whiteAdvantage: netAdvantage > 0 ? netAdvantage : 0,
    blackAdvantage: netAdvantage < 0 ? -netAdvantage : 0
  };
}
