// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import vercel from '@astrojs/vercel'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'

/**
 * Hybrid rendering: the marketing pages prerender to static HTML, while
 * /admin/* and /api/* opt into server rendering with `export const prerender = false`.
 *
 * The adapter is chosen by environment so the same repo deploys to Vercel and
 * still runs on a plain Node server locally (`npm run build && npm start`).
 */
const onVercel = !!process.env.VERCEL

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://www.bigtexascomfort.com',
  trailingSlash: 'always',
  adapter: onVercel ? vercel() : node({ mode: 'standalone' }),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin') && !page.includes('/api'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  devToolbar: { enabled: false },
  build: {
    inlineStylesheets: 'auto',
  },
})
