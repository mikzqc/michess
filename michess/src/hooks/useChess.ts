import { useState, useCallback } from 'react';
import { Chess, Move } from 'chess.js';
import { audioService } from '../services/audio';

export function useChess() {
  const [game, setGame] = useState(new Chess());
  // We keep FEN in state to trigger re-renders when the board changes
  const [fen, setFen] = useState(game.fen());
  const [history, setHistory] = useState<Move[]>([]);

  const makeMove = useCallback((move: { from: string; to: string; promotion?: string }) => {
    try {
      const gameCopy = new Chess();
      gameCopy.loadPgn(game.pgn());
      const result = gameCopy.move(move);

      if (result) {
        setGame(gameCopy);
        setFen(gameCopy.fen());
        setHistory(gameCopy.history({ verbose: true }) as Move[]);
        
        // Audio
        if (gameCopy.isGameOver()) {
          if (gameCopy.isCheckmate()) {
            audioService.play('checkmate');
          } else {
            audioService.play('stalemate');
          }
        } else if (gameCopy.inCheck()) {
          audioService.play('check');
        } else if (result.flags.includes('c') || result.flags.includes('e')) {
          audioService.play('capture');
        } else if (result.flags.includes('p')) {
          audioService.play('promote');
        } else if (result.flags.includes('k') || result.flags.includes('q')) {
          audioService.play('castle');
        } else {
          audioService.play('move');
        }

        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }, [game]);

  const resetGame = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setHistory([]);
    audioService.play('newGame');
  }, []);

  const undo = useCallback((movesToUndo: number = 1) => {
    const gameCopy = new Chess();
    gameCopy.loadPgn(game.pgn());
    
    for (let i = 0; i < movesToUndo; i++) {
      gameCopy.undo();
    }
    
    setGame(gameCopy);
    setFen(gameCopy.fen());
    setHistory(gameCopy.history({ verbose: true }) as Move[]);
  }, [game]);

  const getPgn = useCallback(() => {
    return game.pgn();
  }, [game]);

  return { game, fen, history, makeMove, resetGame, getPgn, undo };
}