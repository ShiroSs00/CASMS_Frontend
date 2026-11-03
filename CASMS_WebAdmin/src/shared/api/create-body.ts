// Primary UUIDs belong to BE. Foreign keys still identify existing selections.
const generatedIds: Readonly<Record<string, string>> = {
  '/ports': 'portId',
  '/ships': 'shipId',
  '/decks': 'deckId',
  '/cabins': 'cabinId',
  '/cruise': 'cruiseId',
  '/destinations': 'destinationId',
  '/itineraries': 'itineraryId',
  '/itinerary-days': 'itineraryDayId',
  '/cruise-stops': 'cruiseStopId',
  '/itinerary-change-history': 'changeHistoryId',
  '/operational-issues': 'issueId',
  '/operational-regulations': 'regulationId',
  '/booking': 'bookingId',
  '/suppliers': 'supplierId',
  '/shore-excursions': 'shoreExcursionId',
  '/tour-groups': 'tourGroupId',
  '/tour-group-passengers': 'tourGroupPassengerId',
  '/activities': 'onboardActivityId',
  '/servicepackage/services': 'serviceId',
  '/servicepackage/products': 'productId',
  '/servicepackage/packages': 'tourPackageId',
  '/servicepackage/requests': 'serviceRequestId',
}

function omit(value: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))
}

// Only these create fields have defaults in BE d4bd597. Do not drop required
// values, explicit zero prices/false flags, or blank values in update requests.
const defaultedFields: Readonly<Record<string, readonly string[]>> = {
  '/ships': ['shipCode', 'status'],
  '/decks': ['deckNumber', 'deckName'],
  '/cabins': ['shipId', 'status', 'isAccessible'],
  '/cruise': ['cruiseCode', 'cruiseType'],
  '/itineraries': ['itineraryName', 'startDate', 'endDate', 'itineraryType'],
  '/itinerary-days': ['dayNumber', 'date', 'dayType', 'shipTimeZoneId'],
  '/cruise-stops': ['stopOrder', 'callType'],
  '/itinerary-change-history': ['changedByUserId'],
  '/operational-issues': ['issueCode', 'shipId', 'cruiseId', 'cabinId', 'severity'],
  '/operational-regulations': ['regulationCode'],
  '/activities': ['activityCode', 'price', 'currencyCode'],
  '/shore-excursions': ['excursionCode', 'minimumParticipants', 'price', 'currencyCode'],
  '/tour-groups': ['groupCode', 'maximumCapacity', 'meetingPoint', 'assemblyTime', 'plannedDepartureTime', 'plannedReturnTime'],
  '/servicepackage/services': ['serviceCode', 'price', 'currencyCode'],
  '/servicepackage/products': ['productCode', 'currencyCode'],
  '/servicepackage/packages': ['packageCode', 'currencyCode'],
  '/servicepackage/requests': ['quantity'],
}

export function prepareCreateBody(path: string, method: string | undefined, body: unknown): unknown {
  if (method !== 'POST' || !body || typeof body !== 'object' || Array.isArray(body)) return body
  const route = path.split('?')[0].replace(/\/$/, '')
  let primaryKey = generatedIds[route]
  if (!primaryKey && /^\/activities\/(?:excursions\/)?[^/]+\/registrations$/.test(route)) primaryKey = 'registrationId'
  if (!primaryKey && /^\/tour-groups\/[^/]+\/passengers$/.test(route)) primaryKey = 'tourGroupPassengerId'
  if (!primaryKey) return body

  const result = omit(body as Record<string, unknown>, ['id', primaryKey])
  for (const field of defaultedFields[route] ?? []) {
    const value = result[field]
    if (value == null || (typeof value === 'string' && !value.trim())) delete result[field]
  }
  if (route === '/booking' && Array.isArray(result.passengers)) {
    result.passengers = result.passengers.map(person =>
      person && typeof person === 'object' && !Array.isArray(person)
        ? omit(person as Record<string, unknown>, ['id', 'passengerId', 'bookingPassengerId', 'userId'])
        : person,
    )
  }
  return result
}
