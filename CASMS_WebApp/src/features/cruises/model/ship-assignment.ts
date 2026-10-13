import type { ShipRecord } from './cruise-record'

export type ShipAvailability = 'AVAILABLE' | 'UNAVAILABLE' | 'REQUIRES_IMPACT_CHECK'

export type ShipCandidate = {
  ship: ShipRecord
  state: ShipAvailability
  reasons: string[]
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
