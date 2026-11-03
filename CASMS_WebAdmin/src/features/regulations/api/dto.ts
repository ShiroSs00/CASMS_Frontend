import type { RegulationScope, RegulationStatus, RegulationType, RegulationUnit } from '../model/regulation'

export type RegulationDto = {
  regulationId: string
  regulationCode: string
  name: string
  description?: string | null
  regulationType: RegulationType
  scope: RegulationScope
  value: string
  unit?: RegulationUnit | null
  effectiveFrom: string
  effectiveTo?: string | null
  status: RegulationStatus
  createdAt?: string
  updatedAt?: string
}

export type ConflictDto = {
  context: string
  severity: 'CLEAR' | 'WARNING' | 'BLOCKING'
  canProceed: boolean
  code: string
  message: string
  comparedWith: Array<{ regulationId: string; code: string; scope: RegulationScope; value: string; unit: string | null }>
}

export type AssignmentDto = { regulationId: string }
export type SnapshotDto = {
  host: { type: string; id: string; code: string; name: string }
  checkedAt: string
  direct: SnapshotItemDto[]
  inherited: SnapshotItemDto[]
}
export type SnapshotItemDto = {
  regulation: RegulationDto
  source: import('../model/regulation').RegulationScope
  sourceLabel: string
  canRemove: boolean
  removeBlockedReason?: string
}
