import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const root = new URL('../../src/', import.meta.url)
function load(file, imports = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, {
    module, exports: module.exports, Date, require(id) { assert.ok(Object.hasOwn(imports, id), id); return imports[id] },
  })
  return module.exports
}
class ApiError extends Error { constructor(message, status) { super(message); this.status = status } }
const pack = { id: 'package', code: 'PK', name: 'Package', type: 'PREMIUM', price: 120, currency: 'USD', status: 'ACTIVE' }

test('public package benefits preserve inherited ownership and reject wrong package headers, duplicate or malformed components', () => {
  const { decodePackageBenefits } = load('features/booking/api/customer-extras-api.ts', { '@/shared/api': {} })
  const payload = { packageInfo: pack, services: [{ packageId: pack.id, serviceId: 'service', benefitType: 'INCLUDED' }], activities: [], excursions: [{ packageId: pack.id, excursionId: 'excursion', benefitType: 'OPTIONAL' }] }
  const result = decodePackageBenefits(payload, pack.id)
  assert.equal(result.benefits.length, 2)
  assert.equal(result.benefits[0].benefitType, 'INCLUDED')
  assert.equal(result.benefits[1].benefitType, 'OPTIONAL')
  const inherited = decodePackageBenefits({ ...payload, services: [{ ...payload.services[0], packageId: 'parent' }] }, pack.id)
  assert.equal(inherited.benefits[0].sourcePackageId, 'parent')
  for (const changes of [
    { packageInfo: { ...pack, id: 'other' } },
    { services: [{ ...payload.services[0], packageId: '' }] },
    { services: [payload.services[0], payload.services[0]] },
    { services: [{ ...payload.services[0], benefitType: 'FREE_UPGRADE' }] },
    { excursions: null },
  ]) assert.throws(() => decodePackageBenefits({ ...payload, ...changes }, pack.id))
})

test('booking refreshes package currency before POST and safely rejects changed, removed and unavailable packages', async () => {
  const calls = [], context = load('domain/booking-context/booking-context-api.ts', { '@/shared/api': {} })
  let packages = [pack], fail = false
  const detail = { bookingId: 'booking', bookingReference: 'QA', bookingStatus: 'Draft', cruiseId: 'cruise', cruiseName: 'QA', passengers: [], agreedFareAmount: 245, requiredDepositAmount: 73.5, currency: 'USD', installments: [] }
  const { realBookingApi, bookingPackageErrors } = load('features/booking/api/real-booking-api.ts', {
    '@/domain/booking-context': context,
    '@/shared/api': { ApiError, apiRequest: async (path, options) => { calls.push({ path, method: options?.method ?? 'GET' }); if (path === '/servicepackage/packages') { if (fail) throw new ApiError('Offline', 0); return packages } return detail } },
  })
  const draft = { cruiseId: 'cruise', currency: 'USD', paymentPlan: 'DEPOSIT', notes: '', passengers: [{ fullName: 'QA Guest', nationality: '', documentNumber: '', email: '', phoneNumber: '', cabinId: 'cabin', tourPackageId: pack.id }] }
  assert.equal(Object.keys(bookingPackageErrors(draft, packages)).length, 0)
  await realBookingApi.create(draft)
  assert.deepEqual(calls.map(call => call.method + ' ' + call.path), ['GET /servicepackage/packages', 'POST /booking'])
  for (const next of [[{ ...pack, currency: 'VND' }], [], [{ ...pack, status: 'INACTIVE' }]]) {
    packages = next; calls.length = 0
    await assert.rejects(realBookingApi.create(draft), error => error.status === 422)
    assert.equal(calls.some(call => call.method === 'POST'), false)
  }
  fail = true; calls.length = 0
  await assert.rejects(realBookingApi.create(draft), error => error.status === 422 && /chưa được gửi/.test(error.message))
  assert.equal(calls.some(call => call.method === 'POST'), false)
})
