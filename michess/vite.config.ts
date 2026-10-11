import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function tokenReplyCoachPlugin(): Plugin {
  return {
    name: 'tokenreply-coach-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/coach-explain', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const env = loadEnv(server.config.mode, process.cwd(), '');
        const apiKey = env.TOKENREPLY_API_KEY || process.env.TOKENREPLY_API_KEY;
        const baseUrl = env.TOKENREPLY_BASE_URL || process.env.TOKENREPLY_BASE_URL || 'https://api.tokenreply.com/v1';

        // Server-side model fallback chain resolution
        const resolveModelChain = (): string[] => {
          const customModels = env.TOKENREPLY_MODELS || process.env.TOKENREPLY_MODELS;
          if (customModels && customModels.trim()) {
            const list = customModels.split(',').map((m: string) => m.trim()).filter(Boolean);
            if (list.length > 0) return list;
          }

          const primary = env.TOKENREPLY_MODEL || process.env.TOKENREPLY_MODEL || 'z-ai/glm-5.3-flash';
          const customFallbacks = env.TOKENREPLY_FALLBACK_MODELS || process.env.TOKENREPLY_FALLBACK_MODELS;

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

        const isValidCoachJson = (rawText: string): boolean => {
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
        };

        let bodyRaw = '';
        req.on('data', chunk => {
          bodyRaw += chunk;
          if (bodyRaw.length > 15360) {
            res.statusCode = 413;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Payload too large (max 15KB)' }));
            req.destroy();
          }
        });

        req.on('end', async () => {
          try {
            const body = JSON.parse(bodyRaw || '{}');
            const { evidence, prompt } = body;

            if (!evidence || !evidence.fenBefore || !evidence.san) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing required move evidence' }));
              return;
            }

            if (!apiKey) {
              res.statusCode = 503;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: 'TOKENREPLY_API_KEY is not configured on the server. Please add it to your environment or .env.local file.',
                success: false
              }));
              return;
            }

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
              const timeoutId = setTimeout(() => controller.abort(), 7500); // 7.5s short timeout

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
                    max_tokens: 650
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

                // Succeeded with valid structured output
                console.log(`[AI Coach] Successfully generated explanation with model '${currentModel}' (attempt ${i + 1}/${models.length}).`);
                finalContent = content;
                finalModel = currentModel;
                succeeded = true;
                break;
              } catch (err: any) {
                clearTimeout(timeoutId);
                const isTimeout = err?.name === 'AbortError';
                const reason = isTimeout ? 'Timeout (7.5s)' : (err?.message || 'Network error');
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
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: err?.message || 'Internal server error',
              success: false
            }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tokenReplyCoachPlugin(),
  ],
})