import { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import type { PuzzleData } from '../types/puzzle';

export function usePuzzle() {
  const [chess] = useState(new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadRandomPuzzle = useCallback(async () => {
    setIsLoading(true);
    setIsSolved(false);
    setIsFailed(false);
    try {
      const res = await fetch('/puzzles.json');
      const puzzles: PuzzleData[] = await res.json();
      const randomPuzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
      
      setPuzzle(randomPuzzle);
      chess.load(randomPuzzle.fen);
      
      // Play the first move (opponent's move)
      const firstMove = randomPuzzle.moves[0];
      chess.move({
        from: firstMove.substring(0, 2),
        to: firstMove.substring(2, 4),
        promotion: firstMove.length === 5 ? firstMove[4] : undefined
      });
      
      setFen(chess.fen());
      setMoveIndex(1); // User needs to find moves[1]
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  }, [chess]);

  useEffect(() => {
    loadRandomPuzzle();
  }, [loadRandomPuzzle]);

  const makeMove = (move: { from: string, to: string, promotion?: string }) => {
    if (!puzzle || isSolved || isFailed) return false;

    // Build UCI string to compare
    let uci = `${move.from}${move.to}`;
    
    // In chess.js, if promotion is not provided but the move is a promotion, it fails.
    // However, if we just want to check UCI, we can assume 'q' if not provided but expected.
    // Our puzzle moves always include promotion if it's one.
    const expectedMove = puzzle.moves[moveIndex];
    if (expectedMove.length === 5 && !move.promotion) {
       move.promotion = expectedMove[4];
    }
    uci = `${move.from}${move.to}${move.promotion || ''}`;

    if (uci === expectedMove) {
      // Correct move
      try {
        chess.move(move);
        setFen(chess.fen());
        
        if (moveIndex + 1 >= puzzle.moves.length) {
          setIsSolved(true);
        } else {
          // Play opponent's response after a short delay
          const nextMoveIndex = moveIndex + 1;
          setMoveIndex(nextMoveIndex + 1);
          
          setTimeout(() => {
            const oppMove = puzzle.moves[nextMoveIndex];
            chess.move({
              from: oppMove.substring(0, 2),
              to: oppMove.substring(2, 4),
              promotion: oppMove.length === 5 ? oppMove[4] : undefined
            });
            setFen(chess.fen());
            
            if (nextMoveIndex + 1 >= puzzle.moves.length) {
              setIsSolved(true);
            }
          }, 400);
        }
        return true;
      } catch (e) {
        console.error("Invalid move caught by chess.js", e);
        return false;
      }
    } else {
      // Incorrect move
      setIsFailed(true);
      return false;
    }
  };

  const retry = () => {
    if (puzzle) {
      setIsFailed(false);
      setIsSolved(false);
      chess.load(puzzle.fen);
      const firstMove = puzzle.moves[0];
      chess.move({
        from: firstMove.substring(0, 2),
        to: firstMove.substring(2, 4),
        promotion: firstMove.length === 5 ? firstMove[4] : undefined
      });
      setFen(chess.fen());
      setMoveIndex(1);
    }
  };

  return {
    fen,
    puzzle,
    isSolved,
    isFailed,
    isLoading,
    makeMove,
    nextPuzzle: loadRandomPuzzle,
    retry,
    orientation: chess.turn(), // if it's white's turn now, user plays white, so orientation is white
    chess
  };
}
