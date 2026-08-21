export const prerender = false

/**
 * The visitor half of live chat.
 *
 * The assistant's answers are produced here rather than in the browser, so the
 * transcript the office reads is what was actually said: a tampered client can
 * only put words in its own mouth, never the company's. It also means that the
 * moment a real person joins, the bot stops talking, because that decision is
 * made against the stored status rather than trusted from the page.
 *
 * Visitors are identified by a random token, not by the row id, so nobody can
 * read someone else's conversation by counting upwards.
 */
import type { APIRoute } from 'astro'
import { randomBytes } from 'node:crypto'
import { respond } from '@/data/assistant'
import {
  addMessage,
  createChat,
  getChatByToken,
  getLead,
  listMessages,
  updateChat,
  storageReady,
} from '@/lib/db'
import { clientIp, rateLimit, tooMany, windowFor } from '@/lib/ratelimit'

const TOKEN_RE = /^[a-f0-9]{32}$/
const MAX_BODY = 1500

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

const unavailable = () =>
  json(
    { ok: false, error: 'Chat is unavailable right now. Please call 832-888-5166.' },
    503,
  )

const clean = (v: unknown, max = MAX_BODY) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!storageReady) return unavailable()

  const ip = clientIp(request, clientAddress)
  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ ok: false, error: 'Malformed request' }, 400)
  }

  const action = clean(payload.action, 20)

  if (action === 'start') {
    const gate = rateLimit(`chat-start:${ip}`, 10, windowFor(10 * 60 * 1000))
    if (!gate.ok) return tooMany(gate.retryAfter, 'Too many conversations started. Please call 832-888-5166.')

    const chat = await createChat({ token: randomBytes(16).toString('hex'), page: clean(payload.page, 200) })
    const greeting = await addMessage(chat.id, 'bot', respond('').reply)
    return json({ ok: true, token: chat.token, status: chat.status, messages: [greeting] })
  }

  const token = clean(payload.token, 64)
  if (!TOKEN_RE.test(token)) return json({ ok: false, error: 'Unknown conversation' }, 400)
  const chat = await getChatByToken(token)
  if (!chat) return json({ ok: false, error: 'Unknown conversation' }, 404)

  if (action === 'send') {
    const gate = rateLimit(`chat-send:${ip}`, 40, windowFor(5 * 60 * 1000))
    if (!gate.ok) return tooMany(gate.retryAfter, 'Slow down a moment, then try again.')

    const text = clean(payload.text)
    if (!text) return json({ ok: false, error: 'Empty message' }, 422)

    const visitor = await addMessage(chat.id, 'visitor', text)
    const out = [visitor]
    let capture = false
    let status = chat.status

    // While a coordinator has the conversation, the bot stays quiet. Recording
    // the message and raising the unread count is all that should happen.
    const humanHasIt = chat.status === 'waiting' || chat.status === 'live'
    const collecting = clean(payload.mode, 20) === 'capture'

    if (chat.status === 'closed') {
      // Someone was told the conversation was finished and wrote back anyway.
      // Letting the bot pick up would talk over a customer nobody is watching,
      // so put it in front of a person instead.
      status = 'waiting'
      await updateChat(chat.id, { status, agent_unread: chat.agent_unread + 1 })
      out.push(
        await addMessage(
          chat.id,
          'bot',
          'Thanks for coming back to us. I have reopened this for the office and someone will reply here. If it cannot wait, call 832-888-5166.',
        ),
      )
    } else if (humanHasIt) {
      await updateChat(chat.id, { agent_unread: chat.agent_unread + 1 })
    } else if (!collecting) {
      const answer = respond(text)
      out.push(await addMessage(chat.id, 'bot', answer.reply))
      capture = Boolean(answer.capture)
    }

    return json({ ok: true, status, messages: out, capture })
  }

  if (action === 'handoff') {
    const gate = rateLimit(`chat-handoff:${ip}`, 10, windowFor(10 * 60 * 1000))
    if (!gate.ok) return tooMany(gate.retryAfter, 'Please call 832-888-5166 and we will pick up.')

    if (chat.status === 'closed') return json({ ok: false, error: 'This conversation is closed' }, 409)
    await updateChat(chat.id, { status: 'waiting', agent_unread: chat.agent_unread + 1 })
    const note = await addMessage(
      chat.id,
      'bot',
      'I have passed this to the office. Someone will reply here shortly. If it cannot wait, call 832-888-5166.',
    )
    return json({ ok: true, status: 'waiting', messages: [note] })
  }

  // details gathered by the capture flow, so the office can call back
  if (action === 'profile') {
    const phone = clean(payload.phone, 40) || chat.phone

    /*
     * The browser tells us which lead it just created, and on its own that is
     * an open door: any id would be accepted, so a stranger could pin their
     * conversation to a real customer's record and have the office ring the
     * wrong person. Only honour the claim when the chat has no lead yet and
     * the lead's phone number matches the one on this conversation, which is
     * something only the person who filled the form knows.
     */
    let lead_id = chat.lead_id
    const claimed = Number(payload.leadId)
    if (!chat.lead_id && Number.isInteger(claimed) && claimed > 0 && phone) {
      const digits = (s: string) => s.replace(/\D/g, '')
      const lead = await getLead(claimed)
      if (lead && digits(lead.phone) && digits(lead.phone) === digits(phone)) lead_id = claimed
    }

    await updateChat(chat.id, {
      name: clean(payload.name, 80) || chat.name,
      phone,
      email: clean(payload.email, 160) || chat.email,
      lead_id,
    })
    return json({ ok: true })
  }

  return json({ ok: false, error: 'Unknown action' }, 400)
}

/** Poll: everything said since the message the browser last saw. */
export const GET: APIRoute = async ({ request, url, clientAddress }) => {
  if (!storageReady) return unavailable()

  const gate = rateLimit(`chat-poll:${clientIp(request, clientAddress)}`, 240, windowFor(5 * 60 * 1000))
  if (!gate.ok) return tooMany(gate.retryAfter, 'Polling too often.')

  const token = url.searchParams.get('token') ?? ''
  if (!TOKEN_RE.test(token)) return json({ ok: false, error: 'Unknown conversation' }, 400)

  const chat = await getChatByToken(token)
  if (!chat) return json({ ok: false, error: 'Unknown conversation' }, 404)

  const after = Number(url.searchParams.get('after') ?? 0)
  const messages = await listMessages(chat.id, Number.isFinite(after) && after > 0 ? after : 0)
  return json({ ok: true, status: chat.status, messages })
}
