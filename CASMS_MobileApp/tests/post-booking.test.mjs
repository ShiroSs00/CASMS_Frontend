import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './register-typescript.mjs';
import { createApiClient } from '../src/lib/api/api-client.ts';
import { createPassengerApi } from '../src/features/passenger-actions/passenger-api.ts';
import { availableVoyages, chooseVoyage, forgetVoyageRoute, resolveVoyage, scopedSelection, useVoyageSelection, voyageScopeKey } from '../src/features/passenger-actions/voyage-selection.ts';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope = { owner: id(1), apiUrl: 'https://fixture.invalid/api', signedInAt: 10 };
const voyage = (n, extra = {}) => ({ bookingId: id(n), bookingReference: `WEB-${n}`, bookingPassengerId: id(n + 10), cruiseId: id(n + 20), cruiseName: `Voyage ${n}`, cruiseStatus: 'PUBLISHED', bookingStatus: 'Confirmed', participationStatus: 'Active', ...extra });
const rows = [voyage(2), voyage(3)];
const detail = { ...rows[0], cruiseCode: 'WEB', departureDatetime: '2027-01-01T00:00:00Z', returnDatetime: '2027-01-03T00:00:00Z', createdAt: '2026-11-10T00:00:00Z',
  agreedFareAmount: 500, currency: 'USD', requiredDepositAmount: 150, paymentPlan: 'DEPOSIT',
  installments: [{ sequenceNo: 1, requiredAmount: 150, currency: 'USD', status: 'Paid' }],
  passengers: [{ bookingPassengerId: rows[0].bookingPassengerId, passengerId: id(1), fullName: 'Passenger A', participationStatus: 'Active', cabinId: id(40), cabinNumber: '801' }] };

test('companion adapter reads existing booking, assigned cabin, deposit and payments using the current bearer', async () => {
  const requests = [];
  const transport = createApiClient({ baseUrl: () => scope.apiUrl, fetch: async (url, options) => {
    requests.push({ url, ...options });
    assert.equal(options.headers.Authorization, 'Bearer fixture-passenger');
    const value = url.includes('/payment/booking/') ? [{ paymentId: id(50), bookingId: detail.bookingId, operationType: 'Collect', requestedAmount: 150, confirmedAmount: 150, currency: 'USD', status: 'Confirmed' }]
      : url.includes('/itineraries/mine') ? rows : detail;
    return Response.json({ success: true, data: value });
  } }); transport.setToken('fixture-passenger');
  const api = createPassengerApi(transport);
  const booking = await api.booking(detail.bookingId);
  assert.equal(booking.passengers[0].cabinNumber, '801');
  assert.equal(booking.passengers[0].bookingPassengerId, rows[0].bookingPassengerId);
  assert.equal(booking.requiredDepositAmount, 150); assert.equal(booking.installments[0].requiredAmount, 150);
  assert.equal((await api.payments(detail.bookingId))[0].confirmedAmount, 150);
  assert.equal((await api.voyages()).length, 2);
  assert.ok(requests.every(request => request.method === 'GET' && request.body === undefined));
  for (const removed of ['createBooking', 'bookingQuote', 'recoverBooking', 'cabins', 'cruises']) assert.equal(removed in api, false);
});

test('read-only detail and payment adapters reject responses linked to a different booking', async () => {
  const wrongDetail = createPassengerApi({ request: async () => ({ ...detail, bookingId: id(99) }) });
  await assert.rejects(wrongDetail.booking(detail.bookingId), /không khớp/);
  const wrongPayment = createPassengerApi({ request: async () => [{ paymentId: id(50), bookingId: id(99), operationType: 'Collect', currency: 'USD', status: 'Confirmed' }] });
  await assert.rejects(wrongPayment.payments(detail.bookingId), /không khớp/);
});

test('voyage choice retains the exact booking/passenger pair and refuses cross-booking passengers', () => {
  useVoyageSelection.setState({ selection: null, handledRoutes: {} });
  assert.equal(chooseVoyage(scope, rows, rows[1].bookingId, rows[1].bookingPassengerId), true);
  const selected = useVoyageSelection.getState().selection;
  assert.equal(resolveVoyage(scope, selected, rows).cruiseId, rows[1].cruiseId);
  assert.equal(chooseVoyage(scope, rows, rows[1].bookingId, rows[0].bookingPassengerId), false);
  assert.deepEqual(useVoyageSelection.getState().selection, selected);
  assert.equal(chooseVoyage(scope, rows, id(99)), false);
});

test('multiple linked passengers in one booking do not fall back to the first passenger', () => {
  const sharedBooking = [rows[0], { ...rows[0], bookingPassengerId: id(42) }];
  assert.equal(chooseVoyage(scope, sharedBooking, rows[0].bookingId, id(42)), true);
  const selected = useVoyageSelection.getState().selection;
  assert.equal(resolveVoyage(scope, selected, sharedBooking).bookingPassengerId, id(42));
  assert.equal(resolveVoyage(scope, selected, [rows[0]]), undefined);
});

test('selection cannot cross user, login epoch or Backend and never supplies data after logout', () => {
  const selected = { ...scope, bookingId: rows[1].bookingId, bookingPassengerId: rows[1].bookingPassengerId };
  for (const changed of [{ ...scope, owner: id(88) }, { ...scope, signedInAt: 11 }, { ...scope, apiUrl: 'https://another.invalid/api' }]) {
    assert.equal(scopedSelection(changed, selected), null);
    assert.equal(resolveVoyage(changed, selected, [rows[0]]).bookingId, rows[0].bookingId);
  }
  assert.equal(resolveVoyage(null, selected, rows), undefined);
  assert.equal(resolveVoyage(scope, selected, []), undefined);
});

test('current voyage prioritizes active confirmed trips, excludes cancelled passenger participation', () => {
  const choices = [voyage(2, { cruiseStatus: 'COMPLETED' }), voyage(3), voyage(4, { cruiseStatus: 'IN_PROGRESS' }), voyage(5, { bookingStatus: 'Cancelled' }), voyage(6, { participationStatus: 'Cancelled' })];
  assert.deepEqual(availableVoyages(choices).map(row => row.bookingId), [id(4), id(3), id(2)]);
  assert.equal(resolveVoyage(scope, null, choices).bookingId, id(4));
});

test('route initialization is scoped, atomic, and can be released without altering the chosen passenger', () => {
  useVoyageSelection.setState({ selection: null, handledRoutes: {} });
  chooseVoyage(scope, rows, rows[0].bookingId, rows[0].bookingPassengerId, 'route-A');
  assert.equal(useVoyageSelection.getState().handledRoutes['route-A'], voyageScopeKey(scope));
  chooseVoyage(scope, rows, rows[1].bookingId, rows[1].bookingPassengerId, 'route-B');
  assert.equal(useVoyageSelection.getState().handledRoutes['route-A'], voyageScopeKey(scope));
  forgetVoyageRoute('route-A');
  assert.equal(useVoyageSelection.getState().handledRoutes['route-A'], undefined);
  assert.equal(useVoyageSelection.getState().selection.bookingPassengerId, rows[1].bookingPassengerId);
});

test('production source cannot reintroduce ticket creation grants, quote endpoints or purchase CTAs', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  const forbidden = /BOOKING_CREATE|\/booking\/quotes|\/booking\/recovery|PassengerNewBookingScreen|Đặt chuyến mới|Tạo đặt chỗ nháp/;
  function scan(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (/\.tsx?$/.test(file)) assert.doesNotMatch(readFileSync(file, 'utf8'), forbidden, path.relative(root, file));
    }
  } scan(root);
});
