import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import process from 'node:process'
import { URL } from 'node:url'

// UI regression tests against the explicit labelled development fixture server.
// Start it separately; no real Backend, credentials or Booking writes are used.
const enabled = Boolean(process.env.CASMS_PLAYWRIGHT_MODULE)
const base = process.env.CASMS_PREVIEW_URL || 'http://127.0.0.1:5177'
assert.equal(new URL(base).hostname, '127.0.0.1', 'Fixture tests must stay on loopback')
const cruiseId = '11111111-2222-3333-4444-555555555555'
const cabinId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const packageId = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa'
async function sandbox() {
  const { chromium } = createRequire(import.meta.url)(process.env.CASMS_PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(), errors = [], unlabelled = [], mutations = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (new URL(response.url()).pathname.startsWith('/api/') && response.headers()['x-ocv-development-fixture'] !== 'true') unlabelled.push(response.url()) })
  page.on('request', request => { if (request.method() !== 'GET' && new URL(request.url()).pathname.startsWith('/api/')) mutations.push(request.url()) })
  async function open(route, scenario = 'ready') {
    await page.goto(base + route + (route.includes('?') ? '&' : '?') + '__fixture=' + scenario)
    await page.getByRole('note', { name: 'Development fixtures' }).waitFor()
  }
  async function finish() { assert.deepEqual(errors, []); assert.deepEqual(unlabelled, []); await browser.close() }
  return { page, browser, open, finish, mutations }
}
async function desktop(page, name) {
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true, name + ' overflow at ' + width)
    // Every aria-describedby target must exist, including inline hints/errors.
    assert.deepEqual(await page.locator('[aria-describedby]').evaluateAll(elements => elements.flatMap(el => el.getAttribute('aria-describedby').split(/\s+/).filter(id => !globalThis.document.getElementById(id)))), [], name + ' missing hint')
    if (process.env.CASMS_EVIDENCE_DIR) {
      await mkdir(process.env.CASMS_EVIDENCE_DIR, { recursive: true })
      await page.screenshot({ path: path.join(process.env.CASMS_EVIDENCE_DIR, name + '-' + width + '.png'), fullPage: true })
    }
  }
}
async function review(page) {
  await page.getByLabel('Phòng cho hành khách 1 *', { exact: true }).selectOption(cabinId)
  await page.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
  await page.getByLabel('Họ tên *', { exact: true }).fill('Khách QA development')
  await page.getByLabel('Email', { exact: true }).fill('qa@example.test')
  await page.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
}

test('V11 fixture UI: discovery, details, draft-preserving edit paths, result and guest lookup at desktop widths', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.open('/cruises?cruiseType=MULTI_DAYS')
    await p.getByRole('link', { name: 'Xem hành trình', exact: true }).waitFor()
    await desktop(p, 'discovery')
    await p.getByRole('link', { name: 'Xem hành trình', exact: true }).click()
    await p.getByRole('heading', { name: 'Thông tin hành trình', exact: true }).waitFor()
    await desktop(p, 'detail')
    await p.getByRole('link', { name: 'Lịch trình & tàu', exact: true }).click()
    assert.equal(new URL(p.url()).hash, '#cruise-extras')
    await p.getByRole('link', { name: 'Chọn phòng & đặt chỗ', exact: true }).click()
    const cabin = p.getByLabel('Phòng cho hành khách 1 *', { exact: true })
    await cabin.selectOption(cabinId)
    assert.equal(await cabin.locator(`option[value="${packageId}"]`).isDisabled(), true)
    await p.getByLabel('Gói cho hành khách 1 (tùy chọn)', { exact: true }).selectOption(packageId)
    await desktop(p, 'cabin')
    await p.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
    await p.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.id), 'person-0-fullName')
    await p.getByRole('button', { name: 'Họ tên cần từ 2 đến 100 ký tự.', exact: true }).click()
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.id), 'person-0-fullName')
    await p.getByLabel('Họ tên *', { exact: true }).fill('Khách QA development')
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.id), 'person-0-fullName', 'Editing errors must not steal focus')
    await p.getByLabel('Email', { exact: true }).fill('qa@example.test')
    assert.equal(await p.locator('[aria-invalid="true"]').count(), 0, 'Edited fields must not retain stale errors')
    assert.equal(await p.getByLabel('Email', { exact: true }).getAttribute('autocomplete'), 'section-traveller0 email')
    await desktop(p, 'passengers')
    await p.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
    await desktop(p, 'review')
    await p.getByRole('link', { name: 'Sửa thông tin hành khách', exact: true }).click()
    assert.equal(await p.getByLabel('Họ tên *', { exact: true }).inputValue(), 'Khách QA development')
    await p.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
    await p.getByRole('link', { name: 'Sửa phòng & gói', exact: true }).click()
    assert.equal(await cabin.inputValue(), cabinId)
    assert.equal(await p.getByLabel('Gói cho hành khách 1 (tùy chọn)', { exact: true }).inputValue(), packageId)
    await p.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
    await p.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
    assert.equal(s.mutations.length, 0, 'Navigation and preflight do not write')
    await p.getByRole('button', { name: 'Kiểm tra và gửi đặt chỗ', exact: true }).click()
    await p.getByRole('dialog').getByRole('button', { name: 'Gửi đặt chỗ', exact: true }).click()
    await p.getByRole('heading', { name: 'Đã tiếp nhận đặt chỗ', exact: true }).waitFor()
    assert.equal(s.mutations.length, 1, 'One simulated fixture submission')
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.textContent), 'Đã tiếp nhận đặt chỗ')
    await desktop(p, 'result')
    await p.getByRole('link', { name: 'Tra cứu đặt chỗ', exact: true }).click()
    assert.equal(await p.getByLabel('Mã đặt chỗ', { exact: true }).inputValue(), 'DEV-BOOKING-ONLY')
    await p.getByRole('button', { name: 'Tra cứu', exact: true }).click()
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.id), 'lookup-email')
    await p.getByLabel('Số điện thoại đại diện', { exact: true }).fill('+84900000000')
    await p.getByRole('button', { name: 'Tra cứu', exact: true }).click()
    await p.getByRole('heading', { name: 'Kết quả tra cứu · DEV-BOOKING-ONLY', exact: true }).waitFor()
    await desktop(p, 'lookup-result')
  } finally { await s.finish() }
})

test('V11 fixture states: loading, error, empty, no cabins/packages and disabled package', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.open('/cruises', 'loading')
    await p.getByRole('status').filter({ hasText: 'Đang tải hành trình' }).waitFor()
    await p.getByRole('link', { name: 'Xem hành trình', exact: true }).waitFor()
    await s.open('/cruises', 'error')
    await p.getByRole('heading', { name: 'Không tải được danh mục chuyến đi', exact: true }).waitFor()
    assert.equal(await p.getByRole('link', { name: 'Xem hành trình', exact: true }).count(), 0)
    await desktop(p, 'catalog-error')
    await s.open('/cruises?cruiseType=MULTI_DAYS', 'empty')
    await p.getByRole('heading', { name: 'Chưa có hành trình đã công bố', exact: true }).waitFor()
    await p.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
    assert.equal(new URL(p.url()).searchParams.has('cruiseType'), false)
    await desktop(p, 'catalog-empty')
    await s.open('/booking/cabin-experience?cruiseId=' + cruiseId, 'cabins-empty')
    await p.getByText('Chưa có phòng trống cho chuyến này', { exact: true }).waitFor()
    await s.open('/booking/cabin-experience?cruiseId=' + cruiseId, 'packages-empty')
    await p.getByText('Chưa có gói dịch vụ đang hoạt động. Bạn có thể tiếp tục mà không chọn gói.', { exact: true }).waitFor()
    await s.open('/booking/cabin-experience?cruiseId=' + cruiseId, 'package-error')
    await p.getByText('Chưa tải được gói dịch vụ', { exact: true }).waitFor()
    assert.equal(await p.getByLabel('Gói cho hành khách 1 (tùy chọn)', { exact: true }).isDisabled(), true)
    assert.equal(s.mutations.length, 0)
  } finally { await s.finish() }
})

test('V11 fixture validation links focus fields and uncertain outcomes keep submission locked', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.open('/booking/lookup')
    await p.getByRole('button', { name: 'Tra cứu', exact: true }).click()
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.id), 'lookup-reference')
    await desktop(p, 'lookup-validation')
    await s.open('/booking/cabin-experience?cruiseId=' + cruiseId, 'create-unknown')
    await review(p)
    await p.getByRole('button', { name: 'Kiểm tra và gửi đặt chỗ', exact: true }).click()
    await p.getByRole('dialog').getByRole('button', { name: 'Gửi đặt chỗ', exact: true }).click()
    await p.getByText('Kiểm tra kết quả trước khi gửi lại', { exact: true }).waitFor()
    assert.equal(await p.getByRole('dialog').getByRole('button', { name: 'Gửi đặt chỗ', exact: true }).isDisabled(), true)
    assert.equal(s.mutations.length, 1)
    await p.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click()
    await desktop(p, 'uncertain')
  } finally { await s.finish() }
})
