import type { EngineEvaluation } from '../types/review';
import { Chess } from 'chess.js';

class ReviewCache {
  private memoryCache: Map<string, EngineEvaluation> = new Map();
  private maxLocalStorageItems = 2000;

  constructor() {
    this.purgeLegacyCaches();
    this.loadFromStorage();
  }

  private purgeLegacyCaches() {
    try {
      localStorage.removeItem('michess_review_cache_v4');
      localStorage.removeItem('michess_review_cache_v3');
      localStorage.removeItem('michess_review_cache_v2');
      localStorage.removeItem('michess_review_cache_v1');
    } catch {}
  }

  private generateKey(fen: string, depth: number): string {
    // Simplify FEN to ignore halfmove clock and fullmove number for cache hit rate
    const parts = fen.split(' ');
    const coreFen = parts.slice(0, 4).join(' ');
    return `${coreFen}|d${depth}`;
  }

  public get(fen: string, depth: number): EngineEvaluation | null {
    const key = this.generateKey(fen, depth);
    return this.memoryCache.get(key) || null;
  }

  public set(fen: string, depth: number, evaluation: EngineEvaluation): void {
    if (evaluation.bestmove && evaluation.bestmove !== '(none)') {
      try {
        const c = new Chess(fen);
        const legal = c.moves({ verbose: true }).some(m => {
          const uci = `${m.from}${m.to}${m.promotion || ''}`;
          return uci === evaluation.bestmove || evaluation.bestmove!.startsWith(m.from + m.to);
        });
        if (!legal) {
          console.warn(`[ReviewCache] Discarding invalid bestmove "${evaluation.bestmove}" for FEN "${fen}"`);
          return;
        }
      } catch {}
    }

    const key = this.generateKey(fen, depth);
    this.memoryCache.set(key, evaluation);
    this.saveToStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('michess_review_cache_v5');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.memoryCache = new Map(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load review cache from localStorage', e);
    }
  }

  private saveToStorage() {
    try {
      // Prevent localStorage quota errors by limiting size
      if (this.memoryCache.size > this.maxLocalStorageItems) {
        const entries = Array.from(this.memoryCache.entries());
        const toKeep = entries.slice(entries.length - this.maxLocalStorageItems);
        this.memoryCache = new Map(toKeep);
      }
      
      localStorage.setItem(
        'michess_review_cache_v5', 
        JSON.stringify(Array.from(this.memoryCache.entries()))
      );
    } catch (e) {
      console.warn('Failed to save review cache to localStorage', e);
    }
  }

  public clear(): void {
    this.memoryCache.clear();
    try {
      localStorage.removeItem('michess_review_cache_v5');
      localStorage.removeItem('michess_review_cache_v4');
      localStorage.removeItem('michess_review_cache_v3');
    } catch (e) {
      console.warn('Failed to clear review cache from localStorage', e);
    }
  }
}

export const reviewCache = new ReviewCache();
