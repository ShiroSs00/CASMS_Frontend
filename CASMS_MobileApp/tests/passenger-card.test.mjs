import assert from 'node:assert/strict';
import test from 'node:test';
import './register-typescript.mjs';
const { createPassengerApi } = await import('../src/features/passenger-actions/passenger-api.ts');
const { createScopedPosApi } = await import('../src/features/pos/pos-transport.ts');
const { readCardClaim, remainingClaimSeconds } = await import('../src/features/passenger-actions/card-contracts.ts');
const id = '00000000-0000-4000-8000-000000000001';
const code = 'a'.repeat(43); // test-only claim, never used against a live server
test('claim comes from server, uses BookingPassenger path and rejects expired or malformed data', async () => {
  const api = createPassengerApi({ request: async (path, options) => {
    assert.equal(path, '/checkin/passenger/' + id + '/card-claim');
    assert.equal(options.method, 'POST');
    return { code, expiresAt: '2099-01-01T00:00:00Z' };
  } });
  assert.equal((await api.cardClaim(id)).code, code);
  assert.throws(() => readCardClaim({ code, expiresAt: '2000-01-01T00:00:00Z' }));
  assert.throws(() => readCardClaim({ code: id, expiresAt: '2099-01-01T00:00:00Z' }));
  assert.equal(remainingClaimSeconds('2026-01-01T00:01:00Z', Date.parse('2026-01-01T00:00:30Z')), 30);
  assert.equal(remainingClaimSeconds('2026-01-01T00:01:00Z', Date.parse('2026-01-01T01:00:00Z')), 0);
});
test('POS preview/confirm/lookup preserve scoped session and validate response', async () => {
  const calls = [];
  const pos = createScopedPosApi({ request: async (path, options) => {
    calls.push({ path, ...options });
    assert.equal(options.posSession, 'test-session');
    return { bookingPassengerId: id, passengerName: 'Test passenger', confirmedAt: '2026-01-01T00:00:00Z' };
  } }, 'test-session');
  assert.equal((await pos.previewCard(code)).bookingPassengerId, id);
  await pos.confirmCard(code, '01020304');
  await pos.lookupCard('01020304');
  assert.deepEqual(calls.map(row => row.path), ['/pos/passenger-cards/preview', '/pos/passenger-cards/confirm', '/pos/passenger-cards/lookup']);
  assert.equal(calls.length, 3);
  await assert.rejects(pos.previewCard(id));
  await assert.rejects(pos.confirmCard(code, 'manual'));
  await assert.rejects(createScopedPosApi({ request: async () => ({ passengerName: 'Test' }) }, 'test').previewCard(code));
});
test('uncertain confirmation is never replayed automatically', async () => {
  let count = 0;
  const pos = createScopedPosApi({ request: async () => { count++; throw new Error('test network failure'); } }, 'test');
  await assert.rejects(pos.confirmCard(code, '01020304'));
  assert.equal(count, 1);
});
