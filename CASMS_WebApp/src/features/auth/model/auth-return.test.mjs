import assert from 'node:assert/strict'
import test from 'node:test'
import { safeCustomerReturnTo, safeAdminReturnTo } from './auth-types.ts'

test('customer return keeps local booking context and rejects external or unrelated routes', () => {
  assert.equal(safeCustomerReturnTo('/booking/review?step=3#total'), '/booking/review?step=3#total')
  assert.equal(safeCustomerReturnTo('/my-bookings/1842/manage'), '/my-bookings/1842/manage')
  for (const value of ['https://evil.test/my-bookings', '//evil.test/booking', '/booking/../../admin', '/admin', '/bookings', '/booking\\evil', '/booking\n']) assert.equal(safeCustomerReturnTo(value), null)
  assert.equal(safeAdminReturnTo('/my-bookings'), null)
})
