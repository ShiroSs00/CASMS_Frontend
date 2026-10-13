import type { CabinStatus, CabinType, ShipStatus } from '../model/types'

export type ShipDto = {
  shipId: string; shipCode: string; shipName: string; status: ShipStatus
  totalCapacity: number; totalDecks: number; commissionDate: string | null
  createdAt: string; updatedAt: string
}
export type DeckDto = {
  deckId: string; shipId: string; deckNumber: number; deckName: string | null
  createdAt: string; updatedAt: string
}
export type CabinDto = {
  cabinId: string; shipId: string; deckId: string; cabinNumber: string
  cabinType: CabinType; capacity: number; status: CabinStatus; isAccessible: boolean
}
export type CruiseDto = {
  cruiseId: string; cruiseCode: string; cruiseName: string; status: string
  departureDatetime: string; returnDatetime: string
}
export type AssignmentDto = {
  cabinAssignmentId: string; bookingPassengerId: string; validFrom: string
  validTo: string | null; assignedByUserId: string; changeReason: string | null
}
export type PageDto<T> = { content: T[]; totalPages: number; totalElements: number; number: number }
