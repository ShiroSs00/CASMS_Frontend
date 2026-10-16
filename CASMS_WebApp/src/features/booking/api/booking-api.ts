import { bookingFixtures, cabinFixtures, cruiseFixtures, packageFixtures, arrivalFixtures, itineraryFixtures } from '../model/booking-fixtures'
import type { ActionResult, Booking, Cruise, MissingCapability, CruiseSearchQuery, CruiseSearchResult } from '../model/booking-types'
import { searchCruiseFixtures } from '../model/cruise-search'
import { mockActionResult, type MockAction } from '../model/booking-scenarios'
// UI view models only. No HTTP DTO is claimed until a controller contract exists.
// Confirmed auth continues to use shared/api/apiRequest in features/auth.
export interface BookingAdapter {
 readonly mode:'UI_WITH_TYPED_ADAPTER'
 listCruises(signal?:AbortSignal):Promise<Cruise[]>
 searchCruises(query:CruiseSearchQuery,signal?:AbortSignal):Promise<CruiseSearchResult>
 listBookings(signal?:AbortSignal):Promise<Booking[]>
 perform(capability:MissingCapability, input?:unknown, scenario?:MockAction):Promise<ActionResult>
}
export const bookingApi:BookingAdapter = {
 mode:'UI_WITH_TYPED_ADAPTER',
 async listCruises(signal) { signal?.throwIfAborted(); return structuredClone(cruiseFixtures) },
 async searchCruises(query,signal) { signal?.throwIfAborted();return searchCruiseFixtures(structuredClone(cruiseFixtures),query) },
 async listBookings(signal) { signal?.throwIfAborted(); return structuredClone(bookingFixtures) },
 async perform(capability, input, scenario='missing') {
  void input
  const active=import.meta.env.DEV?scenario:'missing'
  await new Promise(resolve=>setTimeout(resolve,650))
  return mockActionResult(capability,active)
 },
}
export const bookingCatalog = { cabins:cabinFixtures, packages:packageFixtures, arrivalSlots:arrivalFixtures, itinerary:itineraryFixtures }
