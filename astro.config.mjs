// @ts-check
import { fileURLToPath } from 'node:url'
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
    resolve: {
      /**
       * Declared here as well as in tsconfig.json. The bundler does not
       * reliably pick the alias up from tsconfig in every environment, which
       * fails the build only on the deployment host. tsconfig keeps the alias
       * for editors and type checking; this makes the build independent of it.
       */
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
  devToolbar: { enabled: false },
  build: {
    inlineStylesheets: 'auto',
  },
})
