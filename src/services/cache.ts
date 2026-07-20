import { DataStore } from './data-store';
import crypto from 'crypto';

export class CacheLayer {
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private dataStore: DataStore;

  constructor(dataStore: DataStore) {
    this.dataStore = dataStore;
  }

  async get(key: string): Promise<any | null> {
    const cacheKey = this.getCacheKey(key);
    const cached = await this.dataStore.get(cacheKey);

    if (!cached) {
      return null;
    }

    const { value, expiresAt } = cached;
    const now = Date.now();

    if (now > expiresAt) {
      // Cache expired, delete it
      await this.dataStore.delete(cacheKey);
      return null;
    }

    return value;
  }

  /**
   * Set a cache entry with optional TTL in milliseconds.
   * @param key Cache key
   * @param value Value to cache
   * @param ttlMs Time-to-live in milliseconds (default: 5 minutes)
   * 
   * Common TTLs:
   * - Static data (parking lot info): 24 * 60 * 60 * 1000 (24 hours)
   * - Availability data: 5 * 60 * 1000 (5 minutes)
   * - Traffic data: 5 * 60 * 1000 (5 minutes)
   */
  async set(key: string, value: any, ttlMs?: number): Promise<void> {
    const cacheKey = this.getCacheKey(key);
    const expiresAt = Date.now() + (ttlMs || this.DEFAULT_TTL);

    await this.dataStore.set(cacheKey, {
      value,
      expiresAt,
    });
  }

  async clear(key: string): Promise<void> {
    const cacheKey = this.getCacheKey(key);
    await this.dataStore.delete(cacheKey);
  }

  generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${JSON.stringify(params[key])}`)
      .join('&');

    const hash = crypto
      .createHash('md5')
      .update(sortedParams)
      .digest('hex');

    return `${prefix}:${hash}`;
  }

  private getCacheKey(key: string): string {
    return `cache:${key}`;
  }

  // Cleanup expired cache entries
  async cleanupExpired(): Promise<void> {
    const cacheKeys = await this.dataStore.listKeys('cache:');
    const now = Date.now();

    for (const key of cacheKeys) {
      const cached = await this.dataStore.get(key);
      if (cached && cached.expiresAt < now) {
        await this.dataStore.delete(key);
      }
    }
  }
}
