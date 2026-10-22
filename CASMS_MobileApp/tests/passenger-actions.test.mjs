import assert from 'node:assert/strict';
import test from 'node:test';
import { createPassengerApi } from '../src/features/passenger-actions/passenger-api.ts';
import { buildBooking, positiveQuantity, packageFits, canRegister, usablePassengers, registrationActions, serviceRequestActions, bookableCruises, money, personalPermissions } from '../src/features/passenger-actions/passenger-model.ts';
import { createApiClient, ApiError } from '../src/lib/api/api-client.ts';
import { readPermissions, toSession, readSession } from '../src/features/auth/session-model.ts';

const shipCruise = '11111111-1111-4111-8111-111111111111';
const cabin = '22222222-2222-4222-8222-222222222222';
const booking = '33333333-3333-4333-8333-333333333333';
const bp = '44444444-4444-4444-8444-444444444444';
const target = '55555555-5555-4555-8555-555555555555';
const user = '66666666-6666-4666-8666-666666666666';
const other = '77777777-7777-4777-8777-777777777777';

test('passenger assignments request only the own-user API and filter actual booking passenger rows', async () => {
  const calls = [];
  const client = createPassengerApi({ request: async (path, options) => {
    calls.push({ path, options });
    return [{ bookingPassengerId: bp, packageId: target }, { bookingPassengerId: other, packageId: target }];
  } });
  assert.deepEqual(await client.assignments([bp]), [{ bookingPassengerId: bp, packageId: target }]);
  assert.equal(calls[0].path, '/servicepackage/package-assignments');
  assert.equal(calls[0].options.query, undefined);
});
const modelRow = { key: 'a', fullName: 'Nguyễn An', email: '', phoneNumber: '', cabinId: cabin };
const details = { bookingId: booking, bookingStatus: 'Draft', passengers: [{ bookingPassengerId: bp }] };

test('booking checks combined cabin occupancy instead of checking each traveller separately', () => {
  assert.throws(() => buildBooking(shipCruise, [modelRow, { ...modelRow, key: 'b' }], [{ cabinId: cabin, cabinNumber: '101', remainingCapacity: 1 }], 'DEPOSIT', ''), /không đủ chỗ/);
  const payload = buildBooking(shipCruise, [modelRow], [{ cabinId: cabin, remainingCapacity: 1 }], 'STAGES', '  Ăn chay ');
  assert.deepEqual(payload.passengers[0], { fullName: 'Nguyễn An', cabinId: cabin });
  assert.equal(payload.notes, 'Ăn chay'); assert.equal(payload.paymentPlan, 'STAGES');
  assert.equal('currency' in payload, false); assert.equal('agreedFareAmount' in payload, false);
});
test('booking validates contacts, removed cabins and integer quantities', () => {
  assert.throws(() => buildBooking(shipCruise, [{ ...modelRow, phoneNumber: 'abc' }], [{ cabinId: cabin, remainingCapacity: 1 }], 'FULL', ''), /điện thoại/);
  assert.throws(() => buildBooking(shipCruise, [modelRow], [], 'FULL', ''), /chọn phòng/);
  for (const value of ['0', '-1', '1.2', '1e3', '', '2147483648']) assert.throws(() => positiveQuantity(value));
  assert.equal(positiveQuantity(' 2 '), 2);
});
test('only published future cruises are offered for creating bookings', () => {
  const date = '2026-11-01T00:00:00Z'; const now = Date.parse('2026-10-20T00:00:00Z');
  assert.equal(bookableCruises([{ status: 'PUBLISHED', departureDatetime: date }, { status: 'DRAFT', departureDatetime: date }, { status: 'PUBLISHED', departureDatetime: '2020-01-01' }], now).length, 1);
});
test('bookingPassengerId comes from active confirmed booking rows, never user identity', () => {
  const value = { bookingStatus: 'Confirmed', passengers: [{ bookingPassengerId: bp, participationStatus: 'Active' }, { bookingPassengerId: user, participationStatus: 'Cancelled' }] };
  assert.deepEqual(usablePassengers(value).map(p => p.bookingPassengerId), [bp]);
  assert.deepEqual(usablePassengers({ ...value, bookingStatus: 'Draft' }), []);
  assert.equal(usablePassengers({ ...value, bookingStatus: 'Draft' }, false).length, 1);
});
test('packages require a draft and dates covering the entire cruise', () => {
  const p = { status: 'ACTIVE', startDate: '2026-11-01', endDate: '2026-11-04' };
  const b = { bookingStatus: 'Draft', departureDatetime: '2026-11-01T10:00:00Z', returnDatetime: '2026-11-04T10:00:00Z' };
  assert.equal(packageFits(p, b), true);
  assert.equal(packageFits(p, { ...b, bookingStatus: 'Confirmed' }), false);
  assert.equal(packageFits(p, { ...b, returnDatetime: '2026-11-05T00:00:00Z' }), false);
  assert.equal(packageFits({ ...p, status: 'INACTIVE' }, b), false);
});
test('registration and service request lifecycle gates follow the actual BE transitions', () => {
  assert.deepEqual(registrationActions({ status: 'PENDING' }), ['confirm', 'edit', 'cancel']);
  assert.deepEqual(registrationActions({ status: 'CONFIRMED' }), ['cancel']);
  assert.deepEqual(registrationActions({ status: 'COMPLETED' }), []);
  assert.deepEqual(serviceRequestActions('ACCEPTED'), ['cancel']);
  assert.deepEqual(serviceRequestActions('IN_PROGRESS'), []);
  assert.equal(canRegister('OPEN', '2030-01-01', 1, 2), false);
  assert.equal(canRegister('FULL', '2030-01-01', 10, 1), false);
  assert.equal(canRegister('OPEN', '2020-01-01', 10, 1), false);
  assert.notEqual(money(null, 'USD'), money(0, 'USD'));
});
test('sessions preserve actual permissions and legacy sessions stay unknown, not inferred from role', () => {
  const dto = { accessToken: 'test', tokenType: 'Bearer', expiresIn: 1000, userId: user, username: 'demo', roles: ['PASSENGER'] };
  assert.equal(toSession(dto).user.effectivePermissions, null);
  assert.deepEqual(toSession({ ...dto, effectivePermissions: ['BOOKING_READ', 'BOOKING_READ'] }).user.effectivePermissions, ['BOOKING_READ']);
  assert.deepEqual(readSession(JSON.stringify(toSession(dto))).user.effectivePermissions, null);
  assert.throws(() => readPermissions(['BOOKING_READ', 4]));
});
test('personal screens reject mismatched, disabled and mixed staff identities', () => {
  const me = { userId: user, status: 'ACTIVE', roles: ['PASSENGER'], effectivePermissions: ['BOOKING_READ'] };
  assert.deepEqual(personalPermissions(user, me), ['BOOKING_READ']);
  assert.deepEqual(personalPermissions(user, { ...me, effectivePermissions: [] }), []);
  assert.equal(personalPermissions(other, me), null);
  assert.equal(personalPermissions(user, { ...me, roles: ['PASSENGER', 'ADMIN'] }), null);
  assert.equal(personalPermissions(user, { ...me, status: 'INACTIVE' }), null);
});
test('API uses all booking pages and rejects incomplete or duplicate results', async () => {
  const pages = [];
  const api = createPassengerApi({ async request(path, options) {
    pages.push(options.query.page);
    return { number: options.query.page, totalPages: 2, totalElements: 2, content: [{ bookingId: options.query.page ? other : booking }] };
  } });
  assert.equal((await api.bookings()).length, 2); assert.deepEqual(pages, [0, 1]);
  await assert.rejects(createPassengerApi({ async request() { return { number: 0, totalPages: 1, totalElements: 2, content: [{ bookingId: booking }] }; } }).bookings(), /Chưa tải đủ/);
  await assert.rejects(createPassengerApi({ async request() { return { number: 0, totalPages: 1, totalElements: 2, content: [{ bookingId: booking }, { bookingId: booking }] }; } }).bookings(), /trùng/);
});
test('booking creation and cancellation use server IDs and do not invent a payment or confirmation API', async () => {
  const calls = [];
  const api = createPassengerApi({ async request(path, options) { calls.push({ path, ...options }); return details; } });
  await api.createBooking({ cruiseId: shipCruise, passengers: [] });
  await api.cancelBooking(booking, '  Đổi kế hoạch  ');
  assert.equal(calls[0].path, '/booking'); assert.equal(calls[0].method, 'POST');
  assert.equal(calls[1].path, `/booking/${booking}/cancel`); assert.deepEqual(calls[1].body, { reason: 'Đổi kế hoạch' });
  assert.equal('confirmBooking' in api, false);
  await assert.rejects(api.cancelBooking(booking, ' '));
  await assert.rejects(api.booking('../all'));
});
test('services support authenticated PUT and POST cancel without staff-only action routes', async () => {
  const seen = [];
  const transport = createApiClient({ baseUrl: () => 'http://test/api', fetch: async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token'); seen.push({ url, ...options });
    return Response.json({ success: true, data: { id: target } });
  } }); transport.setToken('test-token');
  const api = createPassengerApi(transport);
  await api.createRequest(target, bp, 2, '  Không đường ');
  await api.updateRequest(target, 3, ''); await api.cancelRequest(target);
  assert.equal(JSON.parse(seen[0].body).bookingPassengerId, bp);
  assert.equal(JSON.parse(seen[0].body).note, 'Không đường');
  assert.equal(seen[1].method, 'PUT'); assert.equal(seen[2].url, `http://test/api/servicepackage/requests/${target}/cancel`);
});
test('post-booking service requests reject missing passenger linkage before HTTP', () => {
  let calls = 0;
  const api = createPassengerApi({ async request() { calls++; return {}; } });
  assert.throws(() => api.createRequest(target, '', 1, ''), /không hợp lệ/);
  assert.throws(() => api.createRequest(target, null, 1, ''), /không hợp lệ/);
  assert.equal(calls, 0);
});

test('activities register against the selected bookingPassenger and use the correct target routes', async () => {
  const calls = []; const api = createPassengerApi({ async request(path, options) { calls.push({ path, ...options }); return {}; } });
  await api.register('activity', target, bp, 1); await api.register('excursion', target, bp, 2);
  await api.confirmRegistration(target); await api.updateRegistration(target, 3); await api.cancelRegistration(target, 'Đổi lịch');
  assert.equal(calls[0].path, `/activities/${target}/registrations`);
  assert.equal(calls[1].path, `/activities/excursions/${target}/registrations`);
  assert.equal(calls[1].body.bookingPassengerId, bp); assert.equal(calls[3].method, 'PUT');
  assert.deepEqual(calls[4].query, { reason: 'Đổi lịch' });
});
test('excursions are resolved through real itinerary routes and scoped to the booked cruise', async () => {
  const calls = []; const stop = other;
  const api = createPassengerApi({ async request(path, options) {
    calls.push(path);
    if (path === '/itineraries') return { content: [{ itineraryId: target, cruiseId: shipCruise, status: 'ACTIVE' }, { itineraryId: user, cruiseId: other, status: 'ACTIVE' }], number: 0, totalPages: 1, totalElements: 2 };
    if (path === `/cruise-stops/by-itinerary/${target}`) return [{ cruiseStopId: stop }];
    if (path === '/shore-excursions') { assert.equal(options.query.cruiseStopId, stop); return [{ shoreExcursionId: cabin }]; }
    throw new Error(`Unexpected endpoint: ${path}`);
  } });
  assert.equal((await api.excursions(shipCruise))[0].shoreExcursionId, cabin);
  assert.deepEqual(calls, ['/itineraries', `/cruise-stops/by-itinerary/${target}`, '/shore-excursions']);
});
test('package assignment uses POST for initial selection, PUT for change and DELETE for removal', async () => {
  const calls = []; const api = createPassengerApi({ async request(path, options) { calls.push({ path, ...options }); } });
  await api.savePackage(bp, target, false); await api.savePackage(bp, other, true); await api.removePackage(bp);
  assert.deepEqual(calls.map(c => c.method), ['POST', 'PUT', 'DELETE']);
  assert.equal(calls[0].path, `/servicepackage/package-assignments/${bp}`);
  assert.deepEqual(calls[1].body, { tourPackageId: other });
});
test('network failure is not automatically replayed for a create request', async () => {
  let attempts = 0;
  const transport = createApiClient({ baseUrl: () => 'http://test/api', fetch: async () => { attempts++; throw new Error('lost'); } });
  await assert.rejects(createPassengerApi(transport).createRequest(target, bp, 1, ''), e => e instanceof ApiError && e.status === 0);
  assert.equal(attempts, 1);
});


test('service input validates availability, bounded integer quantity and notes before submitting', async () => {
  const { serviceRequestInput } = await import('../src/features/passenger-actions/passenger-model.ts');
  const service = { status: 'ACTIVE', capacity: 2 };
  assert.deepEqual(serviceRequestInput(service, ' 2 ', '  Không đường  '), { quantity: 2, note: 'Không đường' });
  assert.throws(() => serviceRequestInput(service, '3', ''), /khả năng tiếp nhận/);
  assert.throws(() => serviceRequestInput({ ...service, status: 'SUSPENDED' }, '1', ''), /không tiếp nhận/);
  assert.throws(() => serviceRequestInput(service, '1.5', ''), /nguyên dương/);
  assert.throws(() => serviceRequestInput(service, '1', 'a'.repeat(501)), /500/);
  assert.equal(serviceRequestInput({ ...service, capacity: null }, '3', '').quantity, 3);
});
