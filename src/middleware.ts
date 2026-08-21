/**
 * Security headers.
 *
 * Middleware only runs for routes rendered on demand, so on Vercel the 134
 * prerendered pages are served straight from the edge and never reach this
 * file. The same headers are therefore declared in vercel.json, which does
 * apply to static responses. Keeping both means local `npm run dev`, a plain
 * Node deployment, and Vercel all send the same thing. If you change one list,
 * change the other.
 */
import { defineMiddleware } from 'astro:middleware'

/**
 * script-src has to allow 'unsafe-inline': Astro compiles `define:vars`
 * islands to inline <script> tags, and the assistant and motion system both
 * use them. That weakens the anti-XSS half of CSP, so the escaping in those
 * components is what actually holds the line. The rest of the policy still
 * pays for itself: it blocks external script hosts, plugins, base tag
 * injection and framing.
 */
export const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  // the service area map and the video gallery
  'frame-src https://www.google.com https://maps.google.com https://player.vimeo.com https://vimeo.com',
].join('; ')

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
  'Content-Security-Policy': CSP,
}

export const onRequest = defineMiddleware(async (_ctx, next) => {
  const res = await next()
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!res.headers.has(name)) res.headers.set(name, value)
  }
  return res
})
