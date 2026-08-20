/**
 * Email templates and next-action recommendations for the admin panel.
 *
 * Email is composed here and opened in the operator's own mail client, so
 * nothing is sent behind their back and no mail credentials are needed. Wiring
 * a transactional provider later only means posting these same subject and body
 * strings to it.
 *
 * SMS is deliberately absent: it needs a gateway and a carrier registration
 * this project does not have.
 */
import { site } from '@/data/site'
import type { Lead, BookingRow } from './db'

export interface Draft {
  subject: string
  body: string
  /** ready-to-use mailto link */
  href: string
}

const mailto = (to: string, subject: string, body: string) =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

const signOff = `

Big Texas Comfort
${site.address.full}
${site.phoneDisplay}
${site.hours.regular}
${site.hours.emergency}`

/** First touch after a lead arrives. */
export function followUpDraft(lead: Lead): Draft {
  const name = lead.first_name || 'there'
  const what = lead.service ? `your ${lead.service.toLowerCase()} request` : 'your request'
  const subject = `Following up on ${what} | Big Texas Comfort`
  const body = `Hi ${name},

Thanks for getting in touch with Big Texas Comfort about ${what}. I wanted to make sure it did not slip through.

We can usually get someone out quickly, and a service call is ${site.offers.diagnostic.replace('Service calls ', '')}. Estimates on new systems are free, as are second opinions on a quote you already have.

If you would like to book a time, just reply to this email or call ${site.phoneDisplay} and we will sort it out.${signOff}`
  return { subject, body, href: mailto(lead.email, subject, body) }
}

/** Sent after the work is done, pointing at the platforms that hold reviews. */
export function reviewRequestDraft(lead: Lead): Draft {
  const name = lead.first_name || 'there'
  const subject = `How did we do? | Big Texas Comfort`
  const body = `Hi ${name},

Thanks for having Big Texas Comfort out. We build the business on repeat customers, so it genuinely helps to know how the visit went.

If you have a minute, a short review makes a real difference:

Google: ${site.reviewLinks.google}
Facebook: ${site.reviewLinks.facebook}
Yelp: ${site.reviewLinks.yelp}

And if anything was not right, reply here or call ${site.phoneDisplay} and we will put it straight.${signOff}`
  return { subject, body, href: mailto(lead.email, subject, body) }
}

/** Confirmation once a visit is on the calendar. */
export function bookingConfirmDraft(lead: Lead, when: string, slot: string): Draft {
  const name = lead.first_name || 'there'
  const subject = `Your appointment with Big Texas Comfort`
  const body = `Hi ${name},

You are booked in for ${when}${slot ? `, arriving ${slot.toLowerCase()}` : ''}.

The technician will call before setting off. A service call is ${site.offers.diagnostic.replace('Service calls ', '')}, and we price any repair before starting work.

If you need to move it, call ${site.phoneDisplay}.${signOff}`
  return { subject, body, href: mailto(lead.email, subject, body) }
}

/* ============================================================
   Recommendations
   ============================================================ */

export interface Recommendation {
  id: string
  severity: 'urgent' | 'due' | 'idea'
  title: string
  detail: string
  href?: string
  cta?: string
}

const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 36e5

/**
 * Turns the live pipeline into a short list of next actions. Everything here
 * is derived from the data, so an empty list genuinely means nothing is
 * waiting rather than that no rules ran.
 */
export function recommendations(leads: Lead[], bookings: BookingRow[]): Recommendation[] {
  const out: Recommendation[] = []
  const today = new Date().toISOString().slice(0, 10)

  const emergencies = leads.filter((l) => l.urgency === 'emergency' && l.status === 'new')
  if (emergencies.length) {
    out.push({
      id: 'emergency',
      severity: 'urgent',
      title: `${emergencies.length} emergency ${emergencies.length === 1 ? 'lead' : 'leads'} still untouched`,
      detail: 'Someone marked their request an emergency and nobody has moved it out of New yet.',
      href: `/admin/leads/?status=new`,
      cta: 'Open new leads',
    })
  }

  const stale = leads.filter((l) => l.status === 'new' && hoursSince(l.created_at) > 24)
  if (stale.length) {
    out.push({
      id: 'stale',
      severity: 'urgent',
      title: `${stale.length} ${stale.length === 1 ? 'lead has' : 'leads have'} sat in New over 24 hours`,
      detail: 'Response time is the single biggest lever on close rate for service work.',
      href: '/admin/leads/?status=new',
      cta: 'Work the queue',
    })
  }

  const uncontacted = leads.filter(
    (l) => ['new', 'contacted'].includes(l.status) && l.email && !l.follow_up_at,
  )
  if (uncontacted.length) {
    out.push({
      id: 'followup',
      severity: 'due',
      title: `${uncontacted.length} ${uncontacted.length === 1 ? 'lead has' : 'leads have'} had no follow-up email`,
      detail: 'Each lead page has a prepared follow-up you can send in one click.',
      href: '/admin/leads/',
      cta: 'Review leads',
    })
  }

  const wonNoReview = leads.filter((l) => l.status === 'won' && l.email && !l.review_sent_at)
  if (wonNoReview.length) {
    out.push({
      id: 'reviews',
      severity: 'due',
      title: `${wonNoReview.length} finished ${wonNoReview.length === 1 ? 'job has' : 'jobs have'} no review request`,
      detail: 'The site currently shows a single published review. Asking after a good visit is the cheapest way to fix that.',
      href: '/admin/leads/?status=won',
      cta: 'Send requests',
    })
  }

  const unconfirmed = bookings.filter((b) => b.status === 'requested' && b.preferred_date >= today)
  if (unconfirmed.length) {
    out.push({
      id: 'confirm',
      severity: 'due',
      title: `${unconfirmed.length} upcoming ${unconfirmed.length === 1 ? 'booking is' : 'bookings are'} unconfirmed`,
      detail: 'Confirming ahead of the day cuts no-shows and wasted drive time.',
      href: '/admin/bookings/?status=requested',
      cta: 'Confirm bookings',
    })
  }

  const overdue = bookings.filter((b) => b.status === 'confirmed' && b.preferred_date < today)
  if (overdue.length) {
    out.push({
      id: 'close-out',
      severity: 'due',
      title: `${overdue.length} past ${overdue.length === 1 ? 'booking is' : 'bookings are'} still open`,
      detail: 'Mark them completed so the review request and the won count stay accurate.',
      href: '/admin/bookings/?status=confirmed',
      cta: 'Close them out',
    })
  }

  if (out.length === 0) {
    out.push({
      id: 'clear',
      severity: 'idea',
      title: 'Nothing is waiting',
      detail: 'No untouched leads, no unconfirmed bookings and no outstanding review requests.',
    })
  }

  return out
}
