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

export type ShipAssignmentContext = {
  cruiseId: string
  cruiseRevision: number
  hasBookings: boolean
  editablePlan: boolean
  shipId: string | null
  shipName: string | null
  shipCode: string | null
  assignmentStatus: 'ASSIGNED' | 'UNASSIGNED'
  allowedActions: AssignmentCapabilities
  requiresImpactWorkflow: boolean
  impactBlockers: string[]
  changeSafety: ShipAssignmentSafety
  unassignSafety: ShipAssignmentSafety
}

export type ShipAssignmentSafety = {
  cruiseId:string;currentShipId:string|null;requestedShipId:string|null;operation:'ASSIGN'|'CHANGE'|'UNASSIGN'
  assignmentChanged:boolean;canProceed:boolean;blockingCategories:string[];blockers:string[]
  dependencies:{category:string;count:number;blocking:boolean;clarificationRequired:boolean;reason:string}[]
  approvalImpact:{planStatus:string;readyRecorded:boolean;confirmedSignoffs:number;submittedSections:number;fingerprintWillChange:boolean;reason:string}
}
