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
  const model = Deno.env.get("TOKENREPLY_MODEL") || "deepseek-chat";
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

  const systemPrompt = prompt?.system || "You are an encouraging AI Chess Coach analyzing a move in a game.";
  const userPrompt = prompt?.user || `Explain move ${evidence.moveNumber}. ${evidence.san}.`;

  try {
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 650
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text();
      let isQuota = upstreamResponse.status === 429 || errText.toLowerCase().includes("quota") || errText.toLowerCase().includes("balance");

      return new Response(JSON.stringify({
        error: `TokenReply API error (${upstreamResponse.status}): ${errText.slice(0, 200)}`,
        quotaExhausted: isQuota,
        success: false
      }), {
        status: upstreamResponse.status === 429 ? 429 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const data = await upstreamResponse.json();
    const content = data?.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({
      success: true,
      rawContent: content,
      model
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    return new Response(JSON.stringify({
      error: isTimeout ? "Request to TokenReply timed out after 20s" : (err?.message || "Internal server error"),
      success: false
    }), {
      status: isTimeout ? 504 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
