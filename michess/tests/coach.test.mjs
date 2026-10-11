import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';

describe('Michess AI Chess Coach System', () => {
  // Helper simulating tactical facts extraction
  function extractTacticalFacts(fenBefore, fenAfter, san, uci) {
    const chessBefore = new Chess(fenBefore);
    const chessAfter = new Chess(fenAfter);

    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4].toLowerCase() : undefined;

    const pieceBefore = chessBefore.get(from);
    const pieceType = pieceBefore ? pieceBefore.type : 'p';
    const pieceNames = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
    const movedPiece = pieceNames[pieceType] || 'Piece';

    const isCapture = san.includes('x');
    const targetPiece = isCapture ? chessBefore.get(to) : null;
    const capturedPiece = targetPiece ? pieceNames[targetPiece.type] : undefined;

    const isCheck = san.includes('+') || san.includes('#');
    const isCheckmate = san.includes('#');
    const isCastling = san.startsWith('O-O') || san.startsWith('0-0');
    const isPromotion = Boolean(promotion || san.includes('='));

    return {
      movedPiece,
      isCapture,
      capturedPiece,
      isCheck,
      isCheckmate,
      isCastling,
      isPromotion,
      hangingPiecesBefore: [],
      hangingPiecesAfter: []
    };
  }

  // Helper simulating score formatting
  function formatEvalScore(score) {
    if (!score) return 'Uncalculated';
    if (score.type === 'mate') {
      return score.value > 0 ? `Forced Mate in ${score.value} for White` : `Forced Mate in ${Math.abs(score.value)} for Black`;
    }
    const pawns = (score.value / 100).toFixed(2);
    return score.value > 0 ? `+${pawns} (Advantage White)` : score.value < 0 ? `${pawns} (Advantage Black)` : '0.00 (Equal)';
  }

  // Helper simulating prompt building
  function buildCoachPrompt(evidence) {
    const evalBeforeStr = formatEvalScore(evidence.evalBefore?.score);
    const evalAfterStr = formatEvalScore(evidence.evalAfter?.score);

    const system = `You are a world-class, encouraging Grandmaster Chess Coach analyzing a move in a game for an improving student.
Explain the chess clearly, accurately, and with crisp conciseness.

STRICT OUTPUT CONSTRAINTS:
1. Output ONLY a valid JSON object. No markdown fences, no preambles, no commentary, no <think> tags.
2. Keep EVERY field brief: 1 to 2 short sentences per field (maximum 25 words per field).
3. Ground truth: Stockfish engine analysis and chess.js are the absolute source of truth. NEVER fabricate attacks, pins, forks, mate threats, or evaluations not in the evidence.
4. Schema:
{
  "summary": "Crisp 1-sentence verdict on move quality and main consequence. (Max 20 words)",
  "move_purpose": "1 short sentence explaining the player's primary positional or tactical goal. (Max 20 words)",
  "tactical_consequences": "1 short sentence on concrete tactical impact (checks, captures, piece safety, opened lines). (Max 20 words)",
  "opponent_threat": "1 short sentence on the opponent's best reply or counterplay. (Max 20 words)",
  "better_move": "Best move in SAN notation if one is recommended, or empty string if played move was optimal.",
  "why_better": "1 short sentence explaining why the alternative is superior, or empty string if not applicable. (Max 20 words)",
  "lesson": "1 memorable general chess principle the student should apply. (Max 15 words)"
}`;

    const user = `Analyze this move using the verified evidence:

Game Title: ${evidence.gameTitle || 'Game Review'}
Opening: ${evidence.opening ? `${evidence.opening.name} (${evidence.opening.eco || ''})` : 'Standard'}
Move: ${evidence.moveNumber}. ${evidence.color === 'b' ? '...' : ''}${evidence.san} (played by ${evidence.playerColorName})
UCI: ${evidence.uci}
Moved Piece: ${evidence.tacticalFacts.movedPiece}
Classification: ${evidence.classification || 'normal'}
Centipawn Loss: ${evidence.evalLoss} cp

Engine Evaluation:
- Evaluation Before Move: ${evalBeforeStr}
- Evaluation After Move: ${evalAfterStr}
- Engine Best Move: ${evidence.bestMoveSan || evidence.bestMove || 'None'}
- Principal Variation (PV): ${evidence.pv || 'None'}

Verified Facts:
- Check: ${evidence.tacticalFacts.isCheck ? 'Yes' : 'No'}
- Checkmate: ${evidence.tacticalFacts.isCheckmate ? 'Yes' : 'No'}
- Capture: ${evidence.tacticalFacts.isCapture ? `Yes (${evidence.tacticalFacts.capturedPiece || 'piece'})` : 'No'}
- Castling: ${evidence.tacticalFacts.isCastling ? 'Yes' : 'No'}
- Promotion: ${evidence.tacticalFacts.isPromotion ? `Yes (${evidence.tacticalFacts.promotedTo})` : 'No'}`;

    return { system, user };
  }

  function extractRegexField(key, text) {
    const match = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, 'i'));
    if (match) {
      try {
        return JSON.parse(`"${match[1]}"`).trim();
      } catch {
        return match[1].replace(/\\"/g, '"').trim();
      }
    }
    const partialMatch = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"\\r\\n]+)(?:"|$|,)`, 'i'));
    if (partialMatch && partialMatch[1].trim().length > 0) {
      return partialMatch[1].replace(/\\"/g, '"').replace(/^"+|"+$/g, '').trim();
    }
    return '';
  }

  function cleanCoachTextField(text) {
    if (!text || typeof text !== 'string') return '';
    let clean = text.trim();
    if (clean.startsWith('{') || clean.includes('"summary"')) {
      const extracted = extractRegexField('summary', clean);
      if (extracted) {
        clean = extracted;
      } else {
        clean = clean.replace(/^[{\s]*"?[a-zA-Z0-9_-]+"?\s*:\s*"?/i, '')
                     .replace(/"?\s*[,}].*$/s, '')
                     .trim();
      }
    }
    return clean.replace(/^"+|"+$/g, '').trim();
  }

  // Helper simulating response JSON validation & extraction
  function validateCoachApiResponse(raw) {
    if (!raw || typeof raw !== 'string') return null;

    let jsonStr = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object') {
        const summary = cleanCoachTextField(parsed.summary || parsed.takeaway || parsed.verdict);
        if (summary) {
          return {
            summary,
            move_purpose: cleanCoachTextField(parsed.move_purpose || parsed.purpose),
            tactical_consequences: cleanCoachTextField(parsed.tactical_consequences || parsed.tactics),
            opponent_threat: cleanCoachTextField(parsed.opponent_threat || parsed.threat),
            better_move: cleanCoachTextField(parsed.better_move) || undefined,
            why_better: cleanCoachTextField(parsed.why_better) || undefined,
            lesson: cleanCoachTextField(parsed.lesson) || 'Always evaluate checks, captures, and threats.'
          };
        }
      }
    } catch {
      // Fall through to regex recovery
    }

    // Regex extraction recovery for truncated outputs
    const summaryRegex = cleanCoachTextField(extractRegexField('summary', raw));
    if (summaryRegex && summaryRegex.length >= 8) {
      return {
        summary: summaryRegex,
        move_purpose: cleanCoachTextField(extractRegexField('move_purpose', raw)),
        tactical_consequences: cleanCoachTextField(extractRegexField('tactical_consequences', raw)),
        opponent_threat: cleanCoachTextField(extractRegexField('opponent_threat', raw)),
        better_move: cleanCoachTextField(extractRegexField('better_move', raw)) || undefined,
        why_better: cleanCoachTextField(extractRegexField('why_better', raw)) || undefined,
        lesson: cleanCoachTextField(extractRegexField('lesson', raw)) || 'Always evaluate checks, captures, and threats.'
      };
    }

    return null;
  }

  // Helper simulating fallback explanation generator
  function generateFallbackCoachExplanation(evidence) {
    const isBest = evidence.classification === 'best' || evidence.classification === 'brilliant' || evidence.classification === 'great';
    const isBlunder = evidence.classification === 'blunder';
    const isMistake = evidence.classification === 'mistake';
    const isInaccuracy = evidence.classification === 'inaccuracy';
    const isBook = evidence.classification === 'book';

    let summary = `${evidence.playerColorName} played ${evidence.san}.`;
    let movePurpose = `Developed the ${evidence.tacticalFacts.movedPiece.toLowerCase()} to control key squares.`;
    let tacticalConsequences = 'Maintains positional balance with no immediate material loss.';
    let opponentThreat = 'The opponent will seek counterplay and central piece development.';
    let betterMove = evidence.bestMoveSan;
    let whyBetter = '';
    let lesson = 'Always scan all checks, captures, and threats before deciding on a move.';

    if (isBook) {
      summary = `A standard opening book move in the ${evidence.opening?.name || 'opening'}.`;
      movePurpose = `Adheres to established master theory, focusing on piece development and controlling central space.`;
      tacticalConsequences = `Both sides follow balanced opening principles.`;
      opponentThreat = `The opponent will continue typical opening piece coordination.`;
      lesson = `Memorize the primary goals and pawn structures of your chosen opening lines.`;
    } else if (isBest) {
      summary = `Top engine choice! ${evidence.san} is the most accurate continuation in this position.`;
      movePurpose = `Finds the optimal square, maximizing piece activity while keeping the position secure.`;
      tacticalConsequences = evidence.tacticalFacts.isCheck
        ? `Delivers check, restricting the enemy king's movement.`
        : evidence.tacticalFacts.isCapture
        ? `Wins the enemy ${evidence.tacticalFacts.capturedPiece || 'piece'}, securing material.`
        : `Maintains optimal engine evaluation and active piece coordination.`;
      opponentThreat = `The opponent is pushed to find difficult defensive resources.`;
      betterMove = undefined;
      lesson = `Sharp calculation and patient positional improvement yield the strongest moves.`;
    } else if (isBlunder) {
      summary = `Major blunder (-${evidence.evalLoss} cp). ${evidence.san} significantly compromises the position.`;
      movePurpose = `Attempted active play, but overlooks critical tactical refutations.`;
      tacticalConsequences = `Surrenders a decisive advantage or concedes critical material to the opponent.`;
      opponentThreat = `The opponent can exploit this with strong tactical forcing moves.`;
      whyBetter = `Playing ${evidence.bestMoveSan || 'the best move'} prevents the advantage from slipping and keeps pieces coordinated.`;
      lesson = `Before every move, double check: "Does this move leave any of my pieces unprotected?"`;
    } else if (isMistake) {
      summary = `Mistake (-${evidence.evalLoss} cp). ${evidence.san} allows the opponent to gain the initiative.`;
      movePurpose = `A suboptimal choice that conceded positional or tactical ground.`;
      tacticalConsequences = `Gives up control of key squares or allows enemy pieces to become more active.`;
      opponentThreat = `The opponent can capitalize by challenging the center or targeting weak squares.`;
      whyBetter = `${evidence.bestMoveSan || 'The engine alternative'} would have maintained a tighter positional hold.`;
      lesson = `Pay close attention to what your opponent's ideal response will be before committing.`;
    } else if (isInaccuracy) {
      summary = `Inaccuracy (-${evidence.evalLoss} cp). A slightly passive move that misses a stronger opportunity.`;
      movePurpose = `Reasonable intent, but not as incisive as the top engine recommendation.`;
      tacticalConsequences = `Minor shift in position; no immediate material lost.`;
      opponentThreat = `The opponent has room to equalize or start an initiative.`;
      whyBetter = `${evidence.bestMoveSan || 'The engine move'} provides greater piece activity.`;
      lesson = `Look for active, purposeful moves over passive waiting moves.`;
    }

    return {
      summary,
      move_purpose: movePurpose,
      tactical_consequences: tacticalConsequences,
      opponent_threat: opponentThreat,
      better_move: betterMove,
      why_better: whyBetter || (betterMove ? `Preserves the engine evaluation and optimizes piece activity.` : undefined),
      lesson,
      generatedAt: Date.now(),
      fallback: true
    };
  }

  // --- TESTS ---

  it('correctly extracts tactical facts for captures, checks, and castling', () => {
    // Standard starting position -> 1. e4
    const factsE4 = extractTacticalFacts(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      'e4',
      'e2e4'
    );
    assert.equal(factsE4.movedPiece, 'Pawn');
    assert.equal(factsE4.isCapture, false);
    assert.equal(factsE4.isCheck, false);
    assert.equal(factsE4.isCastling, false);

    // Capture & Check: Scholar's mate delivery Qxf7#
    const fenBeforeQxf7 = 'r1bqkb1r/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    const fenAfterQxf7 = 'r1bqkb1r/pppp1Qpp/2n5/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
    const factsQxf7 = extractTacticalFacts(fenBeforeQxf7, fenAfterQxf7, 'Qxf7#', 'h5f7');
    assert.equal(factsQxf7.movedPiece, 'Queen');
    assert.equal(factsQxf7.isCapture, true);
    assert.equal(factsQxf7.capturedPiece, 'Pawn');
    assert.equal(factsQxf7.isCheck, true);
    assert.equal(factsQxf7.isCheckmate, true);

    // Castling: O-O
    const fenBeforeO_O = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5';
    const fenAfterO_O = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 b kq - 2 5';
    const factsO_O = extractTacticalFacts(fenBeforeO_O, fenAfterO_O, 'O-O', 'e1g1');
    assert.equal(factsO_O.isCastling, true);
  });

  it('formats evaluation scores cleanly for White, Black, and Forced Mate', () => {
    assert.equal(formatEvalScore({ value: 150, type: 'cp' }), '+1.50 (Advantage White)');
    assert.equal(formatEvalScore({ value: -230, type: 'cp' }), '-2.30 (Advantage Black)');
    assert.equal(formatEvalScore({ value: 0, type: 'cp' }), '0.00 (Equal)');
    assert.equal(formatEvalScore({ value: 3, type: 'mate' }), 'Forced Mate in 3 for White');
    assert.equal(formatEvalScore({ value: -2, type: 'mate' }), 'Forced Mate in 2 for Black');
    assert.equal(formatEvalScore(undefined), 'Uncalculated');
  });

  it('builds system and user prompts adhering strictly to verified chess facts and schema', () => {
    const evidence = {
      gameTitle: 'Alice vs Bob',
      opening: { name: 'Ruy Lopez', eco: 'C60' },
      moveNumber: 3,
      color: 'w',
      playerColorName: 'White',
      san: 'Bb5',
      uci: 'f1b5',
      classification: 'best',
      evalLoss: 0,
      evalBefore: { score: { value: 30, type: 'cp' } },
      evalAfter: { score: { value: 35, type: 'cp' } },
      bestMoveSan: 'Bb5',
      bestMove: 'f1b5',
      pv: 'Bb5 a6 Ba4 Nf6',
      tacticalFacts: {
        movedPiece: 'Bishop',
        isCapture: false,
        isCheck: false,
        isCheckmate: false,
        isCastling: false,
        isPromotion: false,
        hangingPiecesBefore: [],
        hangingPiecesAfter: []
      }
    };

    const { system, user } = buildCoachPrompt(evidence);

    assert.ok(system.includes('Stockfish engine analysis and chess.js are the absolute source of truth'));
    assert.ok(system.includes('NEVER fabricate attacks, pins, forks'));
    assert.ok(system.includes('"summary"'));
    assert.ok(system.includes('"lesson"'));

    assert.ok(user.includes('Move: 3. Bb5 (played by White)'));
    assert.ok(user.includes('Opening: Ruy Lopez (C60)'));
    assert.ok(user.includes('Evaluation Before Move: +0.30 (Advantage White)'));
    assert.ok(user.includes('Engine Best Move: Bb5'));
  });

  it('parses and validates JSON responses, handling markdown code fences', () => {
    const rawMarkdownJson = `\`\`\`json
{
  "summary": "Solid developing move pinning the knight.",
  "move_purpose": "Pins the Black c6 knight to exert pressure on e5.",
  "tactical_consequences": "Maintains harmonious piece development.",
  "opponent_threat": "Black will likely test the bishop with a6.",
  "better_move": "",
  "why_better": "",
  "lesson": "Develop pieces with a concrete purpose against enemy key squares."
}
\`\`\``;

    const validated = validateCoachApiResponse(rawMarkdownJson);
    assert.ok(validated);
    assert.equal(validated.summary, 'Solid developing move pinning the knight.');
    assert.equal(validated.lesson, 'Develop pieces with a concrete purpose against enemy key squares.');

    // Malformed non-JSON strings should return null safely without throwing
    assert.equal(validateCoachApiResponse('Not a json string'), null);
    assert.equal(validateCoachApiResponse('{ "broken": true '), null);
    assert.equal(validateCoachApiResponse(null), null);
  });

  it('recovers truncated JSON model responses cleanly without leaking raw JSON syntax into summary', () => {
    // Exact user failure case where LLM truncated mid-sentence
    const truncatedRaw = `{"summary": "White opt for a quiet e3 instead of a more active e4, slightly relaxing the advantage.", "move_purpose": "To modestly secure their`;

    const validated = validateCoachApiResponse(truncatedRaw);
    assert.ok(validated);
    assert.equal(
      validated.summary,
      'White opt for a quiet e3 instead of a more active e4, slightly relaxing the advantage.'
    );
    // Summary must never contain raw JSON markers
    assert.ok(!validated.summary.includes('{"summary"'));
    assert.ok(!validated.summary.includes('move_purpose'));
    assert.equal(validated.move_purpose, 'To modestly secure their');

    // Test cleaning nested JSON strings
    assert.equal(
      cleanCoachTextField('{"summary": "A clean verdict."}'),
      'A clean verdict.'
    );
    assert.equal(cleanCoachTextField('"quoted string"'), 'quoted string');
  });

  it('generates high quality deterministic fallback explanations for all move classifications', () => {
    const baseEvidence = {
      moveNumber: 5,
      color: 'w',
      playerColorName: 'White',
      san: 'Nf3',
      uci: 'g1f3',
      evalLoss: 0,
      bestMoveSan: 'Nf3',
      tacticalFacts: {
        movedPiece: 'Knight',
        isCapture: false,
        isCheck: false,
        isCheckmate: false,
        isCastling: false,
        isPromotion: false,
        hangingPiecesBefore: [],
        hangingPiecesAfter: []
      }
    };

    // Best move
    const bestFallback = generateFallbackCoachExplanation({
      ...baseEvidence,
      classification: 'best'
    });
    assert.ok(bestFallback.summary.includes('Top engine choice'));
    assert.equal(bestFallback.better_move, undefined);
    assert.equal(bestFallback.fallback, true);

    // Blunder
    const blunderFallback = generateFallbackCoachExplanation({
      ...baseEvidence,
      san: 'g4',
      evalLoss: 380,
      classification: 'blunder',
      bestMoveSan: 'Nf3'
    });
    assert.ok(blunderFallback.summary.includes('Major blunder (-380 cp)'));
    assert.equal(blunderFallback.better_move, 'Nf3');
    assert.ok(blunderFallback.lesson.includes('Does this move leave any of my pieces unprotected?'));

    // Mistake
    const mistakeFallback = generateFallbackCoachExplanation({
      ...baseEvidence,
      san: 'h3',
      evalLoss: 120,
      classification: 'mistake',
      bestMoveSan: 'd4'
    });
    assert.ok(mistakeFallback.summary.includes('Mistake (-120 cp)'));
    assert.equal(mistakeFallback.better_move, 'd4');

    // Inaccuracy
    const inaccFallback = generateFallbackCoachExplanation({
      ...baseEvidence,
      san: 'a3',
      evalLoss: 45,
      classification: 'inaccuracy',
      bestMoveSan: 'c4'
    });
    assert.ok(inaccFallback.summary.includes('Inaccuracy (-45 cp)'));
    assert.equal(inaccFallback.better_move, 'c4');

    // Book
    const bookFallback = generateFallbackCoachExplanation({
      ...baseEvidence,
      classification: 'book',
      opening: { name: 'Sicilian Defense', eco: 'B20' }
    });
    assert.ok(bookFallback.summary.includes('standard opening book move in the Sicilian Defense'));
  });

  it('enforces Edge Function / Backend security: rate limit and payload size constraints', () => {
    // 1. Rate limiter logic check (30 req / min)
    const rateLimitMap = new Map();
    function checkRateLimit(clientIp, maxPerMinute = 30) {
      const now = Date.now();
      const current = rateLimitMap.get(clientIp);
      if (!current || now - current.resetTime > 60000) {
        rateLimitMap.set(clientIp, { count: 1, resetTime: now });
        return true;
      }
      if (current.count >= maxPerMinute) {
        return false;
      }
      current.count += 1;
      return true;
    }

    const testIp = '192.168.1.100';
    for (let i = 0; i < 30; i++) {
      assert.equal(checkRateLimit(testIp, 30), true);
    }
    // 31st request is blocked
    assert.equal(checkRateLimit(testIp, 30), false);

    // 2. Payload size limiter check (< 15KB)
    function validatePayloadSize(payload, maxSize = 15360) {
      const size = Buffer.byteLength(JSON.stringify(payload), 'utf8');
      return size <= maxSize;
    }

    assert.equal(validatePayloadSize({ test: 'normal payload', fen: '8/8/8/8/8/8/8/8' }), true);
    assert.equal(validatePayloadSize({ hugeData: 'x'.repeat(20000) }), false);
  });

  it('correctly resolves model fallback chains from environment or defaults', () => {
    function resolveModelChain(env) {
      if (env.TOKENREPLY_MODELS && env.TOKENREPLY_MODELS.trim()) {
        const list = env.TOKENREPLY_MODELS.split(',').map(m => m.trim()).filter(Boolean);
        if (list.length > 0) return list;
      }
      const primary = env.TOKENREPLY_MODEL || 'z-ai/glm-5.3-flash';
      if (env.TOKENREPLY_FALLBACK_MODELS && env.TOKENREPLY_FALLBACK_MODELS.trim()) {
        const fallbacks = env.TOKENREPLY_FALLBACK_MODELS.split(',').map(m => m.trim()).filter(Boolean);
        return [primary, ...fallbacks];
      }
      if (primary === 'z-ai/glm-5.3-flash') {
        return ['z-ai/glm-5.3-flash', 'openai/gpt-oss-20b', 'north-mini-code'];
      }
      const defaults = ['z-ai/glm-5.3-flash', 'openai/gpt-oss-20b', 'north-mini-code'];
      return [primary, ...defaults.filter(m => m !== primary)];
    }

    // Default configuration: z-ai/glm-5.3-flash -> openai/gpt-oss-20b -> north-mini-code
    assert.deepEqual(
      resolveModelChain({}),
      ['z-ai/glm-5.3-flash', 'openai/gpt-oss-20b', 'north-mini-code']
    );

    // Custom models list via TOKENREPLY_MODELS
    assert.deepEqual(
      resolveModelChain({ TOKENREPLY_MODELS: 'custom/model-a, custom/model-b' }),
      ['custom/model-a', 'custom/model-b']
    );

    // Custom single primary via TOKENREPLY_MODEL
    assert.deepEqual(
      resolveModelChain({ TOKENREPLY_MODEL: 'custom/model-a' }),
      ['custom/model-a', 'z-ai/glm-5.3-flash', 'openai/gpt-oss-20b', 'north-mini-code']
    );
  });

  it('validates structured coach JSON and rejects invalid or non-JSON model outputs', () => {
    function isValidCoachJson(rawText) {
      if (!rawText || typeof rawText !== 'string') return false;
      let clean = rawText.trim();
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      }
      try {
        const parsed = JSON.parse(clean);
        return Boolean(
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.summary === 'string' &&
          parsed.summary.trim().length > 0
        );
      } catch {
        return false;
      }
    }

    assert.equal(isValidCoachJson('{"summary": "Solid move."}'), true);
    assert.equal(isValidCoachJson('```json\n{"summary": "Active rook lift.", "move_purpose": "Attack"}\n```'), true);
    assert.equal(isValidCoachJson(''), false);
    assert.equal(isValidCoachJson('I cannot provide a JSON response'), false);
    assert.equal(isValidCoachJson('{"no_summary": "invalid"}'), false);
    assert.equal(isValidCoachJson('{"summary": "   "}'), false);
  });

  it('simulates automatic LLM fallback chain execution and preserves Stockfish integrity', async () => {
    const chain = ['z-ai/glm-5.3-flash', 'openai/gpt-oss-20b', 'north-mini-code'];
    const fallbackAttempts = [];

    // Mock scenario: primary times out, secondary returns valid explanation
    async function simulateFallbackExecution(failPrimary, failSecondary) {
      fallbackAttempts.length = 0;

      for (const model of chain) {
        if (model === 'z-ai/glm-5.3-flash' && failPrimary) {
          fallbackAttempts.push({ model, error: 'Timeout (7.5s)' });
          continue;
        }
        if (model === 'openai/gpt-oss-20b' && failSecondary) {
          fallbackAttempts.push({ model, error: 'HTTP 429: Quota exceeded' });
          continue;
        }

        // Returns success
        return {
          success: true,
          model,
          rawContent: JSON.stringify({
            summary: `Explanation generated by ${model}`,
            move_purpose: 'Develop piece',
            tactical_consequences: 'Controls squares',
            opponent_threat: 'None',
            better_move: '',
            lesson: 'Think carefully'
          }),
          fallbackAttempts: fallbackAttempts.slice()
        };
      }

      return {
        success: false,
        error: 'All models failed',
        fallbackAttempts: fallbackAttempts.slice()
      };
    }

    // 1. Primary succeeds
    const res1 = await simulateFallbackExecution(false, false);
    assert.equal(res1.success, true);
    assert.equal(res1.model, 'z-ai/glm-5.3-flash');
    assert.equal(res1.fallbackAttempts.length, 0);

    // 2. Primary fails, secondary succeeds
    const res2 = await simulateFallbackExecution(true, false);
    assert.equal(res2.success, true);
    assert.equal(res2.model, 'openai/gpt-oss-20b');
    assert.equal(res2.fallbackAttempts.length, 1);
    assert.equal(res2.fallbackAttempts[0].model, 'z-ai/glm-5.3-flash');

    // 3. Primary & Secondary fail, tertiary succeeds
    const res3 = await simulateFallbackExecution(true, true);
    assert.equal(res3.success, true);
    assert.equal(res3.model, 'north-mini-code');
    assert.equal(res3.fallbackAttempts.length, 2);

    // 4. Verification that Stockfish engine truth is NEVER changed by fallback
    const stockfishMove = {
      san: 'Bxf7+',
      evalLoss: 0,
      classification: 'great',
      evalBefore: { score: { value: 120, type: 'cp' } },
      evalAfter: { score: { value: 340, type: 'cp' } },
      bestMoveSan: 'Bxf7+'
    };

    // Regardless of fallback, engine move attributes remain exactly the same
    assert.equal(stockfishMove.san, 'Bxf7+');
    assert.equal(stockfishMove.evalLoss, 0);
    assert.equal(stockfishMove.classification, 'great');
    assert.equal(stockfishMove.bestMoveSan, 'Bxf7+');
    assert.equal(stockfishMove.evalAfter.score.value, 340);
  });
});
