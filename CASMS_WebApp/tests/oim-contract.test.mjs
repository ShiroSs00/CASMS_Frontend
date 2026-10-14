import assert from 'node:assert/strict'
import test from 'node:test'

import { mapIssueDto } from '../src/features/operational-issues/api/contract.ts'
import { getIssueActionAvailability } from '../src/features/operational-issues/model/issue-actions.ts'

const dto = {
  issueId: 'issue-1',
  issueCode: 'ISS-001',
  cruiseId: null,
  shipId: 'ship-1',
  cabinId: null,
  issueType: 'TECHNICAL',
  severity: 'HIGH',
  description: 'Engine temperature warning.',
  reportedAt: '2026-10-13T08:00:00Z',
  resolvedAt: '2026-10-13T09:00:00Z',
  status: 'IN_PROGRESS',
  reportedById: 'user-1',
  resolvedById: 'user-2',
  assignedToId: 'user-2',
  verifiedById: null,
  verifiedAt: null,
  resolution: 'Cooling system inspected.',
  createdAt: '2026-10-13T08:00:00Z',
  updatedAt: '2026-10-13T09:00:00Z',
}

test('mapIssueDto retains backend verification fields and safe reference labels', () => {
  const issue = mapIssueDto(dto)
  assert.equal(issue.ship.id, 'ship-1')
  assert.equal(issue.ship.name, 'Ship ship-1')
  assert.equal(issue.verifiedBy, null)
  assert.equal(issue.verifiedAt, null)
})

test('OIM actions follow the backend record-then-verify workflow', () => {
  const issue = mapIssueDto(dto)
  const availability = getIssueActionAvailability(issue)
  assert.equal(availability.RECORD_RESOLUTION.visible, true)
  assert.equal(availability.VERIFY_RESOLUTION.visible, true)
  assert.equal(availability.VERIFY_RESOLUTION.enabled, true)
  assert.equal(availability.CLOSE.visible, false)
})

test('a closed backend issue can be reopened', () => {
  const availability = getIssueActionAvailability({ ...mapIssueDto(dto), status: 'CLOSED' })
  assert.equal(availability.REOPEN.visible, true)
  assert.equal(availability.REOPEN.enabled, true)
})
