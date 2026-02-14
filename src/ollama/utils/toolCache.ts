import type { FunctionResult } from '../types';

/**
 * TTL-based cache for query tool results.
 * Eliminates redundant calls to getSchemaStructure(), getSystemOverview(), etc.
 * Invalidated whenever a schema/character mutation occurs.
 */

interface CacheEntry {
  result: FunctionResult;
  expiry: number;
}

// Tools that should never be cached (external/mutable sources)
const UNCACHEABLE = new Set(['webFetch', 'readMemory', 'writeMemory', 'readRefinements', 'updateRefinements']);

export class ToolResultCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 5 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  private makeKey(name: string, args: Record<string, any>): string {
    // Sort keys for stable serialization
    const sortedArgs = Object.keys(args).sort().reduce((acc, key) => {
      acc[key] = args[key];
      return acc;
    }, {} as Record<string, any>);
    return `${name}:${JSON.stringify(sortedArgs)}`;
  }

  /**
   * Get cached result if valid, or null if miss/expired.
   */
  get(name: string, args: Record<string, any>): FunctionResult | null {
    if (UNCACHEABLE.has(name)) return null;

    const key = this.makeKey(name, args);
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    console.log(`[Sigil] Cache hit: ${name}`);
    return entry.result;
  }

  /**
   * Store a result in the cache.
   */
  set(name: string, args: Record<string, any>, result: FunctionResult, ttlMs?: number): void {
    if (UNCACHEABLE.has(name)) return;
    // Only cache successful results
    if (!result.success) return;

    const key = this.makeKey(name, args);
    this.cache.set(key, {
      result,
      expiry: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  /**
   * Invalidate all cached results. Called after any mutation tool executes.
   */
  invalidateAll(): void {
    if (this.cache.size > 0) {
      console.log(`[Sigil] Cache invalidated (${this.cache.size} entries cleared)`);
      this.cache.clear();
    }
  }
}
