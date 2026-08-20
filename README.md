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

## Live deployment

The Vercel project is **guns/bigtexas**, connected to this repository so pushes to `main` deploy automatically.

- Production: https://bigtexas.vercel.app
- Dashboard: https://vercel.com/guns-0e95291c/bigtexas

Set and working: `ADMIN_SECRET`, `SITE_URL`.
Still required before the site can take requests: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`.

Until those are set the marketing pages are fully live, the admin panel stays locked, and the contact form returns a 503 telling visitors to phone instead of silently dropping their request.

## Setting up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor > New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. That creates the `leads` and `bookings` tables, their indexes, and `updated_at` triggers.
3. Copy the project URL and the **service role** key from **Project Settings > Data API** into the Vercel environment variables above.

Row level security is enabled on both tables with no policies, so anonymous and authenticated clients are denied outright. The app reaches the tables only from server-rendered routes using the service-role key, which bypasses RLS. Keep that key server-side; never give it a `PUBLIC_` prefix.

## Videos

The nine videos embedded on the old site live on a Vimeo account owned by
**Select on Site**, the previous web vendor, and are embed-restricted to
`bigtexascomfort.com`. Anywhere else Vimeo renders a "privacy settings"
notice instead of the film.

The site handles all three cases:

| Situation | Behaviour |
| --- | --- |
| A self-hosted file is set on the video | Plays it directly with a native player. No Vimeo request at all. |
| On bigtexascomfort.com, no local file | Embeds the Vimeo player inline, as before. |
| Any other domain, no local file | Poster and runtime still show; pressing play opens the video on vimeo.com in a new tab. |

The hero behaves the same way: the American Standard promo on the licensed
domain, the company's own sky footage everywhere else.

### Serving the films yourself

This is the durable fix. It removes the domain restriction and the dependency
on the old vendor's account.

1. Obtain properly licensed copies. The American Standard and Mitsubishi
   Electric spots are dealer marketing assets available through the respective
   dealer portals. For anything Big Texas Comfort paid Select On Site to
   produce, request the source files.
2. Drop the files into `public/video/`.
3. Add a `src` to the matching entry in `src/data/videos.ts`:

```ts
{
  id: 'air-promo',
  title: 'American Standard Air Promo',
  vimeoId: '569953090',
  duration: 30,
  poster: '/images/video/air-promo.jpg',
  blurb: '...',
  src: '/video/air-promo.mp4',   // add this line
}
```

That one line switches the card to the local file everywhere, on every domain.

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
