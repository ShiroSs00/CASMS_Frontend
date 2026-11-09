import '../helpers/booking-loader.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quoteUsable, transactionState, updateSelection } from '../../src/features/booking/model/booking-transaction.ts'
import { quoteSelection } from '../../src/features/booking/api/booking-quote-api.ts'
import { bookingFieldErrors, serializeCabinSelection } from '../../src/features/booking/api/real-booking-api.ts'
import { bookingMutationFailure } from '../../src/features/booking/model/booking-mutation.ts'
import { ApiError } from '../../src/shared/api/index.ts'
const person = { fullName: 'Fixture Guest', email: 'fixture@example.test', phoneNumber: '', documentType: '', documentNumber: '', dateOfBirth: '', nationality: '', cabinId: 'c1', tourPackageId: '' }
const draft = { cruiseId: 'cruise', currency: 'USD', paymentPlan: 'STAGES', notes: '', passengers: [person] }
const intent = { selection: quoteSelection(draft), idempotencyKey: 'same-intent', quote: { status: 'ACTIVE', expiresAt: '2099-01-01', totalAmount: 123 } }
test('quote expires or invalidates on economic selection, never on personal edits', () => {
  assert.equal(quoteUsable(draft, intent, 0), true)
  assert.equal(quoteUsable(draft, intent, Date.parse('2099-01-02')), false)
  assert.equal(quoteUsable({ ...draft, paymentPlan: 'FULL' }, intent, 0), false)
  assert.equal(quoteUsable({ ...draft, passengers: [{ ...person, email: 'changed@example.test' }] }, intent, 0), true)
  assert.equal(updateSelection({ draft, intent }, d => ({ ...d, paymentPlan: 'FULL' })).intent, null)
  assert.equal(updateSelection({ draft, intent }, d => ({ ...d, notes: 'Changed' })).intent, intent)
})
test('quote unknown and booking unknown take precedence over editable states', () => {
  assert.equal(transactionState({ busy: false, quoteUnknown: true, uncertain: false, saved: null }), 'quote-unknown')
  assert.equal(transactionState({ busy: false, quoteUnknown: false, uncertain: true, saved: null }), 'booking-unknown')
  for (const status of [0, 200, 408, 500, 502]) assert.equal(bookingMutationFailure(new ApiError('', status)).uncertain, true)
  for (const status of [400, 401, 403, 404, 409, 422]) assert.equal(bookingMutationFailure(new ApiError('', status)).uncertain, false)
})
test('identity validation and category-hold serialization remain authoritative', () => {
  assert.deepEqual(bookingFieldErrors(draft, undefined, null, Date.now(), 2), {})
  const errors = bookingFieldErrors({ ...draft, passengers: [{ ...person, fullName: 'x', email: 'bad' }] }, undefined, null, Date.now(), 2)
  assert.ok(errors['person-0-fullName']); assert.ok(errors['person-0-email'])
  assert.equal(serializeCabinSelection({ ...person, cabinId: 'old', cabinSelectionMode: 'CATEGORY_HOLD', farePackageOfferId: 'offer' }).cabinId, null)
  assert.ok(!quoteSelection(draft).includes('fixture@example.test'))
})
