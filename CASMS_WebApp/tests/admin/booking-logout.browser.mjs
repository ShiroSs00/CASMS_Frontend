import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { URL } from 'node:url'

// Reuse an installed browser runtime; no project dependency or live writes needed.
// CASMS_PLAYWRIGHT_MODULE: absolute path to the existing playwright package.
const enabled = Boolean(process.env.CASMS_PLAYWRIGHT_MODULE)
const base = process.env.CASMS_TEST_URL || 'http://127.0.0.1:5176'
const cr = '11111111-2222-3333-4444-555555555555'
const cabin = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const packageId = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa'
const cruise = { cruiseId: cr, cruiseCode: 'QA-LOCAL', cruiseName: 'Local QA Voyage', status: 'PUBLISHED', shipId: '99999999-8888-7777-6666-555555555555', departureDatetime: '2099-11-01T00:00:00Z', returnDatetime: '2099-11-03T00:00:00Z' }
const saved = { bookingId: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff', bookingReference: 'BK-LOCAL-QA', bookingStatus: 'Draft', cruiseId: cr, cruiseName: cruise.cruiseName, departureDatetime: cruise.departureDatetime, returnDatetime: cruise.returnDatetime, agreedFareAmount: 125, requiredDepositAmount: 37.5, currency: 'USD', paymentPlan: 'DEPOSIT', contractStatus: 'Draft', installments: [], passengers: [{ bookingPassengerId: 'bp', passengerId: 'p', fullName: 'Local QA Traveller', participationStatus: 'Active', cabinId: cabin, cabinNumber: '101' }] }
async function sandbox() {
  const { chromium } = createRequire(import.meta.url)(process.env.CASMS_PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(), errors = [], unexpected = [], writes = []
  const state = { createStatus: 201, unknown: false, cabinReads: 0, logoutCalls: 0, catalogTypes: [], catalogStatus: 200, catalogEmpty: false, catalogOffline: false, remainingCapacity: 2, packageStatus: 200, createGate: null }
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    // Every API request is fulfilled or aborted here, never forwarded to a server.
    if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) { await route.abort(); return }
    if (url.origin !== base) { unexpected.push(request.url()); await route.abort(); return }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return }
    const path = url.pathname.slice(4), method = request.method()
    const reply = (data, status = 200) => route.fulfill({ status, json: { success: status < 400, data, message: status >= 400 ? 'Local QA rejection ' + status : undefined } })
    if (path === '/auth/login') return reply({ accessToken: 'local-test-token', userId: 'u', username: 'local-admin', roles: ['ADMIN'], tokenType: 'Bearer', expiresIn: 3600 })
    if (path === '/auth/me') return reply({ userId: 'u', effectivePermissions: ['BOOKING_READ', 'BOOKING_UPDATE', 'BOOKING_CANCEL', 'BOOKING_CREATE'] })
    if (path === '/auth/logout') { state.logoutCalls++; return reply(null, 500) }
    if (method !== 'GET') {
      writes.push({ path, method, body: request.postDataJSON() })
      if (path === '/booking' && method === 'POST') {
        if (state.createGate) await state.createGate
        if (state.unknown) return route.abort('timedout')
        return reply(state.createStatus === 201 ? saved : null, state.createStatus)
      }
      if (path === '/booking/' + saved.bookingId + '/cancel') return route.abort('timedout')
      unexpected.push(method + ' ' + path); return reply(null, 500)
    }
    if (path === '/booking/available-cabins') { state.cabinReads++; return reply([{ cabinId: cabin, cabinNumber: '101', capacity: 2, remainingCapacity: state.remainingCapacity, deckId: 'deck', deckNumber: 1, deckName: 'Main', cabinType: 'SUITE', isAccessible: false }]) }
    if (path === '/booking/lookup' || path === '/booking/' + saved.bookingId) return reply(saved)
    if (path === '/booking') return reply({ content: [saved], totalPages: 1, totalElements: 1 })
    if (path === '/cruise') {
      state.catalogTypes.push(url.searchParams.get('cruiseType'))
      if (state.catalogOffline) return route.abort('connectionrefused')
      if (state.catalogStatus !== 200) return reply(null, state.catalogStatus)
      return reply({ content: state.catalogEmpty ? [] : [cruise], number: 0, totalPages: state.catalogEmpty ? 0 : 1, totalElements: state.catalogEmpty ? 0 : 1 })
    }
    if (path === '/cruise/' + cr) return reply(cruise)
    if (path === '/servicepackage/packages') return reply([{ id: packageId, name: 'Local QA Package', status: 'ACTIVE', price: 20, currency: 'USD' }], state.packageStatus)
    if (path === '/servicepackage/package-assignments' || path === '/itineraries') return reply(path === '/itineraries' ? { content: [], number: 0, totalPages: 0, totalElements: 0 } : [])
    if (path === '/ships/' + cruise.shipId) return reply(null, 403)
    unexpected.push(method + ' ' + path); return reply(null, 500)
  })
  return { browser, context, page, state, writes, errors, unexpected }
}
async function enterTravellers(page) {
  await page.getByLabel('Phòng cho hành khách 1 *', { exact: true }).selectOption(cabin)
  await page.getByLabel('Gói cho hành khách 1 (tùy chọn)', { exact: true }).selectOption(packageId)
  await page.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
  await page.getByLabel('Họ tên *', { exact: true }).fill('Local QA Traveller')
  await page.getByLabel('Email', { exact: true }).fill('qa@example.test')
  await page.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
  await page.getByRole('heading', { name: 'Kiểm tra & gửi', exact: true }).waitFor()
}
async function checkViewports(page, name) {
  for (const width of [1280, 1440, 1920, 390, 768]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true, name + ' overflow at ' + width)
    if (process.env.CASMS_EVIDENCE_DIR && [1440, 390].includes(width)) {
      await mkdir(process.env.CASMS_EVIDENCE_DIR, { recursive: true })
      await page.screenshot({ path: path.join(process.env.CASMS_EVIDENCE_DIR, name + '-' + width + '.png'), fullPage: true })
    }
  }
}
async function reachReview(page) {
  if (await page.locator('#person-0-cabinId').count()) {
    await page.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
    await page.getByRole('heading', { name: 'Hành khách', exact: true }).waitFor()
  }
  if (await page.locator('#person-0-fullName').count()) {
    await page.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
    await page.getByRole('heading', { name: 'Kiểm tra & gửi', exact: true }).waitFor()
  }
}
async function reviewAndSend(page) {
  await reachReview(page)
  await page.getByRole('button', { name: 'Kiểm tra và gửi đặt chỗ', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Gửi đặt chỗ', exact: true }).click()
}

test('isolated browser: discovery → cabin → reviewed create rejection/retry → server result → guest lookup', { skip: !enabled }, async () => {
  const s = await sandbox()
  try {
    await s.page.goto(base + '/')
    await s.page.getByLabel('Loại hành trình', { exact: true }).selectOption('MULTI_DAYS')
    await s.page.getByRole('button', { name: 'Tìm chuyến', exact: true }).click()
    await s.page.getByRole('link', { name: 'Xem hành trình', exact: true }).click()
    await checkViewports(s.page, 'cruise-detail')
    await s.page.getByRole('link', { name: '← Về danh mục', exact: true }).click()
    assert.equal(new URL(s.page.url()).searchParams.get('cruiseType'), 'MULTI_DAYS')
    await s.page.reload()
    assert.equal(await s.page.getByLabel('Loại hành trình', { exact: true }).inputValue(), 'MULTI_DAYS')
    await s.page.getByRole('link', { name: 'Xem hành trình', exact: true }).click()
    await s.page.getByRole('link', { name: 'Chọn phòng & đặt chỗ', exact: true }).click()
    await checkViewports(s.page, 'cabin')
    await enterTravellers(s.page)
    await s.page.goBack()
    assert.equal(await s.page.getByLabel('Họ tên *', { exact: true }).inputValue(), 'Local QA Traveller')
    await checkViewports(s.page, 'passengers')
    await s.page.goBack()
    assert.equal(await s.page.getByLabel('Phòng cho hành khách 1 *', { exact: true }).inputValue(), cabin)
    assert.equal(await s.page.getByLabel('Gói cho hành khách 1 (tùy chọn)', { exact: true }).inputValue(), packageId)
    await reachReview(s.page)
    await checkViewports(s.page, 'review')
    s.state.createStatus = 400; await reviewAndSend(s.page)
    await s.page.getByText('Local QA rejection 400', { exact: true }).waitFor()
    await s.page.getByRole('link', { name: '2. Hành khách', exact: true }).click()
    assert.equal(await s.page.getByLabel('Họ tên *', { exact: true }).inputValue(), 'Local QA Traveller')
    s.state.createStatus = 409; await reviewAndSend(s.page)
    await s.page.getByText('Local QA rejection 409', { exact: true }).waitFor()
    await s.page.locator('#person-0-cabinId option').nth(1).waitFor({ state: 'attached' })
    s.state.createStatus = 201; await reviewAndSend(s.page)
    await s.page.getByRole('heading', { name: 'Đã tiếp nhận đặt chỗ', exact: true }).waitFor()
    assert.equal(s.writes.length, 3); assert.ok(s.state.cabinReads >= 2); assert.ok(s.state.catalogTypes.includes('MULTI_DAYS'))
    assert.equal(s.writes.at(-1).body.passengers[0].cabinId, cabin)
    assert.equal(s.writes.at(-1).body.passengers[0].tourPackageId, packageId)
    assert.equal(s.writes.at(-1).body.passengers[0].fullName, 'Local QA Traveller')
    await s.page.getByRole('link', { name: 'Tra cứu đặt chỗ', exact: true }).click()
    await s.page.getByLabel('Mã đặt chỗ', { exact: true }).fill(saved.bookingReference)
    await s.page.getByLabel('Email đại diện', { exact: true }).fill('qa@example.test')
    await s.page.getByRole('button', { name: 'Tra cứu', exact: true }).click()
    await s.page.getByRole('heading', { name: 'Trạng thái đặt chỗ', exact: true }).waitFor()
    await s.page.setViewportSize({ width: 375, height: 812 })
    assert.equal(await s.page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true)
    assert.deepEqual(s.errors, []); assert.deepEqual(s.unexpected, [])
  } finally { await s.browser.close() }
})

test('isolated browser: unknown create cannot resubmit; Admin logout failure clears session and Back stays protected', { skip: !enabled }, async () => {
  const s = await sandbox()
  try {
    await s.page.goto(base + '/booking/cabin-experience?cruiseId=' + cr)
    await enterTravellers(s.page)
    s.state.unknown = true; await reviewAndSend(s.page)
    await s.page.getByRole('dialog').getByText('Kiểm tra kết quả trước khi gửi lại', { exact: true }).waitFor()
    assert.equal(await s.page.getByRole('dialog').getByRole('button', { name: 'Gửi đặt chỗ', exact: true }).isDisabled(), true)
    assert.equal(s.writes.length, 1)
    await s.page.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click()
    assert.equal(await s.page.getByRole('button', { name: 'Kiểm tra và gửi đặt chỗ', exact: true }).isDisabled(), true)
    await s.page.goto(base + '/login?returnTo=%2Fadmin%2Fbookings')
    await s.page.getByLabel('Tên đăng nhập', { exact: true }).fill('local-admin')
    await s.page.getByLabel('Mật khẩu', { exact: true }).fill('test-only')
    await s.page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await s.page.getByRole('heading', { name: 'Quản lý đặt chỗ', exact: true }).waitFor()
    await s.page.getByRole('link', { name: 'Chi tiết', exact: true }).click()
    await s.page.getByRole('heading', { name: saved.bookingReference, exact: true }).waitFor()
    await s.page.getByRole('button', { name: 'Hủy đặt chỗ', exact: true }).click()
    await s.page.getByLabel('Lý do hủy *', { exact: true }).fill('Local test only')
    await s.page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await s.page.getByRole('dialog').getByText('Kiểm tra kết quả trước khi thao tác tiếp', { exact: true }).waitFor()
    assert.equal(await s.page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).isDisabled(), true)
    await s.page.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click()
    assert.equal(await s.page.getByRole('button', { name: 'Hủy đặt chỗ', exact: true }).isDisabled(), true)
    assert.equal(s.writes.length, 2)
    await s.page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
    await s.page.waitForURL(base + '/login')
    assert.equal(s.state.logoutCalls, 1)
    assert.equal(await s.page.evaluate(() => globalThis.sessionStorage.getItem('aurora.auth.session.v1')), null)
    await s.page.goBack(); await s.page.waitForURL('**/login?returnTo=*')
    await s.page.goto(base + '/admin/bookings'); await s.page.waitForURL('**/login?returnTo=*')
    await s.page.reload(); await s.page.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor()
    assert.equal(await s.page.getByRole('button', { name: 'Đăng xuất', exact: true }).count(), 0)
    assert.deepEqual(s.errors, []); assert.deepEqual(s.unexpected, [])
  } finally { await s.browser.close() }
})

test('isolated browser: public login/account menu preserves Escape dismissal and logout', { skip: !enabled }, async () => {
  const s = await sandbox()
  try {
    await s.page.goto(base + '/login?returnTo=%2Fcruises')
    await s.page.getByLabel('Tên đăng nhập', { exact: true }).fill('local-admin')
    await s.page.getByLabel('Mật khẩu', { exact: true }).fill('test-only')
    await s.page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    const trigger = s.page.getByRole('button', { name: /^local-admin/ })
    await trigger.click(); assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    await s.page.keyboard.press('Escape')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(await trigger.evaluate(button => button === globalThis.document.activeElement), true)
    await trigger.click()
    await s.page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
    await s.page.waitForURL(base + '/')
    await s.page.getByRole('link', { name: 'Đăng nhập', exact: true }).first().waitFor()
    assert.equal(await s.page.evaluate(() => globalThis.sessionStorage.getItem('aurora.auth.session.v1')), null)
    assert.deepEqual(s.errors, []); assert.deepEqual(s.unexpected, [])
  } finally { await s.browser.close() }
})

test('isolated browser: catalog errors and empty/offline states never fall back to fixtures, and retry recovers', { skip: !enabled }, async () => {
  const s = await sandbox()
  try {
    for (const status of [401, 403, 400, 500]) {
      s.state.catalogStatus = status
      await s.page.goto(base + '/cruises?cruiseType=MULTI_DAYS')
      await s.page.getByRole('heading', { name: 'Không tải được danh mục chuyến đi', exact: true }).waitFor()
      assert.equal(await s.page.getByRole('link', { name: 'Xem hành trình', exact: true }).count(), 0)
      s.state.catalogStatus = 200
      await s.page.getByRole('button', { name: 'Thử lại', exact: true }).click()
      await s.page.getByRole('link', { name: 'Xem hành trình', exact: true }).waitFor()
    }
    s.state.catalogEmpty = true; await s.page.reload()
    await s.page.getByRole('heading', { name: 'Chưa có hành trình đã công bố', exact: true }).waitFor()
    s.state.catalogEmpty = false; s.state.catalogOffline = true; await s.page.reload()
    await s.page.getByRole('heading', { name: 'Không tải được danh mục chuyến đi', exact: true }).waitFor()
    s.state.catalogOffline = false
    await s.page.getByRole('button', { name: 'Thử lại', exact: true }).click()
    await s.page.getByRole('link', { name: 'Xem hành trình', exact: true }).waitFor()
    assert.deepEqual(s.errors, []); assert.deepEqual(s.unexpected, []); assert.equal(s.writes.length, 0)
  } finally { await s.browser.close() }
})

test('isolated browser: capacity and inline focus, optional package failure, and rapid double-submit guard', { skip: !enabled }, async () => {
  const s = await sandbox()
  try {
    s.state.remainingCapacity = 1; s.state.packageStatus = 403
    await s.page.goto(base + '/booking/cabin-experience?cruiseId=' + cr)
    await s.page.getByLabel('Phòng cho hành khách 1 *', { exact: true }).selectOption(cabin)
    await s.page.getByRole('button', { name: 'Thêm hành khách', exact: true }).click()
    assert.equal(await s.page.locator('#person-1-cabinId option[value="' + cabin + '"]').isDisabled(), true)
    await s.page.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
    await s.page.locator('#person-1-cabinId[aria-invalid="true"]').waitFor()
    assert.equal(await s.page.evaluate(() => globalThis.document.activeElement.id), 'person-1-cabinId')
    await s.page.getByRole('button', { name: 'Bỏ hành khách 2', exact: true }).click()
    await s.page.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
    await s.page.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
    await s.page.locator('#person-0-fullName[aria-invalid="true"]').waitFor()
    assert.equal(await s.page.evaluate(() => globalThis.document.activeElement.id), 'person-0-fullName')
    await s.page.getByLabel('Họ tên *', { exact: true }).fill('Local QA Traveller')
    await s.page.getByLabel('Email', { exact: true }).fill('qa@example.test')
    await s.page.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
    await s.page.getByRole('button', { name: 'Kiểm tra và gửi đặt chỗ', exact: true }).click()
    let release
    s.state.createGate = new Promise(resolve => { release = resolve })
    const sent = s.page.waitForRequest(request => request.url().endsWith('/api/booking') && request.method() === 'POST')
    await s.page.getByRole('dialog').getByRole('button', { name: 'Gửi đặt chỗ', exact: true }).evaluate(button => { button.click(); button.click() })
    await sent
    assert.equal(s.writes.length, 1)
    release()
    await s.page.getByRole('heading', { name: 'Đã tiếp nhận đặt chỗ', exact: true }).waitFor()
    assert.equal(s.writes[0].body.passengers[0].tourPackageId, undefined)
    assert.equal(s.writes.length, 1)
    assert.deepEqual(s.errors, []); assert.deepEqual(s.unexpected, [])
  } finally { await s.browser.close() }
})
