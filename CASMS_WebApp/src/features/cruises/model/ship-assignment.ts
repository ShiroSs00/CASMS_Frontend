import type { ShipRecord } from './cruise-record'

export type ShipAvailability = 'AVAILABLE' | 'UNAVAILABLE' | 'REQUIRES_IMPACT_CHECK' | 'UNKNOWN'

export type ShipCandidate = {
  ship: ShipRecord
  state: ShipAvailability
  reasons: string[]
  compatibility?:import('../api/dto').ShipCompatibilityDto|null
  impact?:import('../api/dto').ShipChangeImpactDto|null
}

export type AssignmentCapability = {
  allowed: boolean
  reason: string | null
}

export type AssignmentCapabilities = {
  assign: AssignmentCapability
  change: AssignmentCapability
  unassign: AssignmentCapability
}
