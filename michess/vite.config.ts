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
        const model = env.TOKENREPLY_MODEL || process.env.TOKENREPLY_MODEL || 'deepseek-chat';
        const baseUrl = env.TOKENREPLY_BASE_URL || process.env.TOKENREPLY_BASE_URL || 'https://api.tokenreply.com/v1';

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

            const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);

            const upstream = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: prompt?.system || 'You are an encouraging AI Chess Coach analyzing a move in a game.' },
                  { role: 'user', content: prompt?.user || `Explain move ${evidence.moveNumber}. ${evidence.san}.` }
                ],
                temperature: 0.3,
                max_tokens: 650
              }),
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!upstream.ok) {
              const errText = await upstream.text();
              const isQuota = upstream.status === 429 || errText.toLowerCase().includes('quota') || errText.toLowerCase().includes('balance');
              res.statusCode = upstream.status === 429 ? 429 : 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: `TokenReply API error (${upstream.status}): ${errText.slice(0, 200)}`,
                quotaExhausted: isQuota,
                success: false
              }));
              return;
            }

            const data = (await upstream.json()) as any;
            const content = data?.choices?.[0]?.message?.content || '';

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              rawContent: content,
              model
            }));
          } catch (err: any) {
            const isTimeout = err?.name === 'AbortError';
            res.statusCode = isTimeout ? 504 : 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: isTimeout ? 'Request to TokenReply timed out after 20s' : (err?.message || 'Internal server error'),
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