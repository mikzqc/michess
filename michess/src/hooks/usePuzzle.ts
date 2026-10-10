import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { useSettings } from './useSettings';
import { useToast } from '../components/Toast';
import { useAuth } from './useAuth';
import { supabase } from '../services/supabase';
import type { PuzzleData } from '../types/puzzle';

let cachedSortedPuzzles: PuzzleData[] | null = null;

const PUZZLE_INDEX_KEY = 'michess_puzzle_progress_index';

export function usePuzzle() {
  const { settings } = useSettings();
  const { addToast } = useToast();
  const { user } = useAuth();

  const [chess] = useState(new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpponentMoving, setIsOpponentMoving] = useState(false);

  // Player's perspective locked per puzzle so board doesn't flip on move
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');

  // Track incremental puzzle index (starts at lowest Elo 399)
  const [puzzleIndex, setPuzzleIndex] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(PUZZLE_INDEX_KEY);
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        return isNaN(parsed) ? 0 : Math.max(0, parsed);
      }
    } catch {
      // ignore
    }
    return 0;
  });

  const puzzleIndexRef = useRef(puzzleIndex);
  puzzleIndexRef.current = puzzleIndex;

  const opponentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpponentTimeout = useCallback(() => {
    if (opponentTimeoutRef.current) {
      clearTimeout(opponentTimeoutRef.current);
      opponentTimeoutRef.current = null;
    }
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      clearOpponentTimeout();
    };
  }, [clearOpponentTimeout]);

  const loadPuzzleAtIndex = useCallback(async (targetIndex: number) => {
    clearOpponentTimeout();
    setIsLoading(true);
    setIsSolved(false);
    setIsFailed(false);
    setIsOpponentMoving(false);

    try {
      let puzzles = cachedSortedPuzzles;
      if (!puzzles) {
        const res = await fetch('/puzzles.json');
        const raw: PuzzleData[] = await res.json();
        // Sort puzzles from lowest to highest Elo
        puzzles = raw.sort((a, b) => a.rating - b.rating);
        cachedSortedPuzzles = puzzles;
      }

      if (!puzzles || puzzles.length === 0) throw new Error('No puzzles found');

      const safeIndex = Math.min(Math.max(0, targetIndex), puzzles.length - 1);
      const currentPuzzle = puzzles[safeIndex];

      setPuzzle(currentPuzzle);
      chess.load(currentPuzzle.fen);

      // Play the first move (opponent's move)
      const firstMove = currentPuzzle.moves[0];
      chess.move({
        from: firstMove.substring(0, 2),
        to: firstMove.substring(2, 4),
        promotion: firstMove.length === 5 ? firstMove[4] : undefined
      });

      // Freeze player's color for this puzzle so the board doesn't flip when moves are made
      const activeColor = chess.turn();
      setPlayerColor(activeColor);

      setFen(chess.fen());
      setMoveIndex(1); // User needs to find moves[1]
    } catch (e) {
      console.error(e);
      addToast('Failed to load puzzle', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [chess, addToast]);

  useEffect(() => {
    loadPuzzleAtIndex(puzzleIndexRef.current);
  }, [loadPuzzleAtIndex]);

  const makeMove = (move: { from: string; to: string; promotion?: string }) => {
    if (!puzzle || isSolved || isFailed || isOpponentMoving) return false;

    // Build UCI string to compare
    let uci = `${move.from}${move.to}`;

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
          // Sync puzzle rating to profile if authenticated
          if (user && supabase && puzzle) {
            supabase
              .rpc('update_puzzle_stats', { 
                p_user_id: user.id, 
                p_solved: true, 
                p_new_rating: puzzle.rating 
              })
              .then(() => {});
          }
        } else {
          // Play opponent's response after a short delay
          const nextMoveIndex = moveIndex + 1;
          setIsOpponentMoving(true);

          clearOpponentTimeout();
          opponentTimeoutRef.current = setTimeout(() => {
            opponentTimeoutRef.current = null;
            const oppMove = puzzle.moves[nextMoveIndex];
            chess.move({
              from: oppMove.substring(0, 2),
              to: oppMove.substring(2, 4),
              promotion: oppMove.length === 5 ? oppMove[4] : undefined
            });
            setFen(chess.fen());
            setMoveIndex(nextMoveIndex + 1);
            setIsOpponentMoving(false);

            if (nextMoveIndex + 1 >= puzzle.moves.length) {
              setIsSolved(true);
              if (user && supabase && puzzle) {
                supabase
                  .rpc('update_puzzle_stats', { 
                    p_user_id: user.id, 
                    p_solved: true, 
                    p_new_rating: puzzle.rating 
                  })
                  .then(() => {});
              }
            }
          }, 400);
        }
        return true;
      } catch (e) {
        console.error('Invalid move caught by chess.js', e);
        return false;
      }
    } else {
      // Incorrect move
      if (settings.autoRetryPuzzles) {
        addToast('Incorrect move! Try again.', 'error');
        return false;
      }
      setIsFailed(true);
      if (user && supabase && puzzle) {
        supabase
          .rpc('update_puzzle_stats', { 
            p_user_id: user.id, 
            p_solved: false, 
            p_new_rating: puzzle.rating 
          })
          .then(() => {});
      }
      return false;
    }
  };

  const nextPuzzle = useCallback(() => {
    const nextIdx = puzzleIndexRef.current + 1;
    setPuzzleIndex(nextIdx);
    try {
      localStorage.setItem(PUZZLE_INDEX_KEY, nextIdx.toString());
    } catch {}
    loadPuzzleAtIndex(nextIdx);
  }, [loadPuzzleAtIndex]);

  const resetProgress = useCallback(() => {
    setPuzzleIndex(0);
    try {
      localStorage.setItem(PUZZLE_INDEX_KEY, '0');
    } catch {}
    loadPuzzleAtIndex(0);
  }, [loadPuzzleAtIndex]);

  const retry = useCallback(() => {
    clearOpponentTimeout();
    if (puzzle) {
      setIsFailed(false);
      setIsSolved(false);
      setIsOpponentMoving(false);
      chess.load(puzzle.fen);
      const firstMove = puzzle.moves[0];
      chess.move({
        from: firstMove.substring(0, 2),
        to: firstMove.substring(2, 4),
        promotion: firstMove.length === 5 ? firstMove[4] : undefined
      });
      setPlayerColor(chess.turn());
      setFen(chess.fen());
      setMoveIndex(1);
    }
  }, [chess, puzzle, clearOpponentTimeout]);

  const loadDailyPuzzle = useCallback(() => {
    // Generate an index based on the current date
    const today = new Date();
    const dateString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    
    // Simple string hash
    let hash = 0;
    for (let i = 0; i < dateString.length; i++) {
      hash = ((hash << 5) - hash) + dateString.charCodeAt(i);
      hash |= 0;
    }
    
    const targetIdx = Math.abs(hash) % (cachedSortedPuzzles?.length || 10000);
    loadPuzzleAtIndex(targetIdx);
  }, [loadPuzzleAtIndex]);

  return {
    fen,
    puzzle,
    puzzleIndex,
    puzzleNumber: puzzleIndex + 1,
    totalPuzzles: cachedSortedPuzzles?.length || 10000,
    isSolved,
    isFailed,
    isLoading,
    makeMove,
    nextPuzzle,
    skipPuzzle: nextPuzzle,
    resetProgress,
    retry,
    loadDailyPuzzle,
    orientation: playerColor, // Stays fixed to the player's side throughout puzzle moves!
    chess
  };
}
