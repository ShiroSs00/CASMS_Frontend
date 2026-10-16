import { bookingFixtures, cabinFixtures, cruiseFixtures, packageFixtures, arrivalFixtures, itineraryFixtures } from '../model/booking-fixtures'
import type { ActionResult, Booking, Cruise, MissingCapability } from '../model/booking-types'
// UI view models only. No HTTP DTO is claimed until a controller contract exists.
// Confirmed auth continues to use shared/api/apiRequest in features/auth.
export interface BookingAdapter {
 readonly mode:'UI_WITH_TYPED_ADAPTER'
 listCruises(signal?:AbortSignal):Promise<Cruise[]>
 listBookings(signal?:AbortSignal):Promise<Booking[]>
 perform(capability:MissingCapability, input?:unknown):Promise<ActionResult>
}
export const bookingApi:BookingAdapter = {
 mode:'UI_WITH_TYPED_ADAPTER',
 async listCruises(signal) { signal?.throwIfAborted(); return structuredClone(cruiseFixtures) },
 async listBookings(signal) { signal?.throwIfAborted(); return structuredClone(bookingFixtures) },
 async perform(capability, input) { void capability; void input; return {state:'missing',message:'Chức năng này chưa kết nối dịch vụ. Yêu cầu chưa được gửi; thông tin bạn nhập vẫn được giữ lại.'} },
}
export const bookingCatalog = { cabins:cabinFixtures, packages:packageFixtures, arrivalSlots:arrivalFixtures, itinerary:itineraryFixtures }

