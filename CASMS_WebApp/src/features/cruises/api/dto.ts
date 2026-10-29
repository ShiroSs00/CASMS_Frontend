import type { CruiseStatus, CruiseType, PortRecord, ShipRecord } from '../model/cruise-record'

export type CruiseSaveRequestDto = {
  itineraryMode?: 'FIXED' | 'CUSTOM'
  plannedScope?: 'DOMESTIC' | 'INTERNATIONAL'

  cruiseName: string
  shipId?: string
  sourceVersionId?: string
  expectedSourceVersionRevision?: number | null
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
  itineraryMode?: 'FIXED'|'CUSTOM'
  plannedScope?: 'DOMESTIC'|'INTERNATIONAL'
  revision?: number | null
  cruiseId: string
  sourceTripId?: string | null
  sourceTripCode?: string | null
  sourceVersionId?: string | null
  sourceVersionNumber?: number | null
  saleStopped?: boolean
  stoppedAt?: string | null
  stoppedByUsername?: string | null
  stopReason?: string | null
  stopEvidence?: string | null
  stopScope?: string | null
  stopEventIdentity?: string | null
  cruiseCode: string
  cruiseName: string
  shipId?: string | null
  shipName?: string | null
  shipCode?: string | null
  departurePortName?: string | null
  returnPortName?: string | null
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
  cruiseId?: string
  gateType?: string | null
  policyVersion?: string | null
  preparationSectionsConfirmed?: boolean | null
  unconfirmedPreparationSectionsCount?: number | null
  evaluatedAt?: string | null
  cruiseRevision?: number | null
  ready: boolean
  shipAssigned?: boolean
  shipActive?: boolean
  scheduleValid?: boolean
  shipConfigurationValid?: boolean
  portsActive?: boolean
  itineraryConfigured?: boolean
  issues?: string[]
  staffAssigned?: boolean | null
  captainAssigned?: boolean | null
  staffConflicts?: string[] | null
  regulationsCompliant?: boolean | null
  regulationConflicts?: string[] | null
  blockers?: string[] | null
  warnings?: string[] | null
  status?: ReadinessStatusDto | null
  fingerprint?: string | null
  validUntil?: string | null
  details?: ReadinessIssueDto[] | null
}

export type ReadinessStatusDto = 'READY' | 'NOT_READY' | 'INDETERMINATE' | 'WARNING' | 'NOT_APPLICABLE'
export type ReadinessIssueDto = {
  code:string|null;targetType:string|null;targetId:string|null;scope:string|null;severity:string|null
  message:string|null;evidence:string|null;allowedAction:string|null;requiredPermission:string|null
  ownerRole?:string|null;remediationUrl?:string|null;remediationOperation?:string|null
}
export type ShipCompatibilityDto = {
  cruiseId:string;shipId:string;compatible:boolean;shipActive:boolean|null;scheduleAvailable:boolean|null
  capacitySufficient:boolean|null;shipConfigured:boolean|null;decksCount:number|null;cabinsCount:number|null
  totalCapacity:number|null;bookedPassengersCount:number|null;issues:string[]
}
export type ShipChangeImpactDto = {
  cruiseId:string;currentShipId:string|null;newShipId:string;bookedPassengersCount:number|null
  capacitySufficient:boolean|null;affectedCabinAssignmentsCount:number|null;affectedOnboardActivitiesCount:number|null
  blockers:string[];warnings:string[];canProceed:boolean
}
export type OperationalProgramMappingDto = {
  sourceEntryId:string|null;clientKey:string|null;kind:string|null;title:string|null
  targetId:string|null;targetCode:string|null;targetType:string|null;status:string|null
  reservationRequired:boolean|null;reason:string|null;warnings:string[]|null;requiredData:string|null
}
export type OperationalProgramSyncDto = {
  cruiseId:string;onboardActivitiesCount:number;shoreExcursionsCount:number;servingWindowsCount:number|null
  items:OperationalProgramMappingDto[]|null;warnings:string[];syncedAt:string|null
}

// BE's current sale contracts only. No runtime client/permission is enabled here (F02/O01/O02).
export type CruiseOpenSaleRequestDto = { expectedRevision?:number|null;packageIds?:string[]|null;saleScope?:string|null;fingerprint?:string|null;eventIdentity?:string|null }
export type CruiseStopSaleRequestDto = {
  expectedRevision?:number|null;reason:string;evidence?:string|null;scope?:string|null;eventIdentity?:string|null;packageId?:string|null
}
export type CruiseResumeSaleRequestDto = {
  expectedRevision?:number|null;reason?:string|null;evidence?:string|null;scope?:string|null;eventIdentity?:string|null;packageId?:string|null
}
export type CruiseSaleContracts = {
  'open-sale': {request:CruiseOpenSaleRequestDto|null;response:CruiseDto}
  'stop-sale': {request:CruiseStopSaleRequestDto;response:CruiseDto}
  'resume-sale': {request:CruiseResumeSaleRequestDto|null;response:CruiseDto}
}

export type CapacityDto = {
  shipTotalCapacity: number | null
  bookedPassengersCount: number
  availableCapacity: number | null
  capacitySufficient: boolean
}
