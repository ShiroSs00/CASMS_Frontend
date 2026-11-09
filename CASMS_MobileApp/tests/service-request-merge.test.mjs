import assert from 'node:assert/strict';
import test from 'node:test';
import './register-typescript.mjs';
const { createPassengerApi } = await import('../src/features/passenger-actions/passenger-api.ts');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const request = { id: id(1), serviceId: id(2), bookingPassengerId: id(3), quantity: 2,
  usageMode: 'PRE_CRUISE', fareBenefitSnapshotId: id(4), fulfilledQuantity: 0, fulfillmentUnitCode: 'VISIT',
  unitPriceSnapshot: 10, usageLimitSnapshot: 2, usagePolicySnapshot: 'PER_DAY' };

test('service request recovery uses operation-key endpoint and preserves fare/usage snapshots', async () => {
  const api = createPassengerApi({ request: async (path, options) => {
    assert.equal(path, '/servicepackage/requests/by-operation-key');
    assert.deepEqual(options.query, { key: 'persisted-operation' });
    return request;
  } });
  assert.deepEqual(await api.requestByOperationKey('persisted-operation'), request);
});

test('request adapter rejects malformed snapshots instead of treating recovery as confirmed', async () => {
  for (const changed of [{ quantity: 0 }, { unitPriceSnapshot: -1 }, { fulfilledQuantity: 1.5 },
    { usagePolicySnapshot: 'UNKNOWN' }, { usageMode: 'UNKNOWN' }]) {
    const api = createPassengerApi({ request: async () => ({ ...request, ...changed }) });
    await assert.rejects(api.requestByOperationKey('persisted-operation'));
  }
});

test('scheduled requests keep schedule/key contract and reject schedules for another service', async () => {
  const api = createPassengerApi({ request: async (path, options) => {
    assert.equal(path, '/servicepackage/requests');
    assert.equal(options.body.serviceScheduleId, id(5));
    assert.equal(options.body.idempotencyKey, 'persisted-operation');
    return { ...request, scheduleId: id(5) };
  } });
  assert.equal((await api.createRequest(id(2), id(3), 2, '', id(5), 'persisted-operation')).scheduleId, id(5));
  const schedule = { id: id(5), serviceId: id(2), cruiseId: id(6), status: 'OPEN', remainingCapacity: 2,
    startsAt: '2099-01-01T00:00:00Z', endsAt: '2099-01-01T01:00:00Z', timeZoneId: 'Asia/Saigon' };
  assert.equal((await createPassengerApi({ request: async () => [schedule] }).serviceSchedules(id(2)))[0].timeZoneId, 'Asia/Saigon');
  await assert.rejects(createPassengerApi({ request: async () => [{ ...schedule, serviceId: id(7) }] }).serviceSchedules(id(2)));
});
