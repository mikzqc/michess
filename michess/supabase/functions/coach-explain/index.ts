// Supabase Edge Function: coach-explain
// Integrates with TokenReply OpenAI-compatible endpoint securely without exposing credentials.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// Rate limiting: simple in-memory tracker (30 requests per minute per client)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientId);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (record.count >= 30) {
    return false;
  }

  record.count++;
  return true;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ 
      error: "Rate limit exceeded. Please wait a minute before requesting more coach explanations.",
      rateLimited: true 
    }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Size limit validation (15KB max payload)
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength > 15360) {
    return new Response(JSON.stringify({ error: "Payload too large (max 15KB)" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { evidence, prompt } = body;
  if (!evidence || !evidence.fenBefore || !evidence.san) {
    return new Response(JSON.stringify({ error: "Missing required move evidence" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Server-side environment variables
  const apiKey = Deno.env.get("TOKENREPLY_API_KEY");
  const baseUrl = Deno.env.get("TOKENREPLY_BASE_URL") || "https://api.tokenreply.com/v1";

  if (!apiKey) {
    return new Response(JSON.stringify({
      error: "TOKENREPLY_API_KEY is not configured on the server. Please configure it in your Supabase project settings.",
      success: false
    }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Model chain resolution (server-side configurable)
  const resolveModelChain = (): string[] => {
    const customModels = Deno.env.get("TOKENREPLY_MODELS");
    if (customModels && customModels.trim()) {
      const list = customModels.split(',').map(m => m.trim()).filter(Boolean);
      if (list.length > 0) return list;
    }

    const primary = Deno.env.get("TOKENREPLY_MODEL") || "z-ai/glm-5.3-flash";
    const customFallbacks = Deno.env.get("TOKENREPLY_FALLBACK_MODELS");

    if (customFallbacks && customFallbacks.trim()) {
      const fallbacks = customFallbacks.split(',').map(m => m.trim()).filter(Boolean);
      return [primary, ...fallbacks];
    }

    if (primary === "z-ai/glm-5.3-flash") {
      return ["z-ai/glm-5.3-flash", "openai/gpt-oss-20b", "north-mini-code"];
    }

    const defaults = ["z-ai/glm-5.3-flash", "openai/gpt-oss-20b", "north-mini-code"];
    return [primary, ...defaults.filter(m => m !== primary)];
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

  const normalizeCoachExplanation = (rawText: string): any => {
    if (!rawText || typeof rawText !== 'string') return null;
    const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

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

    return null;
  };

  const systemPrompt = prompt?.system || "You are an encouraging AI Chess Coach analyzing a move in a game.";
  const userPrompt = prompt?.user || `Explain move ${evidence.moveNumber}. ${evidence.san}.`;

  const models = resolveModelChain();
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const fallbackAttempts: Array<{ model: string; error: string }> = [];

  let succeeded = false;
  let finalContent = "";
  let finalModel = models[0];

  for (let i = 0; i < models.length; i++) {
    const currentModel = models[i];
    const controller = new AbortController();
    const timeoutMs = i === 0 ? 11000 : 9000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upstreamResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 600
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!upstreamResponse.ok) {
        const errText = await upstreamResponse.text();
        const reason = `HTTP ${upstreamResponse.status}: ${errText.slice(0, 150)}`;
        console.warn(`[AI Coach] Model '${currentModel}' failed (${reason}). Retrying next fallback...`);
        fallbackAttempts.push({ model: currentModel, error: reason });
        continue;
      }

      const data = await upstreamResponse.json();
      const content = data?.choices?.[0]?.message?.content || "";

      const normalized = normalizeCoachExplanation(content);
      if (!normalized) {
        console.warn(`[AI Coach] Model '${currentModel}' produced invalid non-JSON output. Retrying next fallback...`);
        fallbackAttempts.push({ model: currentModel, error: "Invalid structured output" });
        continue;
      }

      // Valid response obtained
      console.log(`[AI Coach] Successfully generated explanation with model '${currentModel}' (attempt ${i + 1}/${models.length}).`);
      finalContent = JSON.stringify(normalized);
      finalModel = currentModel;
      succeeded = true;
      break;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === "AbortError";
      const reason = isTimeout ? `Timeout (${timeoutMs / 1000}s)` : (err?.message || "Network error");
      console.warn(`[AI Coach] Model '${currentModel}' failed (${reason}). Retrying next fallback...`);
      fallbackAttempts.push({ model: currentModel, error: reason });
    }
  }

  if (succeeded) {
    return new Response(JSON.stringify({
      success: true,
      rawContent: finalContent,
      model: finalModel,
      fallbackAttempts: fallbackAttempts.length > 0 ? fallbackAttempts : undefined
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  console.warn(`[AI Coach] All models in fallback chain failed:`, fallbackAttempts);
  return new Response(JSON.stringify({
    success: false,
    error: "All AI Coach models timed out or were unavailable. Deterministic Stockfish analysis remains available.",
    fallbackAttempts
  }), {
    status: 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
