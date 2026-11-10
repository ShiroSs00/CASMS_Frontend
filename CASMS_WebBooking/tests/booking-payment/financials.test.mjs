import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { decodeBookingDetail, realBookingApi } from '../../src/features/booking/api/real-booking-api.ts'
import { PublicBookingRecord } from '../../src/features/booking/components/PublicBookingRecord.tsx'
import { financialMoney, paymentState } from '../../src/features/booking/model/booking-financials.ts'

const fixture = () => ({ bookingId: 'booking-a', bookingReference: 'REF-A', bookingStatus: 'Draft', cruiseId: 'cruise-a', cruiseName: 'Chuyến A',
  agreedFareAmount: 1000.5678, currency: 'USD', requiredDepositAmount: 300, paymentPlan: 'STAGES', contractStatus: 'Draft',
  totalPaidAmount: 350.1234, outstandingBalance: 650.4444, fullyPaid: false,
  installments: [{ sequenceNo: 1, requiredAmount: 300, currency: 'USD', status: 'Scheduled', installmentType: 'Deposit', paidAmount: 300, outstandingAmount: 0, paid: true },
    { sequenceNo: 2, requiredAmount: 400, currency: 'USD', status: 'Scheduled', installmentType: 'FinalFare', paidAmount: 50.1234, outstandingAmount: 349.8766, paid: false },
    { sequenceNo: 3, requiredAmount: 300.5678, currency: 'USD', status: 'Scheduled', installmentType: 'FinalFare', paidAmount: 0, outstandingAmount: 300.5678, paid: false }],
  passengers: [{ bookingPassengerId: 'bp-a', passengerId: 'p-a', fullName: 'Fixture A', participationStatus: 'Active' }] })
const render = row => renderToStaticMarkup(createElement(PublicBookingRecord, { booking: decodeBookingDetail(row) }))

test('decodes and displays exact server installment projections and four-decimal booking amounts', () => {
  const row = fixture(), decoded = decodeBookingDetail(row), html = render(row)
  assert.equal(decoded.totalPaidAmount, 350.1234)
  assert.equal(decoded.outstandingBalance, 650.4444)
  assert.deepEqual(decoded.installments.map(i => [i.paidAmount, i.outstandingAmount, i.paid]), [[300, 0, true], [50.1234, 349.8766, false], [0, 300.5678, false]])
  for (const value of ['350,1234 USD', '650,4444 USD', '349,8766 USD', 'Chưa thanh toán đủ']) assert.ok(html.includes(value))
})

test('missing projections remain unknown instead of zero or paid, independently at booking and installment level', () => {
  const row = fixture()
  delete row.totalPaidAmount; delete row.outstandingBalance; delete row.fullyPaid
  delete row.installments[0].paidAmount; delete row.installments[0].outstandingAmount; delete row.installments[0].paid
  const decoded = decodeBookingDetail(row)
  assert.deepEqual([decoded.totalPaidAmount, decoded.outstandingBalance, decoded.fullyPaid], [null, null, null])
  assert.equal(decoded.installments[0].paidAmount, null)
  assert.equal(financialMoney(null, 'USD'), 'Chưa cập nhật')
  assert.equal(paymentState(null), 'Chưa cập nhật')
  assert.match(render(row), /Chưa cập nhật/)
})

test('invalid financial fields fail closed without coercion', () => {
  for (const field of ['totalPaidAmount', 'outstandingBalance']) for (const value of [-1, NaN, Infinity, '12', true, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => decodeBookingDetail({ ...fixture(), [field]: value }))
  for (const value of ['true', 1, {}]) assert.throws(() => decodeBookingDetail({ ...fixture(), fullyPaid: value }))
  for (const field of ['paidAmount', 'outstandingAmount', 'paid']) {
    const row = fixture(); row.installments[0][field] = 'invalid'
    assert.throws(() => decodeBookingDetail(row))
  }
})

test('a fully paid Draft remains Draft with an unsigned contract, not booking confirmation or email delivery', () => {
  const row = { ...fixture(), fullyPaid: true, totalPaidAmount: 1000.5678, outstandingBalance: 0 }
  const html = render(row)
  assert.match(html, /Đã thanh toán đủ/)
  assert.match(html, /Đặt chỗ đang chờ xác nhận/)
  assert.match(html, /Bản nháp/)
  assert.doesNotMatch(html, /Bạn có thể nhận email xác nhận/)
})

test('Confirmed does not imply fully paid and flags are not inferred from local arithmetic', () => {
  const row = { ...fixture(), bookingStatus: 'Confirmed', contractStatus: 'Accepted' }
  const html = render(row)
  assert.match(html, /Đặt chỗ đã được xác nhận/)
  assert.match(html, /Chưa thanh toán đủ/)
  assert.match(html, /Đã chấp thuận/)
  const missingFlag = decodeBookingDetail({ ...row, outstandingBalance: 0, fullyPaid: null })
  assert.equal(paymentState(missingFlag.fullyPaid), 'Chưa cập nhật')
})

test('Cancelled/refund projections are displayed as supplied and never reset to zero or interpreted as a refund', () => {
  const row = { ...fixture(), bookingStatus: 'Cancelled', contractStatus: 'Cancelled', totalPaidAmount: 50.1234, outstandingBalance: 950.4444 }
  row.installments = row.installments.map(i => ({ ...i, status: 'Cancelled', paidAmount: 0, outstandingAmount: i.requiredAmount, paid: false }))
  const decoded = decodeBookingDetail(row), html = render(row)
  assert.equal(decoded.totalPaidAmount, 50.1234)
  assert.match(html, /950,4444 USD/)
  assert.match(html, /không phải yêu cầu thanh toán hoặc xác nhận hoàn tiền/)
  assert.match(html, /Đã hủy/)
})

test('duplicate installments, currency mismatch and unknown enums are rejected', () => {
  const row = fixture()
  assert.throws(() => decodeBookingDetail({ ...row, installments: [row.installments[0], row.installments[0]] }))
  for (const change of [{ currency: 'EUR' }, { status: 'Paid' }, { installmentType: 'other' }]) assert.throws(() => decodeBookingDetail({ ...row, installments: [{ ...row.installments[0], ...change }] }))
})

test('booking state does not carry activation token or unrelated response fields', () => {
  const row = decodeBookingDetail({ ...fixture(), token: 'do-not-carry', activationToken: 'do-not-carry', accountSetupToken: 'do-not-carry' })
  for (const key of ['token', 'activationToken', 'accountSetupToken']) assert.equal(key in row, false)
})

test('four-decimal amounts outside safe JSON-number range fail closed instead of displaying rounded financial truth', () => {
  for (const key of ['agreedFareAmount', 'requiredDepositAmount', 'totalPaidAmount', 'outstandingBalance']) assert.throws(() => decodeBookingDetail({ ...fixture(), [key]: 2 ** 39 }))
  const row = fixture(); row.installments[0].requiredAmount = 2 ** 39
  assert.throws(() => decodeBookingDetail(row))
})

test('guest lookup retains contact proof and rejects another reference before rendering financial data', async () => {
  const original = globalThis.fetch, calls = []
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return Response.json({ success: true, data: fixture() }) }
  try {
    await assert.rejects(realBookingApi.lookup('REF-B', 'owner@example.test', ''))
    const url = new URL(calls[0].url, 'https://fixture.invalid')
    assert.equal(url.pathname, '/api/booking/lookup')
    assert.equal(url.searchParams.get('reference'), 'REF-B')
    assert.equal(url.searchParams.get('email'), 'owner@example.test')
  } finally { globalThis.fetch = original }
})
