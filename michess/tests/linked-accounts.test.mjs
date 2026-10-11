import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Linked Accounts System (Chess.com & Lichess)', () => {
  // 1. Username sanitization & validation
  function sanitizeUsername(input) {
    if (!input || typeof input !== 'string') return null;
    const clean = input.trim();
    return clean.length >= 2 ? clean.toLowerCase() : null;
  }

  it('validates and sanitizes usernames correctly', () => {
    assert.equal(sanitizeUsername('  Hikaru  '), 'hikaru');
    assert.equal(sanitizeUsername('MagnusCarlsen'), 'magnuscarlsen');
    assert.equal(sanitizeUsername(''), null);
    assert.equal(sanitizeUsername('   '), null);
    assert.equal(sanitizeUsername('a'), null);
    assert.equal(sanitizeUsername(null), null);
    assert.equal(sanitizeUsername(undefined), null);
  });

  // 2. Player color determination from linked accounts
  function detectUserColor(game, linkedAccounts, defaultUsername = null) {
    const chesscomUser = linkedAccounts.chesscomUsername?.trim().toLowerCase();
    const lichessUser = linkedAccounts.lichessUsername?.trim().toLowerCase();
    const whiteLower = game.white?.trim().toLowerCase();
    const blackLower = game.black?.trim().toLowerCase();

    if (game.source === 'chesscom' && chesscomUser) {
      if (whiteLower === chesscomUser) return 'w';
      if (blackLower === chesscomUser) return 'b';
    }
    if (game.source === 'lichess' && lichessUser) {
      if (whiteLower === lichessUser) return 'w';
      if (blackLower === lichessUser) return 'b';
    }

    if (defaultUsername) {
      const def = defaultUsername.trim().toLowerCase();
      if (whiteLower === def) return 'w';
      if (blackLower === def) return 'b';
    }

    return 'w';
  }

  it('determines user color accurately for Chess.com games based on linked account', () => {
    const linked = { chesscomUsername: 'hikaru', lichessUsername: null };

    // When playing as white
    const gameWhite = {
      source: 'chesscom',
      white: 'Hikaru',
      black: 'DanielNaroditsky',
      result: '1-0'
    };
    assert.equal(detectUserColor(gameWhite, linked), 'w');

    // When playing as black
    const gameBlack = {
      source: 'chesscom',
      white: 'MagnusCarlsen',
      black: 'hikaru',
      result: '0-1'
    };
    assert.equal(detectUserColor(gameBlack, linked), 'b');
  });

  it('determines user color accurately for Lichess games based on linked account', () => {
    const linked = { chesscomUsername: null, lichessUsername: 'DrNykterstein' };

    const gameWhite = {
      source: 'lichess',
      white: 'drnykterstein',
      black: 'nihalsarin2004',
      result: '1-0'
    };
    assert.equal(detectUserColor(gameWhite, linked), 'w');

    const gameBlack = {
      source: 'lichess',
      white: 'Penguingm1',
      black: 'DrNykterstein',
      result: '1/2-1/2'
    };
    assert.equal(detectUserColor(gameBlack, linked), 'b');
  });

  // 3. Deduplication of incoming games
  function deduplicateGames(existingGames, incomingGames) {
    const existingIds = new Set(existingGames.map(g => g.id));
    const existingPgns = new Set(existingGames.map(g => g.pgn?.trim()));
    const toAdd = [];

    for (const game of incomingGames) {
      if (!existingIds.has(game.id) && !existingPgns.has(game.pgn?.trim())) {
        toAdd.push(game);
        existingIds.add(game.id);
        if (game.pgn) existingPgns.add(game.pgn.trim());
      }
    }
    return toAdd;
  }

  it('filters out duplicates by ID and PGN string', () => {
    const existing = [
      { id: 'chesscom-1001', pgn: '1. e4 e5 2. Nf3 Nc6 1-0' },
      { id: 'lichess-game123', pgn: '1. d4 d5 2. c4 c6 1/2-1/2' }
    ];

    const incoming = [
      { id: 'chesscom-1001', pgn: '1. e4 e5 2. Nf3 Nc6 1-0' }, // duplicate ID & PGN
      { id: 'chesscom-9999', pgn: '1. e4 e5 2. Nf3 Nc6 1-0' }, // duplicate PGN with new ID
      { id: 'chesscom-1002', pgn: '1. c4 Nf6 2. Nc3 g6 0-1' }, // brand new game
      { id: 'lichess-game456', pgn: '1. e4 c5 2. Nf3 d6 1-0' } // brand new game
    ];

    const newGames = deduplicateGames(existing, incoming);
    assert.equal(newGames.length, 2);
    assert.equal(newGames[0].id, 'chesscom-1002');
    assert.equal(newGames[1].id, 'lichess-game456');
  });

  // 4. Relative time formatting
  function formatLastSync(ts, now = Date.now()) {
    if (!ts) return 'Never';
    const seconds = Math.floor((now - ts) / 1000);
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  it('formats last sync timestamps cleanly', () => {
    const now = 1700000000000;
    assert.equal(formatLastSync(null, now), 'Never');
    assert.equal(formatLastSync(now - 10000, now), 'Just now'); // 10s ago
    assert.equal(formatLastSync(now - 45000, now), '45s ago');  // 45s ago
    assert.equal(formatLastSync(now - 180000, now), '3m ago');  // 3 min ago
    assert.equal(formatLastSync(now - 7200000, now), '2h ago'); // 2 hours ago
  });

  // 5. Game extraction from Lichess NDJSON representation
  function parseLichessGame(data) {
    const id = `lichess-${data.id}`;
    const pgn = data.pgn || '';
    const timestamp = data.createdAt || Date.now();
    const result = data.winner === 'white' ? '1-0' : data.winner === 'black' ? '0-1' : '1/2-1/2';

    return {
      id,
      pgn,
      white: data.players?.white?.user?.name || 'White',
      black: data.players?.black?.user?.name || 'Black',
      result,
      source: 'lichess',
      timestamp,
      externalUrl: `https://lichess.org/${data.id}`
    };
  }

  it('correctly maps raw Lichess game data to HistoryGame fields', () => {
    const sampleLichess = {
      id: 'abc12345',
      pgn: '1. e4 e5 2. Nf3 *',
      createdAt: 1690000000000,
      winner: 'white',
      players: {
        white: { user: { name: 'PlayerOne' } },
        black: { user: { name: 'PlayerTwo' } }
      }
    };

    const parsed = parseLichessGame(sampleLichess);
    assert.equal(parsed.id, 'lichess-abc12345');
    assert.equal(parsed.white, 'PlayerOne');
    assert.equal(parsed.black, 'PlayerTwo');
    assert.equal(parsed.result, '1-0');
    assert.equal(parsed.source, 'lichess');
    assert.equal(parsed.externalUrl, 'https://lichess.org/abc12345');
  });
});
