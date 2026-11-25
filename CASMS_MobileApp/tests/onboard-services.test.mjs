import assert from 'node:assert/strict';
import test from 'node:test';
import './register-typescript.mjs';
const { createPassengerApi } = await import('../src/features/passenger-actions/passenger-api.ts');
const { ownRequests, filterServices, matchingEntitlements, matchesRequestIntent, serviceOperationSchema, onboardScopeIsCurrent, serviceNoteFingerprint } = await import('../src/features/passenger-actions/onboard-contracts.ts');
const { serviceRequestActions, registrationActions, canRegister, money } = await import('../src/features/passenger-actions/passenger-model.ts');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const service = { id: id(1), code: 'QA', name: 'Trà chiều', description: 'Ẩm thực', type: 'DINING', price: null, currency: 'EUR', capacity: 10, status: 'ACTIVE', requiresSchedule: true, canBuyPreCruise: true, categoryId: id(2) };
const slot = { id: id(3), serviceId: id(1), cruiseId: id(4), startsAt: '2099-01-01T00:00:00Z', endsAt: '2099-01-01T01:00:00Z', location: 'QA', capacity: 10, remainingCapacity: 0, status: 'OPEN' };
const request = { id: id(5), serviceId: id(1), passengerId: id(6), bookingId: id(7), bookingPassengerId: id(8), quantity: 1, status: 'REQUESTED', requestTime: '2026-01-01T00:00:00Z', completedAt: null, note: null };
const grant = { grantId: id(9), bookingPassengerId: id(8), benefitName: 'Trà chiều', inclusion: 'LIMITED_INCLUDED', sourcePackageName: 'QA package', grantedAt: null, status: 'ACTIVE', usagePolicy: null, usageUnit: null, serviceUnitCode: 'VISIT', grantedQuantity: 3, usedQuantity: 3, remainingQuantity: 0, requiresReservation: true, usageStartsAt: null, usageEndsAt: null, occurrences: [{ resourceType: 'SERVICE', resourceId: id(1), name: 'QA' }], registrations: [], blockers: [{ code: 'ENTITLEMENT_EXHAUSTED', message: 'Đã hết định mức', dependencyId: id(9) }], canRegister: false };

test('catalogue search/category compose and empty/inactive records are handled without made-up categories', () => {
  assert.equal(filterServices([service], 'trà', id(2)).length, 1);
  assert.deepEqual(filterServices([service], 'trà', id(99)), []);
  assert.deepEqual(filterServices([], '', ''), []);
  assert.deepEqual(filterServices([{ ...service, status: 'INACTIVE' }], '', ''), []);
});
test('service request visibility isolates BookingPassenger even inside the same booking', () => {
  assert.deepEqual(ownRequests([request, { ...request, bookingPassengerId: id(99) }, { ...request, bookingId: id(98) }], id(7), id(8)), [request]);
  assert.deepEqual(ownRequests([request], '', id(8)), []);
});
test('server entitlements match exact resource IDs and passenger, never names or package presence', () => {
  assert.deepEqual(matchingEntitlements([grant], id(8), 'SERVICE', id(1)), [grant]);
  assert.deepEqual(matchingEntitlements([grant], id(99), 'SERVICE', id(1)), []);
  assert.deepEqual(matchingEntitlements([grant], id(8), 'ACTIVITY', id(1)), []);
  assert.deepEqual(matchingEntitlements([{ ...grant, occurrences: [] }], id(8), 'SERVICE', id(1)), []);
});
test('null price is unknown and currency is not converted or replaced', () => {
  assert.equal(money(null, 'EUR'), 'Chưa có giá');
  assert.notEqual(money(10, 'EUR'), money(10, 'USD'));
});
test('service detail and availability validate identity, quantity and financial precision', async () => {
  const api = createPassengerApi({ request: async path => path.endsWith('/availability') ? { serviceId: id(1), requestedQuantity: 2, available: true } : service });
  assert.equal((await api.service(id(1))).price, null);
  assert.equal((await api.serviceAvailability(id(1), 2)).available, true);
  await assert.rejects(api.service(id(99)));
  await assert.rejects(api.serviceAvailability(id(1), 3));
  await assert.rejects(createPassengerApi({ request: async () => ({ ...service, price: 2 ** 39 }) }).service(id(1)));
});
test('schedule accepts server zero capacity and rejects mismatched or corrupt slots', async () => {
  assert.equal((await createPassengerApi({ request: async () => [slot] }).serviceSchedules(id(1)))[0].remainingCapacity, 0);
  for (const patch of [{ remainingCapacity: 11 }, { endsAt: slot.startsAt }, { serviceId: id(99) }]) await assert.rejects(createPassengerApi({ request: async () => [{ ...slot, ...patch }] }).serviceSchedules(id(1)));
});
test('entitlement API uses booking projection and retains zero/null quota and blockers', async () => {
  const api = createPassengerApi({ request: async path => { assert.equal(path, `/booking/${id(7)}/cruise-package-entitlements`); return [grant]; } });
  const rows = await api.entitlements(id(7));
  assert.equal(rows[0].remainingQuantity, 0); assert.equal(rows[0].canRegister, false); assert.equal(rows[0].grantedAt, null);
  await assert.rejects(createPassengerApi({ request: async () => [{ ...grant, remainingQuantity: -1 }] }).entitlements(id(7)));
});
test('recovery distinguishes the original intent from changed quantity, note, slot and owner', () => {
  const intended = { ...request, note: '' };
  assert.equal(matchesRequestIntent(request, intended), true);
  for (const patch of [{ quantity: 2 }, { note: 'changed' }, { scheduleId: id(3) }, { bookingPassengerId: id(99) }]) assert.equal(matchesRequestIntent(request, { ...intended, ...patch }), false);
  assert.equal(serviceOperationSchema.safeParse({ key: 'same-intent', bookingId: id(7), bookingPassengerId: id(8), serviceId: id(1), payload: { quantity: 1, scheduleId: null, noteFingerprint: 'cbf29ce484222325' } }).success, true);
  assert.equal(serviceOperationSchema.safeParse({ key: 'bad', bookingId: {}, bookingPassengerId: id(8), serviceId: id(1) }).success, false);
});
test('edit/cancel schemas reject HTTP200 missing identity or unknown lifecycle', async () => {
  for (const bad of [{}, { ...request, status: 'FULFILLED' }, { ...request, bookingPassengerId: 'wrong' }]) {
    const api = createPassengerApi({ request: async () => bad });
    await assert.rejects(api.updateRequest(id(5), 1, '')); await assert.rejects(api.cancelRequest(id(5)));
  }
});
test('request and registration lifecycle do not expose staff fulfillment or attendance', () => {
  assert.deepEqual(serviceRequestActions('REQUESTED'), ['edit','cancel']);
  assert.deepEqual(serviceRequestActions('IN_PROGRESS'), []);
  assert.deepEqual(registrationActions({ status: 'PENDING' }), ['confirm','edit','cancel']);
  assert.deepEqual(registrationActions({ status: 'COMPLETED' }), []);
  assert.equal(canRegister('FULL', '2099-01-01', 0, 1), false);
  assert.equal(canRegister('OPEN', '2000-01-01', 10, 1), false);
});
test('registration requires one valid target and schema; a lost POST is not automatically replayed', async () => {
  let count = 0;
  const api = createPassengerApi({ request: async () => { count++; throw new Error('test network loss'); } });
  await assert.rejects(api.register('activity', id(1), id(8), 1)); assert.equal(count, 1);
  const invalid = { id: id(5), passengerId: id(6), bookingPassengerId: id(8), activityId: id(1), excursionId: id(2), quantity: 1, status: 'PENDING', registeredAt: '2026-01-01T00:00:00Z' };
  await assert.rejects(createPassengerApi({ request: async () => [invalid] }).registrations());
});

test('excursion resolution follows exact itinerary/stop IDs and ignores omitted calls and wrong-stop results', async () => {
  const calls = [];
  const tour = { shoreExcursionId: id(12), cruiseStopId: id(10), excursionName: 'QA', startTime: '2099-01-01T00:00:00Z', plannedReturnTime: '2099-01-01T01:00:00Z', status: 'OPEN', price: null, currencyCode: null, availableCapacity: 4 };
  const api = createPassengerApi({ request: async (path, options) => {
    calls.push(path);
    if (path === '/itineraries/mine') return [{ bookingId: id(7), bookingReference: 'QA', bookingPassengerId: id(8), cruiseId: id(4), cruiseName: 'QA', cruiseStatus: 'PUBLISHED', bookingStatus: 'Confirmed', participationStatus: 'Active', itineraryId: id(9), itineraryStatus: 'ACTIVE' }];
    if (path.startsWith('/cruise-stops/')) return [{ cruiseStopId: id(10), itineraryId: id(9), status: 'PLANNED', portName: 'Cảng QA', arrivalItineraryDayId: id(13), portTimeZoneId: 'Asia/Tokyo' }, { cruiseStopId: id(11), itineraryId: id(9), status: 'OMITTED' }];
    assert.equal(options.query.cruiseStopId, id(10));
    return [tour, { ...tour, shoreExcursionId: id(14), cruiseStopId: id(99) }];
  } });
  const rows = await api.excursions(id(4)); assert.equal(rows.length, 1); assert.equal(rows[0].portName, 'Cảng QA'); assert.equal(rows[0].arrivalItineraryDayId, id(13)); assert.equal(calls.length, 3);
});
test('availability and registration response identities cannot be replaced by malformed HTTP200', async () => {
  const api = createPassengerApi({ request: async () => ({ activityId: id(99), capacity: 10, availableSeats: 2, status: 'OPEN' }) });
  await assert.rejects(api.activityAvailability(id(1)));
  await assert.rejects(createPassengerApi({ request: async () => ({}) }).confirmRegistration(id(5)));
});

test('late action guard rejects voyage/person/account/session/environment changes and expired sessions before writes', () => {
  const expected = { backend: 'https://a.invalid/api', owner: id(6), epoch: 1, bookingId: id(7), bookingPassengerId: id(8) };
  const current = { backend: expected.backend, owner: expected.owner, epoch: 1, expiresAt: 100, authenticated: true };
  const selected = { apiUrl: expected.backend, owner: expected.owner, signedInAt: 1, bookingId: id(7), bookingPassengerId: id(8) };
  assert.equal(onboardScopeIsCurrent(expected, current, selected, 50), true);
  for (const patch of [{ backend: 'https://b.invalid/api' }, { owner: id(99) }, { epoch: 2 }, { expiresAt: 50 }, { authenticated: false }]) assert.equal(onboardScopeIsCurrent(expected, { ...current, ...patch }, selected, 50), false);
  assert.equal(onboardScopeIsCurrent(expected, current, { ...selected, bookingPassengerId: id(99) }, 50), false);
  assert.equal(onboardScopeIsCurrent(expected, current, { ...selected, bookingId: id(99) }, 50), false);
});

test('business rejection keeps a meaningful recovery instruction without raw backend implementation text', async () => {
  const { onboardError } = await import('../src/features/passenger-actions/onboard-errors.ts');
  const { ApiError } = await import('../src/lib/api/api-client.ts');
  assert.match(onboardError(new ApiError('test raw implementation detail', 409, 'IDEMPOTENCY_CONFLICT')).message, /Đối soát/);
  assert.match(onboardError(new ApiError('test raw implementation detail', 409, 'ENTITLEMENT_EXHAUSTED')).message, /định mức/);
});

test('NON_NULL serialization preserves unknown amounts and quota, and does not require an absent null registration target', async () => {
  const compact = Object.fromEntries(Object.entries(grant).filter(([,value]) => value !== null));
  delete compact.remainingQuantity;
  const [decoded] = await createPassengerApi({ request: async () => [compact] }).entitlements(id(7));
  assert.equal(decoded.grantedAt, null); assert.equal(decoded.remainingQuantity, null);
  const registered = { id: id(5), passengerId: id(6), bookingPassengerId: id(8), activityId: id(1), quantity: 1, status: 'PENDING', registeredAt: '2026-01-01T00:00:00Z' };
  assert.equal((await createPassengerApi({ request: async () => [registered] }).registrations())[0].excursionId, null);
});
test('journal note fingerprint preserves intent comparison without persisting raw note text', () => {
  assert.equal(serviceNoteFingerprint('  ghi chú  '), serviceNoteFingerprint('ghi chú'));
  assert.notEqual(serviceNoteFingerprint('a'), serviceNoteFingerprint('b'));
  const payload = serviceOperationSchema.parse({ key: 'key', bookingId: id(7), bookingPassengerId: id(8), serviceId: id(1), payload: { quantity: 1, scheduleId: null, noteFingerprint: serviceNoteFingerprint('ghi chú'), note: 'ghi chú' } });
  assert.equal(JSON.stringify(payload).includes('ghi chú'), false);
});
