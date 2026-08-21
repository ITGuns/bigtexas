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

/** How many conversations exist, read through a signed-in admin session. */
const counter = await browser.newContext()
async function adminCount() {
  await counter.request.post(`${base}/admin/login/`, {
    form: { password: PW },
    headers: { origin: base },
  })
  const page = await counter.newPage()
  await page.goto(`${base}/admin/chats/`, { waitUntil: 'networkidle' })
  const n = await page.locator('table tbody tr').count()
  await page.close()
  return n
}

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

/*
 * A customer who writes back after being told the conversation is finished
 * must reach a person. Letting the assistant pick up would talk over someone
 * nobody is watching, and the office would never know they wrote.
 */
await visitor.goto(`${base}/contact/`, { waitUntil: 'networkidle' })
await visitor.locator('[data-asst-open]').click()
await visitor.waitForTimeout(1500)
const reopened = await ask('actually, one more thing')
ok(
  /reopened this for the office/i.test(reopened),
  `chat: a message after closing was not put back in front of a person -> ${reopened.slice(0, 90)}`,
)
await admin.reload({ waitUntil: 'networkidle' })
ok(/waiting for you/i.test(await admin.locator('.admin-sub').innerText()), 'chat: the reopened conversation is not flagged for the office')

/*
 * The browser says which lead it just created. Taken on trust, any id would
 * do, and a stranger could pin their conversation to a real customer's record.
 */
const token = await visitor.evaluate(() => sessionStorage.getItem('btc-chat-token'))
const victim = await adminCtx.request.post(`${base}/api/leads/`, {
  headers: { origin: base, 'content-type': 'application/json' },
  data: { firstName: 'Real', lastName: 'Customer', phone: '713-555-2222' },
})
const victimId = (await victim.json()).id
await adminCtx.request.post(`${base}/api/chat/`, {
  headers: { 'content-type': 'application/json' },
  data: { action: 'profile', token, name: 'Impostor', phone: '000-000-0000', leadId: victimId },
})
await admin.reload({ waitUntil: 'networkidle' })
ok(
  (await admin.locator('a:has-text("Open lead")').count()) === 0,
  'chat: a conversation was linked to a lead whose phone number it does not know',
)

/* ---------------- one visitor, one conversation ---------------- */
/*
 * Asking a question and pressing "Talk to a person" before the first round
 * trip lands used to open two conversations, handing the office an empty one
 * while the question sat in the other. Both calls have to be started in the
 * same tick or the race never opens on a fast local server.
 */
const before = await adminCount()
const racer = await (await browser.newContext()).newPage()
await racer.goto(`${base}/`, { waitUntil: 'networkidle' })
await racer.locator('[data-asst-open]').click()
await racer.waitForTimeout(400)
await racer.evaluate(() => {
  const input = document.querySelector('[data-asst-input]')
  input.value = 'do you have any offers'
  document.querySelector('[data-asst-form]').requestSubmit()
  document.querySelector('[data-asst-handoff]').click()
})
await racer.waitForTimeout(2500)
const after = await adminCount()
ok(
  after - before === 1,
  `chat: a single visitor opened ${after - before} conversations at once`,
)
await racer.close()

/* ---------------- behaviour under a slow network ---------------- */
/*
 * The first request of a session pays for a cold function and a database round
 * trip, several seconds in the worst case. The panel has to show that it is
 * working, and the handoff button must not flip back and invite a second press
 * while its request is still in the air.
 */
const slow = await (await browser.newContext()).newPage()
await slow.route('**/api/chat/**', async (route) => {
  await new Promise((r) => setTimeout(r, 1200))
  await route.continue()
})
await slow.goto(`${base}/`, { waitUntil: 'networkidle' })
await slow.locator('[data-asst-open]').click()
await slow.waitForTimeout(400)
const slowInput = slow.locator('[data-asst-input]')
await slowInput.fill('what are your hours')
await slowInput.press('Enter')
await slow.waitForTimeout(500)
ok((await slow.locator('.asst-thinking').count()) === 1, 'chat: nothing tells the visitor the answer is on its way')
await slow.waitForTimeout(4000)
ok((await slow.locator('.asst-thinking').count()) === 0, 'chat: the waiting indicator was left on screen')
ok(/regular hours/i.test(await slow.locator('[data-asst-log]').innerText()), 'chat: slow answer never arrived')

await slowInput.fill('another question')
await slowInput.press('Enter')
await slow.waitForTimeout(200)
await slow.locator('[data-asst-handoff]').click()
await slow.waitForTimeout(400)
ok(
  /notifying/i.test(await slow.locator('[data-asst-handoff]').innerText()),
  'chat: the handoff button did not show that it was working',
)
await slow.waitForTimeout(5000)
ok(
  /office notified/i.test(await slow.locator('[data-asst-handoff]').innerText()),
  'chat: the handoff button did not settle once the office was told',
)
ok(/passed this to the office/i.test(await slow.locator('[data-asst-log]').innerText()), 'chat: slow handoff was lost')
await slow.close()

/* ---------------- lead validation ---------------- */
// Runs before the flood below, which uses up the rest of the allowance.
const badEmail = await adminCtx.request.post(`${base}/api/leads/`, {
  headers: { origin: base, 'content-type': 'application/json' },
  data: { firstName: 'Typo', email: 'definitely not an email' },
})
ok(badEmail.status() === 422, `chat: a malformed email was accepted (${badEmail.status()})`)

const goodEmail = await adminCtx.request.post(`${base}/api/leads/`, {
  headers: { origin: base, 'content-type': 'application/json' },
  data: { firstName: 'Fine', email: 'real.person@example.com' },
})
ok(goodEmail.status() === 201, `chat: a valid email was refused (${goodEmail.status()})`)

/* ---------------- rate limit ---------------- */
/*
 * Buckets are keyed by the connection, not by a header, so this shares the
 * allowance with every other suite and with the previous run. Restart the dev
 * server if a back to back run trips it early; the window is held in memory.
 */
const flood = []
for (let i = 0; i < 16; i++) {
  const res = await adminCtx.request.post(`${base}/api/leads/`, {
    headers: { origin: base, 'content-type': 'application/json' },
    data: { firstName: `Flood${i}`, phone: '713-555-0000' },
  })
  flood.push(res.status())
}
ok(flood.includes(429), `chat: the lead endpoint never rate limited a flood (${flood.join(',')})`)

/*
 * x-forwarded-for is a request header, so a bot can send whatever it likes.
 * Unless something in front is known to overwrite it, a rotating header must
 * not buy a fresh allowance, or the limit above is decoration.
 */
const spoofed = []
for (let i = 0; i < 4; i++) {
  const res = await adminCtx.request.post(`${base}/api/leads/`, {
    headers: {
      origin: base,
      'content-type': 'application/json',
      'x-forwarded-for': `198.51.100.${i}`,
    },
    data: { firstName: `Spoof${i}`, phone: '713-555-0000' },
  })
  spoofed.push(res.status())
}
ok(
  spoofed.every((s) => s === 429),
  `chat: rotating x-forwarded-for bought a fresh rate limit allowance (${spoofed.join(',')})`,
)


/* ---------------- security headers ---------------- */
const page = await adminCtx.request.get(`${base}/`)
const headers = page.headers()
for (const h of ['x-frame-options', 'x-content-type-options', 'referrer-policy', 'content-security-policy']) {
  ok(headers[h], `chat: ${h} header missing`)
}

await browser.close()
console.log(fails.length ? `FAILURES (${fails.length}):\n` + fails.map((f) => '  ✗ ' + f).join('\n') : 'LIVE CHAT PASSES')
if (fails.length) process.exitCode = 1
