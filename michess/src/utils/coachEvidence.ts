import { Chess } from 'chess.js';
import type { AnalyzedMove } from '../types/review';
import type { CoachMoveEvidence, TacticalFacts } from '../types/coach';

const PIECE_NAMES: Record<string, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King'
};

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

/**
 * Finds unprotected/hanging pieces on the board for a given side.
 */
export function findHangingPieces(fen: string, color: 'w' | 'b'): string[] {
  try {
    const chess = new Chess(fen);
    const board = chess.board();
    const opponentMoves = chess.moves({ verbose: true }); // Moves of the side to move

    // If it's not the opponent's turn, we switch turn to check their legal attacks
    const activeColor = fen.split(' ')[1] as 'w' | 'b';
    let oppAttacks = opponentMoves;
    if (activeColor === color) {
      const fenTokens = fen.split(' ');
      fenTokens[1] = color === 'w' ? 'b' : 'w';
      const oppChess = new Chess(fenTokens.join(' '));
      oppAttacks = oppChess.moves({ verbose: true });
    }

    const hangingList: string[] = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece || piece.color !== color || piece.type === 'k') continue;

        const square = `${String.fromCharCode('a'.charCodeAt(0) + c)}${8 - r}`;
        const pieceVal = PIECE_VALUES[piece.type] || 0;
        const attacksOnPiece = oppAttacks.filter(m => m.to === square && m.captured);

        for (const atk of attacksOnPiece) {
          const atkVal = PIECE_VALUES[atk.piece] || 0;
          if (atkVal < pieceVal) {
            hangingList.push(`${PIECE_NAMES[piece.type]} on ${square}`);
            break;
          }
          if (atkVal === pieceVal) {
            // Check if protected by simulating recapture
            try {
              const sim = new Chess(fen);
              sim.move(atk);
              const recaptures = sim.moves({ verbose: true }).filter(m => m.to === square && m.captured);
              if (recaptures.length === 0) {
                hangingList.push(`${PIECE_NAMES[piece.type]} on ${square}`);
                break;
              }
            } catch {}
          }
        }
      }
    }

    return hangingList;
  } catch {
    return [];
  }
}

/**
 * Derives SAN notation from a UCI move string given the position FEN.
 */
export function getSanFromUci(fen: string, uci?: string): string | undefined {
  if (!uci || uci.length < 4 || uci === '(none)') return undefined;
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = (uci.slice(4, 5) || '').toLowerCase() || undefined;
    const move = chess.move({ from, to, promotion: promotion as any });
    return move ? move.san : uci;
  } catch {
    return uci;
  }
}

/**
 * Computes material balance (White total - Black total).
 */
export function calculateMaterialCount(fen: string): { white: number; black: number; balance: number } {
  const boardPart = fen.split(' ')[0];
  let white = 0;
  let black = 0;

  for (const char of boardPart) {
    if (char === '/' || (!isNaN(parseInt(char, 10)) && parseInt(char, 10) > 0)) continue;
    const lower = char.toLowerCase();
    const val = PIECE_VALUES[lower] || 0;
    if (char === char.toUpperCase()) {
      white += val;
    } else {
      black += val;
    }
  }

  return { white, black, balance: white - black };
}

/**
 * Compiles rich, deterministic chess evidence for a move to feed into the AI Coach.
 */
export function extractCoachMoveEvidence(
  move: AnalyzedMove,
  meta?: {
    gameTitle?: string;
    openingName?: string;
    openingEco?: string;
  }
): CoachMoveEvidence {
  const isCheck = move.san.includes('+') || move.san.includes('#');
  const isCheckmate = move.san.includes('#');
  const isCapture = move.san.includes('x');
  const isCastling = move.san.startsWith('O-O') || move.san.startsWith('0-0');

  let movedPiece = 'Pawn';
  let capturedPiece: string | undefined;

  try {
    const cBefore = new Chess(move.fenBefore);
    const piece = cBefore.get(move.uci.slice(0, 2) as any);
    if (piece) {
      movedPiece = PIECE_NAMES[piece.type] || 'Piece';
    }

    if (isCapture) {
      const targetSq = move.uci.slice(2, 4);
      const targetPiece = cBefore.get(targetSq as any);
      if (targetPiece) {
        capturedPiece = PIECE_NAMES[targetPiece.type];
      } else if (movedPiece === 'Pawn' && targetSq[0] !== move.uci[0]) {
        // En passant
        capturedPiece = 'Pawn (en passant)';
      }
    }
  } catch {}

  const isPromotion = move.uci.length === 5;
  const promotedTo = isPromotion ? PIECE_NAMES[move.uci[4].toLowerCase()] : undefined;

  const hangingPiecesBefore = findHangingPieces(move.fenBefore, move.color);
  const hangingPiecesAfter = findHangingPieces(move.fenAfter, move.color);

  const matBefore = calculateMaterialCount(move.fenBefore);
  const matAfter = calculateMaterialCount(move.fenAfter);
  const materialBalanceChange = move.color === 'w'
    ? matAfter.balance - matBefore.balance
    : matBefore.balance - matAfter.balance;

  const tacticalFacts: TacticalFacts = {
    isCheck,
    isCheckmate,
    isCapture,
    capturedPiece,
    movedPiece,
    isPromotion,
    promotedTo,
    isCastling,
    hangingPiecesBefore,
    hangingPiecesAfter,
    materialBalanceChange
  };

  const bestMoveSan = getSanFromUci(move.fenBefore, move.bestMove);

  return {
    gameTitle: meta?.gameTitle,
    moveNumber: move.moveNumber,
    color: move.color,
    playerColorName: move.color === 'w' ? 'White' : 'Black',
    san: move.san,
    uci: move.uci,
    fenBefore: move.fenBefore,
    fenAfter: move.fenAfter,
    evalBefore: move.evalBefore,
    evalAfter: move.evalAfter,
    evalLoss: move.evalLoss,
    classification: move.classification,
    bestMove: move.bestMove,
    bestMoveSan,
    pv: move.pv,
    depth: move.depth,
    tacticalFacts,
    opening: meta?.openingName ? {
      name: meta.openingName,
      eco: meta.openingEco
    } : undefined
  };
}
