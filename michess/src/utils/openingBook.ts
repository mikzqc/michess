import { Chess } from 'chess.js';

const openingLines = [
  // King's Pawn - Ruy Lopez
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3", // Ruy Lopez Closed
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4 d4", // Ruy Lopez Open
  "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6", // Ruy Lopez Exchange
  "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4", // Berlin Defense
  "e4 e5 Nf3 Nc6 Bb5 f5", // Schliemann

  // Italian Game & Two Knights
  "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3", // Giuoco Pianissimo
  "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+", // Giuoco Piano
  "e4 e5 Nf3 Nc6 Bc4 Nf6 d4 exd4 O-O", // Max Lange
  "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6", // Two Knights Polerio

  // Other e4 e5
  "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nc3", // Scotch
  "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5", // Scotch Classic
  "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5", // Petrov
  "e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7", // Philidor
  "e4 e5 f4 exf4 Nf3 g5 h4", // King's Gambit
  "e4 e5 Nc3 Nf6 f4 d5", // Vienna Game
  "e4 e5 d4 exd4 Qxd4 Nc6", // Center Game
  "e4 e5 Nf3 Nc6 Bc4 h6", // Anti-Fried Liver

  // Sicilian Defense
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5", // Najdorf English Attack
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6 Be2", // Scheveningen
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3", // Dragon Yugoslav
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6", // Accelerated Dragon
  "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7", // Taimanov
  "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6 Bd3", // Kan
  "e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7", // Closed Sicilian
  "e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 cxd4", // Alapin
  "e4 c5 Nf3 d6 Bb5+ Bd7", // Moscow
  "e4 c5 Nf3 Nc6 Bb5 g6", // Rossolimo

  // French Defense
  "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7", // Classical
  "e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3", // Winawer
  "e4 e6 d4 d5 Nd2 c5 exd5 Qxd5", // Tarrasch
  "e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6", // Advance
  "e4 e6 d4 d5 exd5 exd5 Bd3", // Exchange

  // Caro-Kann Defense
  "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6", // Classical
  "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Nf3 Ngf6", // Karpov
  "e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2", // Advance
  "e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3", // Exchange

  // Other e4 Defenses
  "e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7", // Pirc
  "e4 Nf6 e5 Nd5 d4 d6 Nf3", // Alekhine
  "e4 g6 d4 Bg7 Nc3 d6", // Modern
  "e4 Nc6 d4 d5", // Nimzowitsch

  // Queen's Gambit Declined
  "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O", // QGD Orthodox
  "d4 d5 c4 e6 Nc3 c5 cxd5 exd5", // Tarrasch
  "d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5", // Exchange

  // Slav & Semi-Slav
  "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4", // Slav Main
  "d4 d5 c4 c6 Nc3 Nf6 e3 e6 Nf3 Nbd7", // Semi-Slav
  "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 Bg5 h6", // Moscow

  // Queen's Gambit Accepted & Others
  "d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5", // QGA
  "d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3", // London System
  "d4 d5 Nf3 Nf6 c4 c6", // Baltic

  // Indian Defenses
  "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3", // Nimzo-Indian
  "d4 Nf6 c4 e6 Nf3 b6 g3 Ba6", // Queen's Indian
  "d4 Nf6 c4 e6 g3 d5 Bg2", // Catalan
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5", // King's Indian Mar del Plata
  "d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7", // Grunfeld Exchange
  "d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6", // Benoni
  "d4 Nf6 c4 c5 d5 b5 cxb5 a6 bxa6 Bxa6", // Benko Gambit

  // Other d4 Defenses
  "d4 f5 c4 Nf6 g3 g6 Bg2 Bg7 Nc3 O-O", // Dutch Leningrad
  "d4 f5 c4 Nf6 g3 e6 Bg2 Be7 Nc3 O-O", // Dutch Classical

  // Flank Openings
  "c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5", // English Four Knights
  "c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 Nf6", // English Symmetrical
  "c4 Nf6 Nc3 e6 e4 d5", // Mikenas-Carls
  "Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7 c4", // Reti
  "Nf3 Nf6 c4 g6 b3 Bg7 Bb2 O-O", // Reti Setup
  "f4 d5 Nf3 Nf6 e3 c5", // Bird's
  "b3 e5 Bb2 Nc6 e3 Nf6" // Nimzo-Larsen
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
