import type { CruiseStatus, CruiseType, PortRecord, ShipRecord } from '../model/cruise-record'

export type CruiseSaveRequestDto = {
  cruiseName: string
  cruiseType?: CruiseType
  departureDatetime: string
  returnDatetime: string
  departurePortId: string
  returnPortId: string
}

export type PageDto<T> = {
  content: T[]
  totalPages: number
  totalElements: number
  number: number
  size?: number
}

export type CruiseDto = {
  cruiseId: string
  cruiseCode: string
  cruiseName: string
  shipId?: string | null
  shipName?: string | null
  shipCode?: string | null
  departurePortName?: string
  returnPortName?: string
  cruiseType: CruiseType
  departureDatetime: string
  returnDatetime: string
  departurePortId: string
  returnPortId: string
  status: CruiseStatus
  createdAt: string
  updatedAt: string
  ship?: ShipRecord | null
  departurePort?: PortRecord | null
  returnPort?: PortRecord | null
}

export type ReadinessDto = {
  ready: boolean
  shipAssigned?: boolean
  shipActive?: boolean
  scheduleValid?: boolean
  shipConfigurationValid?: boolean
  portsActive?: boolean
  itineraryConfigured?: boolean
  issues?: string[]
}

export type CapacityDto = {
  shipTotalCapacity: number | null
  bookedPassengersCount: number
  availableCapacity: number | null
  capacitySufficient: boolean
}
