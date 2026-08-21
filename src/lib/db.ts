/**
 * Leads and bookings store.
 *
 * Three interchangeable backends behind one async API, picked by environment:
 *   - Supabase REST when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
 *   - Postgres over the wire when DATABASE_URL is set. On serverless point it
 *     at Supabase's transaction pooler (port 6543).
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
  /** when a follow-up email was last sent */
  follow_up_at: string | null
  /** when a review request was sent */
  review_sent_at: string | null
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
  completed_at: string | null
}

export interface BookingRow extends Booking {
  first_name: string | null
  last_name: string | null
  phone: string | null
  city: string | null
  address: string | null
}

/**
 * A conversation held in the website assistant.
 *
 * `token` is the visitor's key to their own thread. It is random and secret;
 * the numeric id is never given to the browser, so one visitor cannot read
 * another's messages by guessing.
 *
 * status: bot     the assistant is answering on its own
 *         waiting the visitor asked for a person and nobody has replied
 *         live    someone from the office has joined
 *         closed  finished
 */
export const CHAT_STATUSES = ['bot', 'waiting', 'live', 'closed'] as const
export type ChatStatus = (typeof CHAT_STATUSES)[number]

export const MESSAGE_ROLES = ['visitor', 'bot', 'agent'] as const
export type MessageRole = (typeof MESSAGE_ROLES)[number]

export interface Chat {
  id: number
  token: string
  created_at: string
  updated_at: string
  name: string
  phone: string
  email: string
  page: string
  status: ChatStatus
  lead_id: number | null
  /** visitor messages the office has not opened yet */
  agent_unread: number
  last_message_at: string
}

export interface ChatMessage {
  id: number
  chat_id: number
  created_at: string
  role: MessageRole
  body: string
}

/** A chat plus what the list view needs, so the page does not N+1. */
export interface ChatRow extends Chat {
  message_count: number
  last_body: string
  last_role: MessageRole | null
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
type LeadPatch = Partial<Pick<Lead, 'status' | 'notes' | 'service' | 'urgency' | 'follow_up_at' | 'review_sent_at'>>
type BookingPatch = Partial<Pick<Booking, 'status' | 'tech_notes' | 'preferred_date' | 'preferred_slot' | 'completed_at'>>

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
  createChat(input: NewChat): Promise<Chat>
  getChatByToken(token: string): Promise<Chat | undefined>
  getChat(id: number): Promise<Chat | undefined>
  listChats(status?: ChatStatus): Promise<ChatRow[]>
  updateChat(id: number, fields: ChatPatch): Promise<void>
  addMessage(chatId: number, role: MessageRole, body: string): Promise<ChatMessage>
  listMessages(chatId: number, afterId?: number): Promise<ChatMessage[]>
  chatCounts(): Promise<Record<string, number>>
}

export interface NewChat {
  token: string
  page?: string
  name?: string
}

type ChatPatch = Partial<
  Pick<Chat, 'status' | 'name' | 'phone' | 'email' | 'lead_id' | 'agent_unread'>
>

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

    /* ---- assistant conversations ---- */

    async createChat(input) {
      const t = now()
      const row = unwrap(
        await client
          .from('chats')
          .insert({
            token: input.token,
            created_at: t,
            updated_at: t,
            last_message_at: t,
            page: input.page ?? '',
            name: input.name ?? '',
          })
          .select('*')
          .single(),
        'createChat',
      )
      return row as Chat
    },

    async getChatByToken(token) {
      const res = await client.from('chats').select('*').eq('token', token).maybeSingle()
      if (res.error) throw new Error(`getChatByToken: ${res.error.message}`)
      return (res.data as Chat) ?? undefined
    },

    async getChat(id) {
      const res = await client.from('chats').select('*').eq('id', id).maybeSingle()
      if (res.error) throw new Error(`getChat: ${res.error.message}`)
      return (res.data as Chat) ?? undefined
    },

    async listChats(status) {
      let q = client
        .from('chats')
        .select('*, chat_messages(id, body, role, created_at)')
        .order('last_message_at', { ascending: false })
      if (status) q = q.eq('status', status)
      const rows = unwrap(await q, 'listChats') as (Chat & {
        chat_messages: { id: number; body: string; role: MessageRole; created_at: string }[]
      })[]
      return rows.map(({ chat_messages, ...c }) => {
        const sorted = [...(chat_messages ?? [])].sort((a, b) => a.id - b.id)
        const last = sorted[sorted.length - 1]
        return {
          ...c,
          message_count: sorted.length,
          last_body: last?.body ?? '',
          last_role: last?.role ?? null,
        }
      })
    },

    async updateChat(id, fields) {
      if (!Object.keys(fields).length) return
      const res = await client.from('chats').update({ ...fields, updated_at: now() }).eq('id', id)
      if (res.error) throw new Error(`updateChat: ${res.error.message}`)
    },

    async addMessage(chatId, role, body) {
      const t = now()
      const row = unwrap(
        await client
          .from('chat_messages')
          .insert({ chat_id: chatId, created_at: t, role, body })
          .select('*')
          .single(),
        'addMessage',
      )
      await client.from('chats').update({ updated_at: t, last_message_at: t }).eq('id', chatId)
      return row as ChatMessage
    },

    async listMessages(chatId, afterId = 0) {
      let q = client.from('chat_messages').select('*').eq('chat_id', chatId).order('id')
      if (afterId) q = q.gt('id', afterId)
      return unwrap(await q, 'listMessages') as ChatMessage[]
    },

    async chatCounts() {
      const rows = unwrap(await client.from('chats').select('status'), 'chatCounts') as {
        status: string
      }[]
      const out = zeroed(CHAT_STATUSES)
      for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1
      return out
    },
  }
}

/* ============================================================
   Postgres over the wire (Supabase connection pooler)
   Used when DATABASE_URL is set. Point it at the transaction
   pooler (port 6543) on serverless: prepared statements are
   disabled below because that mode does not support them.
   ============================================================ */

async function pgStore(connection: string): Promise<Store> {
  const { default: postgres } = await import('postgres')
  const sql = postgres(connection, {
    ssl: 'require',
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
  })

  const one = <T>(rows: T[]): T | undefined => rows[0]

  return {
    async createLead(input) {
      const [row] = await sql<{ id: number }[]>`
        INSERT INTO leads ${sql({
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
        })}
        RETURNING id`
      return Number(row.id)
    },

    async listLeads(status) {
      const rows = status
        ? await sql<Lead[]>`SELECT * FROM leads WHERE status = ${status} ORDER BY created_at DESC`
        : await sql<Lead[]>`SELECT * FROM leads ORDER BY created_at DESC`
      return rows.map(normaliseLead)
    },

    async getLead(id) {
      const row = one(await sql<Lead[]>`SELECT * FROM leads WHERE id = ${id}`)
      return row ? normaliseLead(row) : undefined
    },

    async updateLead(id, fields) {
      if (!Object.keys(fields).length) return
      await sql`UPDATE leads SET ${sql(fields as Record<string, string>)}, updated_at = now() WHERE id = ${id}`
    },

    async deleteLead(id) {
      await sql`DELETE FROM leads WHERE id = ${id}`
    },

    async leadCounts() {
      const rows = await sql<{ status: string; n: string }[]>`
        SELECT status, COUNT(*)::int AS n FROM leads GROUP BY status`
      const out = zeroed(LEAD_STATUSES)
      for (const r of rows) out[r.status] = Number(r.n)
      return out
    },

    async countLeadsSince(iso) {
      const [row] = await sql<{ n: string }[]>`
        SELECT COUNT(*)::int AS n FROM leads WHERE created_at >= ${iso}`
      return Number(row.n)
    },

    async createBooking(input) {
      const [row] = await sql<{ id: number }[]>`
        INSERT INTO bookings ${sql({
          lead_id: input.lead_id ?? null,
          service: input.service ?? '',
          preferred_date: input.preferred_date || null,
          preferred_slot: input.preferred_slot ?? '',
        })}
        RETURNING id`
      return Number(row.id)
    },

    async listBookings(status) {
      const rows = status
        ? await sql<BookingRow[]>`
            SELECT b.*, l.first_name, l.last_name, l.phone, l.city, l.address
            FROM bookings b LEFT JOIN leads l ON l.id = b.lead_id
            WHERE b.status = ${status}
            ORDER BY b.preferred_date ASC NULLS LAST, b.created_at DESC`
        : await sql<BookingRow[]>`
            SELECT b.*, l.first_name, l.last_name, l.phone, l.city, l.address
            FROM bookings b LEFT JOIN leads l ON l.id = b.lead_id
            ORDER BY b.preferred_date ASC NULLS LAST, b.created_at DESC`
      return rows.map(normaliseBooking) as BookingRow[]
    },

    async bookingsForLead(leadId) {
      const rows = await sql<Booking[]>`
        SELECT * FROM bookings WHERE lead_id = ${leadId} ORDER BY created_at DESC`
      return rows.map(normaliseBooking)
    },

    async updateBooking(id, fields) {
      if (!Object.keys(fields).length) return
      const patch: Record<string, string | null> = { ...(fields as Record<string, string>) }
      if ('preferred_date' in patch && !patch.preferred_date) patch.preferred_date = null
      await sql`UPDATE bookings SET ${sql(patch)}, updated_at = now() WHERE id = ${id}`
    },

    async bookingCounts() {
      const rows = await sql<{ status: string; n: string }[]>`
        SELECT status, COUNT(*)::int AS n FROM bookings GROUP BY status`
      const out = zeroed(BOOKING_STATUSES)
      for (const r of rows) out[r.status] = Number(r.n)
      return out
    },

    /* ---- assistant conversations ---- */

    async createChat(input) {
      const [row] = await sql<Chat[]>`
        INSERT INTO chats ${sql({ token: input.token, page: input.page ?? '', name: input.name ?? '' })}
        RETURNING *`
      return normaliseChat(row)
    },

    async getChatByToken(token) {
      const rows = await sql<Chat[]>`SELECT * FROM chats WHERE token = ${token}`
      return rows[0] ? normaliseChat(rows[0]) : undefined
    },

    async getChat(id) {
      const rows = await sql<Chat[]>`SELECT * FROM chats WHERE id = ${id}`
      return rows[0] ? normaliseChat(rows[0]) : undefined
    },

    async listChats(status) {
      const rows = status
        ? await sql<ChatRow[]>`
            SELECT c.*, m.message_count, m.last_body, m.last_role
            FROM chats c LEFT JOIN LATERAL (
              SELECT COUNT(*)::int AS message_count,
                     (ARRAY_AGG(body ORDER BY id DESC))[1] AS last_body,
                     (ARRAY_AGG(role ORDER BY id DESC))[1] AS last_role
              FROM chat_messages WHERE chat_id = c.id
            ) m ON true
            WHERE c.status = ${status}
            ORDER BY c.last_message_at DESC`
        : await sql<ChatRow[]>`
            SELECT c.*, m.message_count, m.last_body, m.last_role
            FROM chats c LEFT JOIN LATERAL (
              SELECT COUNT(*)::int AS message_count,
                     (ARRAY_AGG(body ORDER BY id DESC))[1] AS last_body,
                     (ARRAY_AGG(role ORDER BY id DESC))[1] AS last_role
              FROM chat_messages WHERE chat_id = c.id
            ) m ON true
            ORDER BY c.last_message_at DESC`
      return rows.map((r) => ({
        ...normaliseChat(r),
        message_count: Number(r.message_count ?? 0),
        last_body: r.last_body ?? '',
        last_role: r.last_role ?? null,
      }))
    },

    async updateChat(id, fields) {
      if (!Object.keys(fields).length) return
      await sql`UPDATE chats SET ${sql(fields as Record<string, string>)}, updated_at = now() WHERE id = ${id}`
    },

    async addMessage(chatId, role, body) {
      const [row] = await sql<ChatMessage[]>`
        INSERT INTO chat_messages ${sql({ chat_id: chatId, role, body })}
        RETURNING *`
      await sql`UPDATE chats SET updated_at = now(), last_message_at = now() WHERE id = ${chatId}`
      return { ...row, id: Number(row.id), chat_id: Number(row.chat_id), created_at: iso(row.created_at) }
    },

    async listMessages(chatId, afterId = 0) {
      const rows = await sql<ChatMessage[]>`
        SELECT * FROM chat_messages WHERE chat_id = ${chatId} AND id > ${afterId} ORDER BY id`
      return rows.map((r) => ({
        ...r,
        id: Number(r.id),
        chat_id: Number(r.chat_id),
        created_at: iso(r.created_at),
      }))
    },

    async chatCounts() {
      const rows = await sql<{ status: string; n: string }[]>`
        SELECT status, COUNT(*)::int AS n FROM chats GROUP BY status`
      const out = zeroed(CHAT_STATUSES)
      for (const r of rows) out[r.status] = Number(r.n)
      return out
    },
  }
}

/** Postgres hands back Dates and bigints where the app wants strings/numbers. */
function normaliseChat<T extends Chat>(c: T): T {
  return {
    ...c,
    id: Number(c.id),
    lead_id: c.lead_id === null || c.lead_id === undefined ? null : Number(c.lead_id),
    agent_unread: Number(c.agent_unread ?? 0),
    created_at: iso(c.created_at),
    updated_at: iso(c.updated_at),
    last_message_at: iso(c.last_message_at),
  }
}

/** Postgres returns Date objects and nulls where the app expects strings. */
const iso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : ''

function normaliseLead<T extends Lead>(l: T): T {
  return {
    ...l,
    created_at: iso(l.created_at),
    updated_at: iso(l.updated_at),
    follow_up_at: l.follow_up_at ? iso(l.follow_up_at) : null,
    review_sent_at: l.review_sent_at ? iso(l.review_sent_at) : null,
  }
}

function normaliseBooking<T extends Booking>(b: T): T {
  return {
    ...b,
    created_at: iso(b.created_at),
    updated_at: iso(b.updated_at),
    // a DATE column comes back as a Date; the UI compares plain YYYY-MM-DD
    preferred_date: b.preferred_date ? iso(b.preferred_date).slice(0, 10) : '',
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
      notes        TEXT NOT NULL DEFAULT '',
      follow_up_at   TEXT,
      review_sent_at TEXT
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
      tech_notes     TEXT NOT NULL DEFAULT '',
      completed_at   TEXT
    );
    CREATE TABLE IF NOT EXISTS chats (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      token           TEXT NOT NULL UNIQUE,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      last_message_at TEXT NOT NULL,
      name            TEXT NOT NULL DEFAULT '',
      phone           TEXT NOT NULL DEFAULT '',
      email           TEXT NOT NULL DEFAULT '',
      page            TEXT NOT NULL DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'bot',
      lead_id         INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      agent_unread    INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id    INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      role       TEXT NOT NULL,
      body       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_msg      ON chat_messages(chat_id, id);
    CREATE INDEX IF NOT EXISTS idx_chats_status  ON chats(status, last_message_at DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_book_status   ON bookings(status);
    CREATE INDEX IF NOT EXISTS idx_book_date     ON bookings(preferred_date);
  `)

  // CREATE TABLE IF NOT EXISTS leaves databases made before a column was added
  // untouched, so bring older files forward. Mirrors the post-launch migration
  // at the bottom of supabase/schema.sql.
  const addColumn = (table: string, column: string, decl: string) => {
    const has = db
      .prepare(`SELECT 1 FROM pragma_table_info(?) WHERE name = ?`)
      .get(table, column)
    if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`)
  }
  addColumn('leads', 'follow_up_at', 'TEXT')
  addColumn('leads', 'review_sent_at', 'TEXT')
  addColumn('bookings', 'completed_at', 'TEXT')

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

    /* ---- assistant conversations ---- */

    async createChat(input) {
      const t = now()
      const r = db
        .prepare(
          `INSERT INTO chats (token, created_at, updated_at, last_message_at, page, name)
           VALUES (?,?,?,?,?,?)`,
        )
        .run(input.token, t, t, t, input.page ?? '', input.name ?? '')
      return db.prepare('SELECT * FROM chats WHERE id = ?').get(Number(r.lastInsertRowid)) as unknown as Chat
    },

    async getChatByToken(token) {
      return (db.prepare('SELECT * FROM chats WHERE token = ?').get(token) as unknown as Chat) ?? undefined
    },

    async getChat(id) {
      return (db.prepare('SELECT * FROM chats WHERE id = ?').get(id) as unknown as Chat) ?? undefined
    },

    async listChats(status) {
      const base = `
        SELECT c.*,
               (SELECT COUNT(*) FROM chat_messages WHERE chat_id = c.id) AS message_count,
               (SELECT body FROM chat_messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) AS last_body,
               (SELECT role FROM chat_messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) AS last_role
        FROM chats c`
      const rows = (
        status
          ? db.prepare(`${base} WHERE c.status = ? ORDER BY c.last_message_at DESC`).all(status)
          : db.prepare(`${base} ORDER BY c.last_message_at DESC`).all()
      ) as unknown as ChatRow[]
      return rows.map((r) => ({
        ...r,
        message_count: Number(r.message_count ?? 0),
        last_body: r.last_body ?? '',
        last_role: r.last_role ?? null,
      }))
    },

    async updateChat(id, fields) {
      const keys = Object.keys(fields)
      if (!keys.length) return
      const set = keys.map((k) => `${k} = ?`).join(', ')
      db.prepare(`UPDATE chats SET ${set}, updated_at = ? WHERE id = ?`).run(
        ...keys.map((k) => (fields as Record<string, string>)[k]),
        now(),
        id,
      )
    },

    async addMessage(chatId, role, body) {
      const t = now()
      const r = db
        .prepare('INSERT INTO chat_messages (chat_id, created_at, role, body) VALUES (?,?,?,?)')
        .run(chatId, t, role, body)
      db.prepare('UPDATE chats SET updated_at = ?, last_message_at = ? WHERE id = ?').run(t, t, chatId)
      return db
        .prepare('SELECT * FROM chat_messages WHERE id = ?')
        .get(Number(r.lastInsertRowid)) as unknown as ChatMessage
    },

    async listMessages(chatId, afterId = 0) {
      return db
        .prepare('SELECT * FROM chat_messages WHERE chat_id = ? AND id > ? ORDER BY id')
        .all(chatId, afterId) as unknown as ChatMessage[]
    },

    async chatCounts() {
      const rows = db.prepare('SELECT status, COUNT(*) AS n FROM chats GROUP BY status').all() as unknown as {
        status: string
        n: number
      }[]
      const out = zeroed(CHAT_STATUSES)
      for (const r of rows) out[r.status] = Number(r.n)
      return out
    },
  }
}

/* ============================================================
   Backend selection
   ============================================================ */

/**
 * Astro exposes .env through import.meta.env, while Vercel and plain Node
 * provide process.env. Read both so one lookup works in every environment.
 */
const env = (name: string): string | undefined =>
  (import.meta.env as Record<string, string | undefined>)[name] ?? process.env[name]

const url = env('SUPABASE_URL') ?? env('PUBLIC_SUPABASE_URL')
const key = env('SUPABASE_SERVICE_ROLE_KEY')
const dbUrl = env('DATABASE_URL')

export const backend: 'supabase' | 'postgres' | 'sqlite' =
  url && key ? 'supabase' : dbUrl ? 'postgres' : 'sqlite'

/**
 * SQLite is fine locally but writes to an ephemeral filesystem on serverless,
 * so a lead saved there would be silently lost. Routes check this and refuse
 * to accept submissions rather than pretending to store them.
 */
export const storageReady = backend !== 'sqlite' || !import.meta.env.PROD

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
        : backend === 'postgres'
          ? pgStore(dbUrl!)
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
export const createChat = async (i: NewChat) => (await store()).createChat(i)
export const getChatByToken = async (t: string) => (await store()).getChatByToken(t)
export const getChat = async (id: number) => (await store()).getChat(id)
export const listChats = async (s?: ChatStatus) => (await store()).listChats(s)
export const updateChat = async (id: number, f: ChatPatch) => (await store()).updateChat(id, f)
export const addMessage = async (id: number, r: MessageRole, b: string) =>
  (await store()).addMessage(id, r, b)
export const listMessages = async (id: number, after?: number) =>
  (await store()).listMessages(id, after)
export const chatCounts = async () => (await store()).chatCounts()
export const bookingsForLead = async (id: number) => (await store()).bookingsForLead(id)
export const updateBooking = async (id: number, f: BookingPatch) => (await store()).updateBooking(id, f)
export const bookingCounts = async () => (await store()).bookingCounts()
