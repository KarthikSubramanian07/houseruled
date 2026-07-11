// Coarse per-IP rate limiting for the public AI endpoints, backed by the same KV
// used for rule caching. Fixed-window counters (eventually-consistent KV is fine
// for abuse throttling). Fails OPEN if KV or the client IP is unavailable - this
// protects the Groq bill, it must never take the feature down.

/** Minimal KV surface (avoids depending on @cloudflare/workers-types here). */
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

/** The client's IP, as Cloudflare sees it. */
export function clientIp(request: Request): string {
  const cf = request.headers.get("CF-Connecting-IP")?.trim();
  if (cf) return cf;
  const xff = request.headers.get("X-Forwarded-For");
  if (!xff) return "";
  return xff.split(",")[0]?.trim() ?? "";
}

export interface RateResult {
  ok: boolean;
  retryAfter: number; // seconds
}

/**
 * Allow up to `limit` requests per `windowSec` for `id` in `bucket`. Also enforces
 * an optional global ceiling across all callers of the bucket (bill protection).
 */
export async function rateLimit(
  kv: KVLike | undefined,
  bucket: string,
  id: string,
  limit: number,
  windowSec: number,
  globalPerDay?: number,
): Promise<RateResult> {
  if (!kv || !id) return { ok: true, retryAfter: 0 }; // fail open

  const now = Date.now();
  const windowKey = `rl:${bucket}:${id}:${Math.floor(now / (windowSec * 1000))}`;
  try {
    const current = parseInt((await kv.get(windowKey)) ?? "0", 10) || 0;
    if (current >= limit) return { ok: false, retryAfter: windowSec };

    if (globalPerDay && globalPerDay > 0) {
      const dayKey = `rl:${bucket}:global:${Math.floor(now / 86_400_000)}`;
      const dayCount = parseInt((await kv.get(dayKey)) ?? "0", 10) || 0;
      if (dayCount >= globalPerDay) return { ok: false, retryAfter: 3600 };
      await kv.put(dayKey, String(dayCount + 1), { expirationTtl: 86_400 * 2 });
    }

    await kv.put(windowKey, String(current + 1), { expirationTtl: windowSec * 2 });
    return { ok: true, retryAfter: 0 };
  } catch {
    return { ok: true, retryAfter: 0 }; // KV hiccup → don't block real users
  }
}

/** A 429 response with a Retry-After header. */
export function tooMany(retryAfter: number): Response {
  return Response.json(
    { ok: false, error: "You're going a little fast - give it a moment." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
