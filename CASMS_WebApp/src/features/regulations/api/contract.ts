import type {
  AssignmentSnapshot,
  AssignedRegulation,
  ConflictResult,
  HostType,
  MockRegulation,
  RegulationScope,
  RegulationStatus,
  RegulationType,
  RegulationUnit,
  RegulationDraft,
} from '../model/regulation'

export function mapRegulationFieldErrors(details: Record<string, unknown> = {}) {
  const fields: Record<string, keyof RegulationDraft> = {
    regulationCode: 'code', name: 'name', description: 'description',
    regulationType: 'type', scope: 'scope', value: 'value', unit: 'unit',
    effectiveFrom: 'effectiveFrom', effectiveTo: 'effectiveTo',
  }
  const errors: Partial<Record<keyof RegulationDraft, string>> = {}
  for (const [field, message] of Object.entries(details)) {
    const target = fields[field]
    if (target && typeof message === 'string') errors[target] = message
  }
  return errors
}

export type RegulationConflictDto = {
  context: string
  severity: string
  canProceed: boolean
  code: string
  message: string
  comparedWith: Array<{ regulationId: string; code: string; scope: RegulationScope; value: string; unit: string | null }>
}

export type AssignmentItemDto = {
  regulation: OperationalRegulationDto
  source: RegulationScope
  sourceHostId: string | null
  sourceLabel: string
  canRemove: boolean
  removeBlockedReason: string | null
}

export type AssignmentSnapshotDto = {
  host: { type: 'SHIP' | 'CRUISE'; id: string; code: string; name: string }
  checkedAt: string
  direct: AssignmentItemDto[]
  inherited: AssignmentItemDto[]
}

export function mapConflictDto(dto: RegulationConflictDto): ConflictResult {
  const severity = dto.severity?.toLowerCase()
  const known = severity === 'clear' || severity === 'warning' || severity === 'blocking'
  return {
    severity: known ? severity : 'unavailable',
    title: severity === 'clear' ? 'Không có xung đột' : severity === 'warning' ? 'Cảnh báo xung đột' : 'Không thể tiếp tục',
    message: dto.message,
    canProceed: known && severity !== 'blocking' && dto.canProceed === true,
    comparedWith: (dto.comparedWith ?? []).map((item) => ({
      code: item.code, source: item.scope,
      content: `${item.value}${item.unit && item.unit !== 'NONE' ? ` ${item.unit}` : ''}`,
    })),
  }
}

export function mapAssignmentSnapshot(dto: AssignmentSnapshotDto): AssignmentSnapshot {
  function row(item: AssignmentItemDto, direct: boolean): AssignedRegulation {
    return {
      regulation: mapRegulationDto(item.regulation), source: item.source,
      sourceLabel: item.sourceLabel, direct,
      capabilities: {
        canActivate: { allowed: false }, canDeactivate: { allowed: false },
        canAssign: { allowed: false }, canProceed: { allowed: true },
        canRemove: {
          allowed: direct && item.canRemove === true,
          reason: item.removeBlockedReason ?? (direct ? undefined : 'Quy định kế thừa chỉ đọc.'),
        },
      },
    }
  }
  return {
    host: { type: dto.host.type === 'SHIP' ? 'ship' : 'cruise', id: dto.host.id,
      name: `${dto.host.code} · ${dto.host.name}`, description: 'Quy định đang hiệu lực theo snapshot backend' },
    checkedAt: dto.checkedAt,
    direct: dto.direct.map((item) => row(item, true)),
    inherited: dto.inherited.map((item) => row(item, false)),
    source: 'backend',
  }
}

export type OperationalRegulationDto = {
  regulationId: string
  regulationCode: string
  name: string
  description: string | null
  regulationType: RegulationType
  scope: RegulationScope
  value: string
  unit: RegulationUnit | null
  effectiveFrom: string
  effectiveTo: string | null
  status: RegulationStatus
  createdAt: string
  updatedAt: string
}

export type RegulationAssignmentDto = {
  shipId?: string
  cruiseId?: string
  regulationId: string
}

export function mapRegulationDto(dto: OperationalRegulationDto): MockRegulation {
  const parsedVersion = Date.parse(dto.updatedAt)
  return {
    id: dto.regulationId,
    code: dto.regulationCode,
    name: dto.name,
    description: dto.description ?? '',
    type: dto.regulationType,
    scope: dto.scope,
    value: dto.value,
    unit: dto.unit,
    effectiveFrom: dto.effectiveFrom,
    effectiveTo: dto.effectiveTo,
    status: dto.status,
    hasBeenActive: dto.status !== 'DRAFT',
    version: Number.isFinite(parsedVersion) ? parsedVersion : 0,
    source: 'backend',
  }
}

export function mergeAssignmentSources(
  type: HostType,
  primaryIds: readonly string[],
  shipIds: readonly string[],
  regulations: readonly MockRegulation[],
) {
  const byId = new Map(regulations.map((regulation) => [regulation.id, regulation]))
  const directScope: RegulationScope = type === 'ship' ? 'SHIP' : 'CRUISE'
  const direct = primaryIds
    .map((id) => byId.get(id))
    .filter((item): item is MockRegulation => item?.scope === directScope)

  const inheritedIds = type === 'ship'
    ? primaryIds
    : [...primaryIds, ...shipIds]
  const seen = new Set<string>()
  const inherited = inheritedIds
    .map((id) => byId.get(id))
    .filter((item): item is MockRegulation => {
      if (!item || seen.has(item.id)) return false
      const isInherited = item.scope === 'GLOBAL' || (type === 'cruise' && item.scope === 'SHIP')
      if (!isInherited) return false
      seen.add(item.id)
      return true
    })

  return { direct, inherited }
}
