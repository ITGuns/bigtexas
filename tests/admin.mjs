/** End-to-end: public lead submission through the admin pipeline. */
import { chromium } from '@playwright/test'

const base = 'http://localhost:4321'
const PW = process.env.ADMIN_PASSWORD ?? 'bigtexas'
const browser = await chromium.launch()
const fails = []
const ok = (c, m) => (c ? null : fails.push(m))
const stamp = String(Date.now()).slice(-6)
const testName = `QA${stamp}`

/* ---------- 1. public form creates a lead + booking ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (e) => fails.push('contact PAGEERROR: ' + e.message))
  await page.goto(`${base}/contact/`, { waitUntil: 'networkidle' })

  await page.fill('[name="firstName"]', testName)
  await page.fill('[name="lastName"]', 'Tester')
  await page.fill('[name="phone"]', '832-555-0142')
  await page.fill('[name="email"]', 'qa@example.com')
  await page.fill('[name="city"]', 'Webster')
  await page.selectOption('[name="service"]', { label: 'AC Repair' })
  await page.selectOption('[name="urgency"]', 'emergency')
  const soon = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10)
  await page.fill('[name="preferredDate"]', soon)
  await page.selectOption('[name="preferredSlot"]', { label: 'Morning (7am to 12pm)' })
  await page.fill('[name="comments"]', 'Upstairs unit blowing warm air since last night.')

  // wait on the API rather than a fixed delay: a remote database is slower
  // than the local file the suite used to run against
  const [submitRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/leads'), { timeout: 30000 }),
    page.locator('.contact-submit').click(),
  ])
  ok(submitRes.status() === 201, `contact: API returned ${submitRes.status()}`)
  await page.locator('[data-form-ready]').waitFor({ state: 'visible', timeout: 15000 })
  ok(await page.locator('[data-form-ready]').isVisible(), 'contact: success panel did not appear')
  await page.close()
}

/* ---------- 2. honeypot silently drops bots ---------- */
{
  const res = await fetch(`${base}/api/leads/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ firstName: 'BotSpam', phone: '5555555555', company: 'spam co' }),
  })
  const j = await res.json()
  ok(res.status === 200 && j.id === null, 'honeypot: bot submission was not dropped')
}

/* ---------- 3. validation rejects incomplete leads ---------- */
{
  const res = await fetch(`${base}/api/leads/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ firstName: 'NoContact' }),
  })
  ok(res.status === 422, `validation: expected 422, got ${res.status}`)
}

/* ---------- 4. admin requires auth ---------- */
{
  const page = await browser.newPage()
  await page.goto(`${base}/admin/`, { waitUntil: 'networkidle' })
  ok(page.url().includes('/admin/login'), `auth: /admin did not redirect to login (${page.url()})`)

  // refused either by the auth check (401) or Astro's CSRF origin check (403)
  const api = await fetch(`${base}/api/admin/update/`, { method: 'POST', body: new URLSearchParams({ action: 'lead-status' }) })
  ok([401, 403].includes(api.status), `auth: admin API allowed unauthenticated write (${api.status})`)

  // same-origin but unauthenticated must still be refused
  const sameOrigin = await page.evaluate(async () => {
    const r = await fetch('/api/admin/update/', {
      method: 'POST',
      body: new URLSearchParams({ action: 'lead-status', id: '1', status: 'won' }),
    })
    return r.status
  })
  ok([401, 403].includes(sameOrigin), `auth: same-origin unauthenticated write allowed (${sameOrigin})`)
  await page.close()
}

/* ---------- 5. wrong password is refused ---------- */
{
  const page = await browser.newPage()
  await page.goto(`${base}/admin/login/`, { waitUntil: 'networkidle' })
  await page.fill('[name="password"]', 'definitely-wrong')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(500)
  ok(await page.locator('.login-error').isVisible(), 'auth: wrong password showed no error')
  await page.close()
}

/* ---------- 6. sign in, verify pipeline, advance the lead, book it ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (e) => fails.push('admin PAGEERROR: ' + e.message))
  await page.goto(`${base}/admin/login/`, { waitUntil: 'networkidle' })
  await page.fill('[name="password"]', PW)
  await page.click('button[type="submit"]')
  await page.waitForLoadState('networkidle')
  ok(page.url().endsWith('/admin/'), `auth: login did not land on dashboard (${page.url()})`)

  const body = await page.locator('body').innerText()
  ok(body.includes(testName), 'dashboard: new lead not visible')
  ok(/Open leads/i.test(body), 'dashboard: stat tiles missing')

  // the booking from the public form should exist
  await page.goto(`${base}/admin/bookings/`, { waitUntil: 'networkidle' })
  ok((await page.locator('body').innerText()).includes(testName), 'bookings: public booking not listed')

  // find the lead and open it
  await page.goto(`${base}/admin/leads/?q=${testName}`, { waitUntil: 'networkidle' })
  const rows = await page.locator('.admin-table tbody tr').count()
  ok(rows === 1, `leads: search returned ${rows} rows, expected 1`)
  ok((await page.locator('.pill--urgent').count()) > 0, 'leads: emergency flag not shown')

  await page.locator('.admin-table a').first().click()
  await page.waitForLoadState('networkidle')
  const detail = await page.locator('body').innerText()
  ok(detail.includes('blowing warm air'), 'lead detail: message missing')
  ok(detail.includes('832-555-0142'), 'lead detail: phone missing')

  // advance status
  await page.selectOption('#status', 'qualified')
  await page.locator('button:has-text("Update status")').click()
  await page.waitForLoadState('networkidle')
  ok(
    (await page.locator('.admin-head .pill').first().innerText()).trim().toLowerCase() === 'qualified',
    'lead detail: status did not update',
  )

  // save a note
  await page.fill('#notes', 'Called back, scheduling for Thursday.')
  await page.locator('button:has-text("Save notes")').click()
  await page.waitForLoadState('networkidle')
  ok((await page.locator('#notes').inputValue()).includes('Thursday'), 'lead detail: note not saved')

  // book a job from the lead
  await page.selectOption('#bservice', { label: 'AC Installation' })
  await page.fill('#bdate', new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10))
  await page.locator('button:has-text("Book this job")').click()
  await page.waitForLoadState('networkidle')
  const after = await page.locator('body').innerText()
  ok(after.includes('AC Installation'), 'booking: new booking not shown on lead')
  ok(
    (await page.locator('.admin-head .pill').first().innerText()).trim().toLowerCase() === 'booked',
    'booking: lead was not moved to Booked',
  )

  // CSV export
  const csv = await page.request.get(`${base}/admin/leads/?export=csv`)
  const text = await csv.text()
  ok(csv.headers()['content-type']?.includes('text/csv'), 'export: wrong content type')
  ok(text.includes(testName), 'export: lead missing from CSV')

  // sign out
  await page.goto(`${base}/admin/logout/`, { waitUntil: 'networkidle' })
  await page.goto(`${base}/admin/`, { waitUntil: 'networkidle' })
  ok(page.url().includes('/admin/login'), 'auth: still authenticated after logout')
  await page.close()
}

await browser.close()
console.log(fails.length ? `FAILURES (${fails.length}):\n` + fails.map((f) => '  ✗ ' + f).join('\n') : 'ADMIN E2E PASSES')
