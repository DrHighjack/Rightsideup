import { Redis } from "@upstash/redis";

// Redis caching layer for high-traffic queries
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface CacheOptions {
  ttl?: number; // seconds, default 300 (5 minutes)
}

/**
 * Get value from Redis cache
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    return value as T | null;
  } catch (error) {
    console.error(`[CACHE] Error getting ${key}:`, error);
    return null;
  }
}

/**
 * Set value in Redis cache
 */
export async function setCached<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  try {
    const { ttl = 300 } = options;
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error(`[CACHE] Error setting ${key}:`, error);
  }
}

/**
 * Delete cache key
 */
export async function clearCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`[CACHE] Error deleting ${key}:`, error);
  }
}

/**
 * Clear multiple cache keys by pattern
 */
export async function clearCachePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error(`[CACHE] Error clearing pattern ${pattern}:`, error);
  }
}

/**
 * Get or set cache with fallback function
 */
export async function getOrSet<T>(
  key: string,
  fallback: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try cache first
  const cached = await getCached<T>(key);
  if (cached) {
    return cached;
  }

  // Fetch if not cached
  const value = await fallback();

  // Store in cache
  await setCached(key, value, options);

  return value;
}
