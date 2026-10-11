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
      return ['z-ai/glm-5.3-flash', 'openai/gpt-oss-20b', 'north-mini-code'];
    }

    const defaults = ['z-ai/glm-5.3-flash', 'openai/gpt-oss-20b', 'north-mini-code'];
    return [primary, ...defaults.filter((m: string) => m !== primary)];
  };

  const extractJsonString = (rawText: string): string | null => {
    if (!rawText || typeof rawText !== 'string') return null;
    const trimmed = rawText.trim();
    // 1. Match code fences ```json ... ```
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    // 2. Match outermost braces { ... }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1).trim();
    }
    return trimmed;
  };

  const isValidCoachJson = (rawText: string): boolean => {
    const jsonStr = extractJsonString(rawText);
    if (!jsonStr) return false;
    try {
      const parsed = JSON.parse(jsonStr);
      return Boolean(
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.summary === 'string' &&
        parsed.summary.trim().length > 0
      );
    } catch {
      return false;
    }
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
    // 11s for primary, 9s for fallbacks to avoid timing out on normal inference
    const timeoutMs = i === 0 ? 11000 : 9000;
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
          max_tokens: 420
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

      if (!isValidCoachJson(content)) {
        console.warn(`[AI Coach] Model '${currentModel}' produced invalid non-JSON output. Retrying next fallback...`);
        fallbackAttempts.push({ model: currentModel, error: 'Invalid structured output' });
        continue;
      }

      // Valid explanation obtained
      console.log(`[AI Coach] Successfully generated explanation with model '${currentModel}' (attempt ${i + 1}/${models.length}).`);
      finalContent = extractJsonString(content) || content;
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
