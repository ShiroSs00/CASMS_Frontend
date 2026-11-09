import { bookingFieldErrors, bookingPackageErrors, type BookingDraft, type BookingCruiseOption, type AvailableCabin } from '../api/real-booking-api'
import { bookingCruisePackageSelectionErrors } from '../api/real-booking-api'
import type { CruisePackageCatalog } from '@/domain/cruise-package'
import type { BookingStage } from './live-booking-navigation'
import { eligibleCabins } from './booking-cabin-selection'

/** Later stages require valid earlier choices, including on direct URL entry. */
export function availableBookingStep(draft: BookingDraft, cruise: BookingCruiseOption | undefined,
  cabins: AvailableCabin[] | null, packages: Parameters<typeof bookingPackageErrors>[1], now = Date.now()): 1 | 2 | 3 {
  if (Object.keys(bookingFieldErrors(draft, cruise, cabins, now, 1)).length || Object.keys(bookingPackageErrors(draft, packages)).length) return 1
  return Object.keys(bookingFieldErrors(draft, cruise, cabins, now, 2)).length ? 2 : 3
}

/** UI stage numbers never change the allocation/person/full validator modes. */
export function availableBookingStage(draft: BookingDraft, partyConfirmed: boolean, cruise: BookingCruiseOption | undefined,
  cabins: AvailableCabin[] | null, packages: Parameters<typeof bookingPackageErrors>[1], fares: CruisePackageCatalog | null | undefined,
  guest: boolean, now = Date.now()): BookingStage {
  if (!partyConfirmed || !draft.passengers.length || !draft.cruiseId) return 1
  if (Object.keys(bookingFieldErrors(draft, cruise, cabins, now, 1)).length || Object.keys(bookingPackageErrors(draft, packages)).length || Object.keys(bookingCruisePackageSelectionErrors(draft, fares)).length
    || draft.passengers.some((p, i) => p.cabinSelectionMode !== 'CATEGORY_HOLD' && !eligibleCabins(cabins ?? [], draft.passengers, i, fares).some(c => c.cabinId === p.cabinId))) return 2
  if (Object.keys(bookingFieldErrors(draft, cruise, cabins, now, 2)).length || guest && !draft.passengers[0]?.email.trim()) return 3
  return 4
}
