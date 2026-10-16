import assert from 'node:assert/strict';
import test from 'node:test';
import { getChanges, getItineraryDay, scenarios, stopDuration } from '../src/features/itinerary/itinerary-model.ts';

const minutes = value => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };

test('Passenger tour returns before all-aboard, which precedes ship departure', () => {
  for (const [scenario] of scenarios) {
    for (let index = 0; index < 4; index++) {
      const day = getItineraryDay(index, scenario);
      if (day.sea || !day.allAboard) continue;
      assert.ok(minutes(day.allAboard) < minutes(day.departure), scenario);
      if (!day.tour || day.tour.status === 'cancelled') continue;
      assert.ok(minutes(day.tour.meetingTime) <= minutes(day.tour.departure), scenario);
      assert.ok(minutes(day.tour.departure) < minutes(day.tour.returnTime), scenario);
      assert.ok(minutes(day.tour.returnTime) < minutes(day.allAboard), scenario);
    }
  }
});
test('operational changes affect the intended day and leave original fixtures intact', () => {
  assert.equal(getItineraryDay(1, 'changed').tour.departure, '10:30');
  assert.equal(getItineraryDay(1).tour.departure, '10:00');
  assert.equal(getItineraryDay(2, 'changed').tour.departure, '09:00');
  const modified = getItineraryDay(1); modified.tour.title = 'Changed by caller';
  assert.equal(getItineraryDay(1).tour.title, 'Khám phá làng Việt Hải');
});
test('sea days have no port tour or all-aboard and substitution replaces the tour too', () => {
  const sea = getItineraryDay(1, 'sea');
  assert.equal(sea.port, ''); assert.equal(sea.tour, null); assert.equal(sea.allAboard, null);
  const replacement = getItineraryDay(1, 'substitute');
  assert.equal(replacement.port, 'Bến Hòn Gai');
  assert.equal(replacement.tour.title, 'Khám phá Bái Tử Long');
});
test('normal history excludes unapplied changes and published changes describe the selected scenario', () => {
  assert.equal(getChanges('normal').length, 1);
  assert.match(getChanges('changed')[0].description, /10:00 → 10:30/);
  assert.match(getChanges('substitute')[0].description, /Bến Hòn Gai/);
  assert.equal(getItineraryDay(1, 'tour-cancelled').tour.status, 'cancelled');
});
test('port duration handles overnight arrival and departure', () => {
  assert.equal(stopDuration('09:00', '17:00'), '8 giờ');
  assert.equal(stopDuration('23:30', '01:00'), '1 giờ 30 phút');
});
