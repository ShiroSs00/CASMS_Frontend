import { sourceLoader } from '../helpers/source-loader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'






const completeCruise={cruiseId:'c',cruiseCode:'CR-TEST',cruiseName:'Fixture',cruiseType:'MULTI_DAYS',departurePortId:'a',returnPortId:'b',departureDatetime:'2027-01-01T01:00:00Z',returnDatetime:'2027-01-02T01:00:00Z',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'}
class ApiError extends Error { constructor(message, status, code) { super(message); Object.assign(this, { status, code }) } }
function loader(overrides = {}) { return sourceLoader(overrides, {}); }
const model = () => loader({ '@/shared/api': { ApiError } })('features/cruises/model/departure-contract.ts')
const schedule = { sourceVersionId: 'v', departureDatetime: '2027-01-01T08:00:00Z', returnDatetime: '2027-01-03T08:00:00Z', days: [{ dayNumber: 1, calendarDate: '2027-01-01', shipTimeZoneId: 'Asia/Ho_Chi_Minh', stops: [
  { sourceStopId: 'one', portId: 'same-port', stopOrder: 1, plannedArrival: '2027-01-01T16:00:00Z', plannedDeparture: '2027-01-02T03:00:00Z' },
  { sourceStopId: 'two', portId: 'same-port', stopOrder: 2, plannedArrival: '2027-01-03T01:00:00Z', plannedDeparture: '2027-01-03T02:00:00Z' },
], entries: [] }] }

test('R02 preserves overnight instants, repeated-port occurrences and timezone separately', () => {
  const data = model().decodeSchedule(schedule)
  assert.equal(data.days[0].stops.length, 2)
  assert.notEqual(data.days[0].stops[0].sourceStopId, data.days[0].stops[1].sourceStopId)
  assert.equal(data.days[0].stops[0].plannedDeparture, '2027-01-02T03:00:00Z')
  assert.equal(data.days[0].shipTimeZoneId, 'Asia/Ho_Chi_Minh')
  assert.equal(data.days[0].stops[0].portTimeZoneId, null)
})
test('R02 malformed days, duplicate day IDs and malformed timestamps are not empty success', () => {
  for (const data of [{}, { days: null }, { ...schedule, days: [...schedule.days, ...schedule.days] }, { ...schedule, departureDatetime: 'broken' }]) assert.throws(() => model().decodeSchedule(data), ApiError)
})
test('R04 omitted inventory is unknown, not zero or an empty list', () => {
  const data = model().decodeInventory({ cruiseId: 'c' }, 'c')
  assert.equal(data.remainingCapacity, null); assert.equal(data.physicalCapacity, null); assert.equal(data.cabinTypeInventory, null)
  assert.throws(() => model().decodeInventory({ cruiseId: 'other' }, 'c'), ApiError)
  assert.throws(() => model().decodeInventory({ cruiseId: 'c', remainingCapacity: '0' }, 'c'), ApiError)
})
test('R05 a ready flag alone cannot establish sale readiness; errors are not business blockers', async () => {
  const { decodeSaleReadiness, saleAssessment } = model()
  assert.equal(saleAssessment(null), 'UNKNOWN')
  assert.equal(saleAssessment(decodeSaleReadiness({ cruiseId: 'c', ready: true }, 'c'), 2), 'UNKNOWN')
  const data = decodeSaleReadiness({ cruiseId: 'c', ready: true, cruiseRevision: 2, evaluatedAt: '2027-01-01T00:00:00Z', blockers: [] }, 'c')
  assert.equal(saleAssessment(data, 2), 'UNVERIFIED')
  assert.equal(saleAssessment(data, 3), 'STALE')
  assert.equal(saleAssessment(data, 2, '2027-01-02T00:00:00Z'), 'STALE')
  assert.equal(saleAssessment({ ...data, ready: false }, 2), 'BLOCKED')
  const api = loader({ '@/shared/api': { ApiError, apiRequest: async () => { throw new ApiError('Dependency unavailable', 503) } } })('features/cruises/api/departure-api.ts').departureApi
  await assert.rejects(api.saleReadiness('c'), error => error.status === 503)
})
test('R06 foreign Cruise tasks and malformed task lists are rejected', async () => {
  const api = loader({ '@/shared/api': { ApiError, apiRequest: async () => [{ cruiseId: 'other', taskId: 'x' }] } })('features/cruises/api/departure-api.ts').departureApi
  await assert.rejects(api.tasks('c'), ApiError)
})
test('R06 preview is read-only POST with exact revision; never calls generate, resolve or apply', async () => {
  const calls = [], input = { newDepartureDatetime: '2027-01-01T08:00:00Z', expectedRevision: 7, reason: 'Fixture only' }
  const api = loader({ '@/shared/api': { ApiError, apiRequest: async (path, options) => { calls.push({ path, ...options }); return { cruiseId: 'c', currentRevision: 7, generatedTasks: [{ cruiseId: 'c', taskId: null, title: 'Preview task' }] } } } })('features/cruises/api/departure-api.ts').departureApi
  const result = await api.impact('c', input)
  assert.equal(calls.length, 1); assert.equal(calls[0].path, '/cruise/c/preview-change-impact'); assert.equal(calls[0].method, 'POST'); assert.equal(calls[0].body, input)
  assert.equal(result.generatedTasks[0].taskId, null)
})
test('R02 preview response identity and input instant are verified', async () => {
  let data = schedule
  const calls = [], signal = new AbortController().signal
  const api = loader({ '@/shared/api': { ApiError, apiRequest: async (path, options) => { calls.push({ path, ...options }); return data } } })('features/cruises/api/departure-api.ts').departureApi
  await api.preview('v', schedule.departureDatetime, signal)
  assert.equal(calls[0].body.sourceVersionId, 'v'); assert.equal(calls[0].signal, signal)
  data = { ...schedule, sourceVersionId: 'other' }; await assert.rejects(api.preview('v', schedule.departureDatetime), ApiError)
  data = { ...schedule, departureDatetime: '2027-01-02T00:00:00Z' }; await assert.rejects(api.preview('v', schedule.departureDatetime), ApiError)
})
test('R03 URL roundtrip preserves both source filters and page; no latest-source fallback', () => {
  const query = loader()('features/cruises/model/cruise-query.ts')
  const parsed = query.parseCruiseQuery(new URLSearchParams('sourceTripId=t&sourceVersionId=v&page=3&status=DRAFT'))
  assert.equal(parsed.sourceTripId, 't'); assert.equal(parsed.sourceVersionId, 'v')
  const back = query.parseCruiseQuery(query.serializeCruiseQuery(parsed))
  assert.equal(back.page, 3); assert.equal(back.sourceVersionId, 'v'); assert.equal(query.hasActiveCruiseFilters(back), true)
})
test('R01 draft PATCH carries revision and excludes source/ship mutation fields', async () => {
  const calls = [], draft = { revision: 9, cruiseName: 'Fixture only', sourceVersionId: 'v', shipId: 'ship', departureDatetime: '2027-01-01T08:00', returnDatetime: '2027-01-02T08:00', departurePortId: 'a', returnPortId: 'b' }
  const api = loader({ '@/shared/api': { ApiError, apiRequest: async (path, options) => { calls.push({ path, ...options }); return { ...completeCruise, revision: 10, status: 'DRAFT' } } }, '@/shared/auth': {} })('features/cruises/api/cruise-api.ts').cruiseApi
  const saved = await api.updateCruise('c', draft)
  assert.equal(calls[0].body.expectedRevision, 9); assert.equal(calls[0].body.sourceVersionId, undefined); assert.equal(calls[0].body.shipId, undefined); assert.equal(saved.revision, 10)
})
test('R18 handoff keeps booking, check-in and boarded distinct; missing fields stay unknown', () => {
  const data = model().decodeHandoff({ cruiseId: 'c', confirmedBookingsCount: 2, checkedInPassengersCount: 1, boardedPassengersCount: 0 }, 'c')
  assert.equal(data.confirmedBookingsCount, 2); assert.equal(data.checkedInPassengersCount, 1); assert.equal(data.boardedPassengersCount, 0); assert.equal(data.departureClearanceReady, null)
  assert.equal(data.programId, undefined)
})
test('R14 only active assignments for requested Cruise are selectable; foreign context fails closed', async () => {
  let links = [{ cruiseId: 'c', tourPackageId: 'a', active: true }, { cruiseId: 'c', tourPackageId: 'b', active: false }]
  const api = loader({ '@/shared/api': { ApiError, apiRequest: async path => path.endsWith('/packages') && path.startsWith('/cruise/') ? links : ['a', 'b', 'outside'].map(id => ({ id, name: id, status: 'ACTIVE', price: 20, currency: 'USD' })) }, '@/domain/booking-context': {} })('features/booking/api/real-booking-api.ts').realBookingApi
  assert.deepEqual(Array.from(await api.packagesForCruise('c'), item => item.id), ['a'])
  links = [{ cruiseId: 'other', tourPackageId: 'a', active: true }]; await assert.rejects(api.packagesForCruise('c'), ApiError)
})
test('R14 package preflight rejects out-of-scope payload before booking POST', async () => {
  const calls = []
  const api = loader({ '@/shared/api': { ApiError, apiRequest: async (path, options) => { calls.push({ path, ...options }); return [] } }, '@/domain/booking-context': {} })('features/booking/api/real-booking-api.ts').realBookingApi
  await assert.rejects(api.create({ cruiseId: 'c', currency: 'USD', passengers: [{ tourPackageId: 'outside' }] }), error => error.status === 422)
  assert.ok(calls.every(call => call.method !== 'POST'))
})
test('R09 publish stays on publish path, not sale endpoints', async () => {
  const calls = []
  const api = loader({ '@/shared/api': { ApiError, apiRequest: async path => { calls.push(path); return {} } }, '@/shared/auth': {} })('features/cruises/api/cruise-api.ts').cruiseApi
  await api.publish('c'); assert.deepEqual(calls, ['/cruise/c/publish'])
})
test('R14 translated sale errors remain distinct from sold-out or network errors', () => {
  const { businessErrorMessage } = loader()('shared/api/business-errors.ts')
  assert.match(businessErrorMessage('SALE_SUSPENDED', 'Suspended'), /tạm dừng/)
  assert.match(businessErrorMessage('PACKAGE_NOT_AVAILABLE_FOR_CRUISE', 'Unavailable'), /không còn được áp dụng/)
  assert.match(businessErrorMessage('PACKAGE_NOT_ACTIVE', 'Inactive'), /không còn hoạt động/)
  assert.equal(businessErrorMessage('NETWORK_UNKNOWN', 'Network unavailable'), 'Không thể hoàn tất thao tác. Vui lòng tải lại và thử lại.')
})

test('R02 actual shared query hook cannot apply late A after input/context B, even when transport ignores abort', async () => {
  const states = [], effects = []
  let stateIndex = 0, effectIndex = 0
  const react = {
    useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }] },
    useEffect(effect, deps) { const index = effectIndex++, old = effects[index]; if (!old || deps.some((value, i) => value !== old.deps[i])) { old?.cleanup?.(); effects[index] = { deps, cleanup: effect() } } },
  }
  const { useReadQuery } = loader({ react })('shared/api/useReadQuery.ts')
  function render(key, load) { stateIndex = 0; effectIndex = 0; return useReadQuery(key, load) }
  let resolveA, resolveB, signalA
  const loadA = signal => { signalA = signal; return new Promise(resolve => { resolveA = resolve }) }
  const loadB = () => new Promise(resolve => { resolveB = resolve })
  render('sourceA:departureA', loadA)
  assert.equal(render('sourceB:departureB', loadB).data, null)
  assert.equal(signalA.aborted, true)
  resolveB({ sourceVersionId: 'B' }); await new Promise(resolve => setImmediate(resolve))
  assert.equal(render('sourceB:departureB', loadB).data.sourceVersionId, 'B')
  resolveA({ sourceVersionId: 'A' }); await new Promise(resolve => setImmediate(resolve))
  assert.equal(render('sourceB:departureB', loadB).data.sourceVersionId, 'B')
  effects.forEach(effect => effect.cleanup?.())
})

test('R01 stale draft rejection preserves caller input and does not retry on a new revision', async () => {
  const calls = [], draft = { revision: 4, cruiseName: 'Unsaved fixture', departureDatetime: '2027-01-01T08:00', returnDatetime: '2027-01-02T08:00', departurePortId: 'a', returnPortId: 'b' }, before = JSON.stringify(draft)
  const api = loader({ '@/shared/api': { ApiError, apiRequest: async (path, options) => { calls.push({ path, ...options }); throw new ApiError('Stale', 409, 'STALE_REVISION') } }, '@/shared/auth': {} })('features/cruises/api/cruise-api.ts').cruiseApi
  await assert.rejects(api.updateCruise('c', draft), error => error.code === 'STALE_REVISION')
  assert.equal(JSON.stringify(draft), before); assert.equal(calls.length, 1); assert.equal(calls[0].body.expectedRevision, 4)
})

test('R01 malformed or foreign PATCH success is unknown outcome, not saved navigation', async () => {
  const draft = { revision: 4, cruiseName: 'Fixture', departureDatetime: '2027-01-01T08:00', returnDatetime: '2027-01-02T08:00', departurePortId: 'a', returnPortId: 'b' }
  for (const response of [{}, { cruiseId: 'other', status: 'DRAFT' }]) {
    const api = loader({ '@/shared/api': { ApiError, apiRequest: async () => response }, '@/shared/auth': {} })('features/cruises/api/cruise-api.ts').cruiseApi
    await assert.rejects(api.updateCruise('c', draft), error => error.status === 502)
  }
})

test('R01 renaming a loaded draft does not rewrite seconds or unchanged ports through minute inputs', async () => {
  const calls = [], original = { cruiseId: 'c', revision: 4, departureDatetime: '2027-01-01T01:00:37Z', returnDatetime: '2027-01-02T01:00:48Z', departurePortId: 'a', returnPortId: 'b' }
  const draft = { ...original, cruiseName: 'Changed fixture', departureDatetime: '2027-01-01T08:00', returnDatetime: '2027-01-02T08:00' }
  const api = loader({ '@/shared/api': { ApiError, apiRequest: async (path, options) => { calls.push(options.body); return { ...completeCruise,...original, status: 'DRAFT', revision: 5 } } }, '@/shared/auth': {} })('features/cruises/api/cruise-api.ts').cruiseApi
  await api.updateCruise('c', draft, original)
  assert.equal(calls[0].expectedRevision, 4); assert.equal(calls[0].cruiseName, 'Changed fixture')
  for (const key of ['departureDatetime', 'returnDatetime', 'departurePortId', 'returnPortId']) assert.equal(calls[0][key], undefined)
  await api.updateCruise('c', { ...draft, returnDatetime: '2027-01-03T08:00' }, original)
  assert.equal(calls[1].returnDatetime, '2027-01-03T01:00:00.000Z')
})
