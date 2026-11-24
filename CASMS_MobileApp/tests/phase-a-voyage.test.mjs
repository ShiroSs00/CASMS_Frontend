import assert from 'node:assert/strict';
import test from 'node:test';
import './register-typescript.mjs';
import { validateLogin } from '../src/features/auth/login-model.ts';
import { createApiClient } from '../src/lib/api/api-client.ts';
import { createPassengerApi } from '../src/features/passenger-actions/passenger-api.ts';
import { chooseVoyage, resolveVoyage, restoredVoyageSelection, useVoyageSelection } from '../src/features/passenger-actions/voyage-selection.ts';
import { voyagePassenger, voyageAllowsActions } from '../src/features/passenger-actions/passenger-model.ts';
const { landingLink, loginLink, workspaceDestination } = await import('../src/features/auth/workspace-navigation.ts');
const { createItineraryApi } = await import('../src/features/itinerary/itinerary-client.ts');
const { itineraryToday, nextRegisteredActivity } = await import('../src/features/home/voyage-home-model.ts');

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const passenger = { roles: ['PASSENGER'] };
const staff = { roles: ['ONBOARD_STAFF'] };
const scope = { owner: id(1), signedInAt: 1, apiUrl: 'https://fixture.invalid/api' };
const item = { bookingId: id(2), bookingPassengerId: id(3), cruiseId: id(4), bookingReference: 'BOOKING',
  cruiseName: 'Chuyến thử nghiệm', bookingStatus: 'Confirmed', cruiseStatus: 'PUBLISHED', participationStatus: 'Active', registeredActivities: [] };
const profile = { userId: id(1), username: 'fixture', status: 'ACTIVE', roles: ['PASSENGER'], effectivePermissions: ['BOOKING_READ'] };

test('login follows Backend required fields without altering the password', () => {
  assert.ok(validateLogin({ username: ' ', password: ' ' }).username);
  assert.ok(validateLogin({ username: 'a', password: ' ' }).password);
  assert.deepEqual(validateLogin({ username: ' a ', password: ' x ' }), { username: undefined, password: undefined });
});

test('role landing is explicit for Passenger, Staff, terminal, and unsupported roles', () => {
  assert.equal(workspaceDestination(passenger), '/home');
  assert.equal(workspaceDestination(staff), '/staff-pos');
  assert.equal(workspaceDestination({ roles: ['POS'] }), '/staff-pos');
  assert.equal(workspaceDestination({ roles: ['OPERATIONS_MANAGER'], effectivePermissions: ['POS_ACCESS'] }), '/staff-pos');
  assert.equal(workspaceDestination({ roles: ['ADMIN'] }), null);
  assert.equal(workspaceDestination({ roles: ['PASSENGER', 'ONBOARD_STAFF'] }), null);
});

test('anonymous deep link resumes the intended route within its workspace only', () => {
  const route = `/passenger-bookings/${id(2)}`;
  assert.deepEqual(loginLink('anonymous', route), { pathname: '/login', params: { state: 'default', returnTo: route } });
  assert.deepEqual(landingLink(passenger, route), { pathname: '/passenger-bookings/[bookingId]', params: { bookingId: id(2) } });
  assert.deepEqual(landingLink(passenger, '/check-in', id(2)), { pathname: '/check-in', params: { bookingId: id(2) } });
  assert.equal(landingLink(staff, '/staff-pos/scanner'), '/staff-pos/scanner');
  assert.equal(landingLink(staff, route), '/staff-pos');
  assert.equal(landingLink(passenger, '/staff-pos/scanner'), '/home');
  for (const value of ['https://fixture.invalid', '/passenger-bookings/../new', '/loading', '/login']) assert.equal(landingLink(passenger, value), '/home');
  assert.equal(loginLink('signed-out', route).params.returnTo, undefined);
  assert.equal(loginLink('expired', route).params.state, 'expired');
});

test('empty, single and ambiguous voyages never choose a different passenger silently', () => {
  useVoyageSelection.setState({ selection: null, handledRoutes: {} });
  const otherPassenger = { ...item, bookingPassengerId: id(6) };
  const otherBooking = { ...item, bookingId: id(7), bookingPassengerId: id(8), cruiseId: id(9) };
  assert.equal(resolveVoyage(scope, null, []), undefined);
  assert.equal(resolveVoyage(scope, null, [item]), item);
  assert.equal(resolveVoyage(scope, null, [item, otherBooking]), undefined);
  assert.equal(chooseVoyage(scope, [item, otherPassenger], item.bookingId), false);
  assert.equal(chooseVoyage(scope, [item, otherPassenger], item.bookingId, otherPassenger.bookingPassengerId), true);
  const chosen = useVoyageSelection.getState().selection;
  assert.equal(resolveVoyage(scope, chosen, [item, otherPassenger]), otherPassenger);
  assert.equal(resolveVoyage(scope, chosen, [item]), undefined);
  assert.equal(resolveVoyage(scope, null, [{ ...item, bookingStatus: 'Cancelled' }]), undefined);
  assert.equal(resolveVoyage(scope, null, [{ ...item, participationStatus: 'Cancelled' }]), undefined);
});

test('restored voyage is scoped and checked again against actual records', () => {
  const selection = restoredVoyageSelection(scope, { bookingId: item.bookingId, bookingPassengerId: item.bookingPassengerId });
  assert.equal(resolveVoyage(scope, selection, [item]), item);
  assert.equal(resolveVoyage(scope, selection, [{ ...item, bookingPassengerId: id(15) }]), undefined);
  assert.equal(restoredVoyageSelection(scope, { bookingId: item.bookingId, bookingPassengerId: 'bad' }), null);
});

test('cabin can be unassigned; matching requires the correct booking, cruise and active passenger', () => {
  const person = { bookingPassengerId: id(3), passengerId: id(11), participationStatus: 'Active', cabinId: null, cabinNumber: null };
  const booking = { bookingId: id(2), cruiseId: id(4), bookingStatus: 'Confirmed', passengers: [person] };
  assert.equal(voyagePassenger(item, booking, id(11)).cabinId, null);
  assert.equal(voyagePassenger(item, booking, id(12)), undefined);
  assert.equal(voyagePassenger(item, { ...booking, cruiseId: id(12) }, id(11)), undefined);
  assert.equal(voyagePassenger(item, { ...booking, bookingStatus: 'Cancelled' }, id(11)), undefined);
  assert.equal(voyagePassenger(item, { ...booking, passengers: [{ ...person, participationStatus: 'Cancelled' }] }), undefined);
  assert.equal(voyageAllowsActions('PUBLISHED'), true);
  assert.equal(voyageAllowsActions('COMPLETED'), false);
});

test('Passenger DTO accepts nullable itinerary and profile details and rejects spoofed identifiers and states', async () => {
  assert.equal((await createPassengerApi({ request: async () => [item] }).voyages())[0].itineraryId, undefined);
  const api = createPassengerApi({ request: async () => ({ ...profile, fullName: 'Hành khách QA', documentNumber: 'test-only' }) });
  const me = await api.me();
  assert.equal(me.fullName, 'Hành khách QA');
  assert.equal(me.phoneNumber, null);
  assert.equal('documentNumber' in me, false);
  for (const invalid of [{ cruiseId: 'bad' }, { participationStatus: 'UNKNOWN' }, { startDate: '2026-02-31' }]) {
    await assert.rejects(createPassengerApi({ request: async () => [{ ...item, ...invalid }] }).voyages());
  }
  await assert.rejects(createPassengerApi({ request: async () => [item, item] }).voyages(), /trùng/);
  await assert.rejects(createPassengerApi({ request: async () => ({ ...profile, phoneNumber: 42 }) }).me());
});

test('cruise detail accepts no assigned ship and rejects a response for another cruise', async () => {
  const detail = { cruiseId: id(4), cruiseName: 'Chuyến thử nghiệm', cruiseCode: 'T1', status: 'PUBLISHED', shipId: null,
    departureDatetime: '2026-11-25T10:00:00Z', returnDatetime: '2026-11-26T10:00:00Z' };
  assert.equal((await createPassengerApi({ request: async () => detail }).voyageCruise(id(4))).shipId, null);
  await assert.rejects(createPassengerApi({ request: async () => detail }).voyageCruise(id(9)), /không khớp/);
});

test('scoped itinerary rejects malformed day and unrelated voyage', async () => {
  const itineraryId = id(21), cruiseId = id(4);
  const itinerary = { itineraryId, cruiseId, itineraryName: 'Lịch thử nghiệm', status: 'ACTIVE', startDate: '2026-11-25', endDate: '2026-11-26' };
  const day = { itineraryDayId: id(22), itineraryId, dayNumber: 1, date: '2026-11-25', dayType: 'SEA_DAY', shipTimeZoneId: 'Asia/Saigon' };
  let data = day;
  const api = createItineraryApi({ request: async path => path.endsWith('/days') ? [data] : path.startsWith('/cruise-stops') ? [] : itinerary });
  assert.equal((await api.detail(itineraryId, undefined, { cruise: false, history: false, expectedCruiseId: cruiseId })).days[0].date, day.date);
  data = { ...day, date: 'invalid' };
  await assert.rejects(api.detail(itineraryId, undefined, { cruise: false, history: false, expectedCruiseId: cruiseId }), /không khớp/);
  await assert.rejects(api.detail(itineraryId, undefined, { expectedCruiseId: id(9) }), /không khớp/);
});

test('home chooses today using ship timezone and only upcoming confirmed registrations', () => {
  const now = Date.parse('2026-11-24T18:00:00Z');
  const days = [{ date: '2026-11-24', shipTimeZoneId: 'Asia/Singapore' }, { date: '2026-11-25', shipTimeZoneId: 'Asia/Singapore' }];
  assert.equal(itineraryToday(days, now), days[1]);
  assert.equal(itineraryToday([{ date: '2026-11-25', shipTimeZoneId: null }], now), undefined);
  const activities = [{ startTime: '2026-11-24T19:00:00Z', registrationStatus: 'PENDING', activityStatus: 'OPEN' },
    { startTime: '2026-11-24T20:00:00Z', registrationStatus: 'CONFIRMED', activityStatus: 'OPEN' }];
  assert.equal(nextRegisteredActivity({ ...item, registeredActivities: activities }, now), activities[1]);
  assert.equal(nextRegisteredActivity({ ...item, cruiseStatus: 'COMPLETED', registeredActivities: activities }, now), undefined);
});

test('login keeps network failure distinct and explicit retry can succeed', async () => {
  let calls = 0;
  const api = createApiClient({ baseUrl: () => scope.apiUrl, fetch: async () => {
    if (++calls === 1) throw new TypeError('Network down');
    if (calls === 2) return Response.json({ success: false, code: 'INVALID_CREDENTIALS' }, { status: 401 });
    return Response.json({ success: true, data: { userId: id(1) } });
  } });
  const login = () => api.request('/auth/login', { method: 'POST', authenticated: false, body: { username: 'fixture', password: 'test-only' } });
  await assert.rejects(login(), error => error.status === 0 && /kết nối/.test(error.message));
  assert.equal(calls, 1);
  await assert.rejects(login(), error => error.status === 401 && error.code === 'INVALID_CREDENTIALS');
  assert.deepEqual(await login(), { userId: id(1) });
});
