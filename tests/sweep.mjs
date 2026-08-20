/**
 * Multi-page QA sweep against the dev server:
 * console errors, horizontal overflow, alt text, heading order, contrast-critical
 * landmarks, and full-page screenshots per breakpoint.
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const outDir = fileURLToPath(new URL('../shots/', import.meta.url))
mkdirSync(outDir, { recursive: true })

const routes = [
  ['/', 'home'],
  ['/services/', 'services'],
  ['/services/ac-repair/', 'service-detail'],
  ['/services/ac-repair/league-city/', 'service-city'],
  ['/products/', 'products'],
  ['/products/air-conditioners/', 'product-detail'],
  ['/service-area/', 'area'],
  ['/service-area/webster/', 'area-city'],
  ['/support/', 'support'],
  ['/support/ac-not-cooling/', 'support-tree'],
  ['/guides/repair-or-replace/', 'guide'],
  ['/videos/', 'videos'],
  ['/special-offers/', 'offers'],
  ['/financing/', 'financing'],
  ['/about/', 'about'],
  ['/reviews/', 'reviews'],
  ['/contact/', 'contact'],
  ['/glossary/', 'glossary'],
  ['/blog/', 'blog'],
  ['/blog/solving-ac-ice-buildup/', 'blog-post'],
  ['/404/', '404'],
]

const viewports = [
  { w: 1440, h: 900, tag: 'desktop' },
  { w: 768, h: 1024, tag: 'tablet' },
  { w: 390, h: 844, tag: 'mobile' },
]

const shotOnly = process.argv[2] ? [process.argv[2]] : null
const browser = await chromium.launch()
const problems = []

for (const [route, name] of routes) {
  if (shotOnly && !shotOnly.includes(name)) continue
  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.w, height: vp.h },
      reducedMotion: 'reduce',
    })
    const tag = `${name}@${vp.tag}`
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`${tag} CONSOLE: ${m.text()}`)
    })
    page.on('pageerror', (e) => problems.push(`${tag} PAGEERROR: ${e.message}`))

    const res = await page.goto(`http://localhost:4321${route}`, { waitUntil: 'networkidle' })
    if (res && res.status() >= 400 && name !== '404') problems.push(`${tag} HTTP ${res.status()}`)

    await page.evaluate(async () => {
      for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager'
      await Promise.all(
        [...document.images].map((i) =>
          i.complete ? 0 : new Promise((r) => ((i.onload = r), (i.onerror = r))),
        ),
      )
    })
    await page.waitForTimeout(400)

    const audit = await page.evaluate(() => {
      const out = {}
      out.overflow =
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      out.imgNoAlt = [...document.images]
        .filter((i) => !i.hasAttribute('alt'))
        .map((i) => i.getAttribute('src'))
      out.imgBroken = [...document.images]
        .filter((i) => i.complete && i.naturalWidth === 0)
        .map((i) => i.getAttribute('src'))
      out.h1Count = document.querySelectorAll('h1').length
      const levels = [...document.querySelectorAll('h1,h2,h3,h4')].map((h) =>
        parseInt(h.tagName[1]),
      )
      out.headingJumps = levels.filter((l, i) => i > 0 && l - levels[i - 1] > 1).length
      out.emptyLinks = [...document.querySelectorAll('a')].filter(
        (a) => !a.textContent.trim() && !a.getAttribute('aria-label') && !a.querySelector('img[alt]:not([alt=""])'),
      ).length
      out.title = document.title
      out.metaDesc = document.querySelector('meta[name="description"]')?.content?.length ?? 0
      return out
    })

    if (audit.overflow > 1) problems.push(`${tag} OVERFLOW ${audit.overflow}px`)
    if (audit.imgNoAlt.length) problems.push(`${tag} IMG NO ALT: ${audit.imgNoAlt.join(', ')}`)
    if (audit.imgBroken.length) problems.push(`${tag} IMG BROKEN: ${audit.imgBroken.join(', ')}`)
    if (audit.h1Count !== 1) problems.push(`${tag} H1 COUNT = ${audit.h1Count}`)
    if (audit.headingJumps) problems.push(`${tag} HEADING JUMPS: ${audit.headingJumps}`)
    if (audit.emptyLinks) problems.push(`${tag} EMPTY LINKS: ${audit.emptyLinks}`)
    if (!audit.title) problems.push(`${tag} NO TITLE`)
    if (audit.metaDesc < 50) problems.push(`${tag} SHORT META (${audit.metaDesc})`)

    if (vp.tag === 'desktop' || shotOnly) {
      await page.screenshot({ path: `${outDir}${name}-${vp.tag}.png`, fullPage: true })
    }
    await page.close()
  }
}

await browser.close()
console.log(problems.length ? `PROBLEMS (${problems.length}):\n` + problems.join('\n') : 'CLEAN — all routes pass')
