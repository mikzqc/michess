// Vercel Serverless Function: /api/coach-explain
// Supports automatic multi-tier LLM fallback for Michess on Vercel deployments.

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-info, apikey');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      info: 'Michess AI Coach endpoint is ready. Send POST requests with move evidence.',
      status: 'online'
    }));
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      return;
    }
  }

  const { evidence, prompt } = body || {};

  if (!evidence || !evidence.fenBefore || !evidence.san) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing required move evidence' }));
    return;
  }

  const apiKey = process.env.TOKENREPLY_API_KEY;
  const baseUrl = process.env.TOKENREPLY_BASE_URL || 'https://api.tokenreply.com/v1';

  if (!apiKey) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'TOKENREPLY_API_KEY is not configured in environment variables.',
      success: false
    }));
    return;
  }

  // Model chain resolution (server-side configurable)
  const resolveModelChain = (): string[] => {
    const customModels = process.env.TOKENREPLY_MODELS;
    if (customModels && customModels.trim()) {
      const list = customModels.split(',').map((m: string) => m.trim()).filter(Boolean);
      if (list.length > 0) return list;
    }

    const primary = process.env.TOKENREPLY_MODEL || 'z-ai/glm-5.3-flash';
    const customFallbacks = process.env.TOKENREPLY_FALLBACK_MODELS;

    if (customFallbacks && customFallbacks.trim()) {
      const fallbacks = customFallbacks.split(',').map((m: string) => m.trim()).filter(Boolean);
      return [primary, ...fallbacks];
    }

    if (primary === 'z-ai/glm-5.3-flash') {
      return ['z-ai/glm-5.3-flash', 'openai/gpt-oss-20b', 'north-mini-code', 'deepseek-chat'];
    }

    const defaults = ['z-ai/glm-5.3-flash', 'openai/gpt-oss-20b', 'north-mini-code', 'deepseek-chat'];
    return [primary, ...defaults.filter((m: string) => m !== primary)];
  };

  const extractRegexField = (key: string, text: string): string => {
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
  };

  const cleanTextField = (text?: string): string => {
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
  };

  const extractJsonString = (rawText: string): string | null => {
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
  };

  const normalizeCoachExplanation = (rawText: string): { summary: string; move_purpose: string; tactical_consequences: string; opponent_threat: string; better_move?: string; why_better?: string; lesson: string } | null => {
    if (!rawText || typeof rawText !== 'string') return null;
    const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // 1. Try standard JSON parse
    const jsonStr = extractJsonString(cleaned);
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === 'object') {
          const summary = cleanTextField(parsed.summary || parsed.takeaway || parsed.verdict || parsed.explanation);
          if (summary && summary.length >= 8) {
            return {
              summary,
              move_purpose: cleanTextField(parsed.move_purpose || parsed.purpose),
              tactical_consequences: cleanTextField(parsed.tactical_consequences || parsed.tactics),
              opponent_threat: cleanTextField(parsed.opponent_threat || parsed.threat),
              better_move: cleanTextField(parsed.better_move) || undefined,
              why_better: cleanTextField(parsed.why_better) || undefined,
              lesson: cleanTextField(parsed.lesson || parsed.principle) || 'Calculate forcing moves before committing.'
            };
          }
        }
      } catch {}
    }

    // 2. Resilient field-level regex extraction for partial or truncated model responses
    const summaryRegex = cleanTextField(extractRegexField('summary', cleaned));
    if (summaryRegex && summaryRegex.length >= 8) {
      return {
        summary: summaryRegex,
        move_purpose: cleanTextField(extractRegexField('move_purpose', cleaned)),
        tactical_consequences: cleanTextField(extractRegexField('tactical_consequences', cleaned)),
        opponent_threat: cleanTextField(extractRegexField('opponent_threat', cleaned)),
        better_move: cleanTextField(extractRegexField('better_move', cleaned)) || undefined,
        why_better: cleanTextField(extractRegexField('why_better', cleaned)) || undefined,
        lesson: cleanTextField(extractRegexField('lesson', cleaned)) || 'Calculate forcing moves before committing.'
      };
    }

    // 3. Fallback from plain text ONLY if it is truly non-JSON human text (never if it contains raw JSON braces or keys)
    const cleanPlain = cleaned.replace(/```[\s\S]*?```/gi, '').trim();
    if (cleanPlain.length >= 20 && !cleanPlain.startsWith('{') && !cleanPlain.includes('"summary"')) {
      const cleanHeader = cleanPlain.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').trim();
      const firstLine = cleanHeader.split('\n').filter(Boolean)[0] || '';
      const summary = firstLine.length >= 10 && firstLine.length <= 160 ? firstLine : cleanHeader.slice(0, 140).trim();
      return {
        summary,
        move_purpose: 'Controls key squares, opens lines for piece development, and improves coordination.',
        tactical_consequences: 'Maintains active tactical piece coordination.',
        opponent_threat: 'The opponent will seek central counterplay.',
        lesson: 'Look for purposeful moves that activate pieces and control key squares.'
      };
    }

    return null;
  };

  const models = resolveModelChain();
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const systemPrompt = prompt?.system || 'You are an encouraging AI Chess Coach analyzing a move in a game.';
  const userPrompt = prompt?.user || `Explain move ${evidence.moveNumber}. ${evidence.san}.`;
  const fallbackAttempts: Array<{ model: string; error: string }> = [];

  let succeeded = false;
  let finalContent = '';
  let finalModel = models[0];

  for (let i = 0; i < models.length; i++) {
    const currentModel = models[i];
    const controller = new AbortController();
    const timeoutMs = 10000; // 10s timeout per model
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 600
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!upstream.ok) {
        const errText = await upstream.text();
        const reason = `HTTP ${upstream.status}: ${errText.slice(0, 150)}`;
        console.warn(`[AI Coach] Model '${currentModel}' failed (${reason}). Retrying next fallback...`);
        fallbackAttempts.push({ model: currentModel, error: reason });
        continue;
      }

      const data = (await upstream.json()) as any;
      const content = data?.choices?.[0]?.message?.content || '';

      const normalized = normalizeCoachExplanation(content);
      if (!normalized) {
        const snippet = content.slice(0, 80).replace(/\n/g, ' ');
        console.warn(`[AI Coach] Model '${currentModel}' produced unparseable output: "${snippet}"`);
        fallbackAttempts.push({ model: currentModel, error: `Invalid output: "${snippet}"` });
        continue;
      }

      // Valid explanation obtained
      console.log(`[AI Coach] Successfully generated explanation with model '${currentModel}' (attempt ${i + 1}/${models.length}).`);
      finalContent = JSON.stringify(normalized);
      finalModel = currentModel;
      succeeded = true;
      break;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === 'AbortError';
      const reason = isTimeout ? `Timeout (${timeoutMs / 1000}s)` : (err?.message || 'Network error');
      console.warn(`[AI Coach] Model '${currentModel}' failed (${reason}). Retrying next fallback...`);
      fallbackAttempts.push({ model: currentModel, error: reason });
    }
  }

  if (succeeded) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      rawContent: finalContent,
      model: finalModel,
      fallbackAttempts: fallbackAttempts.length > 0 ? fallbackAttempts : undefined
    }));
    return;
  }

  console.warn('[AI Coach] All models in fallback chain failed:', fallbackAttempts);
  res.statusCode = 502;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    error: 'All AI Coach models timed out or were unavailable. Deterministic Stockfish analysis remains available.',
    fallbackAttempts,
    success: false
  }));
}
