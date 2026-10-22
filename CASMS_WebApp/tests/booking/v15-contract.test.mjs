import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const root = new URL('../../src/', import.meta.url)
function load(file, imports = {}, globals = {}, dev = false) {
  const module = { exports: {} }
  const source = readFileSync(new URL(file, root), 'utf8').replaceAll('import.meta.env.DEV', String(dev))
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, { module, exports: module.exports, URLSearchParams, Date, AbortController, structuredClone, ...globals, require(id) { assert.ok(Object.hasOwn(imports, id), id); return imports[id] } })
  return module.exports
}
const cruiseId = '11111111-2222-3333-4444-555555555555', shipId = '99999999-8888-7777-6666-555555555555', itineraryId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'
const cruise = { cruiseId, shipId, cruiseName: 'Contract voyage', status: 'PUBLISHED', departureDatetime: '2099-11-01T00:00:00Z', returnDatetime: '2099-11-03T00:00:00Z' }
const detail = { bookingId: 'b', bookingReference: 'BK-CONTRACT', bookingStatus: 'Draft', cruiseId, cruiseName: cruise.cruiseName, passengers: [], agreedFareAmount: 125.1234, currency: 'USD', requiredDepositAmount: 37.537, paymentPlan: 'DEPOSIT', contractStatus: 'Draft', installments: [] }
const passenger = { fullName: ' Contract guest ', dateOfBirth: '', nationality: '', documentType: '', documentNumber: '', email: 'qa@example.test', phoneNumber: '', cabinId: 'c', tourPackageId: '' }
const draft = { cruiseId, currency: 'USD', paymentPlan: 'DEPOSIT', notes: ' note ', passengers: [passenger] }
const context = load('domain/booking-context/booking-context-api.ts', { '@/shared/api': {} })
function booking() {
  const calls = []; let response = detail
  const api = load('features/booking/api/real-booking-api.ts', { '@/domain/booking-context': context, '@/shared/api': { apiRequest: async (path, options) => { calls.push({ path, options }); return response } } })
  return { ...api, calls, set(value) { response = value } }
}

test('V15 catalog contracts cover every detail supplement, exact parent IDs, public filter/page and abort signal', async () => {
  const calls = [], signal = new AbortController().signal
  let response = { content: [cruise], number: 1, totalPages: 2, totalElements: 2 }
  const published = load('features/booking/api/live-cruise-contract.ts')
  const itinerary = load('features/booking/api/live-itinerary-contract.ts', { './live-cruise-contract.ts': published })
  const { liveCruiseCatalogApi: api } = load('features/booking/api/booking-api.ts', { './live-cruise-contract': published, './live-itinerary-contract': itinerary, '@/shared/api': { apiRequest: async (path, options) => { calls.push({ path, options }); return response } } })
  assert.equal((await api.list(2, signal, 'ONE_DAY')).page, 2)
  assert.equal(calls.at(-1).options.query.page, 1); assert.equal(calls.at(-1).options.query.cruiseType, 'ONE_DAY'); assert.equal(calls.at(-1).options.query.status, 'PUBLISHED')
  response = cruise; await api.detail(cruiseId, signal); assert.equal(calls.at(-1).path, '/cruise/' + cruiseId)
  response = { ...cruise, cruiseId: shipId }; await assert.rejects(api.detail(cruiseId), /khớp/)
  const before = calls.length; assert.equal(await api.detail('illustrative-slug'), null); assert.equal(calls.length, before)
  response = { shipId, shipName: 'Ship', totalCapacity: 20, totalDecks: 2 }; await api.ship(shipId, signal); assert.equal(calls.at(-1).path, '/ships/' + shipId)
  response = { content: [{ itineraryId, cruiseId, itineraryName: 'Plan' }], number: 0, totalPages: 1 }; assert.equal((await api.itinerary(cruiseId, signal)).kind, 'found'); assert.equal(calls.at(-1).path, '/itineraries')
  response = [{ itineraryDayId: shipId, itineraryId, dayNumber: 1 }]; await api.days(itineraryId, signal); assert.equal(calls.at(-1).path, '/itineraries/' + itineraryId + '/days')
  response = [{ cruiseStopId: shipId, itineraryId, stopOrder: 1 }]; await api.stops(itineraryId, signal); assert.equal(calls.at(-1).path, '/cruise-stops/by-itinerary/' + itineraryId)
  for (const call of calls.filter(call => call.options?.signal)) assert.equal(call.options.signal, signal)
  response = [{ cruiseStopId: shipId, itineraryId: cruiseId }]; await assert.rejects(api.stops(itineraryId), /không thuộc/)
})

test('V15 Booking contracts cover all eight endpoints, request mapping and exact response identities', async () => {
  const s = booking(), api = s.realBookingApi, signal = new AbortController().signal
  s.set({ content: [{ ...detail, passengerCount: 2, departureDatetime: cruise.departureDatetime }], number: 1, totalPages: 2, totalElements: 22 })
  const page = await api.list(1, 'Draft', cruiseId, signal)
  assert.equal(page.content[0].agreedFareAmount, 125.1234); assert.equal(page.content[0].passengerCount, 2)
  assert.equal(s.calls.at(-1).path, '/booking'); assert.equal(s.calls.at(-1).options.query.size, 20); assert.equal(s.calls.at(-1).options.query.status, 'Draft'); assert.equal(s.calls.at(-1).options.query.cruiseId, cruiseId)
  s.set(detail); await api.get('b', signal); assert.equal(s.calls.at(-1).path, '/booking/b')
  await api.lookup(' BK-CONTRACT ', '', ' +84900000000 ', signal); assert.equal(s.calls.at(-1).path, '/booking/lookup'); assert.equal(s.calls.at(-1).options.query.email, undefined); assert.equal(s.calls.at(-1).options.query.phoneNumber, '+84900000000')
  await api.create({ ...draft, creatorId: 'ignored', passengers: [{ ...passenger, price: 0 }] }); const create = s.calls.at(-1)
  assert.equal(create.path, '/booking'); assert.equal(create.options.method, 'POST'); assert.equal(create.options.body.creatorId, undefined); assert.equal(create.options.body.passengers[0].price, undefined); assert.equal(create.options.body.passengers[0].fullName, 'Contract guest'); assert.equal(create.options.body.notes, 'note')
  await api.confirm('b'); assert.equal(s.calls.at(-1).path, '/booking/b/confirm'); assert.equal(s.calls.at(-1).options.method, 'POST')
  await api.cancel('b', ' reason '); assert.equal(s.calls.at(-1).path, '/booking/b/cancel'); assert.equal(s.calls.at(-1).options.body.reason, 'reason')
  await api.changeCabin('bp', 'new', ' change '); assert.equal(s.calls.at(-1).path, '/booking/change-cabin'); assert.equal(s.calls.at(-1).options.body.newCabinId, 'new'); assert.equal(s.calls.at(-1).options.body.changeReason, 'change')
  s.set([{ cabinId: 'c', cabinNumber: '101', capacity: 2, remainingCapacity: 1, deckId: null, deckNumber: null, deckName: null, isAccessible: null, estimatedPrice: 125.1234, priceMultiplier: 1.15 }])
  const cabins = await api.cabins(cruiseId, signal, { cabinType: 'SUITE', minCapacity: 1 }); assert.equal(cabins[0].estimatedPrice, 125.1234); assert.equal(s.calls.at(-1).path, '/booking/available-cabins'); assert.equal(s.calls.at(-1).options.query.cabinType, 'SUITE')
  s.set([{ id: 'p', name: 'Package', status: 'ACTIVE', price: 20.1234, currency: 'USD' }, { id: 'q', name: 'Old', status: 'INACTIVE', price: 0, currency: 'USD' }]); assert.equal((await api.packages(signal)).length, 1); assert.equal(s.calls.at(-1).path, '/servicepackage/packages')
  s.set({ content: [cruise], totalPages: 1 }); assert.equal((await api.cruises(signal))[0].cruiseId, cruiseId)
  s.set({ ...detail, bookingReference: 'OTHER' }); await assert.rejects(api.lookup('BK-CONTRACT', 'qa@example.test', ''), /khớp/)
  s.set({ ...detail, cruiseId: 'OTHER' }); await assert.rejects(api.create(draft), /kiểm tra kết quả/)
})

test('V15 DTOs accept source nulls while rejecting fabricated payment status, wrong pages and invalid reference amounts', async () => {
  const s = booking(), api = s.realBookingApi
  assert.equal(s.decodeBookingDetail({ ...detail, paymentPlan: null, contractStatus: null, departureDatetime: null, finalPaymentDueAt: null }).paymentPlan, null)
  const profile = s.decodeBookingDetail({ ...detail, passengers: [{ bookingPassengerId: 'bp', passengerId: 'p', fullName: 'QA', participationStatus: 'Active', dateOfBirth: '1990-01-01', email: 'qa@example.test', documentNumber: 'PROTECTED_NOT_FOR_UI' }] }).passengers[0]
  assert.equal(profile.email, 'qa@example.test'); assert.equal(profile.dateOfBirth, '1990-01-01'); assert.equal(profile.documentNumber, undefined)
  for (const changes of [{ contractStatus: 'SIGNED' }, { paymentPlan: 'PAID' }, { installments: [{ sequenceNo: 1, requiredAmount: 10, currency: 'USD', status: 'Paid', installmentType: 'Deposit' }] }]) assert.throws(() => s.decodeBookingDetail({ ...detail, ...changes }))
  s.set({ content: [], number: 2, totalPages: 3, totalElements: 30 }); await assert.rejects(api.list(1), /trang/)
  s.set([{ cabinId: 'c', cabinNumber: '101', capacity: 2, remainingCapacity: 1, estimatedPrice: -1 }]); await assert.rejects(api.cabins(cruiseId), /giá tham chiếu/)
  s.set({ content: [{ ...detail, agreedFareAmount: '125' }], totalPages: 1, totalElements: 1 }); await assert.rejects(api.list(0), /tóm tắt/)
})

test('V15 legacy fixtures require explicit DEV preview and are absent from canonical route adapters', async () => {
  const imports = { '../model/booking-fixtures': { cruiseFixtures: [], bookingFixtures: [] }, '../model/cruise-search': {}, '../model/booking-scenarios': {} }
  for (const [dev, search] of [[false, '?preview=1'], [true, '']]) {
    const api = load('features/booking/api/booking-preview-api.ts', imports, { location: { search } }, dev).bookingApi
    await assert.rejects(api.listCruises(), /explicit development/)
  }
  const api = load('features/booking/api/booking-preview-api.ts', imports, { location: { search: '?preview=1' } }, true).bookingApi
  assert.equal((await api.listCruises()).length, 0)
  for (const file of ['api/booking-api.ts', 'model/booking-state.ts', 'pages/DiscoveryPages.tsx', 'pages/FlowPages.tsx', 'pages/ManagementPages.tsx']) {
    const source = readFileSync(new URL('features/booking/' + file, root), 'utf8')
    assert.doesNotMatch(source, /booking-fixtures|UI_WITH_TYPED_ADAPTER|booking-preview-api|BookingManagement|BookingFlow/)
  }
})

test('V15 async adapter hides previous data immediately when request identity changes and aborts retired requests', async () => {
  const values = []; let cursor = 0, effect, cleanup
  const react = { useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value }] }, useEffect(fn) { effect = fn } }
  const { useAdapterData } = load('features/booking/model/booking-state.ts', { react })
  const render = fn => { cursor = 0; return useAdapterData(fn) }
  let resolve, oldSignal
  const old = signal => { oldSignal = signal; return Promise.resolve('old') }
  render(old); cleanup = effect(); await new Promise(yes => setImmediate(yes)); assert.equal(render(old).data, 'old')
  const next = () => new Promise(yes => { resolve = yes })
  assert.equal(render(next).data, undefined); assert.equal(render(next).loading, true)
  cleanup(); assert.equal(oldSignal.aborted, true); cleanup = effect(); resolve('new'); await new Promise(yes => setImmediate(yes)); assert.equal(render(next).data, 'new'); cleanup()
})
