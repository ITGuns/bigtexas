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
