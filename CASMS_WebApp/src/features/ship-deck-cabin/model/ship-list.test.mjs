import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyShipFilters, filterShips, shipListState } from './ship-list-types.ts'
import { shipListFixture } from '../mocks/ship-list-fixtures.ts'

test('search normalizes case, whitespace, Vietnamese accents and ship codes', () => {
  const accented = [{ ...shipListFixture.items[0], name: 'Đại Dương' }]
  assert.equal(filterShips(accented, { ...emptyShipFilters, search: ' DAI DUONG ' }).length, 1)
  assert.equal(filterShips(shipListFixture.items, { ...emptyShipFilters, search: ' sh-002 ' })[0].name, 'Aurora Pearl')
})

test('status and UI readiness compose without changing fleet aggregates or source rows', () => {
  const before = JSON.stringify(shipListFixture)
  assert.equal(filterShips(shipListFixture.items, { search: '', status: 'READY', readiness: 'BLOCKED' }).length, 0)
  assert.equal(filterShips(shipListFixture.items, { search: '', status: 'READY', readiness: 'ATTENTION' })[0].code, 'SH-002')
  assert.equal(JSON.stringify(shipListFixture), before)
  assert.equal(shipListFixture.metrics.readyCount, 6)
  assert.equal(filterShips(shipListFixture.items, emptyShipFilters).length, 3)
})

test('ship status totals count all six lifecycle states independently of readiness',()=>{
 const base=shipListFixture.items[0]
 const rows=['DRAFT','READY','IN_SERVICE','MAINTENANCE','SUSPENDED','RETIRED'].map((status,i)=>({...base,id:String(i),status,readiness:{status:'unavailable',message:'Not loaded'}}))
 const {metrics}=shipListState(rows)
 assert.equal(metrics.readyCount,1)
 assert.equal(metrics.maintenanceCount,1)
 assert.equal(metrics.suspendedCount,1)
 assert.equal(metrics.draftCount,1)
 assert.equal(metrics.inServiceCount,1)
 assert.equal(metrics.retiredCount,1)
 assert.equal(metrics.attentionCount,null)
})
