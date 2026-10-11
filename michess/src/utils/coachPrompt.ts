import type { CoachMoveEvidence, CoachExplanation } from '../types/coach';

/**
 * Formats an evaluation score for display in the prompt.
 */
export function formatEvalScore(score?: { value: number; type: 'cp' | 'mate' }): string {
  if (!score) return 'Uncalculated';
  if (score.type === 'mate') {
    return score.value > 0 ? `Forced Mate in ${score.value} for White` : `Forced Mate in ${Math.abs(score.value)} for Black`;
  }
  const pawns = (score.value / 100).toFixed(2);
  return score.value > 0 ? `+${pawns} (Advantage White)` : score.value < 0 ? `${pawns} (Advantage Black)` : '0.00 (Equal)';
}

/**
 * Builds the system prompt and user prompt for TokenReply LLM.
 */
export function buildCoachPrompt(evidence: CoachMoveEvidence): { system: string; user: string } {
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
- Promotion: ${evidence.tacticalFacts.isPromotion ? `Yes (${evidence.tacticalFacts.promotedTo})` : 'No'}
- Material Shift: ${evidence.tacticalFacts.materialBalanceChange > 0 ? `+${evidence.tacticalFacts.materialBalanceChange}` : evidence.tacticalFacts.materialBalanceChange} pts for ${evidence.playerColorName}
- Hanging Pieces Before: ${evidence.tacticalFacts.hangingPiecesBefore.length > 0 ? evidence.tacticalFacts.hangingPiecesBefore.join(', ') : 'None'}
- Hanging Pieces After: ${evidence.tacticalFacts.hangingPiecesAfter.length > 0 ? evidence.tacticalFacts.hangingPiecesAfter.join(', ') : 'None'}

Generate the coach explanation JSON now:`;

  return { system, user };
}

/**
 * Extracts a field from raw/truncated text using regex.
 */
function extractRegexField(key: string, text: string): string {
  // Complete key-value pair: "key": "value"
  const match = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, 'i'));
  if (match) {
    try {
      return JSON.parse(`"${match[1]}"`).trim();
    } catch {
      return match[1].replace(/\\"/g, '"').trim();
    }
  }

  // Trailing incomplete key-value pair if truncated mid-string: "key": "value...
  const partialMatch = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"\\r\\n]+)(?:"|$|,)`, 'i'));
  if (partialMatch && partialMatch[1].trim().length > 0) {
    return partialMatch[1].replace(/\\"/g, '"').replace(/^"+|"+$/g, '').trim();
  }

  return '';
}

/**
 * Cleans a text field to ensure no raw JSON syntax leaks into user-facing text.
 */
export function cleanCoachTextField(text?: string): string {
  if (!text || typeof text !== 'string') return '';
  let clean = text.trim();
  
  // If the text contains JSON syntax like {"summary": "..."}
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

  // Strip leading/trailing unbalanced quotes
  return clean.replace(/^"+|"+$/g, '').trim();
}

/**
 * Validates and sanitizes raw JSON returned by the model.
 */
export function extractJsonString(rawText: string): string | null {
  if (!rawText || typeof rawText !== 'string') return null;
  let trimmed = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    trimmed = codeBlockMatch[1].trim();
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }
  return trimmed;
}

export function validateCoachResponse(rawText: string, evidence: CoachMoveEvidence): CoachExplanation | null {
  if (!rawText || typeof rawText !== 'string') return null;

  const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 1. Try standard JSON parse on extracted string
  const cleanJson = extractJsonString(cleaned);
  if (cleanJson) {
    try {
      const parsed = JSON.parse(cleanJson);
      if (typeof parsed === 'object' && parsed !== null) {
        let summary = cleanCoachTextField(parsed.summary || parsed.takeaway || parsed.verdict);
        if (summary) {
          return {
            summary,
            move_purpose: cleanCoachTextField(parsed.move_purpose || parsed.purpose),
            tactical_consequences: cleanCoachTextField(parsed.tactical_consequences || parsed.tactics),
            opponent_threat: cleanCoachTextField(parsed.opponent_threat || parsed.threat),
            better_move: cleanCoachTextField(parsed.better_move) || (evidence.bestMoveSan || undefined),
            why_better: cleanCoachTextField(parsed.why_better) || undefined,
            lesson: cleanCoachTextField(parsed.lesson) || 'Calculate forcing moves before committing.',
            generatedAt: Date.now()
          };
        }
      }
    } catch {
      // JSON parse failed (likely truncated or trailing comma) - proceed to regex extraction
    }
  }

  // 2. Resilient field-level regex extraction for partial or truncated model responses
  const summary = cleanCoachTextField(extractRegexField('summary', cleaned));
  if (summary && summary.length >= 8) {
    const movePurpose = cleanCoachTextField(extractRegexField('move_purpose', cleaned));
    const tacticalConsequences = cleanCoachTextField(extractRegexField('tactical_consequences', cleaned));
    const opponentThreat = cleanCoachTextField(extractRegexField('opponent_threat', cleaned));
    const betterMove = cleanCoachTextField(extractRegexField('better_move', cleaned)) || (evidence.bestMoveSan || undefined);
    const whyBetter = cleanCoachTextField(extractRegexField('why_better', cleaned)) || undefined;
    const lesson = cleanCoachTextField(extractRegexField('lesson', cleaned)) || 'Calculate forcing moves before committing.';

    return {
      summary,
      move_purpose: movePurpose,
      tactical_consequences: tacticalConsequences,
      opponent_threat: opponentThreat,
      better_move: betterMove,
      why_better: whyBetter,
      lesson,
      generatedAt: Date.now()
    };
  }

  return null;
}

/**
 * Deterministic fallback explanation generator when LLM API is unavailable,
 * unconfigured, or returns invalid responses. Never leaves the user with an empty screen.
 */
export function generateFallbackCoachExplanation(evidence: CoachMoveEvidence, _reason?: string): CoachExplanation {
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
    tacticalConsequences = evidence.tacticalFacts.hangingPiecesAfter.length > 0
      ? `Leaves ${evidence.tacticalFacts.hangingPiecesAfter.join(', ')} vulnerable to tactical punishment.`
      : `Surrenders a decisive advantage or concedes critical material to the opponent.`;
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
