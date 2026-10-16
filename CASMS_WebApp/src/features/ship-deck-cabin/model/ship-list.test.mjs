import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyShipFilters, filterShips } from './ship-list-types.ts'
import { shipListFixture } from '../mocks/ship-list-fixtures.ts'

test('search normalizes case, whitespace, Vietnamese accents and ship codes', () => {
  const accented = [{ ...shipListFixture.items[0], name: 'Đại Dương' }]
  assert.equal(filterShips(accented, { ...emptyShipFilters, search: ' DAI DUONG ' }).length, 1)
  assert.equal(filterShips(shipListFixture.items, { ...emptyShipFilters, search: ' sh-002 ' })[0].name, 'Aurora Pearl')
})

test('status and UI readiness compose without changing fleet aggregates or source rows', () => {
  const before = JSON.stringify(shipListFixture)
  assert.equal(filterShips(shipListFixture.items, { search: '', status: 'ACTIVE', readiness: 'BLOCKED' }).length, 0)
  assert.equal(filterShips(shipListFixture.items, { search: '', status: 'ACTIVE', readiness: 'ATTENTION' })[0].code, 'SH-002')
  assert.equal(JSON.stringify(shipListFixture), before)
  assert.equal(shipListFixture.metrics.activeCount, 6)
  assert.equal(filterShips(shipListFixture.items, emptyShipFilters).length, 3)
})
