import '../helpers/booking-loader.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bookingStagePaths, catalogReturn } from '../../src/features/booking/model/live-booking-navigation.ts'
import { availableBookingStage } from '../../src/features/booking/model/booking-progress.ts'
import { initialLiveBooking } from '../../src/features/booking/model/live-booking-context.ts'
test('four stages preserve the three existing URLs', () => {
  assert.deepEqual(bookingStagePaths, ['/booking/party', '/booking/cabin-experience', '/booking/travellers', '/booking/review'])
})
test('deep links stop at the first missing UI stage without changing validator semantics', () => {
  const blank = initialLiveBooking()
  const cruise = { cruiseId: 'c', shipId: 'ship', status: 'PUBLISHED', sellable: true, departureDatetime: '2099-06-01' }
  const draft = { ...blank, cruiseId: 'c', passengers: [{ ...blank.passengers[0], cabinId: 'a' }] }
  const cabins = [{ cabinId: 'a', capacity: 2, remainingCapacity: 2 }], catalog = { cruiseId: 'c', fareManaged: false, offers: [] }
  const stage = (d, confirmed, guest = true) => availableBookingStage(d, confirmed, cruise, cabins, [], catalog, guest)
  assert.equal(stage(draft, false), 1)
  assert.equal(stage({ ...draft, passengers: [{ ...draft.passengers[0], cabinId: '' }] }, true), 2)
  assert.equal(stage(draft, true), 3)
  const completed = { ...draft, passengers: [{ ...draft.passengers[0], fullName: 'Fixture Guest', phoneNumber: '0123456789' }] }
  assert.equal(stage(completed, true), 3)
  assert.equal(stage(completed, true, false), 4)
  assert.equal(stage({ ...completed, passengers: [{ ...completed.passengers[0], email: 'fixture@example.test' }] }, true), 4)
})
test('catalog return accepts only local catalog queries', () => {
  assert.equal(catalogReturn('/cruises?page=2&cruiseType=ONE_DAY'), '/cruises?page=2&cruiseType=ONE_DAY')
  for (const url of ['https://evil.test', '//evil.test', '/cruises#x', '/cruises/../login', '/cruises?x=\\evil']) assert.equal(catalogReturn(url), '/cruises')
})
