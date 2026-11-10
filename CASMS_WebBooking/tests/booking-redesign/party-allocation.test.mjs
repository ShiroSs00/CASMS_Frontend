import '../helpers/booking-loader.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupPassengers, moveToGroup, removePartyPerson } from '../../src/features/booking/model/booking-party.ts'
import { initialLiveBooking } from '../../src/features/booking/model/live-booking-context.ts'
test('the first room key remains stable after physical cabin selection', () => {
  const first = initialLiveBooking().passengers[0]
  const people = [first, { ...first }].map(p => ({ ...p, cabinId: 'selected-cabin' }))
  assert.equal(groupPassengers(people).length, 1)
  assert.equal(groupPassengers(people)[0].key, first.cabinGroupKey)
})
test('deleting a passenger preserves the other identities and personal data', () => {
  const people = [{ fullName: 'First', cabinGroupKey: 'a' }, { fullName: 'Second', cabinGroupKey: 'a' }, { fullName: 'Third', cabinGroupKey: 'b' }]
  const result = removePartyPerson(people, ['1', '2', '3'], 1)
  assert.deepEqual(result.ids, ['1', '3'])
  assert.equal(result.passengers[1], people[2])
  assert.equal(groupPassengers(result.passengers).length, 2)
})
test('moving a person keeps their offer/contact and clears only their physical selection', () => {
  const people = [{ fullName: 'First', email: 'fixture@example.test', farePackageOfferId: 'offer', cabinGroupKey: 'a', cabinId: 'cabin' }, { fullName: 'Second', cabinGroupKey: 'a' }]
  const result = moveToGroup(people, 0, 'b')
  assert.equal(result[0].email, people[0].email)
  assert.equal(result[0].farePackageOfferId, 'offer')
  assert.equal(result[0].cabinId, '')
  assert.equal(result[1], people[1])
})
