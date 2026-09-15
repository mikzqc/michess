import { Chess } from 'chess.js';

const openingLines = [
  // King's Pawn
  "e4 e5 Nf3 Nc6 Bb5 a6", // Ruy Lopez
  "e4 e5 Nf3 Nc6 Bc4 Bc5", // Italian
  "e4 e5 Nf3 Nc6 d4 exd4", // Scotch
  "e4 e5 Nf3 Nf6", // Petrov
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", // Sicilian Najdorf
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4", // Sicilian
  "e4 c5 c3", // Alapin
  "e4 e6 d4 d5 Nc3", "e4 e6 d4 d5 e5", // French
  "e4 c6 d4 d5 Nc3", "e4 c6 d4 d5 e5", // Caro-Kann
  "e4 d6 d4 Nf6 Nc3 g6", // Pirc
  "e4 Nf6 e5 Nd5 d4 d6", // Alekhine
  
  // Queen's Pawn
  "d4 d5 c4 e6 Nc3 Nf6", // QGD
  "d4 d5 c4 c6 Nf3 Nf6 Nc3", // Slav
  "d4 d5 c4 dxc4", // QGA
  "d4 Nf6 c4 e6 Nc3 Bb4", // Nimzo-Indian
  "d4 Nf6 c4 e6 Nf3 b6", // Queen's Indian
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6", // King's Indian
  "d4 Nf6 c4 g6 Nc3 d5", // Grunfeld
  "d4 f5", // Dutch
  
  // Flank Openings
  "c4 e5", "c4 c5", "c4 Nf6", // English
  "Nf3 d5", "Nf3 Nf6", // Reti
  "f4" // Bird's
];

// Key: normalized FEN (pieces, turn, castling rights)
// Value: Set of known book moves in SAN
const bookMap = new Map<string, Set<string>>();
let bookInitialized = false;

// Normalize FEN by stripping en passant, halfmove, and fullmove to avoid inconsistencies
function normalizeFen(fen: string): string {
  return fen.split(' ').slice(0, 3).join(' ');
}

function initBook() {
  if (bookInitialized) return;

  for (const line of openingLines) {
    const game = new Chess();
    const moves = line.split(' ');
    
    for (const moveSan of moves) {
      const fenBefore = normalizeFen(game.fen());
      
      if (!bookMap.has(fenBefore)) {
        bookMap.set(fenBefore, new Set());
      }
      bookMap.get(fenBefore)!.add(moveSan);

      try {
        game.move(moveSan);
      } catch (e) {
        break; // Stop parsing this line on invalid move
      }
    }
  }
  
  bookInitialized = true;
}

export function isBookMove(fenBefore: string, moveSan: string): boolean {
  if (!bookInitialized) initBook();
  
  const normalized = normalizeFen(fenBefore);
  const knownMoves = bookMap.get(normalized);
  
  if (!knownMoves) return false;
  return knownMoves.has(moveSan);
}
