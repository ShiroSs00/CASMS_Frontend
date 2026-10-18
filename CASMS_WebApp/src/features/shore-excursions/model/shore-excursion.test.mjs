import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canDeleteExcursion, canEditExcursion, emptyExcursionForm, excursionToForm,
  formToExcursionRequest, lifecycleActions, normalizeExcursion, normalizeExcursions,
  validateExcursionForm,
} from './shore-excursion.ts'

const fixture = {
  shoreExcursionId: '00000000-0000-4000-8000-000000000001',
  cruiseStopId: '00000000-0000-4000-8000-000000000002', supplierId: '00000000-0000-4000-8000-000000000003',
  supplierName: 'Nhà cung cấp thử nghiệm', excursionCode: null, excursionName: '<script>nội dung</script>',
  startTime: '2026-10-18T01:02:03.456Z', plannedReturnTime: '2026-10-18T04:02:03.456Z', meetingPoint: 'Cảng',
  minimumParticipants: null, maximumCapacity: 20, registeredParticipants: 2, availableCapacity: 18,
  price: 0, currencyCode: 'VND', status: 'PLANNED', cancellationReason: null,
  createdAt: '2026-10-17T01:00:00Z', updatedAt: '2026-10-17T01:00:00Z',
}

test('normalizes raw rows and arrays without coercing malformed data or accepting an envelope', () => {
  assert.deepEqual(normalizeExcursion(fixture), fixture)
  assert.deepEqual(normalizeExcursions([]), [])
  assert.deepEqual(normalizeExcursions([fixture]), [fixture])
  for (const value of [null, {}, { success: true, data: [] }, '[]']) assert.throws(() => normalizeExcursions(value))
  for (const patch of [
    { status: 'DRAFT' }, { maximumCapacity: '20' }, { availableCapacity: -1 }, { registeredParticipants: 0.5 },
    { price: Infinity }, { supplierId: 'invalid' }, { startTime: 'invalid' }, { startTime: '2026-10-18T01:00' }, { excursionName: {} },
  ]) assert.throws(() => normalizeExcursion({ ...fixture, ...patch }))
})

test('form roundtrip preserves instants, optional nulls, zero price and only request DTO fields', () => {
  const values = excursionToForm(fixture)
  assert.deepEqual(validateExcursionForm(values), {})
  const request = formToExcursionRequest(values)
  assert.equal(request.startTime, fixture.startTime)
  assert.equal(request.plannedReturnTime, fixture.plannedReturnTime)
  assert.equal(request.price, 0)
  assert.equal(request.minimumParticipants, undefined)
  assert.equal(request.excursionCode, undefined)
  for (const key of ['status', 'shoreExcursionId', 'registeredParticipants', 'availableCapacity', 'supplierName']) assert.equal(key in request, false)
})

test('validates required fields, UUIDs, lengths, integer limits and DTO money constraints', () => {
  const empty = validateExcursionForm(emptyExcursionForm)
  for (const key of ['cruiseStopId', 'supplierId', 'excursionName', 'meetingPoint', 'maximumCapacity', 'startTime', 'plannedReturnTime']) assert.ok(empty[key])
  const invalid = validateExcursionForm({ ...excursionToForm(fixture), maximumCapacity: '1.5', minimumParticipants: '0', price: '1.12345', currencyCode: 'vnd', excursionCode: 'x'.repeat(51) })
  for (const key of ['maximumCapacity', 'minimumParticipants', 'price', 'currencyCode', 'excursionCode']) assert.ok(invalid[key])
  assert.throws(() => formToExcursionRequest(emptyExcursionForm))
})

test('source-state gates match the inspected service; CLOSED cannot start and terminal states have no lifecycle actions', () => {
  const matrix = {
    PLANNED: ['confirm', 'cancel'], OPEN: ['close', 'start', 'cancel'], FULL: ['close', 'start', 'cancel'],
    CLOSED: ['cancel'], IN_PROGRESS: ['complete', 'cancel'], COMPLETED: [], CANCELLED: [],
  }
  for (const [status, actions] of Object.entries(matrix)) {
    assert.deepEqual(lifecycleActions(status), actions)
    assert.equal(canEditExcursion(status), ['PLANNED', 'OPEN', 'FULL', 'CLOSED'].includes(status))
    assert.equal(canDeleteExcursion(status), status === 'PLANNED')
  }
})
