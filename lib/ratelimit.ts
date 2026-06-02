import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client for rate limiting
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Auth rate limiter: 5 requests per 15 minutes per IP
 * Used for login attempts
 */
export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: true,
});

/**
 * Register rate limiter: 3 requests per hour per IP
 * Used for account registration
 */
export const registerLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  analytics: true,
});

/**
 * Coupon rate limiter: 10 requests per hour per user
 * Used for coupon code validation/redemption
 */
export const couponLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: true,
});

/**
 * API rate limiter: 100 requests per minute per user
 * Used for general API endpoints
 */
export const apiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
});

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
