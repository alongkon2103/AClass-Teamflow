/**
 * In-memory fixed-window rate limiter for login attempts (SPEC 5.1: 5/min/IP).
 *
 * Deliberately process-local: it needs no infrastructure and is correct for a
 * single-instance deployment. Running multiple instances would need a shared
 * store (Redis/Upstash) — revisit before horizontal scaling.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Bound memory growth: drop expired buckets whenever the map gets large.
const MAX_BUCKETS = 10_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit = 5,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Test/maintenance helper — clears all buckets. */
export function resetRateLimits() {
  buckets.clear();
}
