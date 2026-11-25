import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import './register-typescript.mjs';
import { financialMoney, bookingFinancialMoney, financialTransactionStatus, financialHistoryScope } from '../src/features/passenger-actions/booking-financials.ts';
import { spendingCopy, spendingFoundationState } from '../src/features/passenger-actions/spending-foundation.ts';
const ready = { allowed: true, pending: false, paused: false, error: false, cruiseStatus: 'IN_PROGRESS' };

test('shared financial formatter keeps unknown distinct from zero and rejects unsafe precision', () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity, 2**39, -(2**39)]) assert.equal(financialMoney(value, 'USD', { signed: true }), 'Chưa cập nhật');
  assert.equal(financialMoney(0, 'USD'), '0 USD');
  assert.equal(financialMoney(12.3456, 'USD'), '12,3456 USD');
  assert.equal(financialMoney(12.3456, 'VND'), '12,3456 VND');
});

test('shared formatter preserves signed reversal without changing booking nonnegative guard', () => {
  assert.equal(financialMoney(-12.3456, 'USD', { signed: true }), '-12,3456 USD');
  assert.equal(bookingFinancialMoney(-12.3456, 'USD'), 'Chưa cập nhật');
  assert.equal(bookingFinancialMoney(12.3456, 'USD'), financialMoney(12.3456, 'USD'));
  for (const currency of [null, undefined, '', 'usd', 'US', 'USDX', '123']) assert.equal(financialMoney(1, currency), 'Chưa cập nhật');
});

test('financial labels use real transaction enums and distinguish account scope from passenger', () => {
  for (const status of ['PENDING','POSTED','FAILED','VOIDED']) assert.notEqual(financialTransactionStatus(status), 'Chưa cập nhật');
  assert.equal(financialTransactionStatus('SETTLED'), 'Chưa cập nhật');
  assert.equal(financialTransactionStatus(null), 'Chưa cập nhật');
  assert.notEqual(financialHistoryScope('account'), financialHistoryScope('passenger'));
  assert.equal(financialHistoryScope(undefined), 'Phạm vi lịch sử chưa được xác nhận');
});

test('spending cannot turn unavailable account data into zero, empty or missing account', () => {
  assert.equal(spendingFoundationState(ready), 'unavailable');
  assert.equal(spendingFoundationState({ ...ready, cruiseStatus: undefined }), 'missing-voyage');
  for (const state of ['missing-account','empty']) {
    assert.ok(spendingCopy[state].description.includes('Hệ thống đã xác nhận'));
    assert.notEqual(state, spendingFoundationState(ready));
  }
});

test('spending hides previous voyage during reload, denial, failure or offline state', () => {
  assert.equal(spendingFoundationState({ ...ready, pending: true }), 'loading');
  assert.equal(spendingFoundationState({ ...ready, paused: true, pending: true }), 'offline');
  assert.equal(spendingFoundationState({ ...ready, allowed: false }), 'forbidden');
  assert.equal(spendingFoundationState({ ...ready, error: true, errorStatus: 403 }), 'forbidden');
  assert.equal(spendingFoundationState({ ...ready, error: true, errorStatus: 404 }), 'error');
  assert.equal(spendingFoundationState({ ...ready, error: true, errorStatus: 0 }), 'error');
});

test('ended voyage never implies settlement or paid account', () => {
  for (const cruiseStatus of ['COMPLETED','CANCELLED']) assert.equal(spendingFoundationState({ ...ready, cruiseStatus }), 'ended');
  assert.ok(spendingCopy.ended.description.includes('không xác nhận'));
});

test('blocked Spending screen has no financial transport, mock totals or checkout action', async () => {
  const screen = await readFile(new URL('../src/features/passenger-actions/PassengerSpendingScreen.tsx', import.meta.url), 'utf8');
  const route = await readFile(new URL('../src/app/spending.tsx', import.meta.url), 'utf8');
  assert.match(screen, /useSelectedItinerary/);
  assert.match(screen, /permission="BOOKING_READ"/);
  assert.doesNotMatch(screen + route, /api\.request|\bfetch\(|\/payment|\/pos\/|express-checkout|AmountRow|creditLimit|remainingAmount/);
  assert.match(screen, /confirmedContext = \['unavailable','ended'\]/);
  assert.match(route, /PassengerSpendingScreen/);
});
