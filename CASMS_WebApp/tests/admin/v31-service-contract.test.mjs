import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
const root = new URL('../../src/', import.meta.url)
function load(file, imports = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, { module, exports: module.exports, require(id) { assert.ok(Object.hasOwn(imports, id), id); return imports[id] } })
  return module.exports
}
const model = load('features/service-packages/model/catalog-editor.ts')
const draft = { code: ' QA ', name: ' Tên QA ', description: '', type: 'BASIC', price: '0', currency: 'VND', capacity: '0', startDate: '', endDate: '' }
test('catalog serializers use exact per-kind DTO names and preserve zero/null without manufactured defaults', () => {
  const service = model.serializeCatalogDraft('services', { ...draft, price: '', currency: '', capacity: '' })
  assert.equal(service.serviceCode, 'QA'); assert.equal(service.serviceName, 'Tên QA'); assert.equal(service.price, null); assert.equal(service.capacity, null); assert.equal(service.currencyCode, null)
  const product = model.serializeCatalogDraft('products', draft)
  assert.equal(product.unitPrice, 0); assert.equal(product.productType, 'BASIC'); assert.ok(!Object.hasOwn(product, 'capacity')); assert.ok(!Object.hasOwn(product, 'price'))
  const pack = model.serializeCatalogDraft('packages', draft)
  assert.equal(pack.packageType, 'BASIC'); assert.equal(pack.startDate, null); assert.equal(pack.endDate, null)
})
test('catalog form enforces required fields, real money/integer limits, package enum and valid date interval', () => {
  assert.equal(Object.keys(model.validateCatalogDraft('products', draft)).length, 0)
  assert.equal(Object.keys(model.validateCatalogDraft('services', { ...draft, price: '', currency: '' })).length, 0)
  for (const patch of [{ code: 'x'.repeat(51) }, { name: 'a'.repeat(201) }, { price: '-1' }, { price: 'NaN' }, { currency: 'invalid' }]) assert.ok(Object.keys(model.validateCatalogDraft('products', { ...draft, ...patch })).length)
  assert.ok(model.validateCatalogDraft('services', { ...draft, capacity: '1.5' }).capacity)
  assert.ok(model.validateCatalogDraft('packages', { ...draft, type: 'MADE_UP' }).type)
  assert.ok(model.validateCatalogDraft('packages', { ...draft, startDate: '2026-02-30' }).startDate)
  assert.ok(model.validateCatalogDraft('packages', { ...draft, startDate: '2026-10-22', endDate: '2026-10-21' }).endDate)
})
test('catalog transitions match distinct BE state machines, never invent resume/close operations', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(model.catalogActions('services', 'SUSPENDED'))), [])
  assert.equal(model.catalogActions('services', 'ACTIVE')[0].action, 'suspend')
  assert.equal(model.catalogActions('products', 'ACTIVE')[0].action, 'discontinue')
  assert.equal(model.catalogActions('packages', 'DRAFT')[0].action, 'activate')
  assert.equal(model.catalogPermission('products', 'delete'), 'PRODUCT_MANAGE')
  assert.equal(model.catalogPermission('services', 'delete'), 'SERVICE_DELETE_UNUSED')
})
test('benefits, request update and passenger package assignment use correct methods, bodies and 204 handling (unit only)', async () => {
  const calls = []; let result = { success: true, data: { packageId: 'p', serviceId: 's', benefitType: 'INCLUDED' } }, status = 200
  const { servicePackageApi } = load('features/service-packages/api/service-package-api.ts', { '../model/catalog-editor': model, '@/shared/api': { ApiError: Error, apiRequestRaw: async (url, decode, options) => { calls.push({ url, options }); return decode(result, status) } } })
  await servicePackageApi.changeBenefit('p', 'services', 's/1', 'POST', 'INCLUDED')
  assert.equal(calls[0].url, '/servicepackage/packages/p/services/s%2F1'); assert.equal(calls[0].options.body.benefitType, 'INCLUDED')
  result = { success: true, data: { id: 'r', serviceId: 's', status: 'REQUESTED', quantity: 2 } }
  await servicePackageApi.saveRequest({ serviceId: 'forged', bookingPassengerId: 'forged', quantity: 2, note: ' Notes ' }, 'r')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].options.body)), { quantity: 2, note: 'Notes' }); assert.equal(calls[1].options.method, 'PUT')
  result = { success: true, data: { bookingPassengerId: 'bp', packageId: 'p', agreedPrice: 0, currency: 'VND', assignedAt: '2026-10-20T00:00:00Z' } }
  await servicePackageApi.changeAssignment('bp', 'p', 'PUT')
  assert.equal(calls[2].url, '/servicepackage/package-assignments/bp'); assert.deepEqual(JSON.parse(JSON.stringify(calls[2].options.body)), { tourPackageId: 'p' })
  result.data.bookingPassengerId = 'other'; await assert.rejects(servicePackageApi.changeAssignment('bp', 'p', 'POST'), /không khớp/)
  status = 204; result = undefined
  await servicePackageApi.changeAssignment('bp', '', 'DELETE'); assert.equal(calls.at(-1).options.body, undefined)
})
test('Booking context for selectors keeps actual names/relationships, rejects wrong records and does not export contact/documents', async () => {
  const detail = { bookingId: 'b', bookingReference: 'BK-QA', bookingStatus: 'Draft', cruiseId: 'c', cruiseName: 'Chuyến QA', passengers: [{ bookingPassengerId: 'bp', passengerId: 'person', fullName: 'Khách QA', participationStatus: 'Active', documentNumber: 'PRIVATE', email: 'PRIVATE' }] }
  const { decodeBookingContext, bookingContextApi } = load('domain/booking-context/booking-context-api.ts', { '@/shared/api': { apiRequest: async () => detail } })
  const value = decodeBookingContext(detail)
  assert.equal(value.passengers[0].fullName, 'Khách QA'); assert.ok(!JSON.stringify(value).includes('PRIVATE'))
  assert.throws(() => decodeBookingContext({ ...detail, passengers: [{}] }), /không đầy đủ/)
  await assert.rejects(bookingContextApi.get('other'), /không thuộc/)
})
