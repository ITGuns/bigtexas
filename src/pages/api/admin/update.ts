export const prerender = false

import type { APIRoute } from 'astro'
import { isAuthed } from '@/lib/auth'
import {
  updateLead,
  updateBooking,
  deleteLead,
  createBooking,
  LEAD_STATUSES,
  BOOKING_STATUSES,
  type LeadStatus,
  type BookingStatus,
} from '@/lib/db'

const back = (referer: string | null, fallback: string) =>
  new Response(null, { status: 303, headers: { Location: referer ?? fallback } })

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthed(cookies)) return new Response('Unauthorized', { status: 401 })

  const data = await request.formData()
  const action = String(data.get('action') ?? '')
  const referer = request.headers.get('referer')

  try {
    switch (action) {
      case 'lead-status': {
        const status = String(data.get('status')) as LeadStatus
        if (!LEAD_STATUSES.includes(status)) return new Response('Bad status', { status: 400 })
        await updateLead(Number(data.get('id')), { status })
        break
      }
      case 'lead-notes': {
        await updateLead(Number(data.get('id')), { notes: String(data.get('notes') ?? '').slice(0, 4000) })
        break
      }
      case 'lead-delete': {
        await deleteLead(Number(data.get('id')))
        return back(null, '/admin/leads/')
      }
      case 'booking-create': {
        const leadId = Number(data.get('leadId'))
        await createBooking({
          lead_id: leadId,
          service: String(data.get('service') ?? ''),
          preferred_date: String(data.get('preferredDate') ?? ''),
          preferred_slot: String(data.get('preferredSlot') ?? ''),
        })
        await updateLead(leadId, { status: 'booked' })
        break
      }
      case 'booking-status': {
        const status = String(data.get('status')) as BookingStatus
        if (!BOOKING_STATUSES.includes(status)) return new Response('Bad status', { status: 400 })
        await updateBooking(Number(data.get('id')), { status })
        break
      }
      case 'lead-followup-sent': {
        await updateLead(Number(data.get('id')), { follow_up_at: new Date().toISOString() })
        break
      }
      case 'lead-review-sent': {
        await updateLead(Number(data.get('id')), { review_sent_at: new Date().toISOString() })
        break
      }
      case 'booking-notes': {
        await updateBooking(Number(data.get('id')), {
          tech_notes: String(data.get('techNotes') ?? '').slice(0, 4000),
        })
        break
      }
      default:
        return new Response('Unknown action', { status: 400 })
    }
  } catch (err) {
    console.error('admin update failed', err)
    return new Response('Update failed', { status: 500 })
  }

  return back(referer, '/admin/')
}
