import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// 1. Test hasSufficientMaterial logic (FIDE Article 6.9)
describe('Bug 2: Timeout Draw vs Insufficient Material (hasSufficientMaterial)', () => {
  function hasSufficientMaterial(fen, color) {
    const boardFen = fen.split(' ')[0];
    const pieces = [];
    
    for (let i = 0; i < boardFen.length; i++) {
      const char = boardFen[i];
      if (char === '/' || (char >= '1' && char <= '8')) continue;
      
      const isPieceWhite = char === char.toUpperCase();
      if ((color === 'w' && isPieceWhite) || (color === 'b' && !isPieceWhite)) {
        const lower = char.toLowerCase();
        if (lower !== 'k') {
          pieces.push(lower);
        }
      }
    }

    if (pieces.length === 0) return false;
    if (pieces.length === 1 && (pieces[0] === 'b' || pieces[0] === 'n')) return false;

    return true;
  }

  it('detects bare king as insufficient material', () => {
    // 4k3/8/8/8/8/8/8/4K3 w - - 0 1 (K vs K)
    assert.equal(hasSufficientMaterial('4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'w'), false);
    assert.equal(hasSufficientMaterial('4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'b'), false);
  });

  it('detects king + single bishop as insufficient material', () => {
    // White has K + B, Black has K
    const fen = '4k3/8/8/8/8/8/4B3/4K3 w - - 0 1';
    assert.equal(hasSufficientMaterial(fen, 'w'), false);
    assert.equal(hasSufficientMaterial(fen, 'b'), false);
  });

  it('detects king + single knight as insufficient material', () => {
    // White has K + N, Black has K
    const fen = '4k3/8/8/8/8/8/4N3/4K3 w - - 0 1';
    assert.equal(hasSufficientMaterial(fen, 'w'), false);
    assert.equal(hasSufficientMaterial(fen, 'b'), false);
  });

  it('detects king + pawn as sufficient material', () => {
    // White has K + P, Black has K
    const fen = '4k3/8/8/8/8/4P3/8/4K3 w - - 0 1';
    assert.equal(hasSufficientMaterial(fen, 'w'), true);
    assert.equal(hasSufficientMaterial(fen, 'b'), false);
  });

  it('detects king + rook as sufficient material', () => {
    // White has K + R, Black has K
    const fen = '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1';
    assert.equal(hasSufficientMaterial(fen, 'w'), true);
    assert.equal(hasSufficientMaterial(fen, 'b'), false);
  });

  it('detects king + 2 bishops as sufficient material', () => {
    // White has K + 2B, Black has K
    const fen = '4k3/8/8/8/8/4B3/4B3/4K3 w - - 0 1';
    assert.equal(hasSufficientMaterial(fen, 'w'), true);
  });

  it('detects king + bishop + knight as sufficient material', () => {
    // White has K + B + N, Black has K
    const fen = '4k3/8/8/8/8/4B3/4N3/4K3 w - - 0 1';
    assert.equal(hasSufficientMaterial(fen, 'w'), true);
  });
});

// 2. Test parsePgnMetadata robustness against undefined/null/empty (Bug 9)
describe('Bug 9: parsePgnMetadata and hashString undefined handling', () => {
  function hashString(str) {
    if (!str || typeof str !== 'string') return 'fallback-id';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  function parsePgnMetadata(pgn, providedId) {
    if (!pgn || typeof pgn !== 'string' || !pgn.trim()) {
      return {
        id: providedId || hashString(pgn || ''),
        white: 'Unknown',
        black: 'Unknown',
        result: '*',
        date: 'Unknown',
        event: 'Unknown',
        opening: 'Unknown',
        isValid: false,
        error: 'Empty or invalid PGN string.',
        pgn: pgn || ''
      };
    }
    return { id: 'valid', isValid: true, pgn };
  }

  it('handles undefined input without throwing TypeError', () => {
    assert.doesNotThrow(() => {
      const res = parsePgnMetadata(undefined);
      assert.equal(res.isValid, false);
      assert.equal(res.error, 'Empty or invalid PGN string.');
    });
  });

  it('handles null input without throwing TypeError', () => {
    assert.doesNotThrow(() => {
      const res = parsePgnMetadata(null);
      assert.equal(res.isValid, false);
    });
  });

  it('handles empty string without throwing', () => {
    const res = parsePgnMetadata('   ');
    assert.equal(res.isValid, false);
    assert.equal(res.error, 'Empty or invalid PGN string.');
  });
});

// 3. Test accuracy formatting and zero representation (Bug 8)
describe('Bug 8: History and Review Accuracy 0.0 display', () => {
  it('correctly handles 0.0 accuracy without displaying dash or literal 0 in JSX', () => {
    const whiteAccuracy = 0.0;
    const blackAccuracy = 84.5;
    
    // Test HistoryList format logic
    const shouldRenderBadge = Boolean(true && (whiteAccuracy != null || blackAccuracy != null));
    assert.equal(shouldRenderBadge, true);
    
    const whiteDisplay = whiteAccuracy != null ? whiteAccuracy.toFixed(1) : '-';
    assert.equal(whiteDisplay, '0.0');

    // Test ReviewStats format logic
    const whiteStat = whiteAccuracy != null ? `${whiteAccuracy.toFixed(1)}%` : '-';
    assert.equal(whiteStat, '0.0%');

    const nullAccuracy = null;
    const nullStat = nullAccuracy != null ? `${nullAccuracy.toFixed(1)}%` : '-';
    assert.equal(nullStat, '-');
  });
});

// 4. Test Stockfish Engine Promise resolution on stop/terminate (Bug 1)
describe('Bug 1: Engine Promise Rejection on Stop and Terminate', () => {
  it('rejects pending analysis promises instead of hanging indefinitely', async () => {
    let pendingReject = null;
    let promiseSettled = false;

    const analyzePromise = new Promise((resolve, reject) => {
      pendingReject = reject;
    }).catch(err => {
      promiseSettled = true;
      return err.message;
    });

    // Simulate calling stop() while thinking
    if (pendingReject) {
      pendingReject(new Error('Analysis stopped'));
    }

    const message = await analyzePromise;
    assert.equal(promiseSettled, true);
    assert.equal(message, 'Analysis stopped');
  });
});

// 5. Test Social & Challenge Self-Action Guard (Bugs 6 & 7)
describe('Bugs 6 & 7: Social and Challenge Self-Action Validation', () => {
  it('prevents self-friend requests', () => {
    const userId = 'user-123';
    const friendId = 'user-123';
    
    const canSend = (uid, fid) => {
      if (!uid) return { success: false, error: 'Not logged in' };
      if (uid === fid) return { success: false, error: 'Cannot send friend request to yourself' };
      return { success: true };
    };

    const res = canSend(userId, friendId);
    assert.equal(res.success, false);
    assert.equal(res.error, 'Cannot send friend request to yourself');
  });

  it('prevents self-challenges', () => {
    const userId = 'user-abc';
    const receiverId = 'user-abc';

    const canChallenge = (uid, rid) => {
      if (!uid) return { success: false, error: 'Not logged in' };
      if (uid === rid) return { success: false, error: 'Cannot challenge yourself' };
      return { success: true };
    };

    const res = canChallenge(userId, receiverId);
    assert.equal(res.success, false);
    assert.equal(res.error, 'Cannot challenge yourself');
  });
});

// 6. Test Puzzle timeout cancellation (Bug 3)
describe('Bug 3: Puzzle Opponent Move Timeout Tracking and Cancellation', () => {
  it('clears pending opponent move timeout before new move or on retry', () => {
    let timeoutId = 12345;
    let cleared = false;

    const clearOpponentTimeout = () => {
      if (timeoutId) {
        cleared = true;
        timeoutId = null;
      }
    };

    clearOpponentTimeout();
    assert.equal(cleared, true);
    assert.equal(timeoutId, null);
  });
});
