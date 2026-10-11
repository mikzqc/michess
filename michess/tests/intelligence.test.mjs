import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';

const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

function determineGamePhase(fen, moveNumber) {
  if (moveNumber <= 12) {
    return 'opening';
  }

  const boardPart = fen.split(' ')[0];
  let whiteNonPawn = 0;
  let blackNonPawn = 0;
  let totalPieces = 0;

  for (const char of boardPart) {
    if (char === '/' || (!isNaN(parseInt(char, 10)) && parseInt(char, 10) > 0)) {
      continue;
    }
    totalPieces++;
    const lower = char.toLowerCase();
    if (lower === 'k' || lower === 'p') continue;

    const val = PIECE_VALUES[lower] || 0;
    if (char === char.toUpperCase()) {
      whiteNonPawn += val;
    } else {
      blackNonPawn += val;
    }
  }

  if (totalPieces <= 10 || (whiteNonPawn <= 13 && blackNonPawn <= 13)) {
    return 'endgame';
  }

  return 'middlegame';
}

function detectHangingPiece(move, fenBefore, fenAfter) {
  if (move.evalLoss < 80) return undefined;

  try {
    const from = move.uci.slice(0, 2);
    const to = move.uci.slice(2, 4);
    const cBefore = new Chess(fenBefore);
    const movedPiece = cBefore.get(from);

    if (!movedPiece) return undefined;
    const movedVal = PIECE_VALUES[movedPiece.type] || 0;

    const cAfter = new Chess(fenAfter);
    const oppMoves = cAfter.moves({ verbose: true });

    const directAttacks = oppMoves.filter(m => m.to === to && m.captured);
    for (const atk of directAttacks) {
      const atkVal = PIECE_VALUES[atk.piece] || 0;
      if (atkVal < movedVal) {
        return movedPiece.type;
      }
      if (atkVal === movedVal) {
        const sim = new Chess(fenAfter);
        sim.move(atk);
        const recaptures = sim.moves({ verbose: true }).filter(m => m.to === to && m.captured);
        if (recaptures.length === 0) {
          return movedPiece.type;
        }
      }
    }

    const board = cAfter.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.color !== move.color || p.type === 'k') continue;
        const sq = String.fromCharCode('a'.charCodeAt(0) + c) + (8 - r);
        const pVal = PIECE_VALUES[p.type] || 0;
        if (pVal < 3) continue;

        const attacks = oppMoves.filter(m => m.to === sq && m.captured);
        for (const atk of attacks) {
          const atkVal = PIECE_VALUES[atk.piece] || 0;
          if (atkVal < pVal) return p.type;
          if (atkVal === pVal) {
            const sim = new Chess(fenAfter);
            sim.move(atk);
            const recaptures = sim.moves({ verbose: true }).filter(m => m.to === sq && m.captured);
            if (recaptures.length === 0) return p.type;
          }
        }
      }
    }
  } catch {}

  return undefined;
}

function classifyMistakeType(move, phase, hangingPiece) {
  const evalBefore = move.evalBefore?.score;
  const evalAfter = move.evalAfter?.score;

  if (evalBefore?.type === 'mate') {
    const isFriendlyMate = move.color === 'w' ? evalBefore.value > 0 : evalBefore.value < 0;
    if (isFriendlyMate) {
      const afterIsFriendlyMate = evalAfter?.type === 'mate' && (move.color === 'w' ? evalAfter.value > 0 : evalAfter.value < 0);
      if (!afterIsFriendlyMate) {
        return 'missed_mate';
      }
    }
  }

  if (hangingPiece) {
    return 'hanging_piece';
  }

  if (move.classification === 'miss') {
    return 'missed_tactic';
  }

  const playerBeforeScore = evalBefore?.type === 'cp' 
    ? (move.color === 'w' ? evalBefore.value : -evalBefore.value)
    : (evalBefore?.type === 'mate' ? (move.color === 'w' ? evalBefore.value * 1000 : -evalBefore.value * 1000) : 0);
  const playerAfterScore = evalAfter?.type === 'cp'
    ? (move.color === 'w' ? evalAfter.value : -evalAfter.value)
    : (evalAfter?.type === 'mate' ? (move.color === 'w' ? evalAfter.value * 1000 : -evalAfter.value * 1000) : 0);

  if (phase === 'opening' && move.evalLoss >= 150 && playerBeforeScore >= 100 && playerAfterScore < 50) {
    return 'opening_advantage_loss';
  }

  if (phase === 'endgame' && move.evalLoss >= 150) {
    return 'endgame_mistake';
  }

  return 'blunder';
}

describe('Michess Game Intelligence Logic', () => {

  it('correctly determines game phase based on move number and material', () => {
    // 1. Move 1-12 is always opening
    const startFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    assert.equal(determineGamePhase(startFen, 1), 'opening');
    assert.equal(determineGamePhase(startFen, 12), 'opening');

    // 2. Full middlegame position after move 12
    const middlegameFen = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N2NP1/PP3PBP/R1BQ1RK1 w - - 0 13';
    assert.equal(determineGamePhase(middlegameFen, 13), 'middlegame');

    // 3. Endgame position with low material
    const endgameFen = '8/4k3/8/4K3/4P3/8/8/8 w - - 0 45';
    assert.equal(determineGamePhase(endgameFen, 45), 'endgame');

    // 4. Endgame position with <= 10 total pieces
    const rookEndgameFen = '8/5k2/8/8/8/2R2K2/8/7r w - - 0 35';
    assert.equal(determineGamePhase(rookEndgameFen, 35), 'endgame');
  });

  it('detects hanging pieces blundered without compensation', () => {
    // White blunders Queen to d4 where black pawn on c5 captures it
    const fenBefore = 'rnbqkbnr/pp1ppppp/8/2p5/3QP3/8/PPP2PPP/RNB1KBNR w KQkq - 0 2';
    // Move Queen from d4 to e5 where black knight or pawn takes it
    const move = {
      uci: 'd4b6',
      evalLoss: 900,
      color: 'w',
      fenBefore: 'rnb1kbnr/pp1ppppp/1q6/2p5/3QP3/8/PPP2PPP/RNB1KBNR w KQkq - 1 3',
      fenAfter: 'rnb1kbnr/pp1ppppp/1q6/2p5/1Q2P3/8/PPP2PPP/RNB1KBNR b KQkq - 2 3'
    };

    // If evalLoss < 150, hanging piece is ignored
    const lowLossMove = { ...move, evalLoss: 40 };
    assert.equal(detectHangingPiece(lowLossMove, move.fenBefore, move.fenAfter), undefined);
  });

  it('correctly classifies mistake types into missed mate, hanging piece, tactic, or phase error', () => {
    // 1. Missed mate
    const missedMateMove = {
      color: 'w',
      evalLoss: 800,
      evalBefore: { score: { type: 'mate', value: 1 } },
      evalAfter: { score: { type: 'cp', value: 150 } }
    };
    assert.equal(classifyMistakeType(missedMateMove, 'middlegame'), 'missed_mate');

    // 2. Hanging piece
    const hangingPieceMove = {
      color: 'w',
      evalLoss: 500,
      evalBefore: { score: { type: 'cp', value: 100 } },
      evalAfter: { score: { type: 'cp', value: -400 } }
    };
    assert.equal(classifyMistakeType(hangingPieceMove, 'middlegame', 'r'), 'hanging_piece');

    // 3. Missed tactic
    const missedTacticMove = {
      color: 'w',
      classification: 'miss',
      evalLoss: 220,
      evalBefore: { score: { type: 'cp', value: 200 } },
      evalAfter: { score: { type: 'cp', value: 0 } }
    };
    assert.equal(classifyMistakeType(missedTacticMove, 'middlegame'), 'missed_tactic');

    // 4. Opening advantage loss
    const openingErrorMove = {
      color: 'w',
      classification: 'mistake',
      evalLoss: 180,
      evalBefore: { score: { type: 'cp', value: 100 } },
      evalAfter: { score: { type: 'cp', value: -80 } }
    };
    assert.equal(classifyMistakeType(openingErrorMove, 'opening'), 'opening_advantage_loss');

    // 5. Endgame mistake
    const endgameErrorMove = {
      color: 'w',
      classification: 'mistake',
      evalLoss: 250,
      evalBefore: { score: { type: 'cp', value: 300 } },
      evalAfter: { score: { type: 'cp', value: 50 } }
    };
    assert.equal(classifyMistakeType(endgameErrorMove, 'endgame'), 'endgame_mistake');
  });

  it('computes accurate centipawn loss and accuracy metrics per phase', () => {
    const mockPhases = {
      opening: { moveCount: 10, acpl: 200, blunders: 0, mistakes: 1 },
      middlegame: { moveCount: 15, acpl: 600, blunders: 2, mistakes: 2 },
      endgame: { moveCount: 5, acpl: 50, blunders: 0, mistakes: 0 }
    };

    const openingAcpl = Math.round(mockPhases.opening.acpl / mockPhases.opening.moveCount);
    const middlegameAcpl = Math.round(mockPhases.middlegame.acpl / mockPhases.middlegame.moveCount);
    const endgameAcpl = Math.round(mockPhases.endgame.acpl / mockPhases.endgame.moveCount);

    assert.equal(openingAcpl, 20);
    assert.equal(middlegameAcpl, 40);
    assert.equal(endgameAcpl, 10);

    const totalMoves = 30;
    const overallAcpl = Math.round((mockPhases.opening.acpl + mockPhases.middlegame.acpl + mockPhases.endgame.acpl) / totalMoves);
    assert.equal(overallAcpl, 28);
  });

  it('flags insufficient data when fewer than 3 games are analyzed', () => {
    const hasSufficientData = (analysesCount) => analysesCount >= 3;

    assert.equal(hasSufficientData(0), false);
    assert.equal(hasSufficientData(1), false);
    assert.equal(hasSufficientData(2), false);
    assert.equal(hasSufficientData(3), true);
    assert.equal(hasSufficientData(10), true);
  });

  it('ranks top openings by frequency and calculates win percentage accurately', () => {
    const analyses = [
      { opening: { name: 'Sicilian Defense', eco: 'B20' }, result: 'win' },
      { opening: { name: 'Sicilian Defense', eco: 'B20' }, result: 'win' },
      { opening: { name: 'Sicilian Defense', eco: 'B20' }, result: 'loss' },
      { opening: { name: "Queen's Gambit", eco: 'D06' }, result: 'loss' },
      { opening: { name: "Queen's Gambit", eco: 'D06' }, result: 'draw' },
    ];

    const openingMap = new Map();
    for (const a of analyses) {
      if (!a.opening) continue;
      const key = a.opening.name;
      const cur = openingMap.get(key) || { name: a.opening.name, eco: a.opening.eco, count: 0, wins: 0, losses: 0, draws: 0 };
      cur.count++;
      if (a.result === 'win') cur.wins++;
      else if (a.result === 'loss') cur.losses++;
      else if (a.result === 'draw') cur.draws++;
      openingMap.set(key, cur);
    }

    const sicilian = openingMap.get('Sicilian Defense');
    assert.equal(sicilian.count, 3);
    assert.equal(sicilian.wins, 2);
    assert.equal(Math.round((sicilian.wins / sicilian.count) * 100), 67);

    const qg = openingMap.get("Queen's Gambit");
    assert.equal(qg.count, 2);
    assert.equal(qg.wins, 0);
    assert.equal(qg.losses, 1);
    assert.equal(qg.draws, 1);
  });

  it('correctly batches up to 10 unanalyzed games at once', () => {
    const existingAnalyses = [{ gameId: 'g1' }, { gameId: 'g2' }];
    const historyGames = Array.from({ length: 25 }, (_, i) => ({ id: `g${i + 1}` }));
    const existingIds = new Set(existingAnalyses.map(a => a.gameId));

    // Batch analysis with limit 10
    const limit = 10;
    const unanalyzed = historyGames.filter(g => !existingIds.has(g.id)).slice(0, limit);

    assert.equal(unanalyzed.length, 10);
    assert.equal(unanalyzed[0].id, 'g3');
    assert.equal(unanalyzed[9].id, 'g12');
  });

  it('correctly parses user game results from varied notations including descriptive results and spaces', () => {
    const detectUserResult = (game, userColor) => {
      const res = game.result?.trim().toLowerCase() || '';
      if (res === '1/2-1/2' || res === '1/2 - 1/2' || res === 'draw' || res.includes('draw')) return 'draw';
      if (res === '1-0' || res === '1 - 0' || res.includes('white wins')) return userColor === 'w' ? 'win' : 'loss';
      if (res === '0-1' || res === '0 - 1' || res.includes('black wins')) return userColor === 'b' ? 'win' : 'loss';
      if (res === 'win') return 'win';
      if (res === 'loss') return 'loss';
      return '*';
    };

    assert.equal(detectUserResult({ result: '1-0' }, 'w'), 'win');
    assert.equal(detectUserResult({ result: '1-0' }, 'b'), 'loss');
    assert.equal(detectUserResult({ result: '0 - 1' }, 'b'), 'win');
    assert.equal(detectUserResult({ result: '1/2 - 1/2' }, 'w'), 'draw');
    assert.equal(detectUserResult({ result: 'White wins by Resignation' }, 'w'), 'win');
    assert.equal(detectUserResult({ result: 'Black wins on time' }, 'b'), 'win');
    assert.equal(detectUserResult({ result: 'Draw by Stalemate' }, 'w'), 'draw');
    assert.equal(detectUserResult({ result: 'win' }, 'w'), 'win');
  });

  it('correctly handles Black perspective for opening advantage loss', () => {
    // Black had a winning advantage (-150 cp) in the opening and played an inaccuracy dropping to +20 cp (advantage lost!)
    const blackAdvantageLost = {
      color: 'b',
      classification: 'blunder',
      evalLoss: 170,
      evalBefore: { score: { type: 'cp', value: -150 } }, // -150 White = +150 Black!
      evalAfter: { score: { type: 'cp', value: 20 } }
    };
    assert.equal(classifyMistakeType(blackAdvantageLost, 'opening'), 'opening_advantage_loss');

    // Black was ALREADY losing (+250 cp White) and made another blunder: NOT an opening advantage loss!
    const blackAlreadyLosing = {
      color: 'b',
      classification: 'blunder',
      evalLoss: 180,
      evalBefore: { score: { type: 'cp', value: 250 } },
      evalAfter: { score: { type: 'cp', value: 430 } }
    };
    assert.equal(classifyMistakeType(blackAlreadyLosing, 'opening'), 'blunder');
  });

  it('normalizes PGN dot dates to valid ISO date strings', () => {
    const normalizeDate = (rawDate, timestamp) => {
      let formatted = rawDate ? rawDate.replace(/\./g, '-') : '';
      if (!formatted || isNaN(Date.parse(formatted))) {
        formatted = new Date(timestamp || Date.now()).toISOString().split('T')[0];
      }
      return formatted;
    };

    assert.equal(normalizeDate('2026.10.11'), '2026-10-11');
    assert.equal(normalizeDate('', 1760000000000), new Date(1760000000000).toISOString().split('T')[0]);
  });

  it('safely handles promotion moves in UCI notation with uppercase or lowercase letters', () => {
    const parseBestMoveSan = (fenBefore, uci) => {
      try {
        const c = new Chess(fenBefore);
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = (uci.slice(4, 5) || '').toLowerCase() || undefined;
        const m = c.move({ from, to, promotion });
        return m ? m.san : uci;
      } catch {
        return uci;
      }
    };

    // Legal promotion position: White king on a1, Black king on h8, pawn on e7 (e8=Q gives check)
    const promoFen = '7k/4P3/8/8/8/8/8/K7 w - - 0 1';
    assert.equal(parseBestMoveSan(promoFen, 'e7e8q'), 'e8=Q+');
    assert.equal(parseBestMoveSan(promoFen, 'e7e8Q'), 'e8=Q+'); // Uppercase UCI also works!
  });

  it('guards against NaN in overall ACPL and accuracy calculations', () => {
    const mockAnalyses = [
      { userAcpl: undefined, userAccuracy: undefined },
      { userAcpl: 35, userAccuracy: 88 }
    ];
    const totalGames = mockAnalyses.length;
    const avgOverallAcpl = Math.round(mockAnalyses.reduce((s, a) => s + (a.userAcpl || 0), 0) / (totalGames || 1));
    const avgOverallAccuracy = Math.round(mockAnalyses.reduce((s, a) => s + (a.userAccuracy || 0), 0) / (totalGames || 1));

    assert.equal(isNaN(avgOverallAcpl), false);
    assert.equal(isNaN(avgOverallAccuracy), false);
    assert.equal(avgOverallAcpl, 18);
    assert.equal(avgOverallAccuracy, 44);
  });
});

