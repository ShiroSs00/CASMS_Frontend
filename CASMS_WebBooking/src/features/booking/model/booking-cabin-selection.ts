import type { CruisePackageCatalog } from '@/domain/cruise-package'
import type { AvailableCabin, BookingPersonDraft } from '../api/real-booking-api'
import { personGroup } from './booking-party'

/** Both the independent list and model consume this same authoritative candidate set. */
export function eligibleCabins(cabins: AvailableCabin[], passengers: BookingPersonDraft[], index: number, catalog?: CruisePackageCatalog | null) {
  const person = passengers[index]
  if (!person || person.cabinSelectionMode === 'CATEGORY_HOLD') return []
  const members = passengers.filter(p => personGroup(p) === personGroup(person))
  return cabins.filter(cabin => {
    if (catalog?.fareManaged) {
      if (cabin.remainingCapacity !== cabin.capacity) return false
      if (!members.every(p => {
        const fare = catalog.offers.find(o => o.selection.offerId === p.farePackageOfferId)?.selection
        return p.cabinSelectionMode === 'PHYSICAL_CABIN' && fare && fare.priceRevisionId === p.farePackagePriceRevisionId && fare.physicalCabinIds.includes(cabin.cabinId)
      })) return false
    }
    const otherMembers = passengers.filter(p => personGroup(p) !== personGroup(person) && p.cabinId === cabin.cabinId).length
    return cabin.remainingCapacity - otherMembers >= members.length
  })
}
