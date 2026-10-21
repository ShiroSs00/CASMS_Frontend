// Legacy editorial preview only; never imported by live routes.
import { bookingFixtures, cabinFixtures, cruiseFixtures, packageFixtures, arrivalFixtures, itineraryFixtures } from '../model/booking-fixtures'
import type { ActionResult, Booking, Cruise, MissingCapability, CruiseSearchQuery, CruiseSearchResult } from '../model/booking-types'
import { searchCruiseFixtures } from '../model/cruise-search'
import { mockActionResult, type MockAction } from '../model/booking-scenarios'
export interface BookingAdapter {
 readonly mode:'UI_WITH_TYPED_ADAPTER'
 listCruises(signal?:AbortSignal):Promise<Cruise[]>
 searchCruises(query:CruiseSearchQuery,signal?:AbortSignal):Promise<CruiseSearchResult>
 listBookings(signal?:AbortSignal):Promise<Booking[]>
 perform(capability:MissingCapability, input?:unknown, scenario?:MockAction):Promise<ActionResult>
}
function requirePreview() {
 if (!import.meta.env.DEV || new URLSearchParams(globalThis.location.search).get('preview') !== '1') throw new Error('Booking fixtures require explicit development preview=1')
}
export const bookingApi:BookingAdapter = {
 mode:'UI_WITH_TYPED_ADAPTER',
 async listCruises(signal) { requirePreview(); signal?.throwIfAborted(); return structuredClone(cruiseFixtures) },
 async searchCruises(query,signal) { requirePreview(); signal?.throwIfAborted();return searchCruiseFixtures(structuredClone(cruiseFixtures),query) },
 async listBookings(signal) { requirePreview(); signal?.throwIfAborted(); return structuredClone(bookingFixtures) },
 async perform(capability, input, scenario='missing') {
  requirePreview(); void input
  const active=import.meta.env.DEV?scenario:'missing'
  await new Promise(resolve=>setTimeout(resolve,650))
  return mockActionResult(capability,active)
 },
}
export const bookingCatalog = { cabins:cabinFixtures, packages:packageFixtures, arrivalSlots:arrivalFixtures, itinerary:itineraryFixtures }
