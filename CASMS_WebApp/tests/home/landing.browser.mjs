import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { URL } from 'node:url'

const enabled = Boolean(process.env.CASMS_PLAYWRIGHT_MODULE)
const base = process.env.CASMS_PREVIEW_URL || 'http://127.0.0.1:5177'
assert.equal(new URL(base).hostname, '127.0.0.1')
const cabin = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
async function sandbox() {
  const { chromium } = createRequire(import.meta.url)(process.env.CASMS_PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(), errors = [], writes = [], unlabelled = [], reads = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (!new URL(request.url()).pathname.startsWith('/api/')) return
    assert.equal(new URL(request.url()).origin, new URL(base).origin)
    if (request.method() !== 'GET') writes.push(request.url()); else reads.push(request.url())
  })
  page.on('response', response => { if (new URL(response.url()).pathname.startsWith('/api/') && response.headers()['x-ocv-development-fixture'] !== 'true') unlabelled.push(response.url()) })
  async function home(query = '__fixture=catalog-pages') {
    await page.goto(base + '/?' + query)
    await page.getByRole('note', { name: 'Development fixtures' }).waitFor()
  }
  async function finish() {
    try { assert.deepEqual(errors, []); assert.deepEqual(writes, []); assert.deepEqual(unlabelled, []) } finally { await browser.close() }
  }
  return { page, context, home, finish, reads }
}

test('V14 finder: both supported types affect real query/results; Back/Forward retains selection and guest enters Booking', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    for (const [type, name, id] of [
      ['ONE_DAY', 'DEV · Hành trình thứ hai', '22222222-3333-4444-5555-666666666666'],
      ['MULTI_DAYS', 'DEV · Hành trình trải nghiệm giao diện', '11111111-2222-3333-4444-555555555555'],
    ]) {
      await s.home()
      await p.getByLabel('Loại hành trình', { exact: true }).selectOption(type)
      await p.getByRole('button', { name: 'Tìm chuyến', exact: true }).click()
      await p.getByRole('link', { name, exact: true }).waitFor()
      assert.equal(new URL(p.url()).searchParams.get('cruiseType'), type)
      const request = new URL(s.reads.filter(url => new URL(url).pathname === '/api/cruise').at(-1))
      assert.equal(request.searchParams.get('cruiseType'), type)
      assert.equal(request.searchParams.get('status'), 'PUBLISHED')
      assert.equal(await p.getByRole('link', { name: 'Xem hành trình', exact: true }).count(), 1)
      await p.goBack()
      assert.equal(await p.getByLabel('Loại hành trình', { exact: true }).inputValue(), type)
      await p.goForward()
      await p.getByRole('link', { name: 'Xem hành trình', exact: true }).click()
      assert.equal(new URL(new URL(p.url()).searchParams.get('from'), base).searchParams.get('cruiseType'), type)
      await p.getByRole('link', { name: 'Chọn phòng & đặt chỗ', exact: true }).click()
      await p.locator(`#real-booking-cruise option[value="${id}"]`).waitFor({ state: 'attached' })
      assert.equal(await p.locator('#real-booking-cruise').inputValue(), id)
      await p.locator('#person-0-cabinId').selectOption(cabin)
      await p.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
      await p.locator('#person-0-email[aria-required="true"]').waitFor()
      assert.equal(new URL(p.url()).pathname, '/booking/travellers')
    }
    await s.home('__fixture=ready&cruiseType=INVALID')
    assert.equal(await p.getByLabel('Loại hành trình', { exact: true }).inputValue(), '')
    await p.getByRole('button', { name: 'Tìm chuyến', exact: true }).click()
    assert.equal(new URL(p.url()).searchParams.has('cruiseType'), false)
  } finally { await s.finish() }
})

test('V14 editorial: inspiration cannot masquerade as live inventory or unsupported destination filtering', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.home()
    assert.equal(await p.locator('#voyages a[href*="cruiseType"]').count(), 0)
    assert.equal(await p.locator('#destinations article').count(), 7)
    assert.equal(await p.locator('#voyages article').count(), 3)
    assert.match(await p.locator('#voyages').innerText(), /NỘI DUNG BIÊN TẬP/)
    assert.match(await p.locator('#destinations').innerText(), /chưa hỗ trợ lọc theo điểm đến/)
    assert.doesNotMatch(await p.locator('main').innerText(), /4\.800\.000|6\.200\.000|3\.900\.000|Ocean Voyager|20\/11\/2026/)
    assert.equal(s.reads.filter(url => new URL(url).pathname === '/api/cruise').length, 0, 'Editorial Home must not pretend to load inventory')
    await p.goto(base + '/cruises/ha-long-lan-ha')
    await p.getByRole('heading', { name: 'Không có hành trình đã công bố', exact: true }).waitFor()
    assert.equal(s.reads.some(url => url.includes('/cruise/ha-long-lan-ha')), false)
  } finally { await s.finish() }
})

test('V14 CTA matrix: every active Home link reaches its declared destination; management is guest lookup', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.home()
    assert.equal(await p.locator('header').getByRole('link', { name: 'Tra cứu bằng mã', exact: true }).getAttribute('href'), '/booking/lookup')
    assert.equal(await p.locator('footer button').count(), 0, 'Unavailable legal/help actions must not imitate working controls')
    const hrefs = await p.locator('a[href]').evaluateAll(links => links.filter(link => link.getAttribute('target') !== '_blank').map(link => link.getAttribute('href')))
    assert.ok(hrefs.length > 10)
    for (let index = 0; index < hrefs.length; index++) {
      await s.home()
      const link = p.locator('a[href]:not([target="_blank"])').nth(index), href = hrefs[index]
      assert.equal(await link.getAttribute('href'), href)
      const expected = new URL(href, p.url())
      if (expected.hash) assert.equal(await p.locator(expected.hash).count(), 1)
      if (href === '#main-content') { await p.keyboard.press('Tab'); await p.keyboard.press('Enter') }
      else await link.click()
      assert.equal(new URL(p.url()).pathname, expected.pathname)
      assert.equal(new URL(p.url()).hash, expected.hash)
      if (expected.pathname === '/cruises') await p.getByRole('link', { name: 'Xem hành trình', exact: true }).first().waitFor()
      if (expected.pathname === '/booking/lookup') await p.locator('#lookup-reference').waitFor()
      if (expected.pathname === '/login') await p.getByRole('heading', { name: 'Chào mừng trở lại', exact: true }).waitFor()
    }
  } finally { await s.finish() }
})

test('V14 entry states: loading, empty,401,403,502 and retry show truthful downstream results', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    let status = 200, empty = false, release
    await s.context.route('**/api/cruise?*', async route => {
      if (release) await release.promise
      if (status !== 200) return route.fulfill({ status, headers: { 'X-Ocv-Development-Fixture': 'true' }, json: { success: false, message: 'INTERNAL_ONLY_DO_NOT_SHOW' } })
      if (empty) return route.fulfill({ headers: { 'X-Ocv-Development-Fixture': 'true' }, json: { success: true, data: { content: [], number: 0, totalPages: 0, totalElements: 0 } } })
      return route.continue()
    })
    await s.home()
    let resolve
    release = { promise: new Promise(yes => { resolve = yes }) }
    await p.getByRole('button', { name: 'Tìm chuyến', exact: true }).click()
    await p.getByRole('status').filter({ hasText: 'Đang tải hành trình' }).waitFor()
    resolve(); release = null
    await p.getByRole('link', { name: 'Xem hành trình', exact: true }).first().waitFor()
    empty = true
    await s.home()
    await p.getByRole('button', { name: 'Tìm chuyến', exact: true }).click()
    await p.getByRole('heading', { name: 'Chưa có hành trình đã công bố', exact: true }).waitFor()
    empty = false
    for (status of [401, 403, 502]) {
      await s.home()
      await p.getByRole('button', { name: 'Tìm chuyến', exact: true }).click()
      await p.getByRole('alert').waitFor()
      assert.equal(await p.getByRole('link', { name: 'Xem hành trình', exact: true }).count(), 0)
      assert.doesNotMatch(await p.locator('main').innerText(), /INTERNAL_ONLY_DO_NOT_SHOW|DEV · Hành trình/)
      status = 200
      await p.getByRole('button', { name: 'Thử lại', exact: true }).click()
      await p.getByRole('link', { name: 'Xem hành trình', exact: true }).first().waitFor()
    }
  } finally { await s.finish() }
})

test('V14 desktop and keyboard: visible focus, meaningful headings/alt/labels, no overflow and rendered screenshots', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.home()
    assert.equal(await p.getByRole('heading', { level: 1 }).count(), 1)
    assert.match(await p.getByRole('heading', { level: 1 }).innerText(), /bến cảng/)
    assert.deepEqual(await p.locator('img').evaluateAll(images => images.filter(img => !img.hasAttribute('alt')).map(img => img.src)), [])
    await p.keyboard.press('Tab')
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.textContent), 'Chuyển đến nội dung chính')
    await p.keyboard.press('Enter')
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.id), 'main-content')
    for (let i = 0; i < 12; i++) {
      if (await p.getByLabel('Loại hành trình', { exact: true }).evaluate(el => el === globalThis.document.activeElement)) break
      await p.keyboard.press('Tab')
    }
    const outline = await p.getByLabel('Loại hành trình', { exact: true }).evaluate(el => ({ active: el === globalThis.document.activeElement, color: globalThis.getComputedStyle(el).outlineColor, width: globalThis.getComputedStyle(el).outlineWidth }))
    assert.equal(outline.active, true)
    assert.equal(outline.color, 'rgb(18, 48, 66)')
    assert.equal(outline.width, '3px')
    const measures = []
    if (process.env.CASMS_EVIDENCE_DIR) await mkdir(process.env.CASMS_EVIDENCE_DIR, { recursive: true })
    await p.evaluate(() => globalThis.document.fonts.ready)
    for (const width of [1024, 1280, 1440, 1920]) {
      await p.setViewportSize({ width, height: 1000 })
      measures.push(await p.evaluate(() => ({ width: globalThis.innerWidth, scrollWidth: globalThis.document.documentElement.scrollWidth })))
      assert.equal(measures.at(-1).scrollWidth <= width, true)
      if (process.env.CASMS_EVIDENCE_DIR) {
        await p.evaluate(() => globalThis.scrollTo(0, 0))
        await p.screenshot({ path: path.join(process.env.CASMS_EVIDENCE_DIR, 'home-' + width + '.png'), fullPage: true })
        await p.screenshot({ path: path.join(process.env.CASMS_EVIDENCE_DIR, 'top-' + width + '.png') })
      }
    }
    if (process.env.CASMS_EVIDENCE_DIR) await writeFile(path.join(process.env.CASMS_EVIDENCE_DIR, 'measurements.json'), JSON.stringify({ outline, measures }, null, 2))
  } finally { await s.finish() }
})
