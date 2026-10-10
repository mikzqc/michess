import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper to parse .env or .env.local file if env vars are not set
function loadEnvFile(filename) {
  const filePath = path.join(projectRoot, filename);
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

const localEnv = {
  ...loadEnvFile('.env'),
  ...loadEnvFile('.env.local'),
};

const DEFAULT_SUPABASE_URL = 'https://azcgiieritmsabfomqow.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_LGNAOAaNN43C0caiFD_VjQ_6atOakWA';

const supabaseUrl = 
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  localEnv.VITE_SUPABASE_URL ||
  localEnv.SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabaseKey = 
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  localEnv.VITE_SUPABASE_ANON_KEY ||
  localEnv.SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Heartbeat Error] Missing Supabase URL or Anon Key.');
  console.error('Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment or .env.local.');
  process.exit(1);
}

async function pingDatabase() {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    // Directly queries PostgREST (SELECT id FROM profiles LIMIT 1).
    // This executes an actual SQL query on the Postgres engine, ensuring Supabase
    // pause monitor detects live database activity.
    const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/profiles?select=id&limit=1`;
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    const duration = Date.now() - start;
    if (response.ok) {
      const data = await response.json();
      console.log(`[${timestamp}] Heartbeat SUCCESS (${duration}ms) - Postgres query executed! Result:`, data);
      return true;
    } else {
      const text = await response.text();
      console.error(`[${timestamp}] Heartbeat WARNING (${response.status} ${response.statusText}):`, text);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[${timestamp}] Heartbeat FAILED (${duration}ms):`, error.message);
    return false;
  }
}

// Check arguments
const isDaemon = process.argv.includes('--daemon') || process.argv.includes('-d');
const intervalArgIdx = process.argv.findIndex(arg => arg === '--interval' || arg === '-i');
const intervalHours = intervalArgIdx !== -1 && process.argv[intervalArgIdx + 1] 
  ? parseFloat(process.argv[intervalArgIdx + 1]) 
  : 12; // default 12 hours

if (isDaemon) {
  console.log(`Starting Supabase Keep-Alive Daemon. Pinging every ${intervalHours} hour(s)...`);
  pingDatabase();
  const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;
  setInterval(pingDatabase, intervalMs);
} else {
  // Single-run mode (ideal for cron jobs, GitHub Actions, or scheduled executions)
  pingDatabase().then(success => {
    process.exit(success ? 0 : 1);
  });
}
