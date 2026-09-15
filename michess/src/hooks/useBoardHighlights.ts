import { useState, useMemo } from 'react';
import { Chess, Move, type Square } from 'chess.js';

interface UseBoardHighlightsProps {
  game: Chess;
  history: Move[];
  playerColor?: 'white' | 'black'; // undefined means local game (both can play)
  showLegalMoves?: boolean;
}

export function useBoardHighlights({ game, history, playerColor, showLegalMoves = true }: UseBoardHighlightsProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);

  // Calculate Check Square
  const checkSquare = useMemo(() => {
    if (!game.inCheck()) return null;
    // Find the king of the side to move
    const turn = game.turn();
    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === turn) {
          // Columns are a-h (97-104), Rows are 8-1
          const file = String.fromCharCode(97 + c);
          const rank = 8 - r;
          return `${file}${rank}`;
        }
      }
    }
    return null;
  }, [game]);

  // Last Move Squares
  const lastMove = useMemo(() => {
    if (history.length === 0) return null;
    return history[history.length - 1];
  }, [history]);

  const clearSelection = () => {
    setSelectedSquare(null);
    setLegalMoves([]);
  };

  const handleSquareClick = (square: string) => {
    // If we click on a square that is a legal move, it means we are making a move.
    // However, the actual move logic is usually handled by `onPieceDrop` or we can return the move if it's a click-move.
    // To make this hook reusable for BOTH visual and click-to-move, we can just return the intended move.
    
    // Check if clicked square is a legal move destination
    const move = legalMoves.find((m) => m.to === square);
    if (move && selectedSquare) {
      clearSelection();
      return { from: selectedSquare, to: square };
    }

    // Otherwise, try to select the piece on the clicked square
    const piece = game.get(square as Square);
    if (piece) {
      // Check if it's the player's turn and color
      const isPlayerTurn = !playerColor || piece.color === playerColor[0];
      if (isPlayerTurn) {
        const moves = game.moves({ square: square as Square, verbose: true }) as Move[];
        if (moves.length > 0) {
          setSelectedSquare(square);
          setLegalMoves(moves);
          return null;
        }
      }
    }
    
    // If clicking an empty square or opponent's piece without a pending valid move, clear
    clearSelection();
    return null;
  };

  const handlePieceDrag = (args: any) => {
    const square = args.square;
    if (!square) return;
    const pieceStr = typeof args.piece === 'string' ? args.piece : args.piece.pieceType;
    if (!pieceStr) return;
    
    // piece is like "wP" or "bN"
    const color = pieceStr[0];
    const isPlayerTurn = !playerColor || color === playerColor[0];
    if (isPlayerTurn) {
      const moves = game.moves({ square: square as Square, verbose: true }) as Move[];
      setSelectedSquare(square);
      setLegalMoves(moves);
    }
  };

  const handlePieceDropEnd = () => {
    clearSelection();
  };

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // 1. Last Move Highlight (subtle yellow/green)
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: 'rgba(255, 255, 0, 0.4)', transition: 'background-color 0.2s ease' };
      styles[lastMove.to] = { backgroundColor: 'rgba(255, 255, 0, 0.4)', transition: 'background-color 0.2s ease' };
    }

    // 2. Check Highlight (red radial gradient)
    if (checkSquare) {
      const isMate = game.isCheckmate();
      styles[checkSquare] = {
        background: isMate 
          ? 'radial-gradient(circle, rgba(220,38,38,0.9) 0%, rgba(220,38,38,0.4) 100%)' // Stronger red for mate
          : 'radial-gradient(circle, rgba(220,38,38,0.7) 0%, rgba(220,38,38,0) 80%)', // Subtle red for check
        borderRadius: '50%',
        transition: 'background 0.2s ease-in-out'
      };
    }

    // 3. Selected Square Highlight
    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: 'rgba(123, 153, 203, 0.5)', transition: 'background-color 0.15s ease' };
    }

    // 4. Legal Moves Highlight
    if (showLegalMoves) {
      legalMoves.forEach((m) => {
        const isCapture = m.flags.includes('c') || m.flags.includes('e');
        
        styles[m.to] = {
          ...styles[m.to],
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        };
        
        if (isCapture) {
          // Distinct ring for capture (a hollow circle)
          styles[m.to].backgroundImage = `radial-gradient(transparent 0%, transparent 79%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0.3) 100%)`;
        } else {
          // Subtle dot for normal move
          styles[m.to].backgroundImage = `radial-gradient(circle, rgba(0,0,0,0.3) 20%, transparent 21%)`;
        }
      });
    }

    return styles;
  }, [lastMove, checkSquare, selectedSquare, legalMoves, showLegalMoves]);

  return {
    squareStyles,
    handleSquareClick,
    handlePieceDrag,
    handlePieceDropEnd,
    clearSelection
  };
}
