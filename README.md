# Big Texas Comfort

Redesign of [bigtexascomfort.com](https://www.bigtexascomfort.com), a Houston HVAC contractor. Astro 7, hybrid rendering, with a small back office for leads and bookings.

- **134 marketing pages** prerender to static HTML at build time.
- **`/admin/*` and `/api/*`** render on the server.
- **Leads and bookings** persist to Supabase in production, SQLite locally.

## Running locally

```bash
npm install
cp .env.example .env   # then set ADMIN_PASSWORD and ADMIN_SECRET
npm run dev
```

The site is at `http://localhost:4321`, the control panel at `/admin/`.

With no Supabase credentials set, the app writes to a local SQLite file at `data/bigtexas.db` (gitignored). Nothing external is needed to develop or run the tests.

## Content

Page copy comes from a scrape of the existing site, extracted into `content-extracted/*.json` and normalised at import time by `cleanText()` in `src/data/extracted.ts`.

Two rules hold everywhere in this project:

1. **Nothing is invented.** Prices, certifications, service areas, equipment specs and the single customer review are all verbatim from the client's own site. There is exactly one real review; do not add more.
2. **No em or en dashes** in visible copy, and no decorative index numerals. Both read as machine-written. `cleanText()` strips dashes from scraped copy on the way in.

Structured business facts live in `src/data/site.ts`. Images in `public/images/` were pulled from the live site; there is no stock photography.

## Deploying to Vercel

1. Import the repository in Vercel. Framework preset **Astro** is detected automatically; leave the build command and output directory at their defaults.
2. Add the environment variables from `.env.example` under **Settings > Environment Variables**:
   - `ADMIN_PASSWORD`
   - `ADMIN_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SITE_URL` (optional, defaults to the production domain)
3. Deploy.

The adapter switches itself: `@astrojs/vercel` when the `VERCEL` env var is present, `@astrojs/node` otherwise, so `npm run build && npm start` still gives you a working server anywhere else.

## Setting up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor > New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. That creates the `leads` and `bookings` tables, their indexes, and `updated_at` triggers.
3. Copy the project URL and the **service role** key from **Project Settings > Data API** into the Vercel environment variables above.

Row level security is enabled on both tables with no policies, so anonymous and authenticated clients are denied outright. The app reaches the tables only from server-rendered routes using the service-role key, which bypasses RLS. Keep that key server-side; never give it a `PUBLIC_` prefix.

## Admin panel

`/admin/` is protected by one shared password and an HMAC-signed, httpOnly session cookie lasting 12 hours. It is excluded from `robots.txt` and the sitemap, and every page sends `noindex`.

- **Dashboard** with open leads, weekly volume, pending bookings and a six-stage pipeline board.
- **Leads**: search, filter by stage, change stage inline, export CSV.
- **Lead detail**: click-to-call and text, internal notes, and booking a job straight from the lead.
- **Bookings**: every appointment with its date, arrival window and status.

The public contact form posts to `/api/leads`. A hidden honeypot field silently absorbs bot submissions, and a requested date turns a lead into a booking automatically.

## Tests

```bash
npm test
```

Four Playwright suites, run against the dev server:

| Suite | Covers |
| --- | --- |
| `tests/sweep.mjs` | 21 routes × 3 breakpoints: console errors, horizontal overflow, alt text, heading order, titles and meta |
| `tests/interactions.mjs` | Service explorer, troubleshooting stepper, video players, mobile menu, contact form, FAQ, glossary, background video, rounded corners |
| `tests/admin.mjs` | Public submission through the full pipeline, plus auth and CSRF refusals |
| `tests/linkcheck.mjs` | Every internal link and asset reference in the build |

Start `npm run dev` in another terminal first. `linkcheck` runs against `dist/`, so build before using it.

## Project layout

```
src/
  components/     nav, footer, video gallery, maps, hero and section components
  data/           site facts, services, cities, videos, extracted page content
  layouts/        Base (public) and Admin shells
  lib/            db (Supabase or SQLite), auth, formatting
  pages/          marketing routes, /admin, /api
  styles/         design tokens, gradients, admin styles
content-extracted/  scraped copy as JSON
supabase/schema.sql database schema
tests/            Playwright suites
```
