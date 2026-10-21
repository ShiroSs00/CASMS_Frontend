import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
const root = new URL('../../src/', import.meta.url)
function load(file, imports = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, { module, exports: module.exports, Date, require(id) { assert.ok(Object.hasOwn(imports, id), id); return imports[id] } })
  return module.exports
}
test('Activity guards reflect BE lifecycle and checkout does not skip completion', () => {
  const model = load('features/activities/model/activity-actions.ts'), parent = { status: 'OPEN', startTime: '2026-10-22T10:00:00Z', endTime: '2026-10-22T11:00:00Z' }, now = Date.parse('2026-10-21T10:00:00Z')
  assert.equal(model.activityActions(parent, now).includes('start'), false)
  assert.equal(model.activityActions({ ...parent, status: 'PLANNED' }, now).includes('open'), true)
  assert.equal(model.activityActions({ ...parent, status: 'CANCELLED' }, now).length, 0)
  assert.equal(model.attendanceActions({ status: 'REGISTERED' }, parent, now).length, 0)
  assert.equal(model.attendanceActions({ status: 'CHECKED_IN' }, parent, now)[0], 'checkout')
  assert.equal(model.attendanceActions({ status: 'IN_PROGRESS' }, parent, now)[0], 'complete')
  assert.equal(model.attendanceActions({ status: 'REGISTERED' }, { ...parent, status: 'IN_PROGRESS' }, now)[0], 'check-in')
})
test('Activity registration/participation adapters use exact methods, query and strict envelopes (unit only)', async () => {
  const calls = [], registration = { id: 'r', bookingPassengerId: 'bp', activityId: 'a', quantity: 1, status: 'PENDING' }
  let response = registration, status = 200
  class ApiError extends Error {}
  const { activityApi: api } = load('features/activities/api/activity-api.ts', { '@/shared/api': { ApiError, apiRequestRaw: async (path, decode, options) => { calls.push({ path, options }); return decode({ success: true, data: response }, status) } } })
  await api.register('excursions', 'e', 'bp', 2); assert.equal(calls.at(-1).path, '/activities/excursions/e/registrations'); assert.equal(calls.at(-1).options.body.quantity, 2)
  await api.updateRegistration('r', 3, 'ghi chú'); assert.equal(calls.at(-1).options.method, 'PUT'); assert.equal(calls.at(-1).options.body.notes, 'ghi chú')
  await api.registrationAction('r', 'cancel', 'lý do'); assert.equal(calls.at(-1).options.query.reason, 'lý do')
  response = { id: 'p', registrationId: 'r', status: 'IN_PROGRESS' }; await api.attendance('p', 'checkout'); assert.equal(calls.at(-1).path, '/activities/participations/p/checkout')
  response = {}; await assert.rejects(api.registration('r'), /đăng ký/)
  status = 204; await api.remove('a'); assert.equal(calls.at(-1).options.method, 'DELETE')
})
const passenger = { fullName: 'Nguyen Van QA', dateOfBirth: '1990-01-01', nationality: 'VN', documentType: '', documentNumber: '', email: 'qa@example.test', phoneNumber: '', cabinId: 'c', tourPackageId: '' }
const draft = { cruiseId: 'cr', currency: 'USD', paymentPlan: 'DEPOSIT', notes: '', passengers: [passenger] }
const cruise = { cruiseId: 'cr', status: 'PUBLISHED', shipId: 's', departureDatetime: '2026-11-01T00:00:00Z' }, cabins = [{ cabinId: 'c', cabinNumber: '101', capacity: 2, remainingCapacity: 1 }]
const context = load('domain/booking-context/booking-context-api.ts', { '@/shared/api': {} })
test('Booking validates actual eligible Cruise, grouped available capacity, representative contact and DTO boundaries', () => {
  const api = load('features/booking/api/real-booking-api.ts', { '@/shared/api': {}, '@/domain/booking-context': context })
  const now = Date.parse('2026-10-20T00:00:00Z')
  assert.equal(api.validateBooking(draft, cruise, cabins, now).length, 0)
  for (const changed of [{ passengers: [passenger, passenger] }, { passengers: [{ ...passenger, email: '' }] }, { currency: 'invalid' }, { passengers: [{ ...passenger, cabinId: 'unknown' }] }]) assert.ok(api.validateBooking({ ...draft, ...changed }, cruise, cabins, now).length)
  assert.ok(api.validateBooking(draft, { ...cruise, status: 'DRAFT' }, cabins, now).length)
  assert.ok(api.validateBooking(draft, cruise, null, now).length)
  const body = api.serializeBooking({ ...draft, creatorId: 'forged', passengers: [{ ...passenger, price: 0, passengerId: 'forged' }] })
  assert.equal(body.creatorId, undefined); assert.equal(body.passengers[0].price, undefined); assert.equal(body.passengers[0].passengerId, undefined)
})
test('Booking real API preserves page structure, filters, response identity, guest lookup and exact write bodies', async () => {
  const calls = []; let value = { content: [], totalPages: 0, totalElements: 0 }
  const api = load('features/booking/api/real-booking-api.ts', { '@/domain/booking-context': context, '@/shared/api': { apiRequest: async (path, options) => { calls.push({ path, options }); return value } } }).realBookingApi
  assert.equal((await api.list(0, 'Draft', 'cr')).content.length, 0); assert.equal(calls.at(-1).options.query.cruiseId, 'cr')
  value = { bookingId: 'b', bookingReference: 'BK-QA', bookingStatus: 'Draft', cruiseId: 'cr', cruiseName: 'Cruise QA', passengers: [], agreedFareAmount: 100, currency: 'USD', paymentPlan: 'DEPOSIT', requiredDepositAmount: 30, installments: [] }
  assert.equal((await api.get('b')).bookingId, 'b'); await assert.rejects(api.get('wrong'), /Không đúng/)
  await api.lookup(' BK-QA ', 'qa@example.test', ''); assert.equal(calls.at(-1).options.query.reference, 'BK-QA'); assert.equal(calls.at(-1).options.query.phoneNumber, undefined)
  await api.create(draft); assert.equal(calls.at(-1).options.method, 'POST'); assert.equal(calls.at(-1).path, '/booking')
  await api.cancel('b', ' reason '); assert.equal(calls.at(-1).options.body.reason, 'reason')
  await api.changeCabin('bp', 'new-cabin', ''); assert.equal(calls.at(-1).options.body.bookingPassengerId, 'bp'); assert.equal(calls.at(-1).options.body.newCabinId, 'new-cabin')
})

test('Authoritative session permissions fail closed: ADMIN role alone, missing permissions and failed session grant nothing',()=>{
 const auth=load('shared/auth/session-access.ts',{react:{useSyncExternalStore:(_subscribe,get)=>get()}})
 assert.throws(()=>auth.decodeSessionAccess({userId:'u',roles:['ADMIN']}),/không đầy đủ/)
 auth.setSessionAccess({status:'error',userId:'u',permissions:['BOOKING_UPDATE'],error:'HTTP failure'});assert.equal(auth.useSessionAccess().has('BOOKING_UPDATE'),false)
 auth.setSessionAccess(auth.decodeSessionAccess({userId:'u',effectivePermissions:['BOOKING_READ']}));assert.equal(auth.useSessionAccess().has('BOOKING_READ'),true);assert.equal(auth.useSessionAccess().has('BOOKING_UPDATE'),false)
 auth.setSessionAccess({status:'anonymous',userId:null,permissions:[],error:''});assert.equal(auth.useSessionAccess().has('BOOKING_READ'),false)
})
