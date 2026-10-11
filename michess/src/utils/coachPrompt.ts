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

  const system = `You are a world-class, encouraging AI Chess Coach analyzing a move in a game.
You explain chess clearly and accurately for beginner and intermediate players.

CRITICAL INSTRUCTIONS:
1. Stockfish engine analysis and chess.js are the absolute source of truth.
2. Use ONLY the supplied verified chess facts. NEVER fabricate attacks, pins, forks, mate threats, or evaluations not supported by the evidence.
3. If the strategic purpose of a quiet move is uncertain, explain observable positional consequences (development, center control, king safety, open files).
4. Always distinguish between verified tactical facts and strategic interpretation.
5. You MUST return ONLY a valid, parseable JSON object matching this exact schema:
{
  "summary": "1-2 sentence takeaway of the move.",
  "move_purpose": "Why this move was played and what it aims to achieve.",
  "tactical_consequences": "Concrete tactical changes (captures, checks, hanging pieces, defenses).",
  "opponent_threat": "What the opponent is threatening or how they can best respond.",
  "better_move": "Best move recommended by the engine, or empty if this move is already best.",
  "why_better": "Why the engine alternative is stronger, or empty if not applicable.",
  "lesson": "A memorable practical chess principle the student can apply in future games."
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

Verified Tactical Facts:
- Check: ${evidence.tacticalFacts.isCheck ? 'Yes' : 'No'}
- Checkmate: ${evidence.tacticalFacts.isCheckmate ? 'Yes' : 'No'}
- Capture: ${evidence.tacticalFacts.isCapture ? `Yes (captured ${evidence.tacticalFacts.capturedPiece || 'piece'})` : 'No'}
- Castling: ${evidence.tacticalFacts.isCastling ? 'Yes' : 'No'}
- Promotion: ${evidence.tacticalFacts.isPromotion ? `Yes (promoted to ${evidence.tacticalFacts.promotedTo})` : 'No'}
- Material Balance Shift: ${evidence.tacticalFacts.materialBalanceChange > 0 ? `+${evidence.tacticalFacts.materialBalanceChange}` : evidence.tacticalFacts.materialBalanceChange} pts for ${evidence.playerColorName}
- Hanging Pieces Before Move: ${evidence.tacticalFacts.hangingPiecesBefore.length > 0 ? evidence.tacticalFacts.hangingPiecesBefore.join(', ') : 'None'}
- Hanging Pieces After Move: ${evidence.tacticalFacts.hangingPiecesAfter.length > 0 ? evidence.tacticalFacts.hangingPiecesAfter.join(', ') : 'None'}

Generate the coach explanation JSON now:`;

  return { system, user };
}

/**
 * Validates and sanitizes raw JSON returned by the model.
 */
export function extractJsonString(rawText: string): string | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }
  return trimmed;
}

export function validateCoachResponse(rawText: string, evidence: CoachMoveEvidence): CoachExplanation | null {
  try {
    const cleanText = extractJsonString(rawText);
    if (!cleanText) return null;

    const parsed = JSON.parse(cleanText);

    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) return null;
    if (typeof parsed.move_purpose !== 'string') return null;

    return {
      summary: parsed.summary.trim(),
      move_purpose: (parsed.move_purpose || '').trim(),
      tactical_consequences: (parsed.tactical_consequences || '').trim(),
      opponent_threat: (parsed.opponent_threat || '').trim(),
      better_move: parsed.better_move ? parsed.better_move.trim() : (evidence.bestMoveSan || undefined),
      why_better: parsed.why_better ? parsed.why_better.trim() : undefined,
      lesson: parsed.lesson ? parsed.lesson.trim() : 'Calculate forcing moves before committing.',
      generatedAt: Date.now()
    };
  } catch {
    return null;
  }
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
