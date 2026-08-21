export const prerender = false

import type { APIRoute } from 'astro'
import { createLead, createBooking, storageReady } from '@/lib/db'
import { clientIp, rateLimit, tooMany } from '@/lib/ratelimit'

const clean = (v: FormDataEntryValue | null, max = 2000) =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

/**
 * A real customer submits once, occasionally twice. Twelve in ten minutes is
 * far past any honest use while still cutting a script off early, and it
 * leaves enough headroom that running the test suite twice in a row does not
 * lock the machine out of its own dev server.
 */
const LIMIT = 12
const WINDOW_MS = 10 * 60 * 1000

export const POST: APIRoute = async ({ request }) => {
  const gate = rateLimit(`leads:${clientIp(request)}`, LIMIT, WINDOW_MS)
  if (!gate.ok) {
    return tooMany(
      gate.retryAfter,
      'That is a lot of requests in a short time. Please call 832-888-5166 and we will take the details directly.',
    )
  }

  // Better to tell the visitor to phone than to accept a request we cannot keep.
  if (!storageReady) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Online requests are unavailable right now. Please call 832-888-5166.',
      }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    )
  }

  let data: FormData
  try {
    const ct = request.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      const json = (await request.json()) as Record<string, string>
      data = new FormData()
      for (const [k, v] of Object.entries(json)) data.append(k, String(v ?? ''))
    } else {
      data = await request.formData()
    }
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Malformed request' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  // honeypot: bots fill hidden fields, humans do not
  if (clean(data.get('company'))) {
    return new Response(JSON.stringify({ ok: true, id: null }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const first_name = clean(data.get('firstName'), 80)
  const phone = clean(data.get('phone'), 40)
  const email = clean(data.get('email'), 160)

  if (!first_name || (!phone && !email)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'A name and either a phone number or email are required.' }),
      { status: 422, headers: { 'content-type': 'application/json' } },
    )
  }

  try {
    const leadId = await createLead({
      first_name,
      last_name: clean(data.get('lastName'), 80),
      phone,
      email,
      address: clean(data.get('address'), 200),
      city: clean(data.get('city'), 80),
      service: clean(data.get('service'), 80),
      message: clean(data.get('comments')) || clean(data.get('message')),
      source: clean(data.get('source'), 120) || 'website',
      urgency: clean(data.get('urgency'), 20) || 'normal',
    })

    // a requested date turns this into a booking too
    const preferred_date = clean(data.get('preferredDate'), 32)
    let bookingId: number | null = null
    if (preferred_date) {
      bookingId = await createBooking({
        lead_id: leadId,
        service: clean(data.get('service'), 80),
        preferred_date,
        preferred_slot: clean(data.get('preferredSlot'), 40),
      })
    }

    return new Response(JSON.stringify({ ok: true, id: leadId, bookingId }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    console.error('lead create failed', err)
    return new Response(JSON.stringify({ ok: false, error: 'Could not save your request.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
