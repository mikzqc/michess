import { supabase } from './supabase';
import type { CoachMoveEvidence, CoachExplanation } from '../types/coach';
import { buildCoachPrompt, validateCoachResponse, generateFallbackCoachExplanation } from '../utils/coachPrompt';

const COACH_CACHE_KEY = 'michess_coach_cache_v1';
const MAX_CACHE_ENTRIES = 200;

class CoachService {
  private cache: Map<string, CoachExplanation> = new Map();
  private inFlightRequests: Map<string, Promise<CoachExplanation>> = new Map();

  constructor() {
    this.loadCache();
  }

  private getCacheKey(evidence: CoachMoveEvidence): string {
    const fenKey = evidence.fenBefore.split(' ').slice(0, 4).join('_');
    return `${fenKey}_${evidence.uci}_${evidence.bestMove || 'nobest'}_${evidence.classification || 'none'}`;
  }

  private loadCache(): void {
    try {
      const stored = localStorage.getItem(COACH_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach(([key, val]) => this.cache.set(key, val));
        }
      }
    } catch (e) {
      console.warn('Failed to load coach explanation cache:', e);
    }
  }

  private persistCache(): void {
    try {
      // Keep only most recent entries
      if (this.cache.size > MAX_CACHE_ENTRIES) {
        const entries = Array.from(this.cache.entries()).slice(-MAX_CACHE_ENTRIES);
        this.cache = new Map(entries);
      }
      localStorage.setItem(COACH_CACHE_KEY, JSON.stringify(Array.from(this.cache.entries())));
    } catch (e) {
      console.warn('Failed to persist coach explanation cache:', e);
    }
  }

  /**
   * Retrieves a cached explanation synchronously if available.
   */
  public getCachedExplanation(evidence: CoachMoveEvidence): CoachExplanation | null {
    const key = this.getCacheKey(evidence);
    return this.cache.get(key) || null;
  }

  /**
   * Clears all cached coach explanations.
   */
  public clearCoachCache(): void {
    this.cache.clear();
    localStorage.removeItem(COACH_CACHE_KEY);
  }

  /**
   * Requests an AI Chess Coach explanation for the given move evidence.
   */
  public async getExplanation(
    evidence: CoachMoveEvidence,
    options?: { forceRefresh?: boolean }
  ): Promise<CoachExplanation> {
    const key = this.getCacheKey(evidence);

    if (!options?.forceRefresh) {
      const cached = this.cache.get(key);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    // Deduplicate concurrent requests for the same move
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key)!;
    }

    const requestPromise = (async () => {
      const prompt = buildCoachPrompt(evidence);
      const payload = { evidence, prompt };

      let rawContent: string | null = null;
      let modelUsed = 'z-ai/glm-5.3-flash';
      let fallbackAttempts: Array<{ model: string; error: string }> | undefined = undefined;
      let apiError: string | null = null;
      let quotaExhausted = false;

      // 1. Try Supabase Edge Function if supabase client is available
      if (supabase) {
        try {
          const { data, error } = await supabase.functions.invoke('coach-explain', {
            body: payload
          });

          if (!error && data?.success && data?.rawContent) {
            rawContent = data.rawContent;
            if (data.model) modelUsed = data.model;
            if (data.fallbackAttempts) fallbackAttempts = data.fallbackAttempts;
          } else if (data?.error) {
            apiError = data.error;
            quotaExhausted = !!data.quotaExhausted;
            if (data.fallbackAttempts) fallbackAttempts = data.fallbackAttempts;
          }
        } catch {
          // Edge function may not be deployed, fall through to dev API
        }
      }

      // 2. If not fulfilled, attempt local server-side middleware /api/coach-explain
      if (!rawContent && !quotaExhausted) {
        try {
          const res = await fetch('/api/coach-explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.success && data?.rawContent) {
              rawContent = data.rawContent;
              if (data.model) modelUsed = data.model;
              if (data.fallbackAttempts) fallbackAttempts = data.fallbackAttempts;
            } else if (data?.error) {
              apiError = data.error;
              quotaExhausted = !!data.quotaExhausted;
              if (data.fallbackAttempts) fallbackAttempts = data.fallbackAttempts;
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            apiError = errData?.error || `Server responded with status ${res.status}`;
            quotaExhausted = res.status === 429 || !!errData?.quotaExhausted;
            if (errData?.fallbackAttempts) fallbackAttempts = errData.fallbackAttempts;
          }
        } catch (fetchErr: any) {
          apiError = fetchErr?.message || 'Network error connecting to AI Coach endpoint';
        }
      }

      // 3. Process LLM response or fall back gracefully
      if (rawContent) {
        const validated = validateCoachResponse(rawContent, evidence);
        if (validated) {
          validated.model = modelUsed;
          validated.fallbackAttempts = fallbackAttempts;
          this.cache.set(key, validated);
          this.persistCache();
          return validated;
        }
      }

      // 4. Return reliable deterministic fallback with error context
      // Note: Never modifies Stockfish's evaluation, best move, centipawn score, or classification.
      const fallback = generateFallbackCoachExplanation(evidence, apiError || undefined);
      fallback.model = modelUsed;
      fallback.fallbackAttempts = fallbackAttempts;
      if (apiError) {
        fallback.summary += ` (AI Coach Note: ${apiError})`;
      }

      // Cache fallback so subsequent views of this move don't hammer an unconfigured endpoint
      this.cache.set(key, fallback);
      this.persistCache();
      return fallback;
    })();

    this.inFlightRequests.set(key, requestPromise);

    try {
      return await requestPromise;
    } finally {
      this.inFlightRequests.delete(key);
    }
  }
}

export const coachService = new CoachService();
