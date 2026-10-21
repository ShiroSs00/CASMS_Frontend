import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { URL } from 'node:url'

const enabled = Boolean(process.env.CASMS_PLAYWRIGHT_MODULE), base = process.env.CASMS_TEST_URL || 'http://127.0.0.1:5173'
assert.equal(new URL(base).hostname, '127.0.0.1')
const cr = '11111111-2222-3333-4444-555555555555', b = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff', ship = '99999999-8888-7777-6666-555555555555'
const permissions = ['BOOKING_READ', 'ACTIVITY_READ', 'ACTIVITY_REGISTRATION', 'SERVICE_READ', 'SERVICE_REQUEST_CREATE']
const booking = { bookingId: b, bookingReference: 'DEV-COMPLETE-ONLY', bookingStatus: 'Confirmed', cruiseId: cr, cruiseName: 'Fixture voyage', agreedFareAmount: 125, currency: 'USD', requiredDepositAmount: 25, installments: [], passengers: [{ bookingPassengerId: 'bp', passengerId: 'p', fullName: 'Fixture passenger', participationStatus: 'Active', cabinId: 'c', cabinNumber: '101' }] }
const activity = { id: 'a', cruiseId: cr, name: 'Fixture yoga', description: 'Fixture activity details', startTime: '2099-01-01T01:00:00Z', endTime: '2099-01-01T02:00:00Z', capacity: 10, price: 12.1234, currencyCode: 'USD', status: 'OPEN' }
const service = { id: 's', name: 'Fixture dining', description: 'Fixture service details', type: 'Dining', price: null, currency: null, capacity: null, status: 'ACTIVE' }
const excursion = { shoreExcursionId: 'e', cruiseStopId: ship, excursionName: 'Fixture shore walk', startTime: activity.startTime, plannedReturnTime: activity.endTime, meetingPoint: 'Fixture pier', maximumCapacity: 20, availableCapacity: 15, price: 0, currencyCode: 'VND', status: 'OPEN' }
async function sandbox(caps = permissions) {
  const { chromium } = createRequire(import.meta.url)(process.env.CASMS_PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ channel: 'msedge', headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => globalThis.addEventListener('DOMContentLoaded', () => { const note = globalThis.document.createElement('aside'); note.textContent = 'UI PREVIEW — FIXTURE HTTP ONLY — NO LIVE MUTATIONS'; note.setAttribute('role', 'note'); globalThis.document.body.prepend(note) }))
  const page = await context.newPage(), requests = [], errors = [], unexpected = []
  const state = { caps, packageStatus: 403, unknown: false, writeStatus: 200, readStatus: 200, malformed: false, registrations: [], requests: [] }
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.abort()
    if (url.origin !== base) { unexpected.push(req.url()); return route.abort() }
    if (!url.pathname.startsWith('/api/')) return route.continue()
    const p = url.pathname.slice(4), method = req.method(), body = req.postData() ? req.postDataJSON() : undefined
    requests.push({ path: p, method, body, query: Object.fromEntries(url.searchParams) })
    const reply = (data, status = 200) => route.fulfill({ status, json: { success: status < 400, message: status < 400 ? 'Fixture only' : 'PRIVATE_TRACE_MUST_NOT_RENDER', data } })
    if (p === '/auth/login') return reply({ accessToken: 'fixture-token', userId: 'fixture-user', username: 'fixture-user', roles: ['PASSENGER'], tokenType: 'Bearer', expiresIn: 3600 })
    if (p === '/auth/me') return reply({ userId: 'fixture-user', effectivePermissions: state.caps })
    if (p === '/booking/' + b) return reply(booking, state.readStatus)
    if (p === '/cruise') return reply({ content: [{ cruiseId: cr, shipId: ship, cruiseName: booking.cruiseName, status: 'PUBLISHED', departureDatetime: '2099-01-01T00:00:00Z' }], number: 0, totalPages: 1, totalElements: 1 })
    if (p === '/booking/available-cabins') return reply([{ cabinId: 'c', cabinNumber: '101', capacity: 2, remainingCapacity: 2 }])
    if (p === '/servicepackage/packages') return reply([{ id: 'pack', name: 'Fixture premium', status: 'ACTIVE', price: 20, currency: 'USD' }])
    if (p === '/servicepackage/packages/pack') return reply({ id: state.malformed ? 'wrong' : 'pack', code: 'PK', name: 'Fixture premium', description: 'Verified fixture package details', type: 'PREMIUM', price: 20, currency: 'USD', status: 'ACTIVE', startDate: null, endDate: null }, state.packageStatus)
    if (p === '/activities' && method === 'GET') return reply([activity, { ...activity, id: 'other', cruiseId: 'other-cruise', name: 'OTHER_CRUISE_MUST_NOT_RENDER' }])
    if (p === '/activities/a' && method === 'GET') return reply(activity)
    if (p === '/activities/a/availability') return reply({ activityId: 'a', capacity: 10, availableSeats: 8, status: 'OPEN' })
    if (p === '/activities/registrations' && method === 'GET') return reply(state.registrations)
    if (p === '/itineraries') return reply({ content: [{ itineraryId: b, cruiseId: cr }], number: 0, totalPages: 1 })
    if (p === '/cruise-stops/by-itinerary/' + b) return reply([{ cruiseStopId: ship, itineraryId: b, stopOrder: 1, portName: 'Fixture port' }])
    if (p === '/shore-excursions') return route.fulfill({ json: [state.malformed ? { ...excursion, cruiseStopId: 'foreign-stop' } : excursion] })
    if (p === '/shore-excursions/e' || p === '/shore-excursions/e/availability') return route.fulfill({ json: excursion })
    if (p === '/servicepackage/services' && method === 'GET') return reply([service])
    if (p === '/servicepackage/services/s') return reply(service)
    if (p === '/servicepackage/services/s/availability') return reply({ serviceId: 's', requestedQuantity: Number(url.searchParams.get('quantity')), available: true })
    if (p === '/servicepackage/requests' && method === 'GET') return reply(state.requests)
    const registration = state.registrations.find(item => p.startsWith('/activities/registrations/' + item.id))
    const request = state.requests.find(item => p.startsWith('/servicepackage/requests/' + item.id))
    if (method === 'GET' && registration) return reply(state.malformed ? { ...registration, bookingPassengerId: 'foreign', passengerId: 'foreign' } : registration)
    if (method === 'GET' && request) return reply(request)
    if (method !== 'GET') {
      if (state.unknown) return route.abort('timedout')
      if (state.writeStatus >= 400) return reply(null, state.writeStatus)
      if (p === '/activities/a/registrations') { const item = { id: 'r', passengerId: 'p', bookingPassengerId: body.bookingPassengerId, activityId: 'a', excursionId: null, quantity: body.quantity, status: 'PENDING', registeredAt: '2099-01-01T00:00:00Z' }; state.registrations.push(item); return reply(item, 201) }
      if (p === '/activities/excursions/e/registrations') { const item = { id: 'r', passengerId: 'p', bookingPassengerId: body.bookingPassengerId, activityId: null, excursionId: 'e', quantity: body.quantity, status: 'PENDING', registeredAt: '2099-01-01T00:00:00Z' }; state.registrations.push(item); return reply(item, 201) }
      if (p === '/servicepackage/requests' && method === 'POST') { const item = { id: 'q', passengerId: 'p', serviceId: body.serviceId, bookingId: b, bookingPassengerId: body.bookingPassengerId, quantity: body.quantity, note: body.note, status: 'REQUESTED', requestTime: '2099-01-01T00:00:00Z', completedAt: null }; state.requests.push(item); return reply(item, 201) }
      const item = registration || request
      if (item) {
        if (method === 'PUT') { item.quantity = body.quantity; if (request) item.note = body.note }
        else if (p.endsWith('/confirm')) item.status = 'CONFIRMED'
        else if (p.endsWith('/cancel')) item.status = 'CANCELLED'
        return reply(item)
      }
    }
    unexpected.push(method + ' ' + p); return reply(null, 404)
  })
  async function login(to = '/my-bookings/' + b + '/experiences') {
    await page.goto(base + '/login?returnTo=' + encodeURIComponent(to)); await page.locator('#auth-username').waitFor()
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill('fixture-user'); await page.getByLabel('Mật khẩu', { exact: true }).fill('fixture-only'); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL(url => url.pathname === to)
  }
  async function finish() { try { assert.deepEqual(errors, []); assert.deepEqual(unexpected, []) } finally { await browser.close() } }
  return { page, state, requests, login, finish }
}
test('Complete: public package details have explicit loading/error/retry, real identity and no benefit fallback', { skip: !enabled }, async () => {
  const s = await sandbox([]), p = s.page
  try {
    await p.goto(base + '/booking/cabin-experience?cruiseId=' + cr)
    await p.locator('#person-0-tourPackageId').selectOption('pack'); await p.getByRole('button', { name: 'Xem chi tiết gói cho khách 1', exact: true }).click()
    await p.getByText('Chưa tải được chi tiết gói', { exact: true }).waitFor(); assert.doesNotMatch(await p.locator('main').innerText(), /PRIVATE_TRACE/)
    s.state.packageStatus = 200; await p.getByRole('button', { name: 'Tải lại chi tiết gói', exact: true }).click(); await p.getByText('Verified fixture package details', { exact: true }).waitFor()
    assert.equal(s.requests.some(req => req.path.includes('/benefits')), false)
    assert.equal(s.requests.some(req => req.method !== 'GET'), false)
  } finally { await s.finish() }
})
test('Complete: activity create/edit/confirm/cancel is a linked customer flow with exact requests and authoritative states', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.login('/my-bookings/' + b); await p.getByRole('link', { name: 'Hoạt động & dịch vụ', exact: true }).click()
    await p.locator('#customer-activity').selectOption('a'); await p.getByText('Fixture activity details', { exact: true }).waitFor()
    assert.doesNotMatch(await p.locator('main').innerText(), /OTHER_CRUISE/)
    await p.locator('#activity-passenger').selectOption('bp'); await p.locator('#activity-quantity').fill('2'); await p.getByRole('button', { name: 'Đăng ký hoạt động', exact: true }).click()
    await p.getByText(/Đã tạo đăng ký/).waitFor(); await p.getByRole('button', { name: 'Tải lại đăng ký', exact: true }).click(); await p.getByRole('button', { name: 'Chi tiết đăng ký r', exact: true }).click()
    assert.equal(await p.locator('#activity-edit-r').inputValue(), '2'); await p.locator('#activity-edit-r').fill('3'); await p.locator('#activity-note-r').fill('fixture note'); await p.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
    await p.getByText(/Chờ xác nhận · 3 chỗ/).waitFor(); await p.getByRole('button', { name: 'Chi tiết đăng ký r', exact: true }).click(); await p.getByRole('button', { name: 'Xác nhận đăng ký', exact: true }).click()
    await p.getByText(/Đã xác nhận đăng ký · 3 chỗ/).waitFor(); await p.getByRole('button', { name: 'Chi tiết đăng ký r', exact: true }).click(); await p.locator('#activity-cancel-r').fill('fixture cancel'); await p.getByRole('button', { name: 'Hủy đăng ký', exact: true }).click(); await p.getByText(/Đã hủy · 3 chỗ/).waitFor()
    const writes = s.requests.filter(req => req.path.startsWith('/activities') && req.method !== 'GET')
    assert.equal(writes.length, 4); assert.deepEqual(writes[0].body, { bookingPassengerId: 'bp', quantity: 2 }); assert.deepEqual(writes[1].body, { quantity: 3, notes: 'fixture note' }); assert.equal(writes.at(-1).query.reason, 'fixture cancel')
  } finally { await s.finish() }
})
test('Complete: service create/detail/update/cancel uses actual permissions, availability quantity and note DTO', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.login(); await p.locator('#customer-service').selectOption('s'); await p.getByText('Fixture service details', { exact: true }).waitFor()
    await p.getByText(/Chưa có đủ thông tin giá/).waitFor(); await p.locator('#service-passenger').selectOption('bp'); await p.locator('#service-quantity').fill('2'); await p.locator('#service-note').fill('fixture meal'); await p.getByRole('button', { name: 'Gửi yêu cầu dịch vụ', exact: true }).click()
    await p.getByText(/Đã gửi yêu cầu dịch vụ/).waitFor(); await p.getByRole('button', { name: 'Tải lại yêu cầu dịch vụ', exact: true }).click(); await p.getByRole('button', { name: 'Chi tiết yêu cầu q', exact: true }).click()
    assert.equal(await p.locator('#service-edit-q').inputValue(), '2'); assert.equal(await p.locator('#service-note-q').inputValue(), 'fixture meal'); await p.locator('#service-edit-q').fill('3'); await p.locator('#service-note-q').fill('new fixture note'); await p.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
    await p.getByText(/Đã gửi yêu cầu · 3 chỗ/).waitFor(); await p.getByRole('button', { name: 'Chi tiết yêu cầu q', exact: true }).click(); await p.getByRole('button', { name: 'Hủy yêu cầu dịch vụ', exact: true }).click(); await p.getByText(/Đã hủy · 3 chỗ/).waitFor()
    const writes = s.requests.filter(req => req.path.startsWith('/servicepackage/requests') && req.method !== 'GET')
    assert.equal(writes.length, 3); assert.deepEqual(writes[0].body, { serviceId: 's', bookingPassengerId: 'bp', quantity: 2, note: 'fixture meal' }); assert.deepEqual(writes[1].body, { quantity: 3, note: 'new fixture note' })
  } finally { await s.finish() }
})
test('Complete: authorized excursion selection proves cruise→itinerary→stop before raw catalog and registration', { skip: !enabled }, async () => {
  const caps = [...permissions, 'EXCURSION_READ', 'EXCURSION_BOOKING', 'ITINERARY_READ', 'CRUISE_STOP_READ']
  const s = await sandbox(caps), p = s.page
  try {
    await s.login(); await p.locator('#excursion-stop').selectOption(ship); await p.locator('#customer-excursion').selectOption('e'); await p.getByText('Điểm tập trung: Fixture pier', { exact: true }).waitFor()
    await p.locator('#excursion-passenger').selectOption('bp'); await p.locator('#excursion-quantity').fill('2'); await p.getByRole('button', { name: 'Đăng ký tour tham quan', exact: true }).click(); await p.getByText(/Đã tạo đăng ký tour/).waitFor()
    await p.getByRole('button', { name: 'Tải lại đăng ký', exact: true }).click(); await p.getByRole('button', { name: 'Chi tiết đăng ký r', exact: true }).click(); await p.getByRole('button', { name: 'Xác nhận đăng ký', exact: true }).click(); await p.getByText(/Đã xác nhận đăng ký · 2 chỗ/).waitFor()
    assert.equal(s.requests.find(req => req.path === '/shore-excursions').query.cruiseStopId, ship)
    assert.equal(s.requests.filter(req => req.path === '/shore-excursions/e/availability').at(-1).query.participants, '2')
    assert.deepEqual(s.requests.find(req => req.path === '/activities/excursions/e/registrations').body, { bookingPassengerId: 'bp', quantity: 2 })
  } finally { await s.finish() }
  const t = await sandbox(caps), q = t.page
  try { t.state.malformed = true; await t.login(); await q.locator('#excursion-stop').selectOption(ship); await q.getByText('Chưa tải được tour tham quan', { exact: true }).waitFor(); assert.equal(await q.locator('#customer-excursion').count(), 0); assert.equal(t.requests.some(req => req.path === '/activities/excursions/e/registrations'), false) } finally { await t.finish() }
})
test('Complete: missing permissions make no private supplement requests; malformed ownership blocks writes', { skip: !enabled }, async () => {
  const s = await sandbox(['BOOKING_READ']), p = s.page
  try { await s.login(); await p.getByText('Chưa có quyền xem hoạt động', { exact: true }).waitFor(); assert.equal(s.requests.some(req => req.path.startsWith('/activities') || req.path.startsWith('/servicepackage')), false) } finally { await s.finish() }
  const t = await sandbox(), q = t.page
  try {
    t.state.registrations = [{ id: 'r', passengerId: 'p', bookingPassengerId: 'bp', activityId: 'a', excursionId: null, quantity: 1, status: 'PENDING', registeredAt: '2099-01-01T00:00:00Z' }]; t.state.malformed = true
    await t.login(); await q.getByRole('button', { name: 'Chi tiết đăng ký r', exact: true }).click(); await q.getByText('Dữ liệu không thuộc đặt chỗ này', { exact: true }).waitFor(); assert.equal(await q.getByRole('button', { name: 'Xác nhận đăng ký', exact: true }).count(), 0)
  } finally { await t.finish() }
})
test('Complete: uncertain create stays locked across route remount, while safe reads and typed data remain available', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    s.state.unknown = true; await s.login(); await p.locator('#customer-activity').selectOption('a'); await p.locator('#activity-passenger').selectOption('bp'); await p.getByRole('button', { name: 'Đăng ký hoạt động', exact: true }).click(); await p.getByText('Cần kiểm tra kết quả trước khi gửi lại', { exact: true }).waitFor()
    await p.getByRole('link', { name: '← Về chi tiết đặt chỗ', exact: true }).click(); await p.getByRole('link', { name: 'Hoạt động & dịch vụ', exact: true }).click(); await p.locator('#customer-activity').selectOption('a'); await p.getByText('Cần kiểm tra kết quả trước khi gửi lại', { exact: true }).waitFor()
    assert.equal(await p.getByRole('button', { name: 'Đăng ký hoạt động', exact: true }).isDisabled(), true); assert.equal(s.requests.filter(req => req.path === '/activities/a/registrations').length, 1)
    await p.getByRole('button', { name: 'Tải lại đăng ký', exact: true }).click()
  } finally { await s.finish() }
})
test('Complete: backend ownership 403 retains entered values, discloses no server trace and never claims success', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    s.state.writeStatus = 403; await s.login(); await p.locator('#customer-activity').selectOption('a'); await p.locator('#activity-passenger').selectOption('bp'); await p.locator('#activity-quantity').fill('2'); await p.getByRole('button', { name: 'Đăng ký hoạt động', exact: true }).click(); await p.getByText('Chưa hoàn tất thao tác', { exact: true }).waitFor()
    assert.equal(await p.locator('#activity-passenger').inputValue(), 'bp'); assert.equal(await p.locator('#activity-quantity').inputValue(), '2'); assert.equal(await p.getByRole('button', { name: 'Đăng ký hoạt động', exact: true }).isDisabled(), false)
    assert.doesNotMatch(await p.locator('main').innerText(), /PRIVATE_TRACE|Đã tạo đăng ký\./); assert.equal(s.state.registrations.length, 0); assert.equal(s.requests.filter(req => req.path === '/activities/a/registrations').length, 1)
  } finally { await s.finish() }
})
test('Complete: customer experiences desktop 1280/1440/1920 has no overflow and accessible named controls', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.login(); await p.locator('#customer-activity').selectOption('a'); await p.getByText('Fixture activity details', { exact: true }).waitFor()
    await p.locator('#customer-service').selectOption('s'); await p.getByText('Fixture service details', { exact: true }).waitFor()
    for (const width of [1280, 1440, 1920]) {
      await p.setViewportSize({ width, height: 1000 }); assert.equal(await p.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true)
      assert.equal(await p.getByLabel('Hồ sơ của bạn trong đặt chỗ *', { exact: true }).count(), 2)
      if (process.env.CASMS_EVIDENCE_DIR) { await mkdir(process.env.CASMS_EVIDENCE_DIR, { recursive: true }); await p.screenshot({ path: path.join(process.env.CASMS_EVIDENCE_DIR, 'customer-experiences-' + width + '.png'), fullPage: true }) }
    }
  } finally { await s.finish() }
})
