import assert from 'node:assert/strict'
import test from 'node:test'
import { assertMoveTarget, assignmentStatuses, canAssignPassenger, normalizeAvailableCapacity, normalizeEligibility, normalizePassenger, normalizePassengers, passengerActions } from './group-passenger.ts'
import { groupStatuses } from './tour-group.ts'

const id = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const row = { tourGroupPassengerId: id, tourGroupId: id, passengerId: id, shoreExcursionId: id, groupCode: '<script>nhóm</script>', assignmentStatus: 'ASSIGNED', assignedAt: '2026-10-18T07:00:00.123456Z', checkedInAt: null, returnedAt: null, createdAt: '2026-10-18T07:00:00Z' }

test('raw passenger DTOs preserve IDs, status and instants without invented display fields', () => {
  assert.deepEqual(normalizePassenger(row), row)
  assert.deepEqual(normalizePassengers([]), [])
  assert.deepEqual(normalizePassengers([row]), [row])
  assert.equal('passengerName' in normalizePassenger({ ...row, passengerName: 'ignore' }), false)
  assert.equal(normalizePassenger({ ...row, checkedInAt: undefined }).checkedInAt, null)
  for (const value of [null, {}, { success: true, data: [row] }, '[]', [null]]) assert.throws(() => normalizePassengers(value))
  for (const patch of [{ assignmentStatus: 'DEPARTED' }, { passengerId: 'invalid' }, { groupCode: null }, { checkedInAt: '2026-10-18 07:00' }, { createdAt: 0 }, { tourGroupId: null }]) assert.throws(() => normalizePassenger({ ...row, ...patch }))
})

test('zero capacity and negative eligibility remain real results; malformed maps fail closed', () => {
  assert.equal(normalizeAvailableCapacity({ availableCapacity: 0 }), 0)
  assert.equal(normalizeEligibility({ eligible: false }), false)
  for (const value of [null, {}, { availableCapacity: '1' }, { availableCapacity: -1 }, { availableCapacity: 1.5 }]) assert.throws(() => normalizeAvailableCapacity(value))
  for (const value of [null, {}, { eligible: 'false' }, { eligible: 1 }]) assert.throws(() => normalizeEligibility(value))
})

test('all passenger/group state pairs follow the verified service gates', () => {
  for (const group of groupStatuses) {
    assert.equal(canAssignPassenger(group), group === 'PLANNED' || group === 'ASSEMBLING')
    for (const assignment of assignmentStatuses) {
      const expected = assignment === 'ASSIGNED' ? group === 'ASSEMBLING' ? ['move', 'remove', 'departure'] : ['move', 'remove'] : assignment === 'CHECKED_IN' && ['DEPARTED', 'RETURNED'].includes(group) ? ['return'] : []
      assert.deepEqual(passengerActions(assignment, group), expected, `${assignment}/${group}`)
    }
  }
})

test('move requires a different group in the same excursion, a valid target state and capacity', () => {
  const source = { tourGroupId: id, shoreExcursionId: id }, target = { tourGroupId: other, shoreExcursionId: id, status: 'ASSEMBLING', availableCapacity: 1 }
  assert.doesNotThrow(() => assertMoveTarget(source, target))
  for (const patch of [{ tourGroupId: id }, { shoreExcursionId: other }, { status: 'DEPARTED' }, { status: 'RETURNED' }, { status: 'CANCELLED' }, { availableCapacity: 0 }]) assert.throws(() => assertMoveTarget(source, { ...target, ...patch }))
})
