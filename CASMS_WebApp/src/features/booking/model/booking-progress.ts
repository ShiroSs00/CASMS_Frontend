import { bookingFieldErrors, bookingPackageErrors, type BookingDraft, type BookingCruiseOption, type AvailableCabin } from '../api/real-booking-api'

/** Later stages require valid earlier choices, including on direct URL entry. */
export function availableBookingStep(draft: BookingDraft, cruise: BookingCruiseOption | undefined,
  cabins: AvailableCabin[] | null, packages: Parameters<typeof bookingPackageErrors>[1], now = Date.now()): 1 | 2 | 3 {
  if (Object.keys(bookingFieldErrors(draft, cruise, cabins, now, 1)).length || Object.keys(bookingPackageErrors(draft, packages)).length) return 1
  return Object.keys(bookingFieldErrors(draft, cruise, cabins, now, 2)).length ? 2 : 3
}
