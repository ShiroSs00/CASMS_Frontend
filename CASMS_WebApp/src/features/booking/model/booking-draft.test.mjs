import assert from 'node:assert/strict'
import test from 'node:test'
import { initialDraft, parseGuestCount, validateTravellers, estimateDraft } from './booking-draft.ts'

test('URL guest count accepts only supported integer choices', () => {
  for (const input of [null, '', '-1', '0', '1.5', 'Infinity', '99999999', 'bad']) assert.equal(parseGuestCount(input), 2)
  assert.equal(parseGuestCount('1'), 1)
  assert.equal(parseGuestCount('4'), 4)
})

test('traveller validation rejects impossible calendar dates and keeps each passenger separate', () => {
  const draft = initialDraft()
  assert.notEqual(draft.travellers[0].id, draft.travellers[1].id)
  draft.travellers.forEach(t => Object.assign(t, { name: 'QA Passenger', birthDate: '2000-02-29', email: 'qa@example.test', phone: '+84000000000' }))
  assert.deepEqual(validateTravellers(draft), {})
  draft.travellers[1].birthDate = '2001-02-29'
  assert.deepEqual(Object.keys(validateTravellers(draft)), [draft.travellers[1].id + '-birthDate'])
  draft.travellers[1].birthDate = '2000-02-30'
  assert.ok(validateTravellers(draft)[draft.travellers[1].id + '-birthDate'])
})

test('estimate charges optional packages per passenger without charging included benefits twice', () => {
  const draft = initialDraft()
  draft.selectedCabinCategory = 'balcony'
  draft.passengerPackages = { [draft.travellers[0].id]: 'included', [draft.travellers[1].id]: 'optional', removedPassenger: 'optional' }
  const catalog = { cabins: [{ id: 'deluxe', price: 4800000 }, { id: 'balcony', price: 5800000 }], packages: [{ id: 'included', kind: 'INCLUDED', price: 900000 }, { id: 'optional', kind: 'OPTIONAL', price: 900000 }] }
  assert.deepEqual(estimateDraft(draft, 4800000, catalog), { fare: 11600000, packages: 900000, total: 12500000 })
  assert.equal(draft.acceptedTerms, false)
})
