import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { URL } from 'node:url'

const enabled = Boolean(process.env.CASMS_PLAYWRIGHT_MODULE)
const base = process.env.CASMS_TEST_URL || 'http://127.0.0.1:5173'
assert.equal(new URL(base).hostname, '127.0.0.1')
const cr = '11111111-2222-3333-4444-555555555555', ship = '99999999-8888-7777-6666-555555555555', itinerary = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff', cabin = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', nextCabin = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa'
const voyage = { cruiseId: cr, shipId: ship, cruiseName: 'V15 fixture voyage', status: 'PUBLISHED', departureDatetime: '2099-11-01T00:00:00Z', returnDatetime: '2099-11-03T00:00:00Z' }
async function sandbox(permissions = []) {
  const { chromium } = createRequire(import.meta.url)(process.env.CASMS_PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => globalThis.addEventListener('DOMContentLoaded', () => { const note = globalThis.document.createElement('aside'); note.textContent = 'UI PREVIEW — NO LIVE BACKEND · V15 HTTP INTERCEPT'; note.setAttribute('role', 'note'); globalThis.document.body.prepend(note) }))
  const page = await context.newPage(), requests = [], errors = [], unexpected = []
  const state = { permissions, readStatus: 200, unknown: false, record: { bookingId: itinerary, bookingReference: 'DEV-V15-ONLY', bookingStatus: 'Draft', cruiseId: cr, cruiseName: voyage.cruiseName, departureDatetime: voyage.departureDatetime, returnDatetime: voyage.returnDatetime, agreedFareAmount: 125.1234, requiredDepositAmount: 37.537, currency: 'USD', paymentPlan: 'DEPOSIT', contractStatus: 'Draft', contractSigningInstructions: 'DEV instructions only', installments: [{ sequenceNo: 1, requiredAmount: 37.537, currency: 'USD', dueAt: null, status: 'Scheduled', installmentType: 'Deposit', description: 'DEV schedule' }], passengers: [{ bookingPassengerId: 'bp', passengerId: 'p', fullName: 'V15 fixture guest', participationStatus: 'Active', cabinId: cabin, cabinNumber: '101' }] } }
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.abort()
    if (url.origin !== base) { unexpected.push(req.url()); return route.abort() }
    if (!url.pathname.startsWith('/api/')) return route.continue()
    const p = url.pathname.slice(4), method = req.method()
    requests.push({ path: p, method, query: Object.fromEntries(url.searchParams), body: req.postData() ? req.postDataJSON() : undefined })
    const reply = (data, status = 200) => route.fulfill({ status, headers: { 'X-Ocv-Development-Fixture': 'true' }, json: { success: status < 400, data, message: status < 400 ? 'V15 fixture only' : 'PRIVATE_DETAIL_MUST_NOT_RENDER' } })
    if (p === '/auth/login') return reply({ accessToken: 'v15-fixture-token', userId: 'fixture-user', username: 'fixture-user', roles: ['PASSENGER'], tokenType: 'Bearer', expiresIn: 3600 })
    if (p === '/auth/me') return reply({ userId: 'fixture-user', effectivePermissions: state.permissions })
    if (method !== 'GET') {
      if (state.unknown) return route.abort('timedout')
      if (p === '/booking/' + itinerary + '/confirm') state.record.bookingStatus = 'Confirmed'
      else if (p === '/booking/' + itinerary + '/cancel') state.record.bookingStatus = 'Cancelled'
      else if (p === '/booking/change-cabin') state.record.passengers[0] = { ...state.record.passengers[0], cabinId: nextCabin, cabinNumber: '201' }
      else { unexpected.push(method + ' ' + p); return reply(null, 500) }
      return reply(state.record)
    }
    if (p === '/booking') return reply({ content: [{ ...state.record, passengerCount: 1 }], number: Number(url.searchParams.get('page') || 0), totalPages: 2, totalElements: 21 }, state.readStatus)
    if (p === '/booking/' + itinerary) return reply(state.record, state.readStatus)
    if (p === '/booking/available-cabins') return reply([{ cabinId: cabin, cabinNumber: '101', capacity: 2, remainingCapacity: 1, deckId: null, deckNumber: null, deckName: null, cabinType: 'SUITE', isAccessible: null, estimatedPrice: 125.1234 }, { cabinId: nextCabin, cabinNumber: '201', capacity: 2, remainingCapacity: 2, deckId: null, deckNumber: null, deckName: null, cabinType: 'SUITE', isAccessible: false }])
    if (p === '/cruise') return reply({ content: [voyage], number: 0, totalPages: 1, totalElements: 1 })
    if (p === '/cruise/' + cr) return reply(voyage)
    if (p === '/servicepackage/packages') return reply([])
    if (p === '/ships/' + ship) return reply({ shipId: ship, shipName: 'V15 authorized ship', totalCapacity: 20, totalDecks: 2 })
    if (p === '/itineraries') { const number = Number(url.searchParams.get('page')); return reply({ content: number === 1 ? [{ itineraryId: itinerary, cruiseId: cr, itineraryName: 'V15 authorized plan' }] : [], number, totalPages: 2 }) }
    if (p === '/itineraries/' + itinerary + '/days') return reply([{ itineraryDayId: ship, itineraryId: itinerary, dayNumber: 1, description: 'V15 authorized day' }])
    if (p === '/cruise-stops/by-itinerary/' + itinerary) return reply([{ cruiseStopId: ship, itineraryId: itinerary, stopOrder: 1, portName: 'V15 authorized stop' }])
    unexpected.push(method + ' ' + p); return reply(null, 404)
  })
  async function login(to = '/my-bookings') {
    await page.goto(base + '/login?returnTo=' + encodeURIComponent(to))
    await page.locator('#auth-username').waitFor()
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill('fixture-user')
    await page.getByLabel('Mật khẩu', { exact: true }).fill('fixture-only')
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await page.waitForURL(url => url.pathname === to)
  }
  async function finish() { try { assert.deepEqual(errors, []); assert.deepEqual(unexpected, []) } finally { await browser.close() } }
  return { page, state, requests, login, finish }
}

test('Guest detail loads public supplements; cabin estimates retain unknown currency and null deck metadata', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await p.goto(base + '/cruises/' + cr + '?preview=1&catalog=live')
    await p.getByText('V15 authorized ship', { exact: true }).waitFor()
    await p.getByText('V15 authorized day', { exact: true }).waitFor()
    await p.getByText('V15 authorized stop', { exact: true }).waitFor()
    assert.equal(s.requests.some(req => req.path.startsWith('/ships') || req.path.startsWith('/itineraries') || req.path.startsWith('/cruise-stops')), true)
    await p.getByRole('link', { name: 'Chọn phòng & đặt chỗ', exact: true }).click()
    await p.locator('#person-0-cabinId').selectOption(cabin)
    await p.getByText(/Giá tham chiếu ước tính \/ khách: 125,1234/).waitFor()
    assert.match(await p.locator('main').innerText(), /chưa có đơn vị tiền tệ/)
    assert.doesNotMatch(await p.locator('#person-0-cabinId').innerText(), /Boong null/)
    assert.equal(s.requests.some(req => req.method !== 'GET'), false)
  } finally { await s.finish() }
})

test('V15 authorized supplements load verified ship, paged itinerary, days and stops independently', { skip: !enabled }, async () => {
  const s = await sandbox(['SHIP_READ', 'ITINERARY_READ', 'CRUISE_STOP_READ']), p = s.page
  try {
    await s.login('/booking/cabin-experience')
    await p.goto(base + '/cruises/' + cr)
    await p.getByText('V15 authorized day', { exact: true }).waitFor()
    await p.getByText('V15 authorized stop', { exact: true }).waitFor()
    await p.getByText('V15 authorized ship', { exact: true }).waitFor()
    assert.deepEqual([...new Set(s.requests.filter(req => req.path === '/itineraries').map(req => req.query.page))], ['0', '1'])
  } finally { await s.finish() }
})

test('V15 customer list/filter/page/detail and existing management routes use real DTOs with no unsupported mutations', { skip: !enabled }, async () => {
  const s = await sandbox(['BOOKING_READ']), p = s.page
  try {
    s.state.record.paymentPlan = null; s.state.record.installments = []
    s.state.record.passengers[0].email = 'qa-v15@example.test'
    await s.login()
    await p.getByRole('link', { name: 'Chi tiết', exact: true }).waitFor()
    assert.match(await p.getByRole('table').innerText(), /125,1234 USD/)
    await p.getByRole('button', { name: 'Trang sau', exact: true }).click()
    await p.getByText('Trang 2 · 21 đặt chỗ', { exact: false }).waitFor()
    assert.equal(s.requests.filter(req => req.path === '/booking').at(-1).query.page, '1')
    await p.locator('#booking-status').selectOption('Confirmed')
    await p.getByText('Trang 1 · 21 đặt chỗ', { exact: false }).waitFor()
    assert.equal(s.requests.filter(req => req.path === '/booking').at(-1).query.status, 'Confirmed')
    await p.getByRole('link', { name: 'Chi tiết', exact: true }).click()
    await p.getByText('Chưa có kế hoạch thanh toán', { exact: true }).waitFor()
    assert.ok((await p.getByRole('heading', { name: 'DEV-V15-ONLY', exact: true }).boundingBox()).y < 500, 'Customer navigation must share one page frame with the record')
    assert.equal(await p.getByRole('button', { name: 'Xác nhận đặt chỗ', exact: true }).count(), 0)
    for (const [name, text] of [['Thông tin khách', 'Chưa có dịch vụ cập nhật hồ sơ'], ['Hợp đồng & lịch thanh toán', 'Chưa có dịch vụ thu tiền'], ['Check-in', 'Chưa có dịch vụ check-in'], ['Giờ đến cảng', 'Chưa có dịch vụ xem hoặc giữ'], ['Thẻ lên tàu', 'Chưa có dịch vụ cấp thẻ'], ['Thay đổi / hủy', 'Chưa có dịch vụ gửi yêu cầu']]) {
      await p.getByRole('navigation', { name: 'Các mục đặt chỗ', exact: true }).getByRole('link', { name, exact: true }).click()
      await p.getByText(new RegExp(text)).waitFor()
      await p.getByText('V15 fixture guest', { exact: true }).first().waitFor()
      if (name === 'Thông tin khách') await p.getByText('qa-v15@example.test', { exact: true }).waitFor()
    }
    assert.equal(s.requests.filter(req => req.method !== 'GET' && req.path.startsWith('/booking')).length, 0)
    if (process.env.CASMS_EVIDENCE_DIR) {
      await mkdir(process.env.CASMS_EVIDENCE_DIR, { recursive: true })
      for (const width of [1280, 1440, 1920]) { await p.setViewportSize({ width, height: 1000 }); assert.equal(await p.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true); await p.screenshot({ path: path.join(process.env.CASMS_EVIDENCE_DIR, 'customer-detail-' + width + '.png'), fullPage: true }) }
    }
  } finally { await s.finish() }
})

test('V15 customer missing BOOKING_READ sends no protected request; API 403 is truthful and retry recovers', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.login()
    await p.getByText('Chưa thể xem đặt chỗ của tài khoản', { exact: true }).waitFor()
    assert.equal(s.requests.some(req => req.path === '/booking'), false)
    s.state.permissions = ['BOOKING_READ']; s.state.readStatus = 403
    await p.reload()
    await p.getByRole('alert').waitFor()
    assert.doesNotMatch(await p.locator('main').innerText(), /PRIVATE_DETAIL_MUST_NOT_RENDER|DEV-V15-ONLY/)
    s.state.readStatus = 200
    await p.getByRole('button', { name: 'Tải lại danh sách đặt chỗ', exact: true }).click()
    await p.getByRole('link', { name: 'Chi tiết', exact: true }).waitFor()
  } finally { await s.finish() }
})

test('V15 authorized confirm/change-cabin/cancel use exact POST bodies once and refetch server states', { skip: !enabled }, async () => {
  const s = await sandbox(['BOOKING_READ', 'BOOKING_UPDATE', 'BOOKING_CANCEL']), p = s.page
  try {
    await s.login('/my-bookings/' + itinerary)
    await p.getByRole('button', { name: 'Xác nhận đặt chỗ', exact: true }).click()
    await p.getByRole('dialog').getByRole('checkbox').check()
    await p.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).evaluate(button => { button.click(); button.click() })
    await p.getByText('Đã xác nhận', { exact: true }).waitFor()
    assert.equal(s.requests.filter(req => req.path.endsWith('/confirm')).length, 1)
    await p.getByRole('button', { name: 'Đổi phòng', exact: true }).click()
    await p.locator('#booking-person').selectOption('bp')
    await p.locator('#booking-new-cabin').selectOption(nextCabin)
    await p.locator('#booking-reason').fill('fixture change')
    await p.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await p.getByRole('cell', { name: '201', exact: true }).waitFor()
    assert.equal(s.requests.find(req => req.path === '/booking/change-cabin').body.bookingPassengerId, 'bp')
    await p.getByRole('button', { name: 'Hủy đặt chỗ', exact: true }).click()
    await p.locator('#booking-reason').fill('fixture cancel')
    await p.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await p.getByText('Đã hủy', { exact: true }).first().waitFor()
    assert.equal(s.requests.find(req => req.path.endsWith('/cancel')).body.reason, 'fixture cancel')
    assert.equal(s.requests.filter(req => req.method === 'POST' && req.path.startsWith('/booking')).length, 3)
  } finally { await s.finish() }
})

test('V15 unknown authorized mutation remains locked without automatic POST retry', { skip: !enabled }, async () => {
  const s = await sandbox(['BOOKING_READ', 'BOOKING_CANCEL']), p = s.page
  try {
    await s.login('/my-bookings/' + itinerary)
    s.state.unknown = true
    await p.getByRole('button', { name: 'Hủy đặt chỗ', exact: true }).click()
    await p.locator('#booking-reason').fill('fixture only')
    await p.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await p.getByRole('dialog').getByText('Kiểm tra kết quả trước khi thao tác tiếp', { exact: true }).waitFor()
    assert.equal(await p.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).isDisabled(), true)
    assert.equal(s.requests.filter(req => req.path.endsWith('/cancel')).length, 1)
  } finally { await s.finish() }
})
