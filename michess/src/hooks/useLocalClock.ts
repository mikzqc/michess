import { useState, useRef, useCallback, useEffect } from 'react';

export interface LocalClockState {
  whiteTimeMs: number;
  blackTimeMs: number;
  isWhiteActive: boolean;
  isBlackActive: boolean;
  isTimed: boolean;
  timeControl: string | null;
}

interface UseLocalClockOptions {
  initialTimeMs: number | null;
  incrementMs: number;
  turn: 'w' | 'b';
  isGameOver: boolean;
  isGameStarted: boolean; // false until first position, prevents clock from ticking during setup
}

/**
 * Client-side chess clock for local and computer games.
 * Uses timestamp math for accurate timing (not setInterval subtraction).
 */
export function useLocalClock(options: UseLocalClockOptions): LocalClockState & {
  onMoveMade: (byColor: 'w' | 'b') => void;
  reset: (initialMs: number | null, incMs: number) => void;
  getWhiteTime: () => number;
  getBlackTime: () => number;
} {
  const { initialTimeMs, incrementMs, turn, isGameOver, isGameStarted } = options;

  const [, setWhiteTimeMs] = useState(initialTimeMs ?? 0);
  const [, setBlackTimeMs] = useState(initialTimeMs ?? 0);
  const [now, setNow] = useState(() => Date.now());

  const isTimed = initialTimeMs !== null && initialTimeMs > 0;
  
  // When the active clock started ticking
  const clockStartedRef = useRef<number | null>(null);
  const whiteTimeRef = useRef(initialTimeMs ?? 0);
  const blackTimeRef = useRef(initialTimeMs ?? 0);
  const incrementRef = useRef(incrementMs);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep incrementRef updated if incrementMs changes
  useEffect(() => {
    incrementRef.current = incrementMs;
  }, [incrementMs]);

  // Start ticking when game begins
  useEffect(() => {
    if (!isTimed) return;

    if (isGameStarted && !isGameOver && clockStartedRef.current === null) {
      clockStartedRef.current = Date.now();
    }

    if (isGameOver) {
      // Freeze clocks
      if (clockStartedRef.current !== null) {
        const elapsed = Date.now() - clockStartedRef.current;
        if (turn === 'w') {
          whiteTimeRef.current = Math.max(0, whiteTimeRef.current - elapsed);
        } else {
          blackTimeRef.current = Math.max(0, blackTimeRef.current - elapsed);
        }
        clockStartedRef.current = null;
      }
      setWhiteTimeMs(whiteTimeRef.current);
      setBlackTimeMs(blackTimeRef.current);
    }
  }, [isTimed, isGameStarted, isGameOver, turn]);

  // Visual tick at 100ms
  useEffect(() => {
    if (isTimed && isGameStarted && !isGameOver) {
      intervalRef.current = setInterval(() => setNow(Date.now()), 100);
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
  }, [isTimed, isGameStarted, isGameOver]);

  // Called after a successful move
  const onMoveMade = useCallback((byColor: 'w' | 'b') => {
    if (!isTimed) return;

    if (clockStartedRef.current !== null) {
      const elapsed = Date.now() - clockStartedRef.current;
      if (byColor === 'w') {
        whiteTimeRef.current = Math.max(0, whiteTimeRef.current - elapsed) + incrementRef.current;
        setWhiteTimeMs(whiteTimeRef.current);
      } else {
        blackTimeRef.current = Math.max(0, blackTimeRef.current - elapsed) + incrementRef.current;
        setBlackTimeMs(blackTimeRef.current);
      }
    } else {
      // First move made before clock was running
      if (byColor === 'w') {
        whiteTimeRef.current = whiteTimeRef.current + incrementRef.current;
        setWhiteTimeMs(whiteTimeRef.current);
      } else {
        blackTimeRef.current = blackTimeRef.current + incrementRef.current;
        setBlackTimeMs(blackTimeRef.current);
      }
    }

    // Reset clock start for the next player
    clockStartedRef.current = Date.now();
  }, [isTimed]);

  const reset = useCallback((initialMs: number | null, incMs: number) => {
    whiteTimeRef.current = initialMs ?? 0;
    blackTimeRef.current = initialMs ?? 0;
    incrementRef.current = incMs;
    clockStartedRef.current = null;
    setWhiteTimeMs(initialMs ?? 0);
    setBlackTimeMs(initialMs ?? 0);
  }, []);

  // Compute visual times
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  void now; // Force re-render dependency
  
  /* eslint-disable */
  let displayWhite = whiteTimeRef.current;
  let displayBlack = blackTimeRef.current;

  if (isTimed && clockStartedRef.current !== null && isGameStarted && !isGameOver) {
    const elapsed = now - clockStartedRef.current;
    if (turn === 'w') {
      displayWhite = Math.max(0, whiteTimeRef.current - elapsed);
    } else {
      displayBlack = Math.max(0, blackTimeRef.current - elapsed);
    }
  }

  const isActive = isTimed && isGameStarted && !isGameOver;

  return {
    whiteTimeMs: displayWhite,
    blackTimeMs: displayBlack,
    isWhiteActive: isActive && turn === 'w',
    isBlackActive: isActive && turn === 'b',
    isTimed,
    timeControl: isTimed ? `${Math.round((initialTimeMs!) / 60000)}+${Math.round(incrementMs / 1000)}` : null,
    onMoveMade,
    reset,
    getWhiteTime: () => displayWhite,
    getBlackTime: () => displayBlack,
  };
  /* eslint-enable */
}
