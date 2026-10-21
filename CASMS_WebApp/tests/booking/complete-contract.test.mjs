import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../../src/features/booking/api/customer-extras-api.ts', import.meta.url), 'utf8')
const activity = { id: 'a', name: 'Fixture activity', cruiseId: 'cr', startTime: '2099-01-01T01:00:00Z', endTime: '2099-01-01T02:00:00Z', capacity: 10, price: null, currencyCode: null, status: 'OPEN' }
const registration = { id: 'r', passengerId: 'p', bookingPassengerId: 'bp', activityId: 'a', excursionId: null, quantity: 1, status: 'PENDING', registeredAt: '2099-01-01T00:00:00Z' }
const service = { id: 's', name: 'Fixture service', type: 'Dining', price: 12.5, currency: 'USD', capacity: null, status: 'ACTIVE' }
const request = { id: 'q', passengerId: 'p', serviceId: 's', bookingId: 'b', bookingPassengerId: 'bp', quantity: 1, note: '', status: 'REQUESTED', requestTime: '2099-01-01T00:00:00Z', completedAt: null }
const pack = { id: 'p', code: 'PK', name: 'Fixture package', description: '', type: 'PREMIUM', price: 20.1234, currency: 'USD', status: 'ACTIVE', startDate: '2099-01-01', endDate: null }
function setup() {
  const calls = [], module = { exports: {} }; let response
  const request = async (path, options) => { calls.push({ path, ...options }); if (response instanceof Error) throw response; return response }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, { module, exports: module.exports, Date, require: id => { assert.equal(id, '@/shared/api'); return { apiRequest: request, apiRequestRaw: async (path, decode, options) => decode(await request(path, options), 200) } } })
  return { api: module.exports.customerExtrasApi, decode: module.exports, calls, set: value => { response = value } }
}
test('Complete: public package detail follows exact DTO, dates, identity, nulls and abort contract', async () => {
  const s = setup(), signal = new AbortController().signal
  s.set(pack); assert.equal((await s.api.package('p', signal)).price, 20.1234)
  assert.equal(s.calls[0].path, '/servicepackage/packages/p'); assert.equal(s.calls[0].signal, signal)
  for (const changed of [{ id: 'wrong' }, { price: '20' }, { currency: 'BADCODE' }, { type: 'invented' }, { startDate: '2099-02-30' }]) { s.set({ ...pack, ...changed }); await assert.rejects(s.api.package('p')) }
  s.set(new Error('403')); await assert.rejects(s.api.package('p'), /403/)
})
test('Complete: excursion raw DTO/list/detail/availability/registration verify known stop, exact quantity query and owner result', async () => {
  const s = setup(), a = s.api, signal = new AbortController().signal
  const excursion = { shoreExcursionId: 'e', cruiseStopId: 'stop', excursionName: 'Fixture excursion', startTime: activity.startTime, plannedReturnTime: activity.endTime, meetingPoint: '', maximumCapacity: 20, availableCapacity: 15, price: 0, currencyCode: 'VND', status: 'OPEN' }
  s.set([excursion]); assert.equal((await a.excursions('stop', signal))[0].id, 'e'); assert.equal(s.calls.at(-1).path, '/shore-excursions'); assert.equal(s.calls.at(-1).query.cruiseStopId, 'stop'); assert.equal(s.calls.at(-1).query.status, 'OPEN'); assert.equal(s.calls.at(-1).signal, signal)
  s.set(excursion); await a.excursion('e', 'stop', signal); assert.equal(s.calls.at(-1).path, '/shore-excursions/e')
  await a.excursionAvailability('e', 'stop', 2, signal); assert.equal(s.calls.at(-1).path, '/shore-excursions/e/availability'); assert.equal(s.calls.at(-1).query.participants, 2)
  await assert.rejects(a.excursion('e', 'foreign'), /điểm dừng/); await assert.rejects(a.excursionAvailability('e', 'stop', 16), /khớp/)
  s.set({ success: true, data: excursion }); await assert.rejects(a.excursion('e', 'stop'))
  s.set({ ...registration, activityId: null, excursionId: 'e', quantity: 2 }); await a.registerExcursion('e', 'bp', 2); assert.equal(s.calls.at(-1).path, '/activities/excursions/e/registrations'); assert.equal(s.calls.at(-1).method, 'POST'); assert.equal(JSON.stringify(s.calls.at(-1).body), JSON.stringify({ bookingPassengerId: 'bp', quantity: 2 }))
  s.set({ ...registration, activityId: null, excursionId: 'foreign' }); await assert.rejects(a.registerExcursion('e', 'bp', 1), /khớp/)
})
test('Complete: activity catalog is complete-list client-filtered, detail and availability reject cross-cruise/stale identity', async () => {
  const s = setup(), signal = new AbortController().signal
  s.set([activity, { ...activity, id: 'other', cruiseId: 'another' }]); assert.equal((await s.api.activities('cr', signal)).length, 1)
  assert.equal(s.calls.at(-1).path, '/activities'); assert.equal(s.calls.at(-1).query, undefined); assert.equal(s.calls.at(-1).signal, signal)
  s.set(activity); await s.api.activity('a', 'cr', signal); assert.equal(s.calls.at(-1).path, '/activities/a')
  await assert.rejects(s.api.activity('a', 'other'), /chuyến/)
  s.set({ activityId: 'a', capacity: 10, availableSeats: 2, status: 'OPEN' }); assert.equal((await s.api.activityAvailability('a', signal)).availableSeats, 2); assert.equal(s.calls.at(-1).path, '/activities/a/availability')
  s.set({ activityId: 'a', capacity: 10, availableSeats: 11, status: 'OPEN' }); await assert.rejects(s.api.activityAvailability('a'))
  s.set([activity, { ...activity, status: 'PAID' }]); await assert.rejects(s.api.activities('cr'))
})
test('Complete: all six registration reads/writes use source routes, exact bodies and authoritative states', async () => {
  const s = setup(), a = s.api, signal = new AbortController().signal
  s.set([registration]); assert.equal((await a.registrations(signal)).length, 1); assert.equal(s.calls.at(-1).path, '/activities/registrations')
  s.set(registration); await a.registration('r', signal); assert.equal(s.calls.at(-1).path, '/activities/registrations/r')
  s.set({ ...registration, quantity: 2 }); await a.registerActivity('a', 'bp', 2); assert.equal(s.calls.at(-1).path, '/activities/a/registrations'); assert.equal(s.calls.at(-1).method, 'POST'); assert.equal(JSON.stringify(s.calls.at(-1).body), JSON.stringify({ bookingPassengerId: 'bp', quantity: 2 }))
  s.set({ ...registration, status: 'CONFIRMED' }); assert.equal((await a.confirmRegistration('r')).status, 'CONFIRMED'); assert.equal(s.calls.at(-1).path, '/activities/registrations/r/confirm')
  s.set({ ...registration, quantity: 3 }); await a.updateRegistration('r', 3, ' note '); assert.equal(s.calls.at(-1).method, 'PUT'); assert.equal(JSON.stringify(s.calls.at(-1).body), JSON.stringify({ quantity: 3, notes: 'note' }))
  s.set({ ...registration, status: 'CANCELLED' }); await a.cancelRegistration('r', ' reason '); assert.equal(s.calls.at(-1).path, '/activities/registrations/r/cancel'); assert.equal(s.calls.at(-1).query.reason, 'reason'); assert.equal(s.calls.at(-1).body, undefined)
  s.set({ ...registration, bookingPassengerId: 'wrong' }); await assert.rejects(a.registerActivity('a', 'bp', 1), /khớp/)
  s.set({ ...registration, activityId: null, excursionId: 'e' }); assert.equal((await a.registration('r')).excursionId, 'e')
  s.set({ ...registration, excursionId: 'e' }); await assert.rejects(a.registration('r'))
  s.set(registration); await assert.rejects(a.confirmRegistration('r'), /chưa khớp/); await assert.rejects(a.cancelRegistration('r', ''), /chưa khớp/); await assert.rejects(a.updateRegistration('r', 2, ''), /chưa khớp/)
  const before = s.calls.length; await assert.rejects(a.registerActivity('a', 'bp', 0)); await assert.rejects(a.updateRegistration('r', 1, 'x'.repeat(501))); assert.equal(s.calls.length, before)
})
test('Complete: service catalog/detail/availability retain null prices, source currency field and requested quantity', async () => {
  const s = setup(), signal = new AbortController().signal
  s.set([service, { ...service, id: 'inactive', status: 'INACTIVE' }]); assert.equal((await s.api.services(signal)).length, 1); assert.equal(s.calls.at(-1).path, '/servicepackage/services')
  s.set(service); assert.equal((await s.api.service('s', signal)).currency, 'USD'); assert.equal(s.calls.at(-1).path, '/servicepackage/services/s')
  s.set({ serviceId: 's', requestedQuantity: 2, available: false }); assert.equal(await s.api.serviceAvailability('s', 2, signal), false); assert.equal(s.calls.at(-1).path, '/servicepackage/services/s/availability'); assert.equal(s.calls.at(-1).query.quantity, 2)
  await assert.rejects(s.api.serviceAvailability('s', 1), /khớp/)
  s.set({ ...service, price: null, currency: null }); assert.equal((await s.api.service('s')).price, null)
})
test('Complete: service request list/detail/create/update/cancel include owner context and no staff actions', async () => {
  const s = setup(), a = s.api, signal = new AbortController().signal
  s.set([request]); assert.equal((await a.requests(signal)).length, 1); assert.equal(s.calls.at(-1).path, '/servicepackage/requests')
  s.set(request); await a.request('q', signal); assert.equal(s.calls.at(-1).path, '/servicepackage/requests/q')
  s.set({ ...request, quantity: 2 }); await a.createRequest('s', 'bp', 2, ' new '); assert.equal(s.calls.at(-1).method, 'POST'); assert.equal(JSON.stringify(s.calls.at(-1).body), JSON.stringify({ serviceId: 's', bookingPassengerId: 'bp', quantity: 2, note: 'new' }))
  s.set({ ...request, quantity: 3 }); await a.updateRequest('q', 3, ' updated '); assert.equal(s.calls.at(-1).method, 'PUT'); assert.equal(JSON.stringify(s.calls.at(-1).body), JSON.stringify({ quantity: 3, note: 'updated' }))
  s.set({ ...request, status: 'CANCELLED' }); assert.equal((await a.cancelRequest('q')).status, 'CANCELLED'); assert.equal(s.calls.at(-1).path, '/servicepackage/requests/q/cancel'); assert.equal(s.calls.at(-1).body, undefined)
  s.set({ ...request, serviceId: 'wrong' }); await assert.rejects(a.createRequest('s', 'bp', 1, ''), /khớp/)
  s.set({ ...request, status: 'PAID' }); await assert.rejects(a.request('q'))
  s.set(request); await assert.rejects(a.cancelRequest('q'), /chưa khớp/); await assert.rejects(a.updateRequest('q', 2, ''), /chưa khớp/)
  assert.equal(s.calls.some(call => call.path.includes('/actions/')), false)
})
