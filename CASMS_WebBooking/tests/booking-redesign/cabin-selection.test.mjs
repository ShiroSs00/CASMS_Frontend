import '../helpers/booking-loader.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eligibleCabins } from '../../src/features/booking/model/booking-cabin-selection.ts'
const cabins = ['a', 'b', 'c'].map(cabinId => ({ cabinId, capacity: 2, remainingCapacity: 2 }))
const catalog = { fareManaged: true, offers: [
  { selection: { offerId: 'one', priceRevisionId: 'v1', physicalCabinIds: ['a', 'b'] } },
  { selection: { offerId: 'two', priceRevisionId: 'v2', physicalCabinIds: ['b', 'c'] } },
] }
const people = [{ cabinGroupKey: 'room', farePackageOfferId: 'one', farePackagePriceRevisionId: 'v1', cabinSelectionMode: 'PHYSICAL_CABIN' }, { cabinGroupKey: 'room', farePackageOfferId: 'two', farePackagePriceRevisionId: 'v2', cabinSelectionMode: 'PHYSICAL_CABIN' }]
test('mixed-offer groups use intersection and retain both offers', () => {
  assert.deepEqual(eligibleCabins(cabins, people, 0, catalog).map(c => c.cabinId), ['b'])
  assert.equal(people[1].farePackageOfferId, 'two')
})
test('partial inventory, insufficient capacity, missing revisions and category hold cannot become physical choices', () => {
  assert.deepEqual(eligibleCabins(cabins.map(c => ({ ...c, remainingCapacity: 1 })), people, 0, catalog), [])
  assert.deepEqual(eligibleCabins(cabins.map(c => ({ ...c, capacity: 1, remainingCapacity: 1 })), people, 0, catalog), [])
  assert.deepEqual(eligibleCabins(cabins, [{ ...people[0], farePackagePriceRevisionId: 'stale' }], 0, catalog), [])
  assert.deepEqual(eligibleCabins(cabins, [{ ...people[0], cabinSelectionMode: 'CATEGORY_HOLD' }], 0, catalog), [])
})
