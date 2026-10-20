export const CRUISE_TYPES = ['ONE_DAY', 'MULTI_DAYS'] as const
export const CRUISE_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const
export const SHIP_STATUSES = ['ACTIVE', 'MAINTENANCE', 'INACTIVE'] as const

export type CruiseType = (typeof CRUISE_TYPES)[number]
export type CruiseStatus = (typeof CRUISE_STATUSES)[number]
export type ShipStatus = (typeof SHIP_STATUSES)[number]

export type CruiseRecord = {
  cruiseId: string
  cruiseCode: string
  cruiseName: string
  shipId: string | null
  cruiseType: CruiseType
  departureDatetime: string
  returnDatetime: string
  departurePortId: string
  returnPortId: string
  status: CruiseStatus
  createdAt: string
  updatedAt: string
}

export type CruiseDraft = Omit<
  CruiseRecord,
  'cruiseId' | 'status' | 'createdAt' | 'updatedAt' | 'shipId'
>

export type ShipRecord = {
  shipId: string
  shipCode: string
  shipName: string
  status: ShipStatus
  totalCapacity: number
  totalDecks: number
  commissionDate: string | null
  createdAt: string
  updatedAt: string
}

export type PortRecord = {
  portId: string
  portCode: string | null
  portName: string
  countryCode: string
  timeZoneId: string
  status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN'
}
