// =============================================================================
// HYBRID Performance Platform — In-memory fixed-window rate limiter
// =============================================================================
//
// Good enough for a single instance and to slow credential stuffing. On a
// multi-instance deployment (Vercel), each instance keeps its own counters;
// swap for Upstash/Redis when a shared limit is required.
// =============================================================================

import type { NextRequest } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/** Returns true when the call is allowed, false when the limit is exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_BUCKETS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Test helper. */
export function resetRateLimits(): void {
  buckets.clear();
}
