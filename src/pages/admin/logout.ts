export const prerender = false

import type { APIRoute } from 'astro'
import { clearSession, LOGIN_PATH } from '@/lib/auth'

export const POST: APIRoute = ({ cookies, redirect }) => {
  clearSession(cookies)
  return redirect(LOGIN_PATH)
}

export const GET: APIRoute = ({ cookies, redirect }) => {
  clearSession(cookies)
  return redirect(LOGIN_PATH)
}
