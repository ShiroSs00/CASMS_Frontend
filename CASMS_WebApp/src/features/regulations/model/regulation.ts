export type RegulationType = 'SPEED' | 'CAPACITY' | 'SAFETY' | 'SERVICE'
export type RegulationScope = 'GLOBAL' | 'SHIP' | 'CRUISE'
export type RegulationStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'
export type EffectiveStatus = 'EFFECTIVE' | 'UPCOMING' | 'EXPIRED' | 'NOT_ACTIVE'
export type HostType = 'ship' | 'cruise'
export type ConflictSeverity = 'clear' | 'warning' | 'blocking' | 'unavailable'

export type Regulation = {
  id: string
  code: string
  name: string
  description: string
  type: RegulationType
  scope: RegulationScope
  value: string
  unit: string
  effectiveFrom: string
  effectiveTo: string
  status: RegulationStatus
  hasBeenActive: boolean
  version: number
}
export type RegulationDraft = Omit<
  Regulation,
  'id' | 'status' | 'hasBeenActive' | 'version'
>

export type RegulationUpdate = Partial<RegulationDraft> & { version: number }

export type Capability = {
  allowed: boolean
  reason?: string
}

export type RegulationCapabilities = {
  canActivate: Capability
  canDeactivate: Capability
  canAssign: Capability
  canRemove: Capability
  canProceed: Capability
}

export type RegulationListQuery = {
  search: string
  type: RegulationType | 'ALL'
  scope: RegulationScope | 'ALL'
  status: RegulationStatus | 'ALL'
  effectiveAt: string
}

export type RegulationListItem = Regulation & {
  effectiveStatus: EffectiveStatus
}

export type HostContext = {
  type: HostType
  id: string
  name: string
  description: string
}

export type AssignedRegulation = {
  regulation: Regulation
  source: RegulationScope
  sourceLabel: string
  direct: boolean
  capabilities: RegulationCapabilities
}

export type AssignmentSnapshot = {
  host: HostContext
  checkedAt: string
  direct: AssignedRegulation[]
  inherited: AssignedRegulation[]
}

export type CandidateRegulation = {
  regulation: Regulation
  capabilities: RegulationCapabilities
}

export type ConflictResult = {
  severity: ConflictSeverity
  title: string
  message: string
  canProceed: boolean
  comparedWith: Array<{
    code: string
    source: string
    content: string
  }>
}

export type MutationResult = {
  message: string
}

export const typeLabels: Record<RegulationType, string> = {
  SPEED: 'Tốc độ',
  CAPACITY: 'Sức chứa',
  SAFETY: 'An toàn',
  SERVICE: 'Dịch vụ',
}

export const scopeLabels: Record<RegulationScope, string> = {
  GLOBAL: 'Toàn hệ thống',
  SHIP: 'Theo tàu',
  CRUISE: 'Theo chuyến',
}

export const statusLabels: Record<RegulationStatus, string> = {
  DRAFT: 'Bản nháp',
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
}

export const effectiveLabels: Record<EffectiveStatus, string> = {
  EFFECTIVE: 'Đang hiệu lực',
  UPCOMING: 'Sắp hiệu lực',
  EXPIRED: 'Hết hiệu lực',
  NOT_ACTIVE: 'Không áp dụng',
}

export function getEffectiveStatus(
  regulation: Regulation,
  at: string,
): EffectiveStatus {
  if (regulation.status !== 'ACTIVE') return 'NOT_ACTIVE'

  const instant = new Date(at).getTime()
  if (instant < new Date(regulation.effectiveFrom).getTime()) return 'UPCOMING'
  if (
    regulation.effectiveTo &&
    instant > new Date(regulation.effectiveTo).getTime()
  ) {
    return 'EXPIRED'
  }
  return 'EFFECTIVE'
}

export function formatDateTime(value: string) {
  if (!value) return 'Không giới hạn'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}
