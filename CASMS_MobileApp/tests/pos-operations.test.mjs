import assert from 'node:assert/strict';
import test from 'node:test';
import './register-typescript.mjs';
import { createScopedPosApi } from '../src/features/pos/pos-transport.ts';
import { request, registration, sale, statement, samePosScope } from '../src/features/pos/pos-contracts.ts';
import { requestSchema } from '../src/features/passenger-actions/onboard-contracts.ts';
import { requestActions, verifyRequestOutcome, attendanceActions, verifyRegistrationOutcome, verifyAttendanceOutcome, verifySaleIntent } from '../src/features/pos/pos-lifecycle.ts';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const stamp = '2026-11-25T01:00:00Z';
const row = request.parse({ id: id(1), serviceId: id(2), bookingPassengerId: id(3), passengerId: id(4), bookingId: id(5), scheduleId: id(6), quantity: 2, status: 'REQUESTED', requestTime: stamp, fareBenefitSnapshotId: id(7), fulfillmentUnitCode: 'VISIT', fulfilledQuantity: 0 });
const worker = id(8);
const activity = { id: id(9), status: 'IN_PROGRESS', startTime: stamp, endTime: '2026-11-25T02:00:00Z' };
const person = { id: id(10), registrationId: id(11), status: 'REGISTERED' };
const reg = registration.parse({ id: id(11), activityId: id(9), bookingPassengerId: id(3), quantity: 2, status: 'PENDING', notes: 'Giữ nguyên ghi chú' });
const input = { serviceId: id(2), bookingPassengerId: id(3), onboardAccountId: id(12), quantity: 1, idempotencyKey: 'one-operation' };
const receipt = { saleId: id(13), serviceRequestId: id(1), chargeId: id(14), serviceId: id(2), bookingPassengerId: id(3), onboardAccountId: id(12), quantity: 1, unitPrice: 12.3456, amount: 12.3456, currency: 'USD', employeeId: worker, terminalId: id(15), areaId: id(16), createdAt: stamp };

test('request ownership and all terminal states expose only permitted staff actions', () => {
  const permissions = ['SERVICE_REQUEST_ASSIGN','SERVICE_REQUEST_EXECUTE'];
  assert.deepEqual(requestActions(row, worker, permissions), ['assign']);
  assert.deepEqual(requestActions({ ...row, assignedUserId: worker }, worker, permissions), ['accept','reject','cancel']);
  assert.deepEqual(requestActions({ ...row, assignedUserId: id(99) }, worker, permissions), []);
  assert.deepEqual(requestActions({ ...row, assignedUserId: worker, status: 'ACCEPTED' }, worker, permissions), ['start','cancel']);
  assert.deepEqual(requestActions({ ...row, assignedUserId: worker, status: 'IN_PROGRESS' }, worker, permissions), ['complete']);
  for (const status of ['COMPLETED','CANCELLED','REJECTED']) assert.deepEqual(requestActions({ ...row, assignedUserId: worker, status }, worker, permissions), []);
  assert.deepEqual(requestActions(row, worker, []), []);
});

test('fulfillment rejects wrong identity, lifecycle and partial results', () => {
  const result = { ...row, status: 'COMPLETED', fulfilledQuantity: 2 };
  assert.equal(verifyRequestOutcome(row, result, 'complete', worker), result);
  for (const change of [{ id: id(99) }, { serviceId: id(99) }, { bookingPassengerId: id(99) }, { scheduleId: id(99) }, { quantity: 1 }, { status: 'IN_PROGRESS' }, { fulfilledQuantity: 1 }, { fulfillmentUnitCode: 'HOUR' }, { fareBenefitSnapshotId: id(99) }])
    assert.throws(() => verifyRequestOutcome(row, { ...result, ...change }, 'complete', worker), e => e.code === 'POS_INVALID_RESPONSE');
  assert.throws(() => verifyRequestOutcome(row, row, 'assign', worker));
});

test('passenger and POS decode the same completed request identity and quantity', () => {
  const payload = { ...row, status: 'COMPLETED', fulfilledQuantity: 2, assignedUserId: worker, completedAt: stamp, usageMode: 'PRE_CRUISE' };
  const staff = request.parse(payload), passenger = requestSchema.parse(payload);
  for (const field of ['id','serviceId','bookingPassengerId','scheduleId','quantity','status','fulfilledQuantity','fareBenefitSnapshotId','fulfillmentUnitCode']) assert.equal(staff[field], passenger[field]);
});

test('fresh context matching rejects changed terminal, ship, area, cruise or assignment', () => {
  const context = { terminal: { terminalId: id(15), shipId: id(17), areaId: id(16), enabled: true }, cruiseId: id(18), staffAssignmentId: id(19) };
  assert.equal(samePosScope(context, context), true);
  for (const field of ['terminalId','shipId','areaId','enabled']) assert.equal(samePosScope(context, { ...context, terminal: { ...context.terminal, [field]: field === 'enabled' ? false : id(99) } }), false);
  for (const field of ['cruiseId','staffAssignmentId']) assert.equal(samePosScope(context, { ...context, [field]: id(99) }), false);
});

test('attendance separates registration, check-in, checkout, completion and no-show', () => {
  const during = Date.parse(stamp), after = Date.parse(activity.endTime);
  assert.deepEqual(attendanceActions(person, activity, during), ['check-in']);
  assert.deepEqual(attendanceActions(person, { ...activity, status: 'OPEN' }, during), []);
  assert.deepEqual(attendanceActions(person, { ...activity, status: 'COMPLETED' }, after), ['no-show']);
  for (const status of ['REGISTERED','CHECKED_IN','IN_PROGRESS']) assert.deepEqual(attendanceActions({ ...person, status }, { ...activity, status: 'CANCELLED' }, after), []);
  assert.deepEqual(attendanceActions({ ...person, status: 'CHECKED_IN' }, activity, during), ['checkout']);
  assert.deepEqual(attendanceActions({ ...person, status: 'IN_PROGRESS' }, activity, during), ['complete']);
});

test('registration and attendance responses must match exact target and transition', () => {
  assert.equal(verifyRegistrationOutcome(reg, { ...reg, status: 'CONFIRMED' }, 'confirm').status, 'CONFIRMED');
  assert.equal(verifyRegistrationOutcome(reg, { ...reg, quantity: 3 }, 'update', 3).quantity, 3);
  for (const change of [{ activityId: id(99) }, { bookingPassengerId: id(99) }, { quantity: 3 }, { status: 'PENDING' }, { excursionId: id(99) }]) assert.throws(() => verifyRegistrationOutcome(reg, { ...reg, status: 'CONFIRMED', ...change }, 'confirm'));
  assert.equal(verifyAttendanceOutcome(person, { ...person, status: 'CHECKED_IN' }, 'check-in').status, 'CHECKED_IN');
  assert.throws(() => verifyAttendanceOutcome(person, { ...person, registrationId: id(99), status: 'CHECKED_IN' }, 'check-in'));
  assert.throws(() => verifyAttendanceOutcome(person, person, 'check-in'));
});

test('staff registration edit uses scoped PUT, preserves notes and validates quantity before send', async () => {
  const calls = [];
  const api = createScopedPosApi({ request: async (path, options) => { calls.push({ path, ...options }); return { ...reg, quantity: 3 }; } }, 'session');
  await api.updateRegistration(reg.id, 3, reg.notes);
  assert.equal(calls[0].path, `/pos/activity-registrations/${reg.id}`);
  assert.equal(calls[0].method, 'PUT'); assert.equal(calls[0].posSession, 'session');
  assert.deepEqual(calls[0].body, { quantity: 3, notes: reg.notes });
  for (const quantity of [0, -1, 1.5, 2147483648, Infinity]) await assert.rejects(api.updateRegistration(reg.id, quantity));
  assert.equal(calls.length, 1);
});

test('new registration rejects wrong activity, passenger, quantity and automatic confirmation', async () => {
  for (const change of [{ activityId: id(99) }, { bookingPassengerId: id(99) }, { quantity: 1 }, { status: 'CONFIRMED' }, { excursionId: id(99) }]) {
    let calls = 0;
    const api = createScopedPosApi({ request: async () => { calls++; return { ...reg, ...change }; } }, 'session');
    await assert.rejects(api.register(activity.id, id(3), 2), e => e.code === 'POS_INVALID_RESPONSE'); assert.equal(calls, 1);
  }
  assert.equal((await createScopedPosApi({ request: async () => reg }, 'session').register(activity.id, id(3), 2)).status, 'PENDING');
});

test('sale receipt needs request, charge, supported currency and safe financial precision', () => {
  assert.equal(sale.parse(receipt).amount, 12.3456);
  for (const change of [{ serviceRequestId: undefined }, { chargeId: undefined }, { unitPrice: undefined }, { amount: null }, { amount: '12.3456' }, { amount: 2**39 }, { amount: 0 }, { currency: 'usd' }, { currency: '' }]) assert.equal(sale.safeParse({ ...receipt, ...change }).success, false);
});

test('sale response matches intent and employee terminal scope without fabricating totals', () => {
  const scope = { terminalId: id(15), areaId: id(16), owner: worker };
  assert.equal(verifySaleIntent(receipt, input, scope), receipt);
  for (const change of [{ serviceId: id(99) }, { bookingPassengerId: id(99) }, { onboardAccountId: id(99) }, { terminalId: id(99) }, { areaId: id(99) }, { employeeId: id(99) }, { quantity: 2 }, { amount: 12 }]) assert.throws(() => verifySaleIntent({ ...receipt, ...change }, input, scope));
});

test('staff statement keeps signed reversal and passenger ID distinct from BookingPassenger', async () => {
  const value = { budget: { accountId: id(12), passengerId: id(4), allocatedAmount: 30, usedAmount: 0, remainingAmount: 30, accountRemaining: 30, currency: 'USD' }, history: [{ transactionId: id(20), type: 'VOID', amount: -12.3456, recordedAt: stamp }] };
  const parsed = await createScopedPosApi({ request: async () => value }, 'session').statement(id(12), id(3));
  assert.equal(parsed.budget.passengerId, id(4)); assert.equal(parsed.history[0].amount, -12.3456);
  assert.equal(statement.safeParse({ ...value, budget: { ...value.budget, accountRemaining: 2**39 } }).success, false);
});
