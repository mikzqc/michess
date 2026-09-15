import { useState, useEffect, useCallback, useRef } from 'react';
import { useChess } from './useChess';
import { stockfishEngine, type EngineInfo } from '../services/stockfish';

export type Difficulty = number; // 1 to 20
export type PlayerColor = 'white' | 'black';

interface UseComputerGameProps {
  difficulty: Difficulty;
  playerColor: PlayerColor;
  onGameOver?: (result: string) => void;
  onComputerMove?: () => void;
}

export function useComputerGame({ difficulty, playerColor, onGameOver, onComputerMove }: UseComputerGameProps) {
  const chess = useChess();
  const { game, fen, makeMove, resetGame } = chess;
  
  const [isThinking, setIsThinking] = useState(false);
  const [engineInfo, setEngineInfo] = useState<EngineInfo>({});
  
  // We use refs to avoid stale closures in the worker message callbacks
  const gameRef = useRef(game);
  const colorRef = useRef(playerColor);
  const difficultyRef = useRef(difficulty);
  const thinkingRef = useRef(isThinking);

  useEffect(() => {
    gameRef.current = game;
    colorRef.current = playerColor;
    difficultyRef.current = difficulty;
    thinkingRef.current = isThinking;
  }, [game, playerColor, difficulty, isThinking]);

  // Determine game over state
  useEffect(() => {
    if (game.isGameOver()) {
      let result = 'Draw';
      if (game.isCheckmate()) {
        result = game.turn() === 'w' ? 'Black wins by Checkmate' : 'White wins by Checkmate';
      } else if (game.isStalemate()) {
        result = 'Draw by Stalemate';
      } else if (game.isThreefoldRepetition()) {
        result = 'Draw by Repetition';
      } else if (game.isInsufficientMaterial()) {
        result = 'Draw by Insufficient Material';
      } else if (game.isDraw()) {
        // Fifty-move rule or other
        result = 'Draw';
      }
      
      if (onGameOver) {
        onGameOver(result);
      }
      
      stockfishEngine.stop();
    }
  }, [fen, game, onGameOver]);

  const triggerComputerMove = useCallback(async () => {
    const currentGame = gameRef.current;
    if (currentGame.isGameOver()) return;
    if (currentGame.turn() !== colorRef.current[0]) {
      // It's the computer's turn
      setIsThinking(true);
      thinkingRef.current = true;
      
      // Level is 1 to 20
      const level = Math.max(1, Math.min(20, difficultyRef.current));
      
      // Stockfish Skill Level ranges from 0 to 20
      // Map UI level 1-20 to Skill Level 0-20
      const skillLevel = Math.round((level - 1) * (20 / 19)); 
      
      // Depth progression: 1 at level 1, 18 at level 20
      const depth = Math.floor(1 + (level - 1) * (17 / 19));
      
      // Movetime progression: 50ms at level 1, 2000ms at level 20
      const movetime = Math.floor(50 + (level - 1) * (1950 / 19));
      
      try {
        const response = await stockfishEngine.analyzePosition(currentGame.fen(), { depth, movetime, skillLevel });
        
        // Ensure the game state hasn't changed or reset while we were thinking
        // And ensure it is still our turn (no race conditions)
         if (gameRef.current.fen() === currentGame.fen() && gameRef.current.turn() !== colorRef.current[0]) {
           if (response.bestmove) {
             const from = response.bestmove.substring(0, 2);
             const to = response.bestmove.substring(2, 4);
             const promotion = response.bestmove.length > 4 ? response.bestmove.substring(4) : undefined;
             
             const move = makeMove({ from, to, promotion });
             if (move && onComputerMove) {
               onComputerMove();
             }
           }
           if (response.info) {
             setEngineInfo(response.info);
           }
        }
      } catch (e) {
        console.error("Engine analysis failed", e);
      } finally {
        setIsThinking(false);
        thinkingRef.current = false;
      }
    }
  }, [makeMove]);

  // Handle computer's turn
  useEffect(() => {
    // If it's the computer's turn and not game over
    if (game.turn() !== playerColor[0] && !game.isGameOver() && !isThinking) {
      triggerComputerMove();
    }
  }, [fen, game, playerColor, triggerComputerMove, isThinking]);

  // Clean up on unmount or reset
  useEffect(() => {
    return () => {
      stockfishEngine.stop();
    };
  }, []);

  const handlePlayerMove = useCallback((move: { from: string; to: string; promotion?: string }) => {
    if (thinkingRef.current) return false; // Prevent moves while computer is thinking
    if (game.turn() !== playerColor[0]) return false; // Not player's turn
    
    return makeMove(move);
  }, [game, playerColor, makeMove]);

  const handleResetGame = useCallback(() => {
    stockfishEngine.stop();
    setIsThinking(false);
    thinkingRef.current = false;
    setEngineInfo({});
    resetGame();
  }, [resetGame]);

  const undoMove = useCallback(() => {
    stockfishEngine.stop();
    setIsThinking(false);
    thinkingRef.current = false;

    // We want to undo the last pair of moves if possible (player + computer)
    const historyLen = gameRef.current.history().length;
    
    if (historyLen === 0) return;

    const gameCopy = new (chess as any).game.constructor(gameRef.current.fen());
    // Load full history up to now
    gameCopy.loadPgn(gameRef.current.pgn());
    
    // Determine how many moves to undo
    let movesToUndo = 1;
    
    // If it's currently player's turn, it means computer just moved, so undo 2 moves (computer, then player)
    // If it's currently computer's turn, it means player just moved (maybe computer hasn't finished thinking), so undo 1 move (player)
    if (gameCopy.turn() === colorRef.current[0]) {
      // It's player's turn now. We want to undo back to player's PREVIOUS turn
      if (historyLen >= 2) {
        movesToUndo = 2;
      } else {
        movesToUndo = 1;
      }
    } else {
      // It's computer's turn now. Player just moved.
      movesToUndo = 1;
    }

    for (let i = 0; i < movesToUndo; i++) {
      gameCopy.undo();
    }
    
    chess.undo(movesToUndo);
  }, [chess, game, colorRef, gameRef]);

  return {
    ...chess,
    makeMove: handlePlayerMove,
    resetGame: handleResetGame,
    isThinking,
    engineInfo,
    triggerUndo: undoMove
  };
}
