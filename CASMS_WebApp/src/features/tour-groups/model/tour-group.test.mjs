import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canPrepareGroup, emptyGroupForm, formToGroupRequest, groupActions, groupToForm,
  normalizeCapacity, normalizeGroup, normalizeGroups, validateGroupForm,
} from './tour-group.ts'

const id = '00000000-0000-4000-8000-000000000001'
const fixture = {
  tourGroupId: id, shoreExcursionId: id, excursionName: 'Chuyến tham quan thử nghiệm', groupCode: '<script>nhóm</script>',
  maximumCapacity: 20, assignedPassengers: 20, availableCapacity: 0, guideId: null, vehicleId: null, meetingPoint: 'Cảng',
  assemblyTime: null, plannedDepartureTime: '2026-10-18T01:02:03.456Z', plannedReturnTime: '2026-10-18T03:02:03.456Z',
  actualDepartureTime: null, actualReturnTime: null, status: 'PLANNED', notes: null,
}

test('strict raw DTO normalization preserves full groups, optional values and rejects envelopes or malformed rows', () => {
  assert.deepEqual(normalizeGroup(fixture), fixture)
  assert.deepEqual(normalizeGroups([]), [])
  assert.deepEqual(normalizeGroups([fixture]), [fixture])
  for (const value of [null, {}, '[]', { success: true, data: [] }]) assert.throws(() => normalizeGroups(value))
  for (const patch of [{ status: 'DRAFT' }, { status: 'IN_PROGRESS' }, { maximumCapacity: '20' }, { assignedPassengers: -1 }, { availableCapacity: 0.5 }, { guideId: 'not-uuid' }, { plannedDepartureTime: 'not-date' }, { meetingPoint: {} }]) assert.throws(() => normalizeGroup({ ...fixture, ...patch }))
})

test('capacity map uses the actual controller keys, preserving zero without inventing assigned counts', () => {
  assert.deepEqual(normalizeCapacity({ maximumCapacity: 20, availableCapacity: 0 }), { maximumCapacity: 20, availableCapacity: 0 })
  for (const value of [null, {}, { max: 20, remaining: 0 }, { maximumCapacity: 20, availableCapacity: '0' }]) assert.throws(() => normalizeCapacity(value))
})

test('form maps only request DTO fields and roundtrips instants and empty optional values', () => {
  const values = groupToForm(fixture)
  assert.deepEqual(validateGroupForm(values), {})
  const request = formToGroupRequest(values)
  assert.equal(request.plannedDepartureTime, fixture.plannedDepartureTime)
  assert.equal(request.plannedReturnTime, fixture.plannedReturnTime)
  for (const key of ['assemblyTime', 'guideId', 'vehicleId', 'notes']) assert.equal(request[key], undefined)
  for (const key of ['status', 'tourGroupId', 'assignedPassengers', 'availableCapacity', 'excursionName', 'actualDepartureTime', 'actualReturnTime', 'groupName']) assert.equal(key in request, false)
})

test('form validates request constraints and the service-required meeting point', () => {
  const errors = validateGroupForm(emptyGroupForm)
  for (const key of ['shoreExcursionId', 'groupCode', 'maximumCapacity', 'meetingPoint']) assert.ok(errors[key])
  const invalid = validateGroupForm({ ...groupToForm(fixture), maximumCapacity: '1.5', groupCode: 'x'.repeat(51), guideId: 'invalid', notes: 'x'.repeat(501), assemblyTime: 'invalid' })
  for (const key of ['maximumCapacity', 'groupCode', 'guideId', 'notes', 'assemblyTime']) assert.ok(invalid[key])
  assert.throws(() => formToGroupRequest(emptyGroupForm))
})

test('lifecycle and assignment source states follow TourGroupService without fictional status aliases', () => {
  const matrix = { PLANNED: ['confirm', 'cancel'], ASSEMBLING: ['start', 'cancel'], DEPARTED: ['complete'], RETURNED: [], CANCELLED: [] }
  for (const [status, expected] of Object.entries(matrix)) {
    assert.deepEqual(groupActions(status), expected)
    assert.equal(canPrepareGroup(status), status === 'PLANNED')
  }
})
