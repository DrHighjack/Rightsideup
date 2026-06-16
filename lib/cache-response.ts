import { NextResponse } from "next/server";

/**
 * Create a cached response with proper HTTP headers
 */
export function createCachedResponse<T>(
  data: T,
  maxAge: number = 60
): NextResponse<T> {
  const response = NextResponse.json(data);

  // Set cache control headers
  response.headers.set(
    "Cache-Control",
    `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=120`
  );

  return response;
}

/**
 * Create an authenticated cached response
 */
export function createAuthenticatedCachedResponse<T>(
  data: T,
  maxAge: number = 60
): NextResponse<T> {
  const response = NextResponse.json(data);

  // For authenticated endpoints: shorter cache, but allow stale content while revalidating
  response.headers.set(
    "Cache-Control",
    `private, max-age=${maxAge}, stale-while-revalidate=120`
  );

  return response;
}

/**
 * Create a long-lived cached response (for data that rarely changes)
 */
export function createLongCachedResponse<T>(
  data: T,
  maxAge: number = 3600
): NextResponse<T> {
  const response = NextResponse.json(data);

  response.headers.set(
    "Cache-Control",
    `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=604800`
  );

  return response;
}

/**
 * Create a no-cache response (for real-time data)
 */
export function createNoCacheResponse<T>(data: T): NextResponse<T> {
  const response = NextResponse.json(data);

  response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}
