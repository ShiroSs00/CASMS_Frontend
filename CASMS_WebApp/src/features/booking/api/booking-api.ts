import { bookingFixtures, cabinFixtures, cruiseFixtures, packageFixtures, arrivalFixtures, itineraryFixtures } from '../model/booking-fixtures'
import type { ActionResult, Booking, Cruise, MissingCapability, CruiseSearchQuery, CruiseSearchResult } from '../model/booking-types'
import { searchCruiseFixtures } from '../model/cruise-search'
import { mockActionResult, type MockAction } from '../model/booking-scenarios'
import { apiRequest } from '@/shared/api'
import { toPublishedCruise, toPublishedPage, type LiveCruiseDto, type LiveCruisePageDto } from './live-cruise-contract'
import { lookupItinerary, toLiveDays, toLivePortCalls, toLiveShip } from './live-itinerary-contract'
// Booking and checkout remain fixture adapters; only the DEV catalog below reads the cruise API.
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

export const liveCruiseCatalogApi = {
 async list(page:number, signal?:AbortSignal) {
  const data = await apiRequest<LiveCruisePageDto>('/cruise', {
   query: { status:'PUBLISHED', page:page-1, size:6, sort:'departureDatetime,asc' }, signal,
  })
  return toPublishedPage(data)
 },
 async detail(id:string, signal?:AbortSignal) {
  const data = await apiRequest<LiveCruiseDto>(`/cruise/${encodeURIComponent(id)}`, { signal })
  return toPublishedCruise(data)
 },
 async ship(id:string, signal?:AbortSignal) {
  const ship=toLiveShip(await apiRequest<unknown>(`/ships/${encodeURIComponent(id)}`, {signal}))
  if (ship.id!==id) throw new Error('Thông tin tàu trả về không khớp shipId của chuyến đi.')
  return ship
 },
 async itinerary(cruiseId:string, signal?:AbortSignal) {
  return lookupItinerary(cruiseId,page=>apiRequest<unknown>('/itineraries',{
   query:{page,size:50,sort:'itineraryId,asc'},signal,
  }))
 },
 async days(itineraryId:string, signal?:AbortSignal) {
  return toLiveDays(await apiRequest<unknown>(`/itineraries/${encodeURIComponent(itineraryId)}/days`,{signal}),itineraryId)
 },
 async stops(itineraryId:string, signal?:AbortSignal) {
  return toLivePortCalls(await apiRequest<unknown>(`/cruise-stops/by-itinerary/${encodeURIComponent(itineraryId)}`,{signal}),itineraryId)
 },
}
