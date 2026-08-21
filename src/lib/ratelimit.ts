/**
 * Sliding window rate limit, held in memory.
 *
 * Serverless gives each instance its own memory, so a request spread across
 * several warm instances gets a slightly higher effective ceiling than the
 * number below. That is fine for what this defends against: one script
 * hammering the public form. It is not a defence against a distributed flood,
 * and it is deliberately not backed by the database, because writing a row per
 * attempt would hand an attacker the very cost we are trying to avoid.
 */

type Window = { hits: number[] }

const buckets = new Map<string, Window>()

/** Stop the map growing without bound on a long-lived instance. */
function sweep(now: number, windowMs: number) {
  if (buckets.size < 500) return
  for (const [key, w] of buckets) {
    if (!w.hits.some((t) => now - t < windowMs)) buckets.delete(key)
  }
}

export interface RateVerdict {
  ok: boolean
  /** seconds the caller should wait before trying again */
  retryAfter: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateVerdict {
  const now = Date.now()
  sweep(now, windowMs)

  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs)

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket)
    const oldest = bucket.hits[0]
    return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) }
  }

  bucket.hits.push(now)
  buckets.set(key, bucket)
  return { ok: true, retryAfter: 0 }
}

/**
 * Best available caller address. Vercel sets x-forwarded-for; the first entry
 * is the client, the rest are proxies. Falls back to a constant so a missing
 * header shares one bucket rather than bypassing the limit entirely.
 */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** JSON 429 with the header clients and crawlers expect. */
export function tooMany(retryAfter: number, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 429,
    headers: { 'content-type': 'application/json', 'retry-after': String(retryAfter) },
  })
}
