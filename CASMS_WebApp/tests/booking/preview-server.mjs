// Explicit development/test environment only. No request is forwarded to Backend.
// Run from CASMS_WebApp: node tests/booking/preview-server.mjs
import { createServer } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'
import console from 'node:console'
import { setTimeout } from 'node:timers'

if (process.env.NODE_ENV === 'production') throw new Error('Booking fixtures are development-only')
const root = fileURLToPath(new URL('../../', import.meta.url))
const cruiseId = '11111111-2222-3333-4444-555555555555'
const shipId = '99999999-8888-7777-6666-555555555555'
const cabinId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const packageId = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa'
const itineraryId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'
const cruise = { cruiseId, shipId, cruiseCode: 'DEV-ONLY', cruiseName: 'DEV · Hành trình trải nghiệm giao diện', shipName: 'Tàu mẫu development', status: 'PUBLISHED', cruiseType: 'MULTI_DAYS', departureDatetime: '2099-11-01T00:00:00Z', returnDatetime: '2099-11-03T00:00:00Z', departurePortName: 'Cảng mẫu A', returnPortName: 'Cảng mẫu B' }
const secondCruise = { ...cruise, cruiseId: '22222222-3333-4444-5555-666666666666', cruiseCode: 'DEV-TWO', cruiseName: 'DEV · Hành trình thứ hai', cruiseType: 'ONE_DAY', returnDatetime: '2099-11-01T08:00:00Z' }
const cabin = { cabinId, cabinNumber: '101', deckId: shipId, deckNumber: 1, deckName: 'Boong mẫu', cabinType: 'SUITE', capacity: 2, remainingCapacity: 2, isAccessible: true }
const pack = { id: packageId, name: 'DEV · Gói mẫu', status: 'ACTIVE', price: 20, currency: 'USD' }
const record = { bookingId: itineraryId, bookingReference: 'DEV-BOOKING-ONLY', bookingStatus: 'Draft', cruiseId, cruiseName: cruise.cruiseName, departureDatetime: cruise.departureDatetime, returnDatetime: cruise.returnDatetime, agreedFareAmount: 125, requiredDepositAmount: 37.5, currency: 'USD', paymentPlan: 'DEPOSIT', finalPaymentDueAt: '2099-10-25T00:00:00Z', contractReference: 'DEV-CONTRACT-ONLY', contractStatus: 'Draft', contractSigningInstructions: 'Hướng dẫn mẫu để kiểm tra giao diện. Không phải hợp đồng có hiệu lực.', cancellationReason: null, installments: [{ sequenceNo: 1, requiredAmount: 37.5, currency: 'USD', dueAt: '2099-10-25T00:00:00Z', status: 'Scheduled', installmentType: 'Deposit', description: 'Đợt mẫu development' }], passengers: [{ bookingPassengerId: 'dev-passenger', passengerId: 'dev-person', fullName: 'Khách mẫu development', participationStatus: 'Active', cabinId, cabinNumber: '101', tourPackageId: packageId, tourPackageName: pack.name }] }
const scenarios = new Set(['ready', 'loading', 'empty', 'error', 'cabins-empty', 'packages-empty', 'package-error', 'lookup-mismatch', 'create-rejected', 'create-unknown', 'catalog-pages', 'cabins-sold-out', 'packages-stale', 'lookup-not-found', 'lookup-unavailable', 'lookup-empty', 'create-stale'])
let scenario = 'ready'
let staleCabin = false
const requests = []
const plugin = {
  name: 'explicit-booking-development-fixtures',
  apply: 'serve',
  transformIndexHtml(html) {
    return html.replace('<body>', '<body><aside role="note" aria-label="Development fixtures" style="padding:12px 24px;background:#fff2cc;color:#492e00;border-bottom:2px solid #ca9632;font:600 14px/1.5 Arial,sans-serif">UI PREVIEW — NO LIVE BACKEND · DEV FIXTURES — Dữ liệu và hành động mô phỏng. Không tạo Booking thật. Không phải kết quả API live.</aside>')
  },
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      if (url.searchParams.has('__fixture')) {
        const value = url.searchParams.get('__fixture')
        if (!scenarios.has(value)) { res.statusCode = 400; res.end('Unknown fixture scenario'); return }
        scenario = value
        staleCabin = false
      }
      // Explicit scenario control for a second tab; preserves the first tab's draft.
      // Process-local, single operator only. This never reaches the app or Backend.
      if (url.pathname === '/__fixtures/select') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ preview: 'UI PREVIEW — NO LIVE BACKEND', scenario }))
        return
      }
      if (!url.pathname.startsWith('/api/')) { next(); return }
      // Catch ALL /api paths before Vite's real proxy. Unknown requests fail closed.
      requests.push({ method: req.method, path: url.pathname })
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Ocv-Development-Fixture', 'true')
      const reply = (data, status = 200, message = 'Development fixture only') => {
        res.statusCode = status
        res.end(JSON.stringify({ success: status < 400, data, message, code: status >= 400 ? 'DEV_FIXTURE_ERROR' : undefined }))
      }
      if (scenario === 'loading') await new Promise(resolve => setTimeout(resolve, 1500))
      if (scenario === 'error') { reply(null, 503, 'DEV fixture: API unavailable'); return }
      if (url.pathname.startsWith('/api/auth/')) { reply(null, 401, 'DEV fixture: anonymous'); return }
      if (req.method === 'POST' && url.pathname === '/api/booking') {
        // Simulate only in this labelled local environment. No persistence or BE call.
        if (scenario === 'create-rejected') { reply(null, 409, 'DEV fixture: cabin changed'); return }
        if (scenario === 'create-stale') { staleCabin = true; reply(null, 409, 'DEV fixture: cabin sold out'); return }
        if (scenario === 'create-unknown') { reply(null, 503, 'DEV fixture: unknown write outcome'); return }
        let body = ''
        for await (const chunk of req) { body += chunk; if (body.length > 65536) { reply(null, 413); return } }
        try {
          const draft = JSON.parse(body)
          reply({ ...record, paymentPlan: draft.paymentPlan, currency: draft.currency, passengers: draft.passengers.map((person, i) => ({ ...record.passengers[0], bookingPassengerId: 'dev-' + i, fullName: person.fullName, tourPackageId: person.tourPackageId ?? null, tourPackageName: person.tourPackageId ? pack.name : null })) }, 201)
        } catch { reply(null, 400) }
        return
      }
      if (req.method !== 'GET') { reply(null, 405); return }
      if (url.pathname === '/api/cruise') {
        const rows = scenario === 'empty' ? [] : scenario === 'catalog-pages' ? [cruise, secondCruise] : [cruise]
        const filtered = rows.filter(item => !url.searchParams.get('cruiseType') || item.cruiseType === url.searchParams.get('cruiseType'))
        // Two deterministic catalogue pages; checkout size=100 sees the full list.
        const size = scenario === 'catalog-pages' && Number(url.searchParams.get('size')) < 100 ? 1 : 100
        const number = Math.max(0, Number(url.searchParams.get('page') || 0))
        reply({ content: filtered.slice(number * size, (number + 1) * size), number, totalPages: Math.ceil(filtered.length / size), totalElements: filtered.length }); return
      }
      if (url.pathname === '/api/cruise/' + cruiseId) { reply(cruise); return }
      if (url.pathname === '/api/cruise/' + secondCruise.cruiseId && scenario === 'catalog-pages') { reply(secondCruise); return }
      if (url.pathname === '/api/booking/available-cabins') { reply(scenario === 'cabins-empty' ? [] : [{ ...cabin, remainingCapacity: scenario === 'cabins-sold-out' || staleCabin ? 0 : 2 }, { ...cabin, cabinId: packageId, cabinNumber: '102', remainingCapacity: 0 }]); return }
      if (url.pathname === '/api/servicepackage/packages') { reply(scenario === 'packages-empty' ? [] : [{ ...pack, status: scenario === 'packages-stale' ? 'INACTIVE' : 'ACTIVE' }], scenario === 'package-error' ? 403 : 200); return }
      if (url.pathname === '/api/booking/lookup') {
        if (scenario === 'lookup-not-found') { reply(null, 404, 'DEV internal reference missing'); return }
        if (scenario === 'lookup-unavailable') { reply(null, 502, 'DEV internal upstream unavailable'); return }
        if (scenario === 'lookup-empty') { reply(null); return }
        const match = url.searchParams.get('reference') === record.bookingReference && (url.searchParams.get('email') === 'qa@example.test' || url.searchParams.get('phoneNumber') === '+84900000000'); reply(match && scenario !== 'lookup-mismatch' ? record : null, match && scenario !== 'lookup-mismatch' ? 200 : 403); return
      }
      if (url.pathname === '/api/ships/' + shipId) { reply({ shipId, shipName: cruise.shipName, totalDecks: 2, totalCapacity: 20, status: 'ACTIVE' }); return }
      if (url.pathname === '/api/itineraries') { reply({ content: [], number: 0, totalPages: 0, totalElements: 0 }); return }
      reply(null, 404, 'DEV fixture: no handler for this API path')
    })
  },
}
const server = await createServer({ root, configFile: root + '/vite.config.ts', plugins: [plugin], define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') }, server: { host: '127.0.0.1', port: Number(process.env.CASMS_PREVIEW_PORT || 5177), strictPort: true } })
await server.listen()
server.printUrls()
console.log('DEV FIXTURES ONLY. Scenarios: ?__fixture=' + [...scenarios].join(', '))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { console.log('Fixture requests:', requests.length, '; forwarded to BE: 0'); await server.close(); process.exit(0) })
