import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareCreateBody } from './create-body.ts'

const creates = [
  ['/ports', 'portId'], ['/ships', 'shipId'], ['/decks', 'deckId'], ['/cabins', 'cabinId'],
  ['/cruise', 'cruiseId'], ['/destinations', 'destinationId'], ['/itineraries', 'itineraryId'],
  ['/itinerary-days', 'itineraryDayId'], ['/cruise-stops', 'cruiseStopId'],
  ['/itinerary-change-history', 'changeHistoryId'], ['/operational-issues', 'issueId'],
  ['/operational-regulations', 'regulationId'], ['/booking', 'bookingId'],
  ['/suppliers', 'supplierId'], ['/shore-excursions', 'shoreExcursionId'],
  ['/tour-groups', 'tourGroupId'], ['/tour-group-passengers', 'tourGroupPassengerId'],
  ['/activities', 'onboardActivityId'], ['/servicepackage/services', 'serviceId'],
  ['/servicepackage/products', 'productId'], ['/servicepackage/packages', 'tourPackageId'],
  ['/servicepackage/requests', 'serviceRequestId'],
  ['/activities/activity-1/registrations', 'registrationId'],
  ['/activities/excursions/excursion-1/registrations', 'registrationId'],
  ['/tour-groups/group-1/passengers', 'tourGroupPassengerId'],
]

for (const [path, primaryKey] of creates) {
  test(`${path}: BE generates ${primaryKey}; a copied record cannot send its UUID`, () => {
    const input = { [primaryKey]: 'old-record-id', id: 'ui-record-id', name: 'New record', timeZoneId: 'Asia/Ho_Chi_Minh' }
    const output = prepareCreateBody(path, 'POST', input)
    assert.deepEqual(output, { name: 'New record', timeZoneId: 'Asia/Ho_Chi_Minh' })
    assert.equal(input[primaryKey], 'old-record-id', 'Do not mutate form state')
  })
}

test('dependent creates keep selected parent UUIDs and actor references', () => {
  const references = { shipId: 'ship', cruiseId: 'cruise', deckId: 'deck', portId: 'port', destinationId: 'destination', createdByUserId: 'actor' }
  assert.deepEqual(prepareCreateBody('/cabins', 'POST', { ...references, cabinId: 'old' }), references)
  assert.deepEqual(prepareCreateBody('/itineraries', 'POST', { cruiseId: 'cruise', itineraryId: 'old' }), { cruiseId: 'cruise' })
  assert.deepEqual(prepareCreateBody('/servicepackage/requests', 'POST', { serviceId: 'service', bookingPassengerId: 'person', serviceRequestId: 'old' }), { serviceId: 'service', bookingPassengerId: 'person' })
  assert.deepEqual(prepareCreateBody('/tour-groups/group-1/passengers', 'POST', { passengerId: 'selected-person', tourGroupPassengerId: 'old' }), { passengerId: 'selected-person' })
})

test('booking does not send generated passenger/user UUIDs but keeps selected cabin and package', () => {
  const passenger = { fullName: 'Test Guest', userId: 'old-user', passengerId: 'old-person', bookingPassengerId: 'old-booking-person', cabinId: 'selected-cabin', tourPackageId: 'selected-package' }
  assert.deepEqual(prepareCreateBody('/booking', 'POST', { bookingId: 'old', cruiseId: 'selected-cruise', passengers: [passenger] }), {
    cruiseId: 'selected-cruise', passengers: [{ fullName: 'Test Guest', cabinId: 'selected-cabin', tourPackageId: 'selected-package' }],
  })
  assert.equal(passenger.userId, 'old-user')
})

test('updates, actions, lookups and unrelated bodies keep their required UUIDs', () => {
  const input = { id: 'record', shipId: 'ship', passengerId: 'person' }
  for (const [path, method] of [['/ships/record', 'PATCH'], ['/ships/record', 'PUT'], ['/cabins/search', 'POST'], ['/auth/login', 'POST'], ['/servicepackage/package-assignments/person', 'POST']]) {
    assert.equal(prepareCreateBody(path, method, input), input)
  }
  for (const body of [undefined, null, [], 'text']) assert.equal(prepareCreateBody('/ships', 'POST', body), body)
})

test('trailing slash and query do not change primary UUID handling', () => {
  assert.deepEqual(prepareCreateBody('/ports/?source=form', 'POST', { portId: 'old', portCode: 'VN-HPH' }), { portCode: 'VN-HPH' })
})

const defaults = [
  ['/ships', ['shipCode', 'status']], ['/decks', ['deckNumber', 'deckName']],
  ['/cabins', ['shipId', 'status', 'isAccessible']], ['/cruise', ['cruiseCode', 'cruiseType']],
  ['/itineraries', ['itineraryName', 'startDate', 'endDate', 'itineraryType']],
  ['/itinerary-days', ['dayNumber', 'date', 'dayType', 'shipTimeZoneId']],
  ['/cruise-stops', ['stopOrder', 'callType']], ['/itinerary-change-history', ['changedByUserId']],
  ['/operational-issues', ['issueCode', 'severity', 'shipId', 'cruiseId', 'cabinId']],
  ['/operational-regulations', ['regulationCode']], ['/activities', ['activityCode', 'price', 'currencyCode']],
  ['/shore-excursions', ['excursionCode', 'minimumParticipants', 'price', 'currencyCode']],
  ['/tour-groups', ['groupCode', 'maximumCapacity', 'meetingPoint', 'assemblyTime', 'plannedDepartureTime', 'plannedReturnTime']],
  ['/servicepackage/services', ['serviceCode', 'price', 'currencyCode']],
  ['/servicepackage/products', ['productCode', 'currencyCode']], ['/servicepackage/packages', ['packageCode', 'currencyCode']],
  ['/servicepackage/requests', ['quantity']],
]
for (const [route, fields] of defaults) {
  test(`${route}: blank create defaults are omitted, explicit choices and update bodies are preserved`, () => {
    for (const blank of ['', '  ', null, undefined]) {
      const body = { ...Object.fromEntries(fields.map(field => [field, blank])), description: 'Keep me' }
      assert.deepEqual(prepareCreateBody(route, 'POST', body), { description: 'Keep me' })
      assert.equal(body[fields[0]], blank)
      assert.equal(prepareCreateBody(`${route}/existing`, 'PUT', body), body)
      assert.equal(prepareCreateBody(`${route}/existing`, 'PATCH', body), body)
    }
    const choices = Object.fromEntries(fields.map(field => [field, 'explicit-value']))
    assert.deepEqual(prepareCreateBody(route, 'POST', choices), choices)
  })
}
test('required values, zero price, false accessibility and invalid explicit zero remain visible to BE validation', () => {
  assert.deepEqual(prepareCreateBody('/activities', 'POST', { activityName: '', cruiseId: '', capacity: 0, price: 0 }), { activityName: '', cruiseId: '', capacity: 0, price: 0 })
  assert.deepEqual(prepareCreateBody('/cabins', 'POST', { deckId: 'deck', isAccessible: false }), { deckId: 'deck', isAccessible: false })
  assert.deepEqual(prepareCreateBody('/decks', 'POST', { shipId: 'ship', deckNumber: 0 }), { shipId: 'ship', deckNumber: 0 })
  assert.deepEqual(prepareCreateBody('/ports', 'POST', { portCode: '', countryCode: 'VN' }), { portCode: '', countryCode: 'VN' })
})
