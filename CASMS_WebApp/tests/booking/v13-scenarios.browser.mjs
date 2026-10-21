import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import process from 'node:process'
import test from 'node:test'
import { URL } from 'node:url'

const enabled = Boolean(process.env.CASMS_PLAYWRIGHT_MODULE)
const base = process.env.CASMS_PREVIEW_URL || 'http://127.0.0.1:5177'
assert.equal(new URL(base).hostname, '127.0.0.1')
const cruise = '11111111-2222-3333-4444-555555555555'
const other = '22222222-3333-4444-5555-666666666666'
const cabin = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const pack = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa'
const start = '/booking/cabin-experience?cruiseId=' + cruise
async function sandbox() {
  const { chromium } = createRequire(import.meta.url)(process.env.CASMS_PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(), errors = [], unlabelled = [], writes = [], reads = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) {
      assert.equal(new URL(request.url()).origin, new URL(base).origin)
      if (request.method() === 'GET') reads.push(request.url()); else writes.push(request)
    }
  })
  page.on('response', response => {
    if (new URL(response.url()).pathname.startsWith('/api/') && response.headers()['x-ocv-development-fixture'] !== 'true') unlabelled.push(response.url())
  })
  async function open(route, mode = 'ready') {
    await page.goto(base + route + (route.includes('?') ? '&' : '?') + '__fixture=' + mode)
    assert.match(await page.getByRole('note', { name: 'Development fixtures' }).innerText(), /UI PREVIEW — NO LIVE BACKEND/)
  }
  async function mode(value) {
    const response = await context.request.get(base + '/__fixtures/select?__fixture=' + value)
    assert.equal((await response.json()).scenario, value)
  }
  async function finish() {
    try { assert.deepEqual(errors, []); assert.deepEqual(unlabelled, []) } finally { await browser.close() }
  }
  return { page, context, open, mode, finish, writes, reads }
}
async function toReview(p) {
  await p.locator('#person-0-cabinId').selectOption(cabin)
  await p.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
  await p.locator('#person-0-fullName').fill('Khách QA V13')
  await p.locator('#person-0-email').fill('qa@example.test')
  await p.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
}

test('V13: paginated/filter discovery, detail return and cruise switch preserve contact but reset cabin/package', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.open('/cruises', 'catalog-pages')
    await p.getByRole('link', { name: 'Trang sau →', exact: true }).click()
    await p.getByText('Trang 2 / 2 · 2 hành trình', { exact: true }).waitFor()
    await p.getByRole('link', { name: 'Xem hành trình', exact: true }).click()
    await p.getByRole('heading', { name: 'Thông tin hành trình', exact: true }).waitFor()
    assert.ok(p.url().includes(other))
    await p.getByRole('link', { name: '← Về danh mục', exact: true }).click()
    assert.equal(new URL(p.url()).searchParams.get('page'), '2')
    await p.getByLabel('Loại hành trình', { exact: true }).selectOption('MULTI_DAYS')
    assert.equal(new URL(p.url()).searchParams.has('page'), false)
    await p.getByRole('link', { name: 'Xem hành trình', exact: true }).click()
    await p.getByRole('link', { name: 'Chọn phòng & đặt chỗ', exact: true }).click()
    await p.locator(`#real-booking-cruise option[value="${cruise}"]`).waitFor({ state: 'attached' })
    assert.equal(await p.locator('#real-booking-cruise').inputValue(), cruise)
    await p.locator('#person-0-tourPackageId').selectOption(pack)
    await toReview(p)
    await p.getByRole('link', { name: 'Sửa phòng & gói', exact: true }).click()
    await p.locator('#real-booking-cruise').selectOption(other)
    assert.equal(new URL(p.url()).searchParams.get('cruiseId'), other)
    assert.equal(await p.locator('#person-0-cabinId').inputValue(), '')
    assert.equal(await p.locator('#person-0-tourPackageId').inputValue(), '')
    await p.locator('#person-0-cabinId').selectOption(cabin)
    await p.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
    assert.equal(await p.locator('#person-0-fullName').inputValue(), 'Khách QA V13')
    assert.equal(await p.locator('#person-0-email').inputValue(), 'qa@example.test')
    assert.equal(s.writes.length, 0)
  } finally { await s.finish() }
})

test('V13: shared cabin capacity, duplicate documents and optional package removal retain review draft', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.open(start)
    await p.locator('#person-0-cabinId').selectOption(cabin)
    await p.locator('#person-0-tourPackageId').selectOption(pack)
    assert.match(await p.locator(`#person-0-tourPackageId option[value="${pack}"]`).innerText(), /20.*USD/)
    await p.getByRole('button', { name: 'Thêm hành khách', exact: true }).click()
    await p.locator('#person-1-cabinId').selectOption(cabin)
    await p.getByRole('button', { name: 'Thêm hành khách', exact: true }).click()
    assert.equal(await p.locator(`#person-2-cabinId option[value="${cabin}"]`).isDisabled(), true)
    await p.getByRole('button', { name: 'Bỏ hành khách 3', exact: true }).click()
    await p.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
    for (const index of [0, 1]) {
      await p.locator(`#person-${index}-fullName`).fill('Khách QA ' + index)
      await p.locator(`#person-${index}-documentType`).selectOption('Passport')
      await p.locator(`#person-${index}-documentNumber`).fill(index ? ' qa123 ' : 'QA123')
    }
    await p.locator('#person-0-email').fill('invalid')
    await p.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
    await p.locator('#person-1-documentNumber[aria-invalid="true"]').waitFor()
    assert.equal(await p.locator('#person-0-email').getAttribute('aria-invalid'), 'true')
    await p.locator('#person-0-email').fill('qa@example.test')
    await p.locator('#person-1-documentNumber').fill('QA456')
    await p.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
    await p.getByRole('link', { name: 'Sửa phòng & gói', exact: true }).click()
    await p.locator('#person-0-tourPackageId').selectOption('')
    await p.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
    assert.equal(await p.locator('#person-1-documentNumber').inputValue(), 'QA456')
    await p.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
    assert.match(await p.locator('main').innerText(), /Gói: Không chọn/)
    assert.equal(s.writes.length, 0)
  } finally { await s.finish() }
})

test('V13: explicit 409 reloads now sold-out cabins and blocks a second simulated submission', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.open(start, 'create-stale')
    await toReview(p)
    await p.getByRole('button', { name: 'Kiểm tra và gửi đặt chỗ', exact: true }).click()
    await p.getByRole('dialog').getByRole('button', { name: 'Gửi đặt chỗ', exact: true }).click()
    await p.locator('#person-0-cabinId').waitFor()
    await p.locator(`#person-0-cabinId option[value="${cabin}"]`).filter({ hasText: 'Còn 0 chỗ' }).waitFor({ state: 'attached' })
    await p.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
    await p.locator('#person-0-cabinId[aria-invalid="true"]').waitFor()
    assert.equal(s.writes.length, 1)
    assert.ok(s.reads.filter(url => url.includes('/booking/available-cabins')).length >= 2)
    assert.equal(await p.getByRole('heading', { name: 'Đã tiếp nhận đặt chỗ', exact: true }).count(), 0)
  } finally { await s.finish() }
})

test('V13: stale optional package is rejected after fresh reads and can be removed without losing the draft', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.open(start)
    await p.locator('#person-0-tourPackageId').selectOption(pack)
    await toReview(p)
    await p.getByRole('link', { name: 'Xem hành trình khác', exact: true }).click()
    await p.getByRole('link', { name: 'Xem hành trình', exact: true }).waitFor()
    await s.mode('packages-stale')
    await p.goBack()
    await p.getByRole('button', { name: 'Kiểm tra và gửi đặt chỗ', exact: true }).click()
    await p.locator('#person-0-tourPackageId[aria-invalid="true"]').waitFor()
    assert.equal(await p.locator('#person-0-tourPackageId').isDisabled(), false)
    await p.locator('#person-0-tourPackageId').selectOption('')
    await p.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
    assert.equal(await p.locator('#person-0-fullName').inputValue(), 'Khách QA V13')
    await p.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
    await p.getByRole('link', { name: 'Sửa phòng & gói', exact: true }).waitFor()
    assert.equal(s.writes.length, 0)
  } finally { await s.finish() }
})

test('V13: lookup 403/404/502/empty/offline never shows success or raw errors; retry preserves inputs', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.open('/booking/lookup')
    await p.locator('#lookup-reference').fill('DEV-BOOKING-ONLY')
    await p.locator('#lookup-email').fill('qa@example.test')
    const messages = []
    for (const scenario of ['lookup-mismatch', 'lookup-not-found', 'lookup-unavailable', 'lookup-empty']) {
      await s.mode(scenario)
      await p.getByRole('button', { name: 'Tra cứu', exact: true }).click()
      await p.getByRole('region', { name: 'Không tra cứu được', exact: true }).waitFor()
      messages.push(await p.getByRole('alert').innerText())
      assert.equal(await p.getByRole('region', { name: 'Kết quả tra cứu', exact: true }).count(), 0)
      assert.equal(await p.locator('#lookup-reference').inputValue(), 'DEV-BOOKING-ONLY')
      assert.equal(await p.locator('#lookup-email').inputValue(), 'qa@example.test')
    }
    assert.equal(messages[0], messages[1])
    assert.equal(messages.some(message => message.includes('DEV internal')), false)
    await s.context.route('**/api/booking/lookup?*', route => route.abort('connectionrefused'))
    await p.getByRole('button', { name: 'Tra cứu', exact: true }).click()
    await p.getByRole('alert').waitFor()
    assert.match(await p.getByRole('alert').innerText(), /Chưa thể tra cứu lúc này/)
    assert.equal(await p.getByRole('region', { name: 'Kết quả tra cứu', exact: true }).count(), 0)
    await s.context.unroute('**/api/booking/lookup?*')
    await s.mode('ready')
    await p.getByRole('button', { name: 'Tra cứu', exact: true }).click()
    await p.getByRole('heading', { name: 'Kết quả tra cứu · DEV-BOOKING-ONLY', exact: true }).waitFor()
    assert.equal(s.writes.length, 0)
    for (const width of [1280, 1440, 1920]) {
      await p.setViewportSize({ width, height: 1000 })
      assert.equal(await p.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true)
    }
  } finally { await s.finish() }
})
