import type { RegulationScope, RegulationStatus, RegulationType, RegulationUnit } from '../model/regulation'

export type RegulationDto = {
  regulationId: string
  regulationCode: string
  name: string
  description?: string | null
  regulationType: RegulationType
  scope: RegulationScope
  ruleValue?: string | number | null
  value?: string | number | null
  unit?: RegulationUnit | null
  effectiveFrom: string
  effectiveTo?: string | null
  status: RegulationStatus
  createdAt?: string
  updatedAt?: string
}

export type ConflictDto = {
  severity?: string
  comparedWith?: Array<{ regulationId: string; code: string; scope: string; value: string; unit?: string }>
  regulationCode?: string
  code?: string
  source?: string
  content?: string
  hasConflict?: boolean
  blocking?: boolean
  canProceed?: boolean
  message?: string
  conflicts?: Array<{
    regulationCode?: string
    code?: string
    source?: string
    message?: string
    content?: string
  }>
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
