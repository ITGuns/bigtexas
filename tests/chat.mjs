/**
 * Live chat, end to end, with two browsers: a visitor on the public site and a
 * coordinator in the control panel, talking to each other.
 *
 * Start `npm run dev` in another terminal first.
 */
import { chromium } from '@playwright/test'

const base = process.env.BASE_URL ?? 'http://localhost:4321'
const PW = process.env.ADMIN_PASSWORD
const fails = []
const ok = (cond, msg) => (cond ? null : fails.push(msg))

if (!PW) {
  console.log('FAILURES (1):\n  ✗ chat: ADMIN_PASSWORD must be set to run this suite')
  process.exitCode = 1
  process.exit()
}

const browser = await chromium.launch()

/* ---------------- visitor ---------------- */
const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
visitor.on('pageerror', (e) => fails.push('chat visitor PAGEERROR: ' + e.message))

await visitor.goto(`${base}/services/ac-repair/`, { waitUntil: 'networkidle' })
await visitor.locator('[data-asst-open]').click()
await visitor.waitForTimeout(600)

const log = visitor.locator('[data-asst-log]')
const field = visitor.locator('[data-asst-input]')

async function ask(text) {
  const before = (await log.innerText()).length
  await field.fill(text)
  await field.press('Enter')
  await visitor
    .waitForFunction(
      (n) => document.querySelector('[data-asst-log]').innerText.length > n,
      before,
      { timeout: 9000 },
    )
    .catch(() => {})
  await visitor.waitForTimeout(400)
  return (await log.innerText()).slice(before)
}

ok(/bay area|clear lake|houston metro/i.test(await ask('do you serve league city')), 'chat: assistant did not answer a normal question')
ok(
  ((await log.innerText()).match(/this is the Big Texas Comfort assistant/g) ?? []).length === 1,
  'chat: the greeting was shown more than once',
)

// a payload typed by a visitor must never become live markup for the office
await ask('<img src=x onerror=alert(1)> my ac is broken')

await visitor.locator('[data-asst-handoff]').click()
await visitor.waitForTimeout(1200)
ok(/passed this to the office/i.test(await log.innerText()), 'chat: handoff was not confirmed to the visitor')
ok(await visitor.locator('[data-asst-handoff]').isDisabled(), 'chat: handoff button stayed enabled')

// with a person on the way, the bot must stop answering
const afterHandoff = await ask('is anyone there')
ok(
  !/service call is|we cover cooling|I am not sure about that one/i.test(afterHandoff),
  'chat: the assistant kept answering after the conversation was handed over',
)

/* ---------------- coordinator ---------------- */
const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 950 } })
const admin = await adminCtx.newPage()
admin.on('pageerror', (e) => fails.push('chat admin PAGEERROR: ' + e.message))

for (const path of ['/admin/chats/', '/admin/chats/1/']) {
  const res = await adminCtx.request.get(base + path, { maxRedirects: 0 })
  ok(res.status() === 302, `chat: ${path} did not redirect when signed out`)
}
const anon = await adminCtx.request.post(`${base}/api/admin/chat/`, {
  form: { action: 'reply', id: '1', body: 'unauthorised' },
  headers: { origin: base },
})
ok(anon.status() === 401, `chat: admin reply API accepted an anonymous caller (${anon.status()})`)

await admin.goto(`${base}/admin/login/`, { waitUntil: 'networkidle' })
await admin.fill('input[type=password]', PW)
await admin.click('button[type=submit]')
await admin.waitForURL((u) => u.pathname === '/admin/')
await admin.waitForLoadState('networkidle')
ok((await admin.locator('.admin-nav-badge').count()) > 0, 'chat: no unread badge in the admin nav')

await admin.goto(`${base}/admin/chats/`, { waitUntil: 'networkidle' })
ok((await admin.locator('table tbody tr').count()) > 0, 'chat: conversation missing from the list')
await admin.locator('table tbody tr a').first().click()
await admin.waitForLoadState('networkidle')

const threadHtml = await admin.locator('[data-chat-log]').innerHTML()
ok(!threadHtml.includes('<img src=x onerror'), 'chat: visitor markup was not escaped in the admin thread')
ok(/my ac is broken/.test(await admin.locator('[data-chat-log]').innerText()), 'chat: visitor message missing from the thread')

const reply = 'Marcus here. I can get a tech out tomorrow at 8am, does that suit?'
await admin.locator('[data-chat-input]').fill(reply)
await admin.locator('[data-chat-input]').press('Enter')
await admin.waitForTimeout(1000)

await visitor
  .waitForFunction(() => /Marcus here/.test(document.querySelector('[data-asst-log]').innerText), null, { timeout: 15000 })
  .catch(() => {})
ok(/Marcus here/.test(await log.innerText()), 'chat: the visitor never received the reply')
ok(/talking to someone/i.test(await visitor.locator('[data-asst-status]').innerText()), 'chat: visitor banner did not switch to live')

await ask('Yes 8am works, thank you')
ok(
  ((await log.innerText()).match(/Yes 8am works, thank you/g) ?? []).length === 1,
  'chat: the visitor saw their own message twice while a coordinator was live',
)
await admin
  .waitForFunction(() => /8am works/.test(document.querySelector('[data-chat-log]').innerText), null, { timeout: 15000 })
  .catch(() => {})
ok(/8am works/.test(await admin.locator('[data-chat-log]').innerText()), 'chat: the coordinator never received the visitor reply')

// walking to another page must not lose the conversation
await visitor.goto(`${base}/contact/`, { waitUntil: 'networkidle' })
await visitor.locator('[data-asst-open]').click()
await visitor.waitForTimeout(1600)
ok(/Marcus here/.test(await log.innerText()), 'chat: thread was lost when the visitor changed page')

await admin.selectOption('#cstatus', 'closed')
await admin.locator('form:has(input[value="status"]) button[type=submit]').click()
await admin.waitForLoadState('networkidle')
ok(/closed/i.test(await admin.locator('.admin-sub').innerText()), 'chat: closing the conversation did not stick')
ok(await admin.locator('[data-chat-input]').isDisabled(), 'chat: reply box stayed enabled on a closed conversation')

/* ---------------- rate limit ---------------- */
// A made-up forwarded-for gives this test its own bucket, so hammering the
// endpoint here cannot use up the allowance the other suites need.
const floodIp = `203.0.113.${Math.floor(Date.now() / 1000) % 250}`
const flood = []
for (let i = 0; i < 16; i++) {
  const res = await adminCtx.request.post(`${base}/api/leads/`, {
    headers: { origin: base, 'content-type': 'application/json', 'x-forwarded-for': floodIp },
    data: { firstName: `Flood${i}`, phone: '713-555-0000' },
  })
  flood.push(res.status())
}
ok(flood.includes(201), 'chat: the lead endpoint refused a legitimate first submission')
ok(flood.includes(429), `chat: the lead endpoint never rate limited a flood (${flood.join(',')})`)
ok(flood.indexOf(429) >= 12, `chat: rate limit tripped too early, at request ${flood.indexOf(429) + 1}`)

/* ---------------- security headers ---------------- */
const page = await adminCtx.request.get(`${base}/`)
const headers = page.headers()
for (const h of ['x-frame-options', 'x-content-type-options', 'referrer-policy', 'content-security-policy']) {
  ok(headers[h], `chat: ${h} header missing`)
}

await browser.close()
console.log(fails.length ? `FAILURES (${fails.length}):\n` + fails.map((f) => '  ✗ ' + f).join('\n') : 'LIVE CHAT PASSES')
if (fails.length) process.exitCode = 1
