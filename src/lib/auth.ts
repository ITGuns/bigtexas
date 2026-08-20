/**
 * Minimal session auth for the admin area: one shared password, an
 * HMAC-signed cookie, no user table.
 *
 * In production both ADMIN_PASSWORD and ADMIN_SECRET are required. If either
 * is missing the panel refuses every login rather than falling back to a
 * default, because this repository is public and a known default would be no
 * protection at all. A missing ADMIN_SECRET is equally fatal on serverless:
 * each instance would sign cookies with a different random key, so sessions
 * would appear to work and then break at random.
 *
 * In development the defaults below are allowed so the panel is usable
 * straight after clone, and the UI shows a warning while they are in use.
 */
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import type { AstroCookies } from 'astro'

const COOKIE = 'btc_admin'
const MAX_AGE = 60 * 60 * 12 // 12 hours

const isProd = import.meta.env.PROD

/** Astro serves .env via import.meta.env; Vercel and Node use process.env. */
const readEnv = (name: string): string | undefined =>
  (import.meta.env as Record<string, string | undefined>)[name] ?? process.env[name]

const envPassword = readEnv('ADMIN_PASSWORD')
const envSecret = readEnv('ADMIN_SECRET')

const DEV_PASSWORD = 'bigtexas'

const password = envPassword ?? (isProd ? null : DEV_PASSWORD)
const secret = envSecret ?? (isProd ? null : randomBytes(32).toString('hex'))

/** True when the deployment is still on the built-in development defaults. */
export const usingDefaultPassword = !envPassword

/** True when the panel cannot accept a login because config is missing. */
export const authUnconfigured = isProd && (!envPassword || !envSecret)

if (authUnconfigured) {
  console.error(
    '[auth] ADMIN_PASSWORD and ADMIN_SECRET must both be set in production. The admin panel is locked until they are.',
  )
}

function sign(value: string): string {
  if (!secret) throw new Error('ADMIN_SECRET is not configured')
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function checkPassword(candidate: string): boolean {
  if (!password || authUnconfigured) return false
  return safeEqual(candidate, password)
}

export function issueSession(cookies: AstroCookies) {
  const expires = Date.now() + MAX_AGE * 1000
  const payload = String(expires)
  cookies.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
    secure: isProd,
  })
}

export function clearSession(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' })
}

export function isAuthed(cookies: AstroCookies): boolean {
  if (authUnconfigured) return false
  const raw = cookies.get(COOKIE)?.value
  if (!raw) return false
  const [payload, mac] = raw.split('.')
  if (!payload || !mac) return false
  try {
    if (!safeEqual(mac, sign(payload))) return false
  } catch {
    return false
  }
  return Number(payload) > Date.now()
}

/** Redirect target for unauthenticated admin requests. */
export const LOGIN_PATH = '/admin/login/'
