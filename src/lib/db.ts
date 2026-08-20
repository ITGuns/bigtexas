/**
 * Leads and bookings store.
 *
 * Two interchangeable backends behind one async API:
 *   - Supabase (Postgres) when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
 *     set. This is what Vercel runs.
 *   - Node's built-in SQLite otherwise, so `npm run dev` and the test suite
 *     work with no external service and no native build step.
 *
 * The service-role key bypasses row level security, so it must only ever be
 * read on the server. Every caller here is a server-rendered route.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'booked', 'won', 'lost'] as const
export const BOOKING_STATUSES = ['requested', 'confirmed', 'completed', 'cancelled'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export interface Lead {
  id: number
  created_at: string
  updated_at: string
  first_name: string
  last_name: string
  phone: string
  email: string
  address: string
  city: string
  service: string
  message: string
  source: string
  urgency: string
  status: LeadStatus
  notes: string
}

export interface Booking {
  id: number
  lead_id: number | null
  created_at: string
  updated_at: string
  service: string
  preferred_date: string
  preferred_slot: string
  status: BookingStatus
  tech_notes: string
}

export interface BookingRow extends Booking {
  first_name: string | null
  last_name: string | null
  phone: string | null
  city: string | null
  address: string | null
}

export interface NewLead {
  first_name: string
  last_name?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  service?: string
  message?: string
  source?: string
  urgency?: string
}

export interface NewBooking {
  lead_id?: number | null
  service?: string
  preferred_date?: string
  preferred_slot?: string
}

/** Fields callers are allowed to change. */
type LeadPatch = Partial<Pick<Lead, 'status' | 'notes' | 'service' | 'urgency'>>
type BookingPatch = Partial<Pick<Booking, 'status' | 'tech_notes' | 'preferred_date' | 'preferred_slot'>>

interface Store {
  createLead(input: NewLead): Promise<number>
  listLeads(status?: LeadStatus): Promise<Lead[]>
  getLead(id: number): Promise<Lead | undefined>
  updateLead(id: number, fields: LeadPatch): Promise<void>
  deleteLead(id: number): Promise<void>
  leadCounts(): Promise<Record<string, number>>
  countLeadsSince(iso: string): Promise<number>
  createBooking(input: NewBooking): Promise<number>
  listBookings(status?: BookingStatus): Promise<BookingRow[]>
  bookingsForLead(leadId: number): Promise<Booking[]>
  updateBooking(id: number, fields: BookingPatch): Promise<void>
  bookingCounts(): Promise<Record<string, number>>
}

const now = () => new Date().toISOString()
const zeroed = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, 0]))

/* ============================================================
   Supabase (Postgres)
   ============================================================ */

function supabaseStore(client: SupabaseClient): Store {
  /** Supabase returns { data, error }; throw so routes can surface a 500. */
  const unwrap = <T>(res: { data: T | null; error: { message: string } | null }, what: string): T => {
    if (res.error) throw new Error(`${what}: ${res.error.message}`)
    return res.data as T
  }

  return {
    async createLead(input) {
      const t = now()
      const row = unwrap(
        await client
          .from('leads')
          .insert({
            created_at: t,
            updated_at: t,
            first_name: input.first_name,
            last_name: input.last_name ?? '',
            phone: input.phone ?? '',
            email: input.email ?? '',
            address: input.address ?? '',
            city: input.city ?? '',
            service: input.service ?? '',
            message: input.message ?? '',
            source: input.source ?? '',
            urgency: input.urgency ?? 'normal',
          })
          .select('id')
          .single(),
        'createLead',
      )
      return (row as { id: number }).id
    },

    async listLeads(status) {
      let q = client.from('leads').select('*').order('created_at', { ascending: false })
      if (status) q = q.eq('status', status)
      return unwrap(await q, 'listLeads') as Lead[]
    },

    async getLead(id) {
      const res = await client.from('leads').select('*').eq('id', id).maybeSingle()
      if (res.error) throw new Error(`getLead: ${res.error.message}`)
      return (res.data as Lead) ?? undefined
    },

    async updateLead(id, fields) {
      if (!Object.keys(fields).length) return
      const res = await client.from('leads').update({ ...fields, updated_at: now() }).eq('id', id)
      if (res.error) throw new Error(`updateLead: ${res.error.message}`)
    },

    async deleteLead(id) {
      const res = await client.from('leads').delete().eq('id', id)
      if (res.error) throw new Error(`deleteLead: ${res.error.message}`)
    },

    async leadCounts() {
      const rows = unwrap(await client.from('leads').select('status'), 'leadCounts') as {
        status: string
      }[]
      const out = zeroed(LEAD_STATUSES)
      for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1
      return out
    },

    async countLeadsSince(iso) {
      const res = await client
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', iso)
      if (res.error) throw new Error(`countLeadsSince: ${res.error.message}`)
      return res.count ?? 0
    },

    async createBooking(input) {
      const t = now()
      const row = unwrap(
        await client
          .from('bookings')
          .insert({
            lead_id: input.lead_id ?? null,
            created_at: t,
            updated_at: t,
            service: input.service ?? '',
            preferred_date: input.preferred_date || null,
            preferred_slot: input.preferred_slot ?? '',
          })
          .select('id')
          .single(),
        'createBooking',
      )
      return (row as { id: number }).id
    },

    async listBookings(status) {
      let q = client
        .from('bookings')
        .select('*, leads(first_name, last_name, phone, city, address)')
        .order('preferred_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (status) q = q.eq('status', status)
      const rows = unwrap(await q, 'listBookings') as (Booking & {
        leads: { first_name: string; last_name: string; phone: string; city: string; address: string } | null
      })[]
      return rows.map(({ leads, ...b }) => ({
        ...b,
        preferred_date: b.preferred_date ?? '',
        first_name: leads?.first_name ?? null,
        last_name: leads?.last_name ?? null,
        phone: leads?.phone ?? null,
        city: leads?.city ?? null,
        address: leads?.address ?? null,
      }))
    },

    async bookingsForLead(leadId) {
      const rows = unwrap(
        await client
          .from('bookings')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false }),
        'bookingsForLead',
      ) as Booking[]
      return rows.map((b) => ({ ...b, preferred_date: b.preferred_date ?? '' }))
    },

    async updateBooking(id, fields) {
      if (!Object.keys(fields).length) return
      const res = await client.from('bookings').update({ ...fields, updated_at: now() }).eq('id', id)
      if (res.error) throw new Error(`updateBooking: ${res.error.message}`)
    },

    async bookingCounts() {
      const rows = unwrap(await client.from('bookings').select('status'), 'bookingCounts') as {
        status: string
      }[]
      const out = zeroed(BOOKING_STATUSES)
      for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1
      return out
    },
  }
}

/* ============================================================
   SQLite (local development and tests)
   ============================================================ */

async function sqliteStore(): Promise<Store> {
  const { DatabaseSync } = await import('node:sqlite')
  const { mkdirSync } = await import('node:fs')
  const { dirname, resolve } = await import('node:path')

  const dbPath = process.env.BTC_DB_PATH ?? resolve(process.cwd(), 'data', 'bigtexas.db')
  mkdirSync(dirname(dbPath), { recursive: true })

  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      first_name   TEXT NOT NULL,
      last_name    TEXT NOT NULL DEFAULT '',
      phone        TEXT NOT NULL DEFAULT '',
      email        TEXT NOT NULL DEFAULT '',
      address      TEXT NOT NULL DEFAULT '',
      city         TEXT NOT NULL DEFAULT '',
      service      TEXT NOT NULL DEFAULT '',
      message      TEXT NOT NULL DEFAULT '',
      source       TEXT NOT NULL DEFAULT '',
      urgency      TEXT NOT NULL DEFAULT 'normal',
      status       TEXT NOT NULL DEFAULT 'new',
      notes        TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id        INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL,
      service        TEXT NOT NULL DEFAULT '',
      preferred_date TEXT NOT NULL DEFAULT '',
      preferred_slot TEXT NOT NULL DEFAULT '',
      status         TEXT NOT NULL DEFAULT 'requested',
      tech_notes     TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_book_status   ON bookings(status);
    CREATE INDEX IF NOT EXISTS idx_book_date     ON bookings(preferred_date);
  `)

  return {
    async createLead(input) {
      const t = now()
      const r = db
        .prepare(
          `INSERT INTO leads (created_at, updated_at, first_name, last_name, phone, email,
                              address, city, service, message, source, urgency)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          t, t,
          input.first_name,
          input.last_name ?? '',
          input.phone ?? '',
          input.email ?? '',
          input.address ?? '',
          input.city ?? '',
          input.service ?? '',
          input.message ?? '',
          input.source ?? '',
          input.urgency ?? 'normal',
        )
      return Number(r.lastInsertRowid)
    },

    async listLeads(status) {
      return (
        status
          ? db.prepare('SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC').all(status)
          : db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all()
      ) as unknown as Lead[]
    },

    async getLead(id) {
      return db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as unknown as Lead | undefined
    },

    async updateLead(id, fields) {
      const keys = Object.keys(fields)
      if (!keys.length) return
      const set = keys.map((k) => `${k} = ?`).join(', ')
      db.prepare(`UPDATE leads SET ${set}, updated_at = ? WHERE id = ?`).run(
        ...keys.map((k) => (fields as Record<string, string>)[k]),
        now(),
        id,
      )
    },

    async deleteLead(id) {
      db.prepare('DELETE FROM leads WHERE id = ?').run(id)
    },

    async leadCounts() {
      const rows = db.prepare('SELECT status, COUNT(*) AS n FROM leads GROUP BY status').all() as unknown as {
        status: string
        n: number
      }[]
      const out = zeroed(LEAD_STATUSES)
      for (const r of rows) out[r.status] = Number(r.n)
      return out
    },

    async countLeadsSince(iso) {
      return Number(
        (db.prepare('SELECT COUNT(*) AS n FROM leads WHERE created_at >= ?').get(iso) as { n: number }).n,
      )
    },

    async createBooking(input) {
      const t = now()
      const r = db
        .prepare(
          `INSERT INTO bookings (lead_id, created_at, updated_at, service, preferred_date, preferred_slot)
           VALUES (?,?,?,?,?,?)`,
        )
        .run(
          input.lead_id ?? null,
          t, t,
          input.service ?? '',
          input.preferred_date ?? '',
          input.preferred_slot ?? '',
        )
      return Number(r.lastInsertRowid)
    },

    async listBookings(status) {
      const sql = `SELECT b.*, l.first_name, l.last_name, l.phone, l.city, l.address
                   FROM bookings b LEFT JOIN leads l ON l.id = b.lead_id
                   ${status ? 'WHERE b.status = ?' : ''}
                   ORDER BY b.preferred_date ASC, b.created_at DESC`
      return (status ? db.prepare(sql).all(status) : db.prepare(sql).all()) as unknown as BookingRow[]
    },

    async bookingsForLead(leadId) {
      return db
        .prepare('SELECT * FROM bookings WHERE lead_id = ? ORDER BY created_at DESC')
        .all(leadId) as unknown as Booking[]
    },

    async updateBooking(id, fields) {
      const keys = Object.keys(fields)
      if (!keys.length) return
      const set = keys.map((k) => `${k} = ?`).join(', ')
      db.prepare(`UPDATE bookings SET ${set}, updated_at = ? WHERE id = ?`).run(
        ...keys.map((k) => (fields as Record<string, string>)[k]),
        now(),
        id,
      )
    },

    async bookingCounts() {
      const rows = db.prepare('SELECT status, COUNT(*) AS n FROM bookings GROUP BY status').all() as unknown as {
        status: string
        n: number
      }[]
      const out = zeroed(BOOKING_STATUSES)
      for (const r of rows) out[r.status] = Number(r.n)
      return out
    },
  }
}

/* ============================================================
   Backend selection
   ============================================================ */

const url = process.env.SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

export const backend: 'supabase' | 'sqlite' = url && key ? 'supabase' : 'sqlite'

let storePromise: Promise<Store> | null = null
function store(): Promise<Store> {
  if (!storePromise) {
    storePromise =
      backend === 'supabase'
        ? Promise.resolve(
            supabaseStore(
              createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } }),
            ),
          )
        : sqliteStore()
  }
  return storePromise
}

/* Public API: same names as before, now async. */
export const createLead = async (i: NewLead) => (await store()).createLead(i)
export const listLeads = async (s?: LeadStatus) => (await store()).listLeads(s)
export const getLead = async (id: number) => (await store()).getLead(id)
export const updateLead = async (id: number, f: LeadPatch) => (await store()).updateLead(id, f)
export const deleteLead = async (id: number) => (await store()).deleteLead(id)
export const leadCounts = async () => (await store()).leadCounts()
export const countLeadsSince = async (iso: string) => (await store()).countLeadsSince(iso)
export const createBooking = async (i: NewBooking) => (await store()).createBooking(i)
export const listBookings = async (s?: BookingStatus) => (await store()).listBookings(s)
export const bookingsForLead = async (id: number) => (await store()).bookingsForLead(id)
export const updateBooking = async (id: number, f: BookingPatch) => (await store()).updateBooking(id, f)
export const bookingCounts = async () => (await store()).bookingCounts()
