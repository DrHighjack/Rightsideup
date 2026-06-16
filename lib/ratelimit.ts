import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasUpstashConfig = Boolean(upstashUrl && upstashToken);

// Initialize Redis client for rate limiting when configured.
const redis = hasUpstashConfig
  ? new Redis({
      url: upstashUrl!,
      token: upstashToken!,
    })
  : null;

const passThroughLimiter = {
  async limit() {
    return { success: true, limit: 0, remaining: 0, reset: 0, pending: Promise.resolve() };
  },
};

/**
 * Auth rate limiter: 5 requests per 15 minutes per IP
 * Used for login attempts
 */
const authLimiterConfigured = new Ratelimit({
  redis: (redis as any),
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: true,
});

/**
 * Register rate limiter: 3 requests per hour per IP
 * Used for account registration
 */
const registerLimiterConfigured = new Ratelimit({
  redis: (redis as any),
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  analytics: true,
});

/**
 * Coupon rate limiter: 10 requests per hour per user
 * Used for coupon code validation/redemption
 */
const couponLimiterConfigured = new Ratelimit({
  redis: (redis as any),
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: true,
});

/**
 * API rate limiter: 100 requests per minute per user
 * Used for general API endpoints
 */
const apiLimiterConfigured = new Ratelimit({
  redis: (redis as any),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
});

if (!hasUpstashConfig) {
  console.warn('[RATE LIMIT] UPSTASH_REDIS_REST_URL/TOKEN missing; rate limiting disabled');
}

export const authLimiter = hasUpstashConfig ? authLimiterConfigured : passThroughLimiter;
export const registerLimiter = hasUpstashConfig ? registerLimiterConfigured : passThroughLimiter;
export const couponLimiter = hasUpstashConfig ? couponLimiterConfigured : passThroughLimiter;
export const apiLimiter = hasUpstashConfig ? apiLimiterConfigured : passThroughLimiter;

/**
 * Helper function to get identifier for rate limiting
 * @param ip - IP address for IP-based limiting
 * @param userId - User ID for user-based limiting
 * @returns Identifier string
 */
export function getIdentifier(ip?: string, userId?: string): string {
  if (userId) return `user:${userId}`;
  return `ip:${ip || 'unknown'}`;
}
