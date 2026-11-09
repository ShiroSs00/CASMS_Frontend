import assert from 'node:assert/strict';
import test from 'node:test';
import './register-typescript.mjs';
const { createPassengerApi } = await import('../src/features/passenger-actions/passenger-api.ts');
const { processBookingIntent } = await import('../src/features/passenger-actions/booking-workflow.ts');
const { bookingWasRejected, bookingErrorMessage } = await import('../src/features/passenger-actions/booking-policy.ts');
const { withIntentLock } = await import('../src/lib/intent-lock.ts');
const { ApiError, createApiClient } = await import('../src/lib/api/api-client.ts');

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const body = { cruiseId: id(1), paymentPlan: 'DEPOSIT', passengers: [{ fullName: 'Nguyễn An', cabinId: id(2) }] };
const quote = { quoteId: id(3), cruiseId: id(1), currency: 'USD', paymentPlan: 'DEPOSIT', status: 'ACTIVE', totalAmount: 120, expiresAt: '2099-01-01T00:00:00Z', lineItems: [{ cabinId: id(2) }] };
const intent = { owner: id(5), apiUrl: 'https://test/api', idempotencyKey: id(4), expiresAt: quote.expiresAt, body: { ...body, quoteId: quote.quoteId, currency: 'USD' } };
const booking = { bookingId: id(6), bookingReference: 'BK-TEST', bookedByUserId: id(5), cruiseId: id(1), cruiseCode: 'TEST', cruiseName: 'Test',
  departureDatetime: '2027-01-01T00:00:00Z', returnDatetime: '2027-01-02T00:00:00Z', createdAt: '2026-11-09T00:00:00Z',
  paymentPlan: 'DEPOSIT', installments: [], passengers: [], bookingStatus: 'Draft' };

test('authoritative quote excludes contact data and retains guest proof when returned', async () => {
  let sent;
  const api = createPassengerApi({ async request(path, options) {
    assert.equal(path, '/booking/quotes'); sent = options.body;
    return { ...quote, guestToken: 'guest-proof' };
  } });
  const result = await api.bookingQuote(body);
  assert.deepEqual(sent, { cruiseId: id(1), paymentPlan: 'DEPOSIT', currency: 'USD', passengers: [{ cabinId: id(2) }] });
  assert.equal(result.totalAmount, 120);
  assert.equal(result.guestToken, 'guest-proof');
});

test('quote rejects expired, mismatched, negative, invalid currency and inactive responses', async () => {
  for (const changed of [
    { expiresAt: '2020-01-01T00:00:00Z' }, { cruiseId: id(7) }, { paymentPlan: 'FULL' },
    { totalAmount: -1 }, { currency: 'VND' }, { status: 'COMMITTED' },
    { lineItems: [] }, { lineItems: [{ cabinId: id(2), tourPackageId: id(9) }] },
  ]) {
    const api = createPassengerApi({ request: async () => ({ ...quote, ...changed }) });
    await assert.rejects(api.bookingQuote(body));
  }
});

test('quote matches cabin multiplicity independent of response order', async () => {
  const api = createPassengerApi({ request: async () => ({ ...quote, lineItems: [{ cabinId: id(8) }, { cabinId: id(2) }] }) });
  await api.bookingQuote({ ...body, passengers: [...body.passengers, { fullName: 'Nguyễn Bình', cabinId: id(8) }] });
  await assert.rejects(api.bookingQuote({ ...body, passengers: [...body.passengers, ...body.passengers] }));
});

test('booking sends stable Idempotency-Key and quoteGuestToken with the employee-free passenger bearer', async () => {
  const calls = [];
  const transport = createApiClient({ baseUrl: () => 'https://test/api', fetch: async (url, options) => {
    calls.push({ url, ...options }); return Response.json({ success: true, data: booking });
  } });
  transport.setToken('passenger-token');
  const api = createPassengerApi(transport);
  const payload = { ...intent.body, quoteGuestToken: 'guest-proof' };
  await api.createBooking(payload, intent.idempotencyKey, intent.owner);
  await api.createBooking(payload, intent.idempotencyKey, intent.owner);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.headers['Idempotency-Key'], intent.idempotencyKey);
    assert.equal(call.headers.Authorization, 'Bearer passenger-token');
    assert.equal(call.headers['X-POS-Session'], undefined);
    assert.equal(JSON.parse(call.body).quoteGuestToken, 'guest-proof');
  }
  assert.equal(calls[0].body, calls[1].body);
});

test('invalid passenger, key and quote data never reach the transport', async () => {
  let count = 0;
  const api = createPassengerApi({ request: async () => { count++; return booking; } });
  for (const payload of [{ ...intent.body, passengers: [] }, { ...intent.body, quoteId: undefined },
    { ...intent.body, passengers: [{ fullName: 'A', cabinId: id(2) }] }]) {
    await assert.rejects(api.createBooking(payload, intent.idempotencyKey, intent.owner));
  }
  await assert.rejects(api.createBooking(intent.body, undefined, intent.owner));
  assert.equal(count, 0);
});

test('recovery separates not-recorded and processing and rejects another owner', async () => {
  for (const [status, code, state] of [[404, 'RECOVERY_NOT_FOUND', 'not-recorded'], [409, 'RECOVERY_IN_PROGRESS', 'processing']]) {
    const api = createPassengerApi({ request: async () => { throw new ApiError('hidden', status, code); } });
    assert.deepEqual(await api.recoverBooking(intent.idempotencyKey, intent.owner, id(1)), { state });
  }
  const api = createPassengerApi({ request: async () => ({ ...booking, bookedByUserId: id(9) }) });
  await assert.rejects(api.recoverBooking(intent.idempotencyKey, intent.owner, id(1)), /chủ sở hữu/);
});

function ports(initial = null) {
  let saved = initial;
  const events = [];
  return {
    events, saved: () => saved,
    read: async () => saved,
    save: async value => { events.push('save'); saved = value; },
    clear: async () => { events.push('clear'); saved = null; },
    prepare: () => intent,
    create: async value => { events.push(['create', value]); return booking; },
    recover: async () => { events.push('recover'); return { state: 'not-recorded' }; },
    current: () => {}, changed: () => {},
  };
}

test('intent persists before POST; timeout preserves draft and only explicit same-intent retry writes', async () => {
  const p = ports();
  p.create = async () => { p.events.push('create'); throw new ApiError('timeout', 0); };
  await assert.rejects(processBookingIntent('create', p));
  assert.deepEqual(p.events, ['save', 'create']);
  assert.equal(p.saved(), intent);
  p.create = async value => { assert.equal(value, intent); p.events.push('retry'); return booking; };
  await processBookingIntent('lookup', p);
  assert.deepEqual(p.events, ['save', 'create', 'recover']);
  const result = await processBookingIntent('retry', p);
  assert.equal(result.state, 'completed');
  assert.deepEqual(p.events.slice(-2), ['recover', 'retry']);
});

test('processing/completed recovery never sends POST, including a second create tap', async () => {
  for (const state of ['processing', 'completed']) {
    const p = ports(intent);
    p.recover = async () => ({ state, ...(state === 'completed' ? { booking } : {}) });
    const result = await processBookingIntent('create', p);
    assert.equal(result.state, state);
    assert.deepEqual(p.events, []);
  }
});

test('draft validation, storage failure and session switch cannot start a booking', async () => {
  for (const fail of ['prepare', 'save', 'current']) {
    const p = ports();
    p[fail] = () => { throw new Error(fail); };
    await assert.rejects(processBookingIntent('create', p), new RegExp(fail));
    assert.ok(!p.events.some(event => Array.isArray(event)));
  }
});

test('only verified business rejection plus recovery absence permits discarding an intent', async () => {
  const p = ports(intent);
  await processBookingIntent('discard', p);
  assert.equal(p.saved(), intent);
  p.create = async () => { throw new ApiError('old policy', 409, 'QUOTE_POLICY_MISMATCH'); };
  await assert.rejects(processBookingIntent('retry', p));
  assert.equal(p.saved().rejected, true);
  await processBookingIntent('discard', p);
  assert.equal(p.saved(), null);
  for (const error of [new ApiError('unknown', 0), new ApiError('unknown', 500), new ApiError('unknown', 403), new ApiError('unknown', 409, 'IDEMPOTENCY_CONFLICT')]) {
    assert.equal(bookingWasRejected(error), false);
    assert.ok(!bookingErrorMessage(error).includes('unknown'));
  }
});

test('per-owner lock rejects concurrent route submissions and releases after failure', async () => {
  let release;
  const held = withIntentLock('owner', () => new Promise(resolve => { release = resolve; }), 'busy');
  await assert.rejects(withIntentLock('owner', async () => {}, 'busy'), /busy/);
  await withIntentLock('other-owner', async () => {}, 'busy');
  release(); await held;
  await assert.rejects(withIntentLock('owner', async () => { throw new Error('failed'); }, 'busy'));
  await withIntentLock('owner', async () => {}, 'busy');
});
