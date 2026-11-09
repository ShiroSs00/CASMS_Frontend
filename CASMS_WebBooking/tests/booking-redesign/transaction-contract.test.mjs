import '../helpers/booking-loader.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requestBookingQuote, createQuotedBooking } from '../../src/features/booking/api/booking-quote-api.ts'
import { realBookingApi } from '../../src/features/booking/api/real-booking-api.ts'
const person = { fullName: 'Fixture Guest', email: 'fixture@example.test', phoneNumber: '', documentType: '', documentNumber: '', dateOfBirth: '', nationality: '', cabinId: 'cabin', tourPackageId: '', uiOnlyField: 'must-not-send' }
const draft = { cruiseId: 'cruise', currency: 'USD', paymentPlan: 'STAGES', notes: '', passengers: [person] }
const quote = { quoteId: 'quote', cruiseId: 'cruise', currency: 'USD', status: 'ACTIVE', expiresAt: '2099-01-01T00:00:00Z', totalAmount: 123, policyVersion: 'fixture', fingerprint: 'fixture', paymentPlan: 'STAGES', lineItems: [{ cabinId: 'cabin', tourPackageId: null }] }
const saved = { bookingId: 'booking', bookingReference: 'TEST-REF', bookingStatus: 'Draft', cruiseId: 'cruise', cruiseName: 'Fixture', agreedFareAmount: 123, requiredDepositAmount: 0, currency: 'USD', installments: [], passengers: [{ bookingPassengerId: 'bp', passengerId: 'p', fullName: 'Fixture Guest', participationStatus: 'Active', cabinId: 'cabin' }] }
test('quote/create keep readbacks, one idempotency key, USD and serializer privacy', async () => {
  const original = globalThis.fetch, calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options })
    return Response.json({ success: true, data: url === '/api/booking' ? saved : { ...quote, guestToken: 'synthetic-test-token' } })
  }
  try {
    const intent = await requestBookingQuote(draft)
    const result = await createQuotedBooking(draft, intent)
    assert.equal(result.bookingStatus, 'Draft')
    assert.deepEqual(calls.map(c => c.method), ['POST', 'GET', 'GET', 'POST'])
    assert.equal(calls[3].headers['Idempotency-Key'], intent.idempotencyKey)
    assert.ok(!calls[0].body.includes('fixture@example.test'))
    assert.ok(!calls[3].body.includes('uiOnlyField'))
    assert.equal(JSON.parse(calls[3].body).currency, 'USD')
    assert.equal(result.agreedFareAmount, quote.totalAmount)
  } finally { globalThis.fetch = original }
})
test('tampered readback cannot become an intent or create', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (_, options) => Response.json({ success: true, data: { ...quote, totalAmount: options.method === 'GET' ? 999 : 123 } })
  try { await assert.rejects(requestBookingQuote(draft), error => error.status === 502) }
  finally { globalThis.fetch = original }
})
test('legacy package selection intersects active cruise links with ACTIVE catalog', async () => {
  const original = globalThis.fetch
  const paths = []
  globalThis.fetch = async url => {
    paths.push(url)
    const data = url.includes('/cruise/') ? [{ cruiseId: 'cruise', tourPackageId: 'allowed', active: true }, { cruiseId: 'cruise', tourPackageId: 'inactive', active: true }]
      : [{ id: 'allowed', name: 'Allowed', price: 10, currency: 'USD', status: 'ACTIVE' }, { id: 'inactive', name: 'Inactive', price: 20, currency: 'USD', status: 'INACTIVE' }, { id: 'unassigned', name: 'Other', price: 30, currency: 'USD', status: 'ACTIVE' }]
    return Response.json({ success: true, data })
  }
  try {
    assert.deepEqual((await realBookingApi.packagesForCruise('cruise')).map(p => p.id), ['allowed'])
    assert.deepEqual(paths, ['/api/cruise/cruise/packages', '/api/servicepackage/packages'])
  } finally { globalThis.fetch = original }
})
