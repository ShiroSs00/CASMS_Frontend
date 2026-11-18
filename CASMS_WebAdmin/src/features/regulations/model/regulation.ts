import {SHIP_TIME_ZONE,journeyTime,wallTimeToInstant,zonedInput} from '@/shared/lib/journey-time'
import {
  formatRegulationSourceLabel,
  formatRegulationValue,
  regulationScopeLabels,
  regulationStatusLabels,
  regulationTypeLabels,
  regulationUnitLabels,
} from '@/shared/i18n/regulation-labels'
export type RegulationType =
  | 'SAFETY'
  | 'CAPACITY'
  | 'SPEED'
  | 'WEATHER'
  | 'ENVIRONMENT'
  | 'HEALTH'
export type RegulationScope = 'GLOBAL' | 'SHIP' | 'CRUISE'
export type RegulationUnit =
  | 'KNOT'
  | 'KM'
  | 'METER'
  | 'PERCENT'
  | 'PERSON'
  | 'CELSIUS'
  | 'NONE'
export type RegulationStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED'
export type EffectiveStatus = 'EFFECTIVE' | 'UPCOMING' | 'EXPIRED' | 'NOT_ACTIVE' | 'UNKNOWN'
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
  unit: RegulationUnit | null
  effectiveFrom: string
  effectiveTo: string | null
  status: RegulationStatus
}

/** Adapter-only metadata; these fields are not columns in FOREP.sql. */
export type MockRegulation = Regulation & {
  hasBeenActive: boolean
  version: number
}
export type RegulationDraft = Omit<Regulation, 'id' | 'status'>

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
  effectiveOnly?: boolean
}

export type RegulationListItem = MockRegulation & {
  effectiveStatus: EffectiveStatus
}

export type HostContext = {
  type: HostType
  id: string
  name: string
  description: string
}

export type RegulationTargetAssignment = {
  type: HostType | 'global'
  id: string
  name: string
  sourceLabel: string
}

export type AssignedRegulation = {
  regulation: MockRegulation
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
  regulation: MockRegulation
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

export const typeLabels: Record<RegulationType, string> = regulationTypeLabels

export const scopeLabels: Record<RegulationScope, string> = regulationScopeLabels

export const statusLabels: Record<RegulationStatus, string> = regulationStatusLabels

export const effectiveLabels: Record<EffectiveStatus, string> = {
  EFFECTIVE: 'Đang hiệu lực',
  UPCOMING: 'Sắp hiệu lực',
  EXPIRED: 'Hết hiệu lực',
  NOT_ACTIVE: 'Không được kích hoạt',
  UNKNOWN: 'Chưa xác định hiệu lực',
}

export function getEffectiveStatus(
  regulation: Regulation,
  at: string,
): EffectiveStatus {
  if(regulation.status==='EXPIRED')return 'EXPIRED'
  if(regulation.status!=='ACTIVE')return 'NOT_ACTIVE'
  let instant:number
  try{instant=Date.parse(regulationInstant(at))}catch{return 'UNKNOWN'}
  const start=Date.parse(regulation.effectiveFrom),end=regulation.effectiveTo?Date.parse(regulation.effectiveTo):null
  if(!Number.isFinite(instant)||!Number.isFinite(start)||end!=null&&!Number.isFinite(end))return 'UNKNOWN'
  if(instant<start)return 'UPCOMING'
  if(end!=null&&instant>end)return 'EXPIRED'
  return 'EFFECTIVE'
}

export const regulationTimeZone=SHIP_TIME_ZONE
export function regulationInput(instant:string|number){return zonedInput(instant,SHIP_TIME_ZONE)}
export function regulationInstant(value:string){
 return /(?:Z|[+-]\d{2}:\d{2})$/.test(value)?new Date(value).toISOString():wallTimeToInstant(value,SHIP_TIME_ZONE)
}
export const unitLabels: Record<RegulationUnit, string> = regulationUnitLabels
export function regulationValue(regulation: Pick<Regulation, 'value' | 'unit'>) {
  return formatRegulationValue(regulation.value, regulation.unit)
}
export function regulationSource(source: string) {
  return formatRegulationSourceLabel(source)
}

export function formatDateTime(value:string|null){
 if(!value)return 'Không ấn định'
 try{return journeyTime(regulationInstant(value),SHIP_TIME_ZONE)}catch{return 'Chưa có thời gian hợp lệ'}
}
