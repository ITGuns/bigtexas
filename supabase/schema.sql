-- Big Texas Comfort: leads and bookings schema.
-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query).

create table if not exists public.leads (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  first_name  text        not null,
  last_name   text        not null default '',
  phone       text        not null default '',
  email       text        not null default '',
  address     text        not null default '',
  city        text        not null default '',
  service     text        not null default '',
  message     text        not null default '',
  source      text        not null default '',
  urgency     text        not null default 'normal'
                check (urgency in ('normal', 'soon', 'emergency')),
  status      text        not null default 'new'
                check (status in ('new', 'contacted', 'qualified', 'booked', 'won', 'lost')),
  notes       text        not null default ''
);

create table if not exists public.bookings (
  id             bigint generated always as identity primary key,
  lead_id        bigint references public.leads(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  service        text        not null default '',
  preferred_date date,
  preferred_slot text        not null default '',
  status         text        not null default 'requested'
                   check (status in ('requested', 'confirmed', 'completed', 'cancelled')),
  tech_notes     text        not null default ''
);

create index if not exists idx_leads_status  on public.leads (status);
create index if not exists idx_leads_created on public.leads (created_at desc);
create index if not exists idx_book_status   on public.bookings (status);
create index if not exists idx_book_date     on public.bookings (preferred_date);
create index if not exists idx_book_lead     on public.bookings (lead_id);

-- Row level security is ON with no policies, which denies every anon and
-- authenticated request. The app talks to these tables only from server-side
-- routes using the service-role key, which bypasses RLS. That means a leaked
-- anon key cannot read a single customer record.
alter table public.leads    enable row level security;
alter table public.bookings enable row level security;

-- Keep updated_at honest even for changes made directly in the dashboard.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_touch_updated_at on public.leads;
create trigger leads_touch_updated_at
  before update on public.leads
  for each row execute function public.touch_updated_at();

drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at
  before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Follow-up and review tracking (added after launch)
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists follow_up_at   timestamptz,
  add column if not exists review_sent_at timestamptz;

alter table public.bookings
  add column if not exists completed_at timestamptz;

create index if not exists idx_leads_followup on public.leads (follow_up_at);

-- ---------------------------------------------------------------------------
-- Live chat: conversations held in the website assistant, and the replies the
-- office sends back from the control panel.
--
-- `token` is the visitor's key to their own thread. It is random and secret,
-- and the numeric id never reaches the browser, so one visitor cannot read
-- another's conversation by guessing an id.
-- ---------------------------------------------------------------------------
create table if not exists public.chats (
  id              bigint generated always as identity primary key,
  token           text        not null unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  name            text        not null default '',
  phone           text        not null default '',
  email           text        not null default '',
  page            text        not null default '',
  status          text        not null default 'bot'
                    check (status in ('bot', 'waiting', 'live', 'closed')),
  lead_id         bigint      references public.leads(id) on delete set null,
  agent_unread    integer     not null default 0
);

create table if not exists public.chat_messages (
  id         bigint generated always as identity primary key,
  chat_id    bigint      not null references public.chats(id) on delete cascade,
  created_at timestamptz not null default now(),
  role       text        not null check (role in ('visitor', 'bot', 'agent')),
  body       text        not null
);

create index if not exists idx_chats_status   on public.chats (status, last_message_at desc);
create index if not exists idx_chats_token    on public.chats (token);
create index if not exists idx_chat_msg_chat  on public.chat_messages (chat_id, id);

alter table public.chats         enable row level security;
alter table public.chat_messages enable row level security;

drop trigger if exists chats_touch_updated_at on public.chats;
create trigger chats_touch_updated_at
  before update on public.chats
  for each row execute function public.touch_updated_at();
