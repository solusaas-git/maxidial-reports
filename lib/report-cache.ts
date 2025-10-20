/**
 * Simple in-memory cache for report data
 * Prevents redundant API calls when generating PDFs
 */

import { ReportData } from './report-generator';

interface CacheEntry {
  data: ReportData;
  timestamp: number;
  expiresAt: number;
}

// Global cache storage to persist across module reloads
// Use globalThis to ensure it's truly global across all contexts
declare global {
  var __reportCache: Map<string, CacheEntry> | undefined;
}

class ReportCache {
  private cache: Map<string, CacheEntry>;
  private defaultTTL = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Use globalThis to ensure cache persists across API routes
    if (!globalThis.__reportCache) {
      globalThis.__reportCache = new Map<string, CacheEntry>();
    }
    this.cache = globalThis.__reportCache;
  }

  /**
   * Generate cache key from report parameters
   */
  private generateKey(reportType: string, startDate: string, endDate: string): string {
    return `${reportType}:${startDate}:${endDate}`;
  }

  /**
   * Store report data in cache
   */
  set(reportType: string, startDate: string, endDate: string, data: ReportData, ttl?: number): void {
    const key = this.generateKey(reportType, startDate, endDate);
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
    });

    console.log(`[Report Cache] ✅ Cached report: ${key} (expires in ${Math.round((ttl || this.defaultTTL) / 1000)}s)`);
    console.log(`[Report Cache] Cache size: ${this.cache.size} entries`);
    
    // Clean up expired entries
    this.cleanup();
  }

  /**
   * Get report data from cache
   */
  get(reportType: string, startDate: string, endDate: string): ReportData | null {
    const key = this.generateKey(reportType, startDate, endDate);
    console.log(`[Report Cache] Looking for: ${key}`);
    console.log(`[Report Cache] Available keys: ${Array.from(this.cache.keys()).join(', ')}`);
    
    const entry = this.cache.get(key);

    if (!entry) {
      console.log(`[Report Cache] ❌ Cache miss: ${key}`);
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      console.log(`[Report Cache] ⏰ Cache expired: ${key}`);
      this.cache.delete(key);
      return null;
    }

    const age = Math.round((now - entry.timestamp) / 1000);
    console.log(`[Report Cache] ✅ Cache hit: ${key} (age: ${age}s)`);
    return entry.data;
  }

  /**
   * Check if a report is cached and valid
   */
  has(reportType: string, startDate: string, endDate: string): boolean {
    const data = this.get(reportType, startDate, endDate);
    return data !== null;
  }

  /**
   * Invalidate (delete) a specific cache entry
   */
  invalidate(reportType: string, startDate: string, endDate: string): void {
    const key = this.generateKey(reportType, startDate, endDate);
    this.cache.delete(key);
    console.log(`[Report Cache] Invalidated: ${key}`);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    console.log(`[Report Cache] Cleared ${count} entries`);
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    // Convert to array to avoid iterator issues
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[Report Cache] Cleaned up ${removed} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; entries: Array<{ key: string; age: number; expiresIn: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Math.round((now - entry.timestamp) / 1000),
      expiresIn: Math.round((entry.expiresAt - now) / 1000),
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }
}

// Singleton instance
export const reportCache = new ReportCache();

// Auto cleanup every 5 minutes
setInterval(() => {
  reportCache.cleanup();
}, 5 * 60 * 1000);

