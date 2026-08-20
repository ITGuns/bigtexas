/**
 * Knowledge base for the website assistant.
 *
 * Every answer is assembled from the same data the pages use, so the assistant
 * cannot state anything the site does not. There is no generative model behind
 * it: unmatched questions hand off to the phone rather than guessing, which is
 * the right failure mode for a trade business quoting prices and availability.
 */
import { site } from './site'
import { services, serviceCategories } from './services'
import { cities } from './cities'

export interface Answer {
  /** what the assistant says */
  reply: string
  /** optional follow-on buttons */
  links?: { label: string; href: string }[]
  /** start the lead capture flow after answering */
  capture?: boolean
}

export interface Intent {
  id: string
  /** any of these phrases scores a match */
  patterns: string[]
  answer: () => Answer
}

const cityNames = cities.map((c) => c.name)
const serviceNames = services.map((s) => s.name)

export const intents: Intent[] = [
  {
    id: 'emergency',
    patterns: ['emergency', 'urgent', 'right now', 'tonight', 'no cooling', 'no heat', 'not working', 'broke', 'broken', 'stopped working', 'asap'],
    answer: () => ({
      reply: `Emergency service runs 24 hours a day, seven days a week. The fastest route is the phone: ${site.phoneDisplay}. If you would rather we call you, I can take your details now.`,
      links: [
        { label: `Call ${site.phone}`, href: site.phoneHref },
        { label: 'Troubleshoot first', href: '/support/' },
      ],
      capture: true,
    }),
  },
  {
    id: 'hours',
    patterns: ['hours', 'open', 'closing', 'closed', 'what time', 'weekend', 'sunday', 'saturday'],
    answer: () => ({
      reply: `Regular hours are ${site.hours.regular}. Outside those hours the emergency line is staffed, so ${site.hours.emergency.toLowerCase()}.`,
      links: [{ label: `Call ${site.phone}`, href: site.phoneHref }],
    }),
  },
  {
    id: 'pricing',
    patterns: ['price', 'cost', 'how much', 'fee', 'charge', 'quote', 'estimate', 'diagnostic', 'service call'],
    answer: () => ({
      reply: `A service call is ${site.offers.diagnostic.replace('Service calls ', '')}. Estimates on new systems are free, and so are second opinions on a quote you already have. Exact repair cost depends on what the technician finds, so we price it before any work begins.`,
      links: [
        { label: 'Special offers', href: '/special-offers/' },
        { label: 'Financing', href: '/financing/' },
      ],
    }),
  },
  {
    id: 'financing',
    patterns: ['financ', 'payment plan', 'monthly', 'credit', 'afford', 'installment', 'pay over time'],
    answer: () => ({
      reply: `Financing is available with approved credit through ${site.financing.partners.map((p) => p.name).join(' and ')}. That keeps your home equity line and credit cards free for other things.`,
      links: [{ label: 'Financing options', href: '/financing/' }],
    }),
  },
  {
    id: 'payment',
    patterns: ['accept', 'card', 'visa', 'mastercard', 'amex', 'discover', 'cash', 'check', 'how do i pay'],
    answer: () => ({
      reply: `We take ${site.payments.slice(0, 6).join(', ')}, plus financing with approved credit.`,
    }),
  },
  {
    id: 'area',
    patterns: ['area', 'service area', 'do you serve', 'do you cover', 'location', 'near me', 'come to', ...cityNames.map((c) => c.toLowerCase())],
    answer: () => ({
      reply: `We are based on Bay Area Blvd in Clear Lake and cover the Houston metro and the bay communities: ${cityNames.join(', ')}. If you are nearby but not on that list, call and ask.`,
      links: [{ label: 'Full service area', href: '/service-area/' }],
    }),
  },
  {
    id: 'services',
    patterns: ['service', 'what do you do', 'offer', 'repair', 'install', 'maintenance', 'tune up', 'tune-up', 'duct', 'insulation', 'commercial'],
    answer: () => ({
      reply: `We cover ${serviceCategories.map((c) => c.name.toLowerCase()).join(', ')}. That includes ${serviceNames.slice(0, 6).join(', ')} and more. Which one are you after?`,
      links: [{ label: 'All services', href: '/services/' }],
    }),
  },
  {
    id: 'brands',
    patterns: ['brand', 'american standard', 'mitsubishi', 'carrier', 'trane', 'lennox', 'goodman', 'rheem', 'what brand', 'make and model'],
    answer: () => ({
      reply: `We are an independent American Standard dealer and also install Mitsubishi Electric ductless systems. For repair and maintenance we service all makes and models, not just the ones we sell.`,
      links: [{ label: 'Equipment catalog', href: '/products/' }],
    }),
  },
  {
    id: 'booking',
    patterns: ['book', 'appointment', 'schedule', 'come out', 'visit', 'when can', 'availability', 'send someone'],
    answer: () => ({
      reply: `I can start that now. Tell me your name and the best number, and a coordinator will confirm a time with you.`,
      capture: true,
    }),
  },
  {
    id: 'troubleshoot',
    patterns: ['not cooling', 'not heating', 'blowing warm', 'blowing cold', 'making noise', 'leaking', 'smell', 'frozen', 'ice', 'thermostat', 'filter', 'diy', 'fix myself'],
    answer: () => ({
      reply: `There are a few checks worth doing before paying for a visit: thermostat settings, the air filter, registers, and the breakers for both the indoor and outdoor unit. Our guided checklists walk through them in order.`,
      links: [
        { label: 'Troubleshooting checklists', href: '/support/' },
        { label: 'Repair or replace?', href: '/guides/repair-or-replace/' },
      ],
    }),
  },
  {
    id: 'credentials',
    patterns: ['licens', 'insured', 'bonded', 'certified', 'nate', 'qualified', 'trust', 'legit', 'review', 'rating'],
    answer: () => ({
      reply: `We are bonded, insured and licensed in Texas under ${site.license}. Our technicians are NATE-certified, we are an American Standard Customer Care Dealer and a Ductless Pro Contractor, and we hold the 2017 Angie's List Super Service Award.`,
      links: [
        { label: 'Reviews', href: '/reviews/' },
        { label: 'About us', href: '/about/' },
      ],
    }),
  },
  {
    id: 'offers',
    patterns: ['offer', 'deal', 'discount', 'coupon', 'promo', 'rebate', 'special', 'military', 'veteran', 'first responder'],
    answer: () => ({
      reply: `Current offers: a ${site.offers.diagnostic.replace('Service calls ', '')}, free estimates on new systems, free second opinions, and seasonal American Standard rebates. ${site.offers.military}`,
      links: [{ label: 'Special offers', href: '/special-offers/' }],
    }),
  },
  {
    id: 'contact',
    patterns: ['phone', 'number', 'call', 'address', 'where are you', 'contact', 'email', 'reach you'],
    answer: () => ({
      reply: `Phone is ${site.phoneDisplay}. The shop is at ${site.address.full}. ${site.hours.regular}, with 24/7 emergency service.`,
      links: [
        { label: `Call ${site.phone}`, href: site.phoneHref },
        { label: 'Contact page', href: '/contact/' },
      ],
    }),
  },
  {
    id: 'maintenance-plan',
    patterns: ['plan', 'agreement', 'contract', 'membership', 'annual', 'twice a year', 'warranty'],
    answer: () => ({
      reply: `Service agreements cover scheduled tune-ups that keep the system efficient and cut down on emergency calls. We also offer extended warranties on new equipment.`,
      links: [
        { label: 'Service agreements', href: '/services/service-agreements/' },
        { label: 'Extended warranties', href: '/services/extended-warranties/' },
      ],
    }),
  },
]

/** Shown as starter chips when the panel opens. */
export const suggestions = [
  'My AC is not cooling',
  'What does a service call cost?',
  'Do you cover my area?',
  'Book a visit',
]

const GREETING = `Hi, this is the Big Texas Comfort assistant. I can answer questions about services, pricing, coverage and hours, or take your details so a coordinator can call you back.`

export const greeting = GREETING

/** Score a question against the intents and return the best answer. */
export function respond(question: string): Answer {
  const q = question.toLowerCase().trim()
  if (!q) return { reply: GREETING }

  let best: { intent: Intent; score: number } | null = null
  for (const intent of intents) {
    let score = 0
    for (const p of intent.patterns) {
      if (q.includes(p)) score += p.length // longer phrase, stronger signal
    }
    if (score > 0 && (!best || score > best.score)) best = { intent, score }
  }

  if (best) return best.intent.answer()

  return {
    reply: `I am not sure about that one, and I would rather not guess. A coordinator can answer properly on ${site.phoneDisplay}, or leave your details and we will call you.`,
    links: [{ label: `Call ${site.phone}`, href: site.phoneHref }],
    capture: true,
  }
}
