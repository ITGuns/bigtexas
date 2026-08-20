/**
 * Normalized access to the scraped-content extraction
 * (content-extracted/*.json). This is the bridge between the old
 * site's real copy and the new templates. Nothing here is invented.
 */
import coreRaw from '../../content-extracted/core-company.json'
import utilityRaw from '../../content-extracted/utility-pages.json'
import supportRaw from '../../content-extracted/support-education.json'
import servicesRaw from '../../content-extracted/services-metro.json'
import productsRaw from '../../content-extracted/products.json'
import citiesRaw from '../../content-extracted/cities.json'
import comboARaw from '../../content-extracted/service-city-a.json'
import comboBRaw from '../../content-extracted/service-city-b.json'
import blogRaw from '../../content-extracted/blog-landmarks.json'

export interface ExtractedPage {
  slug: string
  oldUrl: string
  title: string
  metaDescription: string
  h1?: string
  summary?: string
  uniqueCopy: string[]
  facts?: string[]
  features?: string[]
  images?: string[]
  ctas?: string[]
  models?: { name: string; specs: string[] }[]
  decisionTree?: { step: string; detail?: string; action?: string }[]
  terms?: { term: string; definition: string }[]
}

type Raw = { pages: ExtractedPage[] }

/**
 * House style: no em/en dashes in body copy. The scraped source is full of
 * them; rewrite to ordinary punctuation without touching real hyphens
 * ("factory-trained") or losing meaning in numeric ranges.
 */
export function cleanText(input: string): string {
  if (!input) return input
  return (
    input
      // ranges read as "to": numbers, times, weekdays
      .replace(/\s*[–—]\s*(?=\d)/g, ' to ')
      .replace(
        /\b((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*)\s*[–—]\s*(?=(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun))/g,
        '$1 to ',
      )
      // spaced dash acting as a clause break
      .replace(/\s+[–—]\s+/g, (_m, offset: number, full: string) => {
        const rest = full.slice(offset).replace(/^\s+[–—]\s+/, '')
        return /^[A-Z]/.test(rest) && !/^[A-Z]{2,}\b/.test(rest) ? '. ' : ', '
      })
      // dash glued between words
      .replace(/(\w)[–—](\w)/g, '$1, $2')
      // any stragglers (leading/trailing)
      .replace(/[–—]/g, '')
      // tidy artifacts
      .replace(/,\s*,/g, ',')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([,.])\s*\1+/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim()
  )
}

function cleanDeep<T>(value: T): T {
  if (typeof value === 'string') return cleanText(value) as unknown as T
  if (Array.isArray(value)) return value.map(cleanDeep) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = cleanDeep(v)
    return out as T
  }
  return value
}

const index = new Map<string, ExtractedPage>()
function ingest(raw: Raw, group: string) {
  for (const p of raw.pages) {
    const key = `${group}:${p.slug}`
    if (!index.has(key)) index.set(key, cleanDeep(p))
  }
}
ingest(coreRaw as Raw, 'core')
ingest(utilityRaw as Raw, 'utility')
ingest(supportRaw as Raw, 'support')
ingest(servicesRaw as Raw, 'service')
ingest(productsRaw as Raw, 'product')
ingest(citiesRaw as Raw, 'city')
ingest(comboARaw as Raw, 'combo')
ingest(comboBRaw as Raw, 'combo')
ingest(blogRaw as Raw, 'blog')

export const get = (group: string, slug: string) => index.get(`${group}:${slug}`)
export const listGroup = (group: string) =>
  [...index.entries()].filter(([k]) => k.startsWith(`${group}:`)).map(([, v]) => v)

/* ---------- services: registry-id → extracted slug ---------- */
const serviceAlias: Record<string, string> = {
  'hvac-maintenance': 'preventive-hvac-maintenance',
  'ac-maintenance': 'seasonal-ac-maintenance',
}
export const serviceContent = (serviceId: string) =>
  get('service', serviceAlias[serviceId] ?? serviceId)

/** extra dealer-program page folded into the ductless service page */
export const ductlessSystemsExtra = get('service', 'ductless-mini-split-systems')

/* ---------- service × city combos ---------- */
const CITY_SUFFIXES = [
  'clear-lake-city',
  'friendswood',
  'league-city',
  'pasadena',
  'seabrook',
  'webster',
]
/** extracted combo slug prefix → registry service id */
const comboService: Record<string, string> = {
  'ac-repair': 'ac-repair',
  'ac-installation': 'ac-installation',
  'ac-maintenance': 'ac-maintenance',
  'furnace-repair': 'furnace-repair',
  'furnace-installation': 'furnace-installation',
  'furnace-maintenance': 'furnace-maintenance',
  'air-duct-cleaning': 'air-duct-cleaning',
  'air-duct-sealing': 'air-duct-sealing',
  'indoor-air-quality': 'indoor-air-quality-testing',
  'commercial-hvac': 'commercial-hvac',
  'ductless-mini-split-installation': 'ductless-mini-split-installation',
}

export interface Combo {
  serviceId: string
  cityId: string
  page: ExtractedPage
}

export const combos: Combo[] = listGroup('combo')
  .map((page) => {
    const city = CITY_SUFFIXES.find((c) => page.slug.endsWith(`-${c}`))
    if (!city) return null
    const prefix = page.slug.slice(0, page.slug.length - city.length - 1)
    const serviceId = comboService[prefix]
    if (!serviceId) return null
    return { serviceId, cityId: city, page }
  })
  .filter((c): c is Combo => c !== null)

export const combosForService = (serviceId: string) => combos.filter((c) => c.serviceId === serviceId)
export const combosForCity = (cityId: string) => combos.filter((c) => c.cityId === cityId)
export const getCombo = (serviceId: string, cityId: string) =>
  combos.find((c) => c.serviceId === serviceId && c.cityId === cityId)

/* ---------- cities ---------- */
const cityAlias: Record<string, string[]> = {
  'clear-lake-city': ['hvac-clear-lake-city'],
  friendswood: ['hvac-friendswood'],
  'league-city': ['hvac-league-city', 'league-city-tx'],
  seabrook: ['hvac-seabrook'],
  webster: ['hvac-webster', 'webster-tx'],
  bacliff: ['bacliff'],
  hitchcock: ['hitchcock'],
  'la-marque': ['la-marque'],
  'texas-city': ['texas-city'],
}
export const cityContent = (cityId: string): ExtractedPage[] =>
  (cityAlias[cityId] ?? []).map((s) => get('city', s)).filter((p): p is ExtractedPage => !!p)

/* ---------- convenient named lookups ---------- */
export const glossaryTerms = (get('utility', 'glossary')?.terms ?? []) as {
  term: string
  definition: string
}[]

export const blogPosts = listGroup('blog').filter((p) =>
  [
    'duct-cleaning-the-real-deal',
    'how-houstons-humidity-impacts-your-ac',
    'mold-in-the-cold-how-to-get-rid-of-mold-in-your-ac',
    'musty-ac-heres-how-to-banish-those-odors',
    'solving-ac-ice-buildup',
  ].includes(p.slug),
)

export const troubleshootingTrees = [
  'troubleshooting-ac-no-cooling',
  'troubleshooting-gas-furnace-no-heating',
  'troubleshooting-heat-pump-no-cooling',
  'troubleshooting-heat-pump-no-heating',
]
  .map((s) => get('support', s))
  .filter((p): p is ExtractedPage => !!p)

export const guides = [
  'select-new-system',
  'repair-replace',
  'energy-bill-concerns',
  'healthier-home',
  'ready-maintenance',
  'request-service',
]
  .map((s) => get('support', s))
  .filter((p): p is ExtractedPage => !!p)

export const productPage = (slug: string) => get('product', slug)
export const productPages = listGroup('product')
