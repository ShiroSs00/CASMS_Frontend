import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Opt-in only: requires the isolated, seeded casms_mobile_qa database.
const enabled = process.env.CASMS_LIVE_QA === 'casms_mobile_qa'
const base = process.env.CASMS_LIVE_API_URL || 'http://127.0.0.1:5175/api'
const root = new URL('../../src/', import.meta.url)
function load(file, imports = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, { module, exports: module.exports, Date, require: id => { assert.ok(Object.hasOwn(imports, id), id); return imports[id] } })
  return module.exports
}
class ApiError extends Error { constructor(message, status) { super(message); this.status = status } }

test('live QA: public supplements and package benefits; authenticated booking create, lookup and cancel through FE proxy', { skip: !enabled }, async t => {
  assert.equal(new URL(base).hostname, '127.0.0.1')
  assert.ok(process.env.CASMS_QA_USERNAME && process.env.CASMS_QA_PASSWORD, 'Supply the seeded QA account through environment variables')
  let token = null, created
  const calls = []
  async function request(path, options = {}) {
    const query = new URLSearchParams(Object.entries(options.query ?? {}).filter(([, value]) => value !== undefined))
    const response = await fetch(base + path + (query.size ? '?' + query : ''), {
      method: options.method ?? 'GET', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    calls.push({ method: options.method ?? 'GET', path, status: response.status })
    const envelope = await response.json()
    if (!response.ok || !envelope.success) throw new ApiError(envelope.message || 'API rejected request', response.status)
    return envelope.data
  }
  const published = load('features/booking/api/live-cruise-contract.ts')
  const itinerary = load('features/booking/api/live-itinerary-contract.ts', { './live-cruise-contract.ts': published })
  const { liveCruiseCatalogApi: catalog } = load('features/booking/api/booking-api.ts', { '@/shared/api': { apiRequest: request }, './live-cruise-contract': published, './live-itinerary-contract': itinerary })
  const { customerExtrasApi: extras } = load('features/booking/api/customer-extras-api.ts', { '@/shared/api': { apiRequest: request } })
  const context = load('domain/booking-context/booking-context-api.ts', { '@/shared/api': {} })
  const { realBookingApi: booking } = load('features/booking/api/real-booking-api.ts', { '@/shared/api': { apiRequest: request, ApiError }, '@/domain/booking-context': context })
  const page = await catalog.list(1)
  const cruise = page.items.find(item => item.code === 'QA-ASIA-2027')
  assert.ok(cruise, 'Refuse writes unless the known QA cruise is present')
  assert.equal((await catalog.ship(cruise.shipId)).name, 'OceVie Horizon')
  const plan = await catalog.itinerary(cruise.id)
  assert.equal(plan.kind, 'found')
  assert.equal((await catalog.days(plan.itinerary.id)).length, 4)
  assert.equal((await catalog.stops(plan.itinerary.id)).length, 4)
  const packages = await booking.packages(), pack = packages.find(item => item.currency === 'USD')
  assert.ok(pack)
  assert.ok((await extras.packageBenefits(pack.id)).benefits.length)
  const login = await request('/auth/login', { method: 'POST', body: { username: process.env.CASMS_QA_USERNAME, password: process.env.CASMS_QA_PASSWORD } })
  token = login.accessToken
  const me = await request('/auth/me')
  assert.ok(me.roles.includes('PASSENGER'))
  const cabins = await booking.cabins(cruise.id), cabin = cabins.find(item => item.remainingCapacity > 0)
  assert.ok(cabin)
  t.after(async () => { if (created?.bookingStatus === 'Draft') { await booking.cancel(created.bookingId, 'WebApp isolated QA cleanup'); created = null } })
  created = await booking.create({ cruiseId: cruise.id, currency: 'USD', paymentPlan: 'STAGES', notes: 'WebApp isolated QA API verification', passengers: [{ fullName: 'WebApp QA Guest', cabinId: cabin.cabinId, tourPackageId: pack.id, dateOfBirth: '', nationality: '', documentType: '', documentNumber: '', email: 'webapp-qa@ocevie.example', phoneNumber: '' }] })
  assert.equal(created.bookingStatus, 'Draft')
  assert.ok(created.agreedFareAmount >= pack.price)
  assert.equal(created.currency, 'USD')
  assert.equal(created.paymentPlan, 'STAGES')
  assert.equal(created.installments.length, 3)
  assert.deepEqual(created.installments.map(item=>item.sequenceNo), [1,2,3])
  const total=created.installments.reduce((sum,item)=>sum+item.requiredAmount,0)
  assert.ok(Math.abs(total-created.agreedFareAmount)<0.0001)
  assert.ok(Math.abs(created.installments[0].requiredAmount-created.agreedFareAmount*0.3)<0.0001)
  assert.ok(Math.abs(created.installments[1].requiredAmount-created.agreedFareAmount*0.4)<0.0001)
  assert.ok(created.installments.every(item=>item.status==='Scheduled'&&Number.isFinite(Date.parse(item.dueAt))))
  assert.match(created.contractSigningInstructions,/OceVie/)
  assert.doesNotMatch(created.contractSigningInstructions,/CASMS|Marina Port/)
  assert.equal((await booking.get(created.bookingId)).bookingReference, created.bookingReference)
  const savedToken = token; token = null
  assert.equal((await booking.lookup(created.bookingReference, 'webapp-qa@ocevie.example', '')).bookingId, created.bookingId)
  token = savedToken
  created = await booking.cancel(created.bookingId, 'WebApp isolated QA cleanup')
  assert.equal(created.bookingStatus, 'Cancelled')
  assert.equal((await booking.get(created.bookingId)).bookingStatus, 'Cancelled')
  t.diagnostic(JSON.stringify({ base, calls, bookingReference: created.bookingReference }))
})
