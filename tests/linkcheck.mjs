/** Crawl dist/ HTML for internal links + image srcs and verify each resolves. */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// hybrid builds emit static output under dist/client; static-only builds use dist/
const distRoot = fileURLToPath(new URL('../dist/', import.meta.url))
const dist = existsSync(join(distRoot, 'client')) ? join(distRoot, 'client') : distRoot

function* htmlFiles(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) yield* htmlFiles(p)
    else if (e.endsWith('.html')) yield p
  }
}

const broken = new Map()
let pages = 0
let links = 0

for (const file of htmlFiles(dist)) {
  pages++
  const html = readFileSync(file, 'utf8')
  const hrefs = [...html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)].map((m) => m[1])
  for (const href of hrefs) {
    links++
    if (href.startsWith('//')) continue
    const clean = decodeURIComponent(href)
    const candidates = [
      join(dist, clean),
      join(dist, clean, 'index.html'),
      join(dist, clean.replace(/\/$/, '') + '.html'),
    ]
    if (!candidates.some((c) => existsSync(c))) {
      if (!broken.has(clean)) broken.set(clean, [])
      if (broken.get(clean).length < 3) broken.get(clean).push(file.replace(dist, '/'))
    }
  }
}

console.log(`${pages} pages scanned, ${links} internal refs checked`)
if (broken.size === 0) console.log('ALL LINKS OK')
else {
  console.log(`BROKEN (${broken.size}):`)
  for (const [href, sources] of broken) console.log(`  ${href}  ← ${sources.join(', ')}`)
}
