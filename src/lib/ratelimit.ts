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

/**
 * The window a limit is measured over.
 *
 * Ten minutes is right for the public site. It is wrong for a dev server,
 * where the whole test suite shares one address: the allowance would carry
 * over between runs and start refusing legitimate requests. Development keeps
 * the same ceiling over a much shorter window, so the limiter is still
 * exercised but never bleeds from one run into the next.
 */
export const windowFor = (productionMs: number): number =>
  import.meta.env.PROD ? productionMs : 30_000

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
 * Who is calling.
 *
 * x-forwarded-for is a request header, so anyone can send one. Trusting it
 * blindly turns the limit into a formality: rotate the header, get a fresh
 * allowance every time. It is only meaningful when something in front is known
 * to overwrite it, which on Vercel it does.
 *
 * So: take the forwarded header on Vercel, and everywhere else prefer the
 * socket address the adapter reports, which the caller cannot set. Behind a
 * different proxy, set TRUST_PROXY=1, and make sure that proxy overwrites
 * x-forwarded-for rather than appending to it.
 */
export function clientIp(request: Request, socketAddress?: string): string {
  const proxied = !!process.env.VERCEL || process.env.TRUST_PROXY === '1'
  if (proxied) {
    const fwd = request.headers.get('x-forwarded-for')
    if (fwd) return fwd.split(',')[0]!.trim()
    const real = request.headers.get('x-real-ip')
    if (real) return real.trim()
  }
  // Not behind a proxy we trust: the connection is the only honest signal.
  // Falling back to one shared bucket is deliberate. It throttles everyone
  // together, which is wrong but safe; per-header buckets would be no limit.
  return socketAddress?.trim() || 'direct'
}

/** JSON 429 with the header clients and crawlers expect. */
export function tooMany(retryAfter: number, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 429,
    headers: { 'content-type': 'application/json', 'retry-after': String(retryAfter) },
  })
}
