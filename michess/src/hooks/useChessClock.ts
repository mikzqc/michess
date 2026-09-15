import { useState, useEffect, useRef } from 'react';
import type { LinkGame } from '../types/linkGame';

interface ClockState {
  whiteTimeMs: number;
  blackTimeMs: number;
  isWhiteActive: boolean;
  isBlackActive: boolean;
  isTimed: boolean;
}

/**
 * Visual countdown hook for the chess clock.
 * 
 * This hook does NOT modify game state. It reads the authoritative
 * clock values from gameData (synced via Supabase Realtime) and
 * calculates a smooth visual countdown using timestamp math.
 * 
 * The displayed time is: stored_time - (now - last_move_at) for the active player.
 * This is resilient to browser tab throttling and render delays.
 */
export function useChessClock(gameData: LinkGame | null): ClockState {
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTimed = !!(gameData?.initial_time_ms);
  const isActive = gameData?.status === 'active' && isTimed && !!gameData.last_move_at;

  // Tick the visual clock at ~100ms intervals while game is active
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setNow(Date.now());
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive]);

  if (!gameData || !isTimed) {
    return {
      whiteTimeMs: 0,
      blackTimeMs: 0,
      isWhiteActive: false,
      isBlackActive: false,
      isTimed: false,
    };
  }

  const storedWhite = gameData.white_time_ms ?? 0;
  const storedBlack = gameData.black_time_ms ?? 0;

  if (!isActive || !gameData.last_move_at) {
    // Game not started, completed, or untimed — show stored values without countdown
    return {
      whiteTimeMs: Math.max(0, storedWhite),
      blackTimeMs: Math.max(0, storedBlack),
      isWhiteActive: false,
      isBlackActive: false,
      isTimed: true,
    };
  }

  // Calculate elapsed time since the active clock started
  const lastMoveTimestamp = new Date(gameData.last_move_at).getTime();
  const elapsed = Math.max(0, now - lastMoveTimestamp);

  const isWhiteTurn = gameData.current_turn === 'w';

  return {
    whiteTimeMs: Math.max(0, isWhiteTurn ? storedWhite - elapsed : storedWhite),
    blackTimeMs: Math.max(0, !isWhiteTurn ? storedBlack - elapsed : storedBlack),
    isWhiteActive: isWhiteTurn,
    isBlackActive: !isWhiteTurn,
    isTimed: true,
  };
}
