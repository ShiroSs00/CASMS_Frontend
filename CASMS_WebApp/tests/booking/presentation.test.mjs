import assert from 'node:assert/strict'
import test from 'node:test'
import { loadSource } from '../helpers/source-loader.mjs'
const { bookingMoney, cabinTypeName } = loadSource('features/booking/model/booking-presentation.ts')

test('Booking amounts preserve server precision and currency instead of assuming two decimal places', () => {
  assert.equal(bookingMoney(1234.567, 'KWD'), '1.234,567 KWD')
  assert.equal(bookingMoney(0, 'USD'), '0 USD')
})
test('Cabin presentation retains unknown API types instead of making up a room category', () => {
  assert.equal(cabinTypeName('BALCONY'), 'Phòng có ban công')
  assert.equal(cabinTypeName('FUTURE_API_TYPE'), 'Chưa xác định (FUTURE_API_TYPE)')
})
