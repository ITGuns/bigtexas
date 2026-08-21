/** Functional checks on the interactive pieces. */
import { chromium } from '@playwright/test'

const base = 'http://localhost:4321'
const browser = await chromium.launch()
const fails = []
const ok = (cond, msg) => (cond ? null : fails.push(msg))

/* ---------- 1. system explorer tabs ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(base, { waitUntil: 'networkidle' })
  const heating = page.locator('[data-cat="heating"]')
  await heating.click()
  ok(await heating.getAttribute('aria-selected') === 'true', 'explorer: tab not selected after click')
  ok(await page.locator('#panel-heating').isVisible(), 'explorer: heating panel not visible')
  ok(!(await page.locator('#panel-cooling').isVisible()), 'explorer: cooling panel still visible')
  const litFurnace = await page.locator('[data-part="furnace"]').getAttribute('class')
  ok(litFurnace?.includes('is-active'), 'explorer: furnace schematic not lit for heating')
  // keyboard nav
  await heating.press('ArrowDown')
  const airq = page.locator('[data-cat="air-quality"]')
  ok(await airq.getAttribute('aria-selected') === 'true', 'explorer: ArrowDown did not move selection')
  await page.close()
}

/* ---------- 2. troubleshooting stepper ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${base}/support/ac-not-cooling/`, { waitUntil: 'networkidle' })
  ok(await page.locator('[data-tree-stepper]').isVisible(), 'tree: stepper hidden')
  ok(!(await page.locator('[data-tree-static]').isVisible()), 'tree: static list should hide when JS runs')
  await page.locator('[data-tree-next]').click()
  const step1 = await page.locator('[data-tree-screen]').innerText()
  ok(/step 1 of/i.test(step1), `tree: expected "Step 1 of", got "${step1.slice(0, 40)}"`)
  ok(/thermostat/i.test(step1), 'tree: first step should mention thermostat')
  // walk to the end
  for (let i = 0; i < 10; i++) {
    const btn = page.locator('[data-tree-next]')
    if (!(await btn.isVisible())) break
    await btn.click()
  }
  const end = await page.locator('[data-tree-screen]').innerText()
  ok(/Checklist complete/i.test(end), 'tree: did not reach completion screen')
  ok(await page.locator('[data-tree-screen] a[href^="tel:"]').count() > 0, 'tree: no call CTA at end')
  // back button works
  await page.locator('[data-tree-back]').click()
  ok(/step \d+ of/i.test(await page.locator('[data-tree-screen]').innerText()), 'tree: back did not return to a step')
  await page.close()
}

/* ---------- 3. video facade ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const vimeoBefore = []
  page.on('request', (r) => {
    if (r.url().includes('vimeo')) vimeoBefore.push(r.url())
  })
  await page.goto(`${base}/videos/`, { waitUntil: 'networkidle' })
  ok(vimeoBefore.length === 0, `video: ${vimeoBefore.length} vimeo request(s) before click (should be 0)`)

  // every card shows a real poster frame rather than an empty panel
  const posters = await page.locator('.video-poster').count()
  ok(posters === 9, `video: expected 9 posters (4 ads + 5 overviews), got ${posters}`)
  const decoded = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('img.video-poster')]
    imgs.forEach((i) => (i.loading = 'eager'))
    await Promise.all(imgs.map((i) => i.decode().catch(() => {})))
    return imgs.filter((i) => i.naturalWidth > 600).length
  })
  ok(decoded === 9, `video: only ${decoded}/9 posters decoded at full size`)

  // ads are self-hosted now, so they play a local file with no third-party request
  await page.locator('.videos--ads .video-trigger').first().click()
  await page.waitForTimeout(1500)
  const adVideo = page.locator('.videos--ads .video-card video').first()
  ok((await adVideo.count()) > 0, 'video: ad did not become a local player')
  const adInfo = await page.evaluate(() => {
    const v = document.querySelector('.videos--ads .video-card video')
    return { src: v?.currentSrc ?? '', muted: v?.muted, controls: v?.controls, w: v?.videoWidth ?? 0 }
  })
  ok(adInfo.src.includes('/video/'), `video: ad not served locally (${adInfo.src})`)
  ok(adInfo.w > 0, 'video: local ad has no frames')
  ok(adInfo.controls === true, 'video: local ad missing controls')
  ok(adInfo.muted === false, 'video: local ad should carry its audio')

  // it must fill the card it replaced, not collapse to a default box
  const adCardBox = await page.locator('.videos--ads .video-card').first().boundingBox()
  const adFrameBox = await adVideo.boundingBox()
  ok(
    Math.abs(adFrameBox.width - adCardBox.width) < 4,
    `video: ad player width ${Math.round(adFrameBox.width)} does not fill card ${Math.round(adCardBox.width)}`,
  )

  // and the equipment overviews still work
  await page.locator('.videos--stacked .video-trigger').first().click()
  await page.waitForTimeout(600)
  const ovFrame = page.locator('.videos--stacked .video-card iframe').first()
  ok(
    (await ovFrame.getAttribute('src'))?.includes('player.vimeo.com/video/121265019'),
    `video: wrong overview src ${await ovFrame.getAttribute('src')}`,
  )
  const ovCardBox = await page.locator('.videos--stacked .video-card').first().boundingBox()
  const ovFrameBox = await ovFrame.boundingBox()
  ok(
    Math.abs(ovFrameBox.width - ovCardBox.width) < 4,
    `video: overview player width ${Math.round(ovFrameBox.width)} does not fill card ${Math.round(ovCardBox.width)}`,
  )
  // the caption under an overview survives playback
  ok(
    await page.locator('.videos--stacked .video-card').first().locator('.video-name').isVisible(),
    'video: overview caption disappeared when playing',
  )
  await page.close()
}

/* ---------- 4. mobile menu ---------- */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(base, { waitUntil: 'networkidle' })
  const menu = page.locator('#mobile-menu')
  ok(!(await menu.isVisible()), 'nav: menu visible before open')
  await page.locator('[data-menu-open]').click()
  ok(await menu.isVisible(), 'nav: menu did not open')
  ok(await page.locator('[data-menu-open]').getAttribute('aria-expanded') === 'true', 'nav: aria-expanded not set')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  ok(!(await menu.isVisible()), 'nav: Escape did not close menu')
  // link click closes
  await page.locator('[data-menu-open]').click()
  await page.locator('#mobile-menu a').first().click()
  await page.waitForTimeout(400)
  ok(!(await page.locator('#mobile-menu').isVisible()), 'nav: menu stayed open after link click')
  await page.close()
}

/* ---------- 5. contact form submits a real lead ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${base}/contact/`, { waitUntil: 'networkidle' })
  ok(!(await page.locator('[data-form-ready]').isVisible()), 'form: success panel visible too early')
  // honeypot stays off-screen rather than display:none, so bots still fill it
  const hp = await page.locator('#company').boundingBox()
  ok(hp !== null && hp.x < 0, 'form: honeypot should sit off-screen')
  ok(
    (await page.locator('#company').getAttribute('tabindex')) === '-1',
    'form: honeypot should be out of the tab order',
  )

  await page.fill('[name="firstName"]', 'Interaction')
  await page.fill('[name="lastName"]', 'Check')
  await page.fill('[name="phone"]', '832-555-0100')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="city"]', 'Webster')
  await page.fill('[name="comments"]', 'AC blowing warm since last night.')

  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/leads')),
    page.locator('.contact-submit').click(),
  ])
  ok(res.status() === 201, `form: expected 201 from API, got ${res.status()}`)
  await page.waitForTimeout(400)
  ok(await page.locator('[data-form-ready]').isVisible(), 'form: success panel did not appear')

  // required validation blocks an empty submit before any request goes out
  await page.goto(`${base}/contact/`, { waitUntil: 'networkidle' })
  let fired = false
  page.on('request', (r) => {
    if (r.url().includes('/api/leads')) fired = true
  })
  await page.locator('.contact-submit').click()
  await page.waitForTimeout(400)
  ok(!fired, 'form: empty submit should be blocked by validation')
  ok(!(await page.locator('[data-form-ready]').isVisible()), 'form: success panel shown on invalid submit')
  await page.close()
}

/* ---------- 6. FAQ accordion + glossary anchors ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${base}/support/`, { waitUntil: 'networkidle' })
  const first = page.locator('.sup-faq-item').first()
  ok(!(await first.locator('.sup-faq-answer').isVisible()), 'faq: answer open by default')
  await first.locator('summary').click()
  ok(await first.locator('.sup-faq-answer').isVisible(), 'faq: answer did not open')

  await page.goto(`${base}/glossary/`, { waitUntil: 'networkidle' })
  const letterLinks = await page.locator('.glossary-letter-link').count()
  ok(letterLinks > 5, `glossary: only ${letterLinks} letter links`)
  const terms = await page.locator('.glossary-term').count()
  ok(terms > 40, `glossary: only ${terms} terms rendered`)
  await page.close()
}

/* ---------- 7. hero film: poster first, Vimeo background after idle ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(base, { waitUntil: 'networkidle' })

  ok((await page.locator('.hero canvas').count()) === 0, 'hero: 3D canvas should be gone')

  const poster = await page.evaluate(async () => {
    const img = document.querySelector('.hero-poster')
    if (!img) return null
    await img.decode().catch(() => {})
    return { src: img.currentSrc.split('/').pop(), w: img.naturalWidth }
  })
  ok(poster !== null, 'hero: poster image missing')
  ok(poster?.w > 600, `hero: poster did not load (${poster?.w}px)`)

  await page.waitForTimeout(4000)
  // off the licensed domain the hero uses the local clip, so assert on that
  const film = await page.evaluate(() => {
    const holder = document.querySelector('.hero-film')
    const v = holder?.querySelector('video')
    const f = holder?.querySelector('iframe')
    return {
      kind: v ? 'video' : f ? 'iframe' : 'none',
      ready: holder?.classList.contains('is-ready') ?? false,
      src: (v?.currentSrc || f?.src) ?? '',
      paused: v ? v.paused : null,
      w: v?.videoWidth ?? 0,
    }
  })
  ok(film.kind === 'video', `hero: expected a local clip, got ${film.kind}`)
  ok(film.src.includes('hero-promo.mp4'), `hero: wrong hero clip ${film.src}`)
  ok(film.paused === false, 'hero: clip not playing')
  ok(film.w > 0, 'hero: clip has no frames')
  await page.close()
}

/* ---------- 8. emergency background clip: lazy, plays, pauses offscreen ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(base, { waitUntil: 'networkidle' })

  const early = await page.evaluate(() => document.querySelector('.emergency video')?.currentSrc || '')
  ok(early === '', `bg video: emergency clip loaded too early (${early})`)

  await page.locator('#emergency-title').scrollIntoViewIfNeeded()
  await page.waitForTimeout(2500)
  const em = await page.evaluate(() => {
    const v = document.querySelector('.emergency video')
    return { src: v?.currentSrc?.split('/').pop() ?? '', paused: v?.paused, w: v?.videoWidth ?? 0 }
  })
  ok(em.src === 'video-loop.mp4', `bg video: emergency src is "${em.src}"`)
  ok(em.paused === false, 'bg video: emergency clip not playing')
  ok(em.w > 0, 'bg video: emergency clip has no frames')

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1200)
  ok(
    await page.evaluate(() => document.querySelector('.emergency video')?.paused === true),
    'bg video: emergency clip kept playing while offscreen',
  )
  await page.close()
}

/* ---------- 9. reduced motion loads no video at all ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const heavy = []
  page.on('request', (r) => {
    if (r.url().endsWith('.mp4') || r.url().includes('player.vimeo.com')) heavy.push(r.url())
  })
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.locator('#emergency-title').scrollIntoViewIfNeeded()
  await page.waitForTimeout(2000)
  ok(heavy.length === 0, `reduced-motion: ${heavy.length} video request(s) fired`)
  ok(
    (await page.locator('.hero-film iframe').count()) === 0,
    'reduced-motion: hero film should not be injected',
  )
  ok(await page.locator('.hero-poster').isVisible(), 'reduced-motion: hero poster not shown')
  ok(
    await page.evaluate(() => !!document.querySelector('.emergency video')?.poster),
    'reduced-motion: emergency clip has no poster fallback',
  )
  await page.close()
}

/* ---------- 10. corners: no hard-edged panels left ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(base, { waitUntil: 'networkidle' })
  const square = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('.surface, .hero-stats, .care-season, .video-card, .gmap-frame, .prods-card, .svc-card')) {
      const r = parseFloat(getComputedStyle(el).borderTopLeftRadius)
      if (!(r > 0)) out.push(el.className.toString().slice(0, 40))
    }
    return out
  })
  ok(square.length === 0, `corners: ${square.length} square container(s): ${square.slice(0, 4).join(', ')}`)
  await page.close()
}

await browser.close()
console.log(fails.length ? `FAILURES (${fails.length}):\n` + fails.map((f) => '  ✗ ' + f).join('\n') : 'ALL INTERACTIONS PASS')
if (fails.length) process.exitCode = 1
