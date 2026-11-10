import assert from 'node:assert/strict';
import test from 'node:test';
import './register-typescript.mjs';
import { createPassengerApi } from '../src/features/passenger-actions/passenger-api.ts';
import { bookingFinancialMoney, bookingPaymentState } from '../src/features/passenger-actions/booking-financials.ts';
import { personalPermissions } from '../src/features/passenger-actions/passenger-model.ts';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const fixture = () => ({ bookingId: id(1), bookingReference: 'REF-A', bookingStatus: 'Draft', cruiseId: id(2), cruiseCode: 'A', cruiseName: 'Chuyến A',
  departureDatetime: '2027-01-01T00:00:00Z', returnDatetime: '2027-01-02T00:00:00Z', createdAt: '2026-11-10T00:00:00Z',
  currency: 'USD', agreedFareAmount: 1000.5678, totalPaidAmount: 350.1234, outstandingBalance: 650.4444, fullyPaid: false, contractStatus: 'Draft',
  installments: [{ sequenceNo: 1, requiredAmount: 300, currency: 'USD', status: 'Scheduled', paidAmount: 300, outstandingAmount: 0, paid: true },
    { sequenceNo: 2, requiredAmount: 700.5678, currency: 'USD', status: 'Scheduled', paidAmount: 50.1234, outstandingAmount: 650.4444, paid: false }],
  passengers: [{ bookingPassengerId: id(3), passengerId: id(4), fullName: 'Passenger A', participationStatus: 'Active' }] });
const decode = row => createPassengerApi({ request: async () => row }).booking(id(1));

test('Mobile preserves server financial projections and shows all four decimals', async () => {
  const row = await decode(fixture());
  assert.deepEqual([row.totalPaidAmount, row.outstandingBalance, row.fullyPaid], [350.1234, 650.4444, false]);
  assert.deepEqual(row.installments.map(i => [i.paidAmount, i.outstandingAmount, i.paid]), [[300, 0, true], [50.1234, 650.4444, false]]);
  assert.equal(bookingFinancialMoney(row.totalPaidAmount, row.currency), '350,1234 USD');
});

test('missing/null projections never become zero or paid', async () => {
  const value = fixture(); delete value.totalPaidAmount; delete value.outstandingBalance; delete value.fullyPaid;
  delete value.installments[0].paidAmount; delete value.installments[0].outstandingAmount; delete value.installments[0].paid;
  const row = await decode(value);
  assert.deepEqual([row.totalPaidAmount, row.outstandingBalance, row.fullyPaid], [null, null, null]);
  assert.equal(row.installments[0].paidAmount, null);
  assert.equal(bookingFinancialMoney(null, 'USD'), 'Chưa cập nhật');
  assert.equal(bookingPaymentState(null), 'Chưa cập nhật');
});

test('invalid amounts, coercible strings and invalid flags fail closed', async () => {
  for (const field of ['totalPaidAmount', 'outstandingBalance']) for (const value of [-1, Infinity, NaN, '2', true, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(decode({ ...fixture(), [field]: value }));
  await assert.rejects(decode({ ...fixture(), fullyPaid: 'true' }));
  for (const field of ['paidAmount', 'outstandingAmount', 'paid']) { const value = fixture(); value.installments[0][field] = 'invalid'; await assert.rejects(decode(value)); }
});

test('fully paid with unsigned contract remains Draft, independent from payment flags', async () => {
  const row = await decode({ ...fixture(), totalPaidAmount: 1000.5678, outstandingBalance: 0, fullyPaid: true });
  assert.equal(row.bookingStatus, 'Draft'); assert.equal(row.contractStatus, 'Draft');
  assert.equal(bookingPaymentState(row.fullyPaid), 'Đã thanh toán đủ');
  const noFlag = await decode({ ...fixture(), fullyPaid: null, outstandingBalance: 0 });
  assert.equal(bookingPaymentState(noFlag.fullyPaid), 'Chưa cập nhật');
});

test('Confirmed booking and transaction history remain independent; another booking payment cannot be used', async () => {
  const value = { ...fixture(), bookingStatus: 'Confirmed', contractStatus: 'Accepted' };
  let wrong = false;
  const api = createPassengerApi({ request: async path => path.startsWith('/payment/') ? [{ paymentId: id(10), bookingId: wrong ? id(99) : id(1), operationType: 'Collect', requestedAmount: 500, confirmedAmount: 500, currency: 'USD', status: 'Confirmed' }] : value });
  const row = await api.booking(id(1)), history = await api.payments(id(1));
  assert.equal(history[0].confirmedAmount, 500);
  assert.equal(row.totalPaidAmount, 350.1234); // History is not the verified/refund-adjusted financial projection.
  wrong = true; await assert.rejects(api.payments(id(1)));
  await assert.rejects(decode({ ...value, bookingId: id(99) }));
});

test('cancelled/refund projections are not fabricated or discarded', async () => {
  const value = { ...fixture(), bookingStatus: 'Cancelled', contractStatus: 'Cancelled', totalPaidAmount: 50.1234, outstandingBalance: 950.4444 };
  value.installments = value.installments.map(i => ({ ...i, status: 'Cancelled', paidAmount: 0, outstandingAmount: i.requiredAmount, paid: false }));
  const row = await decode(value);
  assert.equal(row.totalPaidAmount, 50.1234); assert.equal(row.outstandingBalance, 950.4444);
  assert.equal(row.installments[0].outstandingAmount, 300);
});

test('currency mismatch, duplicate installment and invalid enums fail closed', async () => {
  const value = fixture();
  await assert.rejects(decode({ ...value, installments: [value.installments[0], value.installments[0]] }));
  await assert.rejects(decode({ ...value, installments: [{ ...value.installments[0], currency: 'EUR' }] }));
  await assert.rejects(decode({ ...value, installments: [{ ...value.installments[0], status: 'Paid' }] }));
  await assert.rejects(decode({ ...value, contractStatus: 'unknown' }));
});

test('four-decimal amounts outside safe JSON-number range are not rendered as rounded financial truth', async () => {
  for (const key of ['agreedFareAmount', 'requiredDepositAmount', 'totalPaidAmount', 'outstandingBalance']) await assert.rejects(decode({ ...fixture(), [key]: 2 ** 39 }));
  assert.equal(bookingFinancialMoney(2 ** 39, 'USD'), 'Chưa cập nhật');
});

test('private permission grants cannot be borrowed from another account and tokens are stripped', async () => {
  const me = { userId: id(4), status: 'ACTIVE', roles: ['PASSENGER'], effectivePermissions: ['BOOKING_READ', 'PAYMENT_READ'] };
  assert.equal(personalPermissions(id(5), me), null);
  assert.deepEqual(personalPermissions(id(4), { ...me, effectivePermissions: ['BOOKING_READ'] }), ['BOOKING_READ']);
  const row = await decode({ ...fixture(), activationToken: 'do-not-carry' });
  assert.equal('activationToken' in row, false);
});
