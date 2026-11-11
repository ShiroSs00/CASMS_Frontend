import assert from 'node:assert/strict'
import test from 'node:test'
import { realBookingApi } from '../src/features/booking/api/real-booking-api.ts'
import { setApiAccessToken } from '../src/shared/api/client.ts'
import { getSessionAccess, setSessionAccess } from '../src/shared/auth/session-access.ts'

test('contract acceptance submits only the signed document reference', async () => {
  const booking = {
    bookingId: 'booking', bookingReference: 'QA-BOOKING', bookingStatus: 'Draft',
    cruiseId: 'cruise', cruiseName: 'QA Cruise', passengers: [], installments: [],
    agreedFareAmount: 100, requiredDepositAmount: 30, currency: 'USD', contractStatus: 'Accepted',
  }
  const original = globalThis.fetch
  const previousAccess = getSessionAccess()
  const permissions = ['BOOKING_CONTRACT_MANAGE']
  setSessionAccess({ status: 'ready', userId: 'qa-agent', roles: ['BOOKING_AGENT'], permissions, has: permission => permissions.includes(permission) })
  setApiAccessToken('fixture-session')
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/booking/booking/contract/accept')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { documentReference: 'SIGNED-REFERENCE' })
    return Response.json({ success: true, data: booking })
  }
  try {
    const saved = await realBookingApi.acceptContract(booking.bookingId, ' SIGNED-REFERENCE ')
    assert.equal(saved.contractStatus, 'Accepted')
    assert.equal(saved.bookingStatus, 'Draft')
  } finally {
    globalThis.fetch = original
    setApiAccessToken(null)
    setSessionAccess(previousAccess)
  }
})
