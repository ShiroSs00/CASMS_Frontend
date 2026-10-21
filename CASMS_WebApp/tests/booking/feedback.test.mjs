import assert from 'node:assert/strict'
import test from 'node:test'
import { bookingLookupFailure, bookingReadFailure } from '../../src/features/booking/model/booking-feedback.ts'

test('Public guest lookup no-match responses cannot reveal whether a reference exists', () => {
  for (const code of [400, 403, 404, 422]) assert.equal(bookingLookupFailure(code), bookingLookupFailure(404))
  assert.match(bookingLookupFailure(503), /thử lại sau/)
  assert.match(bookingLookupFailure(429), /chờ/)
})
test('Public reads distinguish permission, temporary service and network recovery without raw server text', () => {
  assert.match(bookingReadFailure(403), /chưa được phép/)
  assert.match(bookingReadFailure(401), /đăng nhập/)
  assert.match(bookingReadFailure(503), /tạm thời/)
  assert.match(bookingReadFailure(0), /quá thời gian/)
  assert.match(bookingReadFailure(), /tải lại/)
})
