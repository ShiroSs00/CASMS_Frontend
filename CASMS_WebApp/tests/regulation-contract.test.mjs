import assert from 'node:assert/strict'
import test from 'node:test'

import {
  mapRegulationDto,
  mergeAssignmentSources,
  mapConflictDto,
  mapRegulationFieldErrors,
} from '../src/features/regulations/api/contract.ts'

const makeDto = (id, scope) => ({
  regulationId: id,
  regulationCode: `REG-${id}`,
  name: `Regulation ${id}`,
  description: '',
  regulationType: 'SAFETY',
  scope,
  value: '1',
  unit: 'NONE',
  effectiveFrom: '2026-01-01T00:00:00Z',
  effectiveTo: null,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-10-13T00:00:00Z',
})

test('unknown or blocking conflict verdicts cannot enable an action', () => {
  for (const severity of ['UNKNOWN', 'BLOCKING']) {
    const result = mapConflictDto({ severity, canProceed: true, message: 'Stop', comparedWith: [] })
    assert.equal(result.canProceed, false)
  }
  assert.equal(mapConflictDto({ severity: 'WARNING', canProceed: false, message: 'Stop', comparedWith: [] }).canProceed, false)
})

test('backend field validation maps DTO names to FE form fields', () => {
  assert.deepEqual(mapRegulationFieldErrors({ regulationCode: 'Duplicate', regulationType: 'Required', name: 'Required', unknown: 'Ignore' }), {
    code: 'Duplicate', type: 'Required', name: 'Required',
  })
})

test('mapRegulationDto maps backend names and derives stable adapter metadata', () => {
  const regulation = mapRegulationDto(makeDto('1', 'SHIP'))
  assert.equal(regulation.id, '1')
  assert.equal(regulation.code, 'REG-1')
  assert.equal(regulation.hasBeenActive, true)
  assert.equal(regulation.version, Date.parse('2026-10-13T00:00:00Z'))
})

test('cruise assignments combine direct CRUISE, inherited SHIP and inherited GLOBAL', () => {
  const regulations = [
    mapRegulationDto(makeDto('global', 'GLOBAL')),
    mapRegulationDto(makeDto('ship', 'SHIP')),
    mapRegulationDto(makeDto('cruise', 'CRUISE')),
  ]
  const result = mergeAssignmentSources(
    'cruise',
    ['global', 'cruise'],
    ['global', 'ship'],
    regulations,
  )
  assert.deepEqual(result.direct.map((item) => item.id), ['cruise'])
  assert.deepEqual(result.inherited.map((item) => [item.id, item.scope]), [
    ['global', 'GLOBAL'],
    ['ship', 'SHIP'],
  ])
})
