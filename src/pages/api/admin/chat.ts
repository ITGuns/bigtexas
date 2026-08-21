export const prerender = false

/**
 * The office half of live chat: reply, join, close, reopen.
 *
 * Everything here is behind the admin session. Replying implicitly takes the
 * conversation off the bot by moving it to `live`, so the assistant will not
 * talk over a coordinator mid-sentence.
 */
import type { APIRoute } from 'astro'
import { isAuthed } from '@/lib/auth'
import { addMessage, getChat, listMessages, updateChat, type ChatStatus } from '@/lib/db'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthed(cookies)) return json({ ok: false, error: 'Unauthorized' }, 401)

  const form = await request.formData().catch(() => null)
  const data = form ?? new FormData()
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json')

  const id = Number(data.get('id'))
  const action = String(data.get('action') ?? '')
  const chat = Number.isFinite(id) ? await getChat(id) : undefined
  if (!chat) return json({ ok: false, error: 'Unknown conversation' }, 404)

  const back = () =>
    wantsJson
      ? json({ ok: true })
      : new Response(null, { status: 303, headers: { Location: `/admin/chats/${chat.id}/` } })

  try {
    switch (action) {
      case 'reply': {
        const body = String(data.get('body') ?? '').trim().slice(0, 2000)
        if (!body) return json({ ok: false, error: 'Empty reply' }, 422)
        const message = await addMessage(chat.id, 'agent', body)
        await updateChat(chat.id, { status: 'live', agent_unread: 0 })
        return wantsJson ? json({ ok: true, message }) : back()
      }
      case 'seen': {
        await updateChat(chat.id, { agent_unread: 0 })
        return back()
      }
      case 'status': {
        const status = String(data.get('status')) as ChatStatus
        if (!['bot', 'waiting', 'live', 'closed'].includes(status)) {
          return json({ ok: false, error: 'Bad status' }, 400)
        }
        await updateChat(chat.id, { status })
        if (status === 'closed') {
          await addMessage(chat.id, 'bot', 'This conversation has been closed. Call 832-888-5166 if you need anything else.')
        }
        return back()
      }
      default:
        return json({ ok: false, error: 'Unknown action' }, 400)
    }
  } catch (err) {
    console.error('admin chat action failed', err)
    return json({ ok: false, error: 'Action failed' }, 500)
  }
}

/** Poll for the thread while the coordinator has it open. */
export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAuthed(cookies)) return json({ ok: false, error: 'Unauthorized' }, 401)

  const id = Number(url.searchParams.get('id'))
  const chat = Number.isFinite(id) ? await getChat(id) : undefined
  if (!chat) return json({ ok: false, error: 'Unknown conversation' }, 404)

  const after = Number(url.searchParams.get('after') ?? 0)
  const messages = await listMessages(chat.id, Number.isFinite(after) && after > 0 ? after : 0)
  return json({ ok: true, status: chat.status, messages })
}
