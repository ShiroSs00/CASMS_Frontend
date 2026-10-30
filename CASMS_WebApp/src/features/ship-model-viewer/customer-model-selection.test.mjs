import test from 'node:test'
import assert from 'node:assert/strict'
import { mapBookingCabins } from './customer-model-selection.ts'

test('3D booking uses persisted cabin mapping and live capacity, never a model source id as booking id', () => {
  const inventory = [{ cabinId: 'database-cabin', remainingCapacity: 0 }]
  const model = [{ id: 'source-cabin', nodeName: 'CabinMesh' }]
  assert.deepEqual(mapBookingCabins(inventory, [{ cabinId: 'database-cabin', modelId: 'source-cabin' }], model), [{ cabinId: 'database-cabin', remainingCapacity: 0, nodeName: 'CabinMesh' }])
  assert.deepEqual(mapBookingCabins(inventory, [], model), [])
  assert.deepEqual(mapBookingCabins(inventory, [{ cabinId: 'other-cabin', modelId: 'source-cabin' }], model), [])
  assert.deepEqual(mapBookingCabins(inventory, [{ cabinId: 'database-cabin', modelId: 'missing' }], model), [])
})
test('ambiguous mappings cannot select the wrong cabin', () => {
  const inventory = [{ cabinId: 'database-cabin', remainingCapacity: 2 }]
  const mapping = { cabinId: 'database-cabin', modelId: 'source-cabin' }
  const model = [{ id: 'source-cabin', nodeName: 'CabinMesh' }]
  assert.deepEqual(mapBookingCabins(inventory, [mapping, mapping], model), [])
  assert.deepEqual(mapBookingCabins(inventory, [mapping, { ...mapping, cabinId: 'other-cabin' }], model), [])
  assert.deepEqual(mapBookingCabins(inventory, [mapping], [...model, { id: 'duplicate', modelId: 'source-cabin', nodeName: 'OtherMesh' }]), [])
})
