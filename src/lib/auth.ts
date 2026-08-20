/**
 * Minimal session auth for the admin area: one shared password, an
 * HMAC-signed cookie, no user table.
 *
 * ADMIN_PASSWORD and ADMIN_SECRET are required in every environment. There is
 * deliberately no built-in fallback password: this repository is public, so a
 * default would be a published credential, and relying on an environment check
 * to disable it is exactly the kind of thing that fails silently in one
 * deployment target. If either variable is missing the panel refuses every
 * login instead.
 *
 * A missing ADMIN_SECRET is equally fatal on serverless: each instance would
 * sign cookies with a different random key, so sessions would appear to work
 * and then break at random.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { AstroCookies } from 'astro'

const COOKIE = 'btc_admin'
const MAX_AGE = 60 * 60 * 12 // 12 hours

/** Astro serves .env via import.meta.env; Vercel and Node use process.env. */
const readEnv = (name: string): string | undefined =>
  (import.meta.env as Record<string, string | undefined>)[name] ?? process.env[name]

const password = readEnv('ADMIN_PASSWORD')
const secret = readEnv('ADMIN_SECRET')

/** True when the panel cannot accept a login because config is missing. */
export const authUnconfigured = !password || !secret

/** Kept for the layout banner; unconfigured is the only unsafe state now. */
export const usingDefaultPassword = false

if (authUnconfigured) {
  console.error(
    '[auth] ADMIN_PASSWORD and ADMIN_SECRET must both be set. The admin panel is locked until they are.',
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
  if (authUnconfigured || !password) return false
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
    secure: import.meta.env.PROD,
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
