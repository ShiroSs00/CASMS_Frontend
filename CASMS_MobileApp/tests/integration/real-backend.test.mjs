import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApiClient } from '../../src/lib/api/api-client.ts';
import { createPassengerApi } from '../../src/features/passenger-actions/passenger-api.ts';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === '../../lib/api/api-client' ? `${specifier}.ts` : specifier, context);
} });
const { createItineraryApi } = await import('../../src/features/itinerary/itinerary-client.ts');
const transport = createApiClient({ baseUrl: () => 'http://127.0.0.1:18080/api' });
const api = createPassengerApi(transport);
const itinerary = createItineraryApi(transport);
const id = suffix => `a1000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

before(async () => {
  const login = await transport.request('/auth/login', { method: 'POST', authenticated: false, body: { username: 'ocevie.mobile.qa', password: 'OcevieQa@2026' } });
  transport.setToken(login.accessToken);
  const me = await api.me();
  assert.equal(me.userId, id(1), 'Run only against the explicitly seeded QA identity');
  assert.deepEqual(me.roles, ['PASSENGER']);
});

test('real JWT /auth/me and own booking, cruise and cabin reads match mobile adapters', async () => {
  const bookings = await api.bookings(); assert.ok(bookings.some(b => b.bookingId === id(61)));
  const booking = await api.booking(id(61));
  assert.equal(booking.bookingStatus, 'Confirmed'); assert.equal(booking.passengers[0].bookingPassengerId, id(71));
  assert.equal(booking.passengers[0].cabinNumber, '801');
  assert.ok((await api.cruises()).some(c => c.cruiseId === id(31)));
  assert.ok((await api.cabins(id(31))).some(c => c.cabinId === id(7)));
});

test('real old itinerary routes return four Asian ports and two ship time zones', async () => {
  assert.ok((await itinerary.catalog()).itineraries.some(i => i.itineraryId === id(32)));
  const result = await itinerary.detail(id(32));
  assert.equal(result.days.length, 4); assert.equal(result.stops.length, 4);
  assert.deepEqual(result.days.map(d => d.shipTimeZoneId), ['Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Kuala_Lumpur', 'Asia/Bangkok']);
  assert.ok(result.history.items.some(h => h.changeHistoryId === id(141)));
  assert.equal((await itinerary.tours(id(52)))[0].shoreExcursionId, id(121));
  await assert.rejects(itinerary.groups(id(121)), error => error.status === 403);
});

test('real service request create/edit/cancel is persisted in PostgreSQL', async () => {
  assert.equal((await api.serviceAvailability(id(91), 1)).available, true);
  const created = await api.createRequest(id(91), id(71), 1, 'Mobile API integration');
  assert.equal(created.status, 'REQUESTED');
  assert.equal((await api.updateRequest(created.id, 2, 'Updated through mobile adapter')).quantity, 2);
  assert.equal((await api.cancelRequest(created.id)).status, 'CANCELLED');
  assert.ok((await api.requests()).some(r => r.id === created.id && r.status === 'CANCELLED'));
  const script = fileURLToPath(new URL('./qa_database.py', import.meta.url));
  const value = execFileSync('python', [script, '--query', `SELECT status FROM "ServiceRequest" WHERE service_request_id='${created.id}'`], { encoding: 'utf8' }).trim();
  assert.equal(value, 'CANCELLED');
});

test('real activity and excursion registration lifecycle matches mobile actions', async () => {
  assert.ok((await api.activities()).some(a => a.id === id(101)));
  assert.ok((await api.excursions(id(31))).some(e => e.shoreExcursionId === id(121)));
  for (const [kind, target] of [['activity', id(101)], ['excursion', id(121)]]) {
    const registration = await api.register(kind, target, id(71), 1);
    assert.equal(registration.status, 'PENDING');
    assert.equal((await api.updateRegistration(registration.id, 2)).quantity, 2);
    assert.equal((await api.confirmRegistration(registration.id)).status, 'CONFIRMED');
    assert.equal((await api.cancelRegistration(registration.id, 'Integration cleanup')).status, 'CANCELLED');
  }
});

test('real package benefits and draft assignment use POST/PUT/DELETE without a fake payment', async () => {
  assert.ok((await api.packages()).some(p => p.id === id(131)));
  const benefits = await api.benefits(id(131));
  assert.equal(benefits.services[0].serviceId, id(91)); assert.equal(benefits.activities[0].activityId, id(101));
  assert.equal(benefits.excursions[0].excursionId, id(121));
  if ((await api.assignments([id(72)])).length) await api.removePackage(id(72));
  assert.equal((await api.savePackage(id(72), id(131), false)).packageId, id(131));
  assert.equal((await api.savePackage(id(72), id(131), true)).packageId, id(131));
  assert.equal((await api.assignments([id(72)])).length, 1);
  await api.removePackage(id(72)); assert.deepEqual(await api.assignments([id(72)]), []);
});

test('real booking creation and cancellation return authoritative fare and state', async () => {
  const created = await api.createBooking({ cruiseId: id(31), passengers: [{ fullName: 'QA Booking Passenger', email: 'booking@ocevie.example', cabinId: id(7) }], paymentPlan: 'DEPOSIT', notes: 'Real API integration' });
  assert.equal(created.bookingStatus, 'Draft'); assert.equal(created.passengers.length, 1);
  assert.equal(typeof created.agreedFareAmount, 'number');
  assert.equal((await api.cancelBooking(created.bookingId, 'Integration cleanup')).bookingStatus, 'Cancelled');
});
