import assert from 'node:assert/strict';
import test from 'node:test';
import { demoVoyage, getItineraryDay } from './fixtures/legacy-itinerary-data.ts';
import { deviceTimeZone, formatTime, stopsForDay, timeZoneLabel, validTimeZone } from '../src/features/itinerary/api-format.ts';
import { dateTime } from '../src/features/passenger-actions/passenger-model.ts';

test('Asian demo crosses countries and time zones rather than assigning one zone to the whole cruise', () => {
  const days = [0, 1, 2, 3].map(index => getItineraryDay(index));
  assert.equal(new Set(days.map(day => day.country)).size, 3);
  assert.deepEqual(days.map(day => day.destination), ['Singapore', 'Port Klang', 'Penang', 'Phuket']);
  assert.equal(days.every(day => validTimeZone(day.timeZoneId)), true);
  assert.match(timeZoneLabel(days[1].timeZoneId), /UTC\+8/);
  assert.match(timeZoneLabel(days[3].timeZoneId), /UTC\+7/);
  assert.equal(demoVoyage.route, days.map(day => day.destination).join(' — '));
  assert.equal(getItineraryDay(1, 'substitute').country, 'Malaysia');
});

test('East, Southeast, South and West Asian times preserve fractional offsets and midnight rollover', () => {
  const instant = '2026-10-20T18:30:00Z';
  for (const [zone, expected] of [
    ['Asia/Singapore', '02:30'], ['Asia/Kuala_Lumpur', '02:30'],
    ['Asia/Hong_Kong', '02:30'], ['Asia/Tokyo', '03:30'],
    ['Asia/Bangkok', '01:30'], ['Asia/Kolkata', '00:00'],
    ['Asia/Kathmandu', '00:15'], ['Asia/Dubai', '22:30'],
  ]) assert.equal(formatTime(instant, zone), expected, zone);
  assert.match(timeZoneLabel('Asia/Kolkata', instant), /UTC\+5:30/);
  assert.match(timeZoneLabel('Asia/Kathmandu', instant), /UTC\+5:45/);
  assert.match(formatTime(instant, 'Asia/Tokyo', true), /21\/10\/2026/);
  assert.match(formatTime(instant, 'Asia/Dubai', true), /20\/10\/2026/);
});

test('missing/invalid ship zones have an explicit UTC fallback without breaking rendering', () => {
  assert.equal(validTimeZone('Asia/Not_A_Port'), null);
  assert.equal(formatTime('2026-10-20T18:30:00Z', 'Asia/Not_A_Port'), '18:30');
  assert.equal(timeZoneLabel(undefined), 'UTC · Chưa có múi giờ tàu');
  assert.equal(formatTime('bad-date', 'Asia/Tokyo'), 'Chưa cập nhật');
  assert.ok(validTimeZone(deviceTimeZone()));
});

test('booking and activity timestamps show an explicit offset across Asian ports', () => {
  const instant = '2027-11-01T07:00:00Z';
  assert.match(dateTime(instant, 'Asia/Singapore'), /15:00.*UTC\+8|UTC\+8.*15:00/);
  assert.match(dateTime(instant, 'Asia/Bangkok'), /14:00.*UTC\+7|UTC\+7.*14:00/);
  assert.match(dateTime(instant, 'Asia/Kolkata'), /12:30.*UTC\+5:30|UTC\+5:30.*12:30/);
});

test('a stop spans different local dates in Singapore and Dubai using each itinerary day zone', () => {
  const stop = { arrivalItineraryDayId: 'first', departureItineraryDayId: 'last', plannedArrival: '2026-10-20T18:00:00Z', plannedDeparture: '2026-10-20T19:00:00Z' };
  const day = { itineraryDayId: 'middle', date: '2026-10-21', shipTimeZoneId: 'Asia/Singapore' };
  assert.equal(stopsForDay(day, [stop]).length, 1);
  assert.equal(stopsForDay({ ...day, shipTimeZoneId: 'Asia/Dubai' }, [stop]).length, 0);
});
