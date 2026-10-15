import { apiRequest, ApiError } from '@/shared/api'

import type {
  AssignedRegulation,
  AssignmentSnapshot,
  CandidateRegulation,
  ConflictResult,
  HostType,
  MockRegulation,
  RegulationCapabilities,
  RegulationDraft,
  RegulationListItem,
  RegulationListQuery,
  RegulationStatus,
  RegulationTargetAssignment,
  RegulationUpdate,
} from '../model/regulation'
import { getEffectiveStatus } from '../model/regulation'
import type { AssignmentDto, ConflictDto, RegulationDto, SnapshotDto, SnapshotItemDto } from './dto'

const root = '/operational-regulations'
const byId = (id: string) => `${root}/${encodeURIComponent(id)}`

function toRegulation(dto: RegulationDto): MockRegulation {
  return {
    id: dto.regulationId,
    code: dto.regulationCode,
    name: dto.name,
    description: dto.description ?? '',
    type: dto.regulationType,
    scope: dto.scope,
    value: String(dto.ruleValue ?? dto.value ?? ''),
    unit: dto.unit ?? null,
    effectiveFrom: dto.effectiveFrom,
    effectiveTo: dto.effectiveTo ?? null,
    status: dto.status,
    hasBeenActive: dto.status !== 'DRAFT',
    version: 1,
  }
}

function body(draft: RegulationDraft) {
  return {
    regulationCode: draft.code.trim(),
    name: draft.name.trim(),
    description: draft.description.trim(),
    regulationType: draft.type,
    scope: draft.scope,
    value: draft.value,
    unit: draft.unit,
    effectiveFrom: new Date(draft.effectiveFrom).toISOString(),
    effectiveTo: draft.effectiveTo ? new Date(draft.effectiveTo).toISOString() : null,
  }
}

const capability = (allowed: boolean, reason?: string) => ({ allowed, ...(reason ? { reason } : {}) })
function capabilitiesFor(regulation: MockRegulation): RegulationCapabilities {
  return {
    canActivate: capability(regulation.status === 'DRAFT' || regulation.status === 'INACTIVE', 'Chỉ DRAFT/INACTIVE có thể activate.'),
    canDeactivate: capability(regulation.status === 'ACTIVE', 'Chỉ ACTIVE có thể deactivate.'),
    canAssign: capability(regulation.status === 'ACTIVE', 'Chỉ regulation ACTIVE mới có hiệu lực để gán.'),
    canRemove: capability(true),
    canProceed: capability(true),
  }
}

function normalizeConflict(value: ConflictDto | ConflictDto[]): ConflictResult {
  const dto = Array.isArray(value) ? value[0] ?? {} : value
  const items = Array.isArray(value) ? value : dto.conflicts ?? []
  const blocking = dto.blocking ?? (dto.canProceed === false)
  const hasConflict = dto.hasConflict ?? (dto.severity?.toLowerCase() === 'warning' || items.length > 0)
  return {
    severity: blocking ? 'blocking' : hasConflict ? 'warning' : 'clear',
    title: blocking ? 'Xung đột chặn thao tác' : hasConflict ? 'Cảnh báo xung đột' : 'Không phát hiện xung đột',
    message: dto.message ?? (blocking ? 'Backend không cho phép tiếp tục.' : hasConflict ? 'Backend yêu cầu rà soát trước khi tiếp tục.' : 'Backend cho phép tiếp tục.'),
    canProceed: dto.canProceed ?? !blocking,
    comparedWith: dto.comparedWith ? dto.comparedWith.map((item) => ({ code: item.code, source: item.scope, content: `${item.value} ${item.unit ?? ''}` })) : items.map((item) => ({
      code: item.regulationCode ?? item.code ?? 'REGULATION',
      source: item.source ?? 'Backend conflict check',
      content: item.message ?? item.content ?? 'Xung đột được backend trả về.',
    })),
  }
}

async function listRaw(signal?: AbortSignal) {
  return (await apiRequest<RegulationDto[]>(root, { signal })).map(toRegulation)
}

function assignmentPath(type: HostType, hostId: string) {
  return `/${type === 'ship' ? 'ships' : 'cruises'}/${encodeURIComponent(hostId)}/regulations`
}

function assigned(regulation: MockRegulation, direct: boolean, sourceLabel: string): AssignedRegulation {
  return {
    regulation,
    source: regulation.scope,
    sourceLabel,
    direct,
    capabilities: {
      ...capabilitiesFor(regulation),
      canRemove: direct ? capability(true) : capability(false, 'Quy định kế thừa chỉ đọc.'),
    },
  }
}

export const regulationsApi = {
  validate: (id: string) => apiRequest<void>(`${byId(id)}/validate`, { method: 'POST' }),
  async conflicts(id: string) { return normalizeConflict(await apiRequest<ConflictDto>(`${byId(id)}/conflicts`)) },
  async list(query: RegulationListQuery): Promise<RegulationListItem[]> {
    const rows = await listRaw()
    const term = query.search.trim().toLocaleLowerCase('vi')
    return rows.filter((item) =>
      (!term || `${item.code} ${item.name}`.toLocaleLowerCase('vi').includes(term)) &&
      (query.type === 'ALL' || item.type === query.type) &&
      (query.scope === 'ALL' || item.scope === query.scope) &&
      (query.status === 'ALL' || item.status === query.status),
    ).map((item) => ({ ...item, effectiveStatus: getEffectiveStatus(item, query.effectiveAt || new Date().toISOString()) }))
  },
  async get(id: string) {
    try {
      const regulation = toRegulation(await apiRequest<RegulationDto>(byId(id)))
      const targets: RegulationTargetAssignment[] = []
      return { regulation, capabilities: capabilitiesFor(regulation), targets }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }
  },
  async create(draft: RegulationDraft) {
    return toRegulation(await apiRequest<RegulationDto>(root, { method: 'POST', body: body(draft) }))
  },
  async update(id: string, update: RegulationUpdate) {
    const current = toRegulation(await apiRequest<RegulationDto>(byId(id)))
    const merged: RegulationDraft = { ...current, ...update }
    return toRegulation(await apiRequest<RegulationDto>(byId(id), { method: 'PUT', body: body(merged) }))
  },
  async precheckStatus(id: string, nextStatus: RegulationStatus) {
    if (nextStatus !== 'ACTIVE') return normalizeConflict({ hasConflict: false, canProceed: true })
    await apiRequest<void>(`${byId(id)}/validate`, { method: 'POST' })
    return normalizeConflict(await apiRequest<ConflictDto | ConflictDto[]>(`${byId(id)}/conflicts`))
  },
  async changeStatus(id: string, nextStatus: RegulationStatus) {
    const action = nextStatus === 'ACTIVE' ? 'activate' : 'deactivate'
    return toRegulation(await apiRequest<RegulationDto>(`${byId(id)}/${action}`, { method: 'PATCH' }))
  },
  async getAssignments(type: HostType, hostId: string): Promise<AssignmentSnapshot> {
    const base = assignmentPath(type, hostId)
    const [directDtos, snapshot] = await Promise.all([
      apiRequest<AssignmentDto[]>(base),
      apiRequest<SnapshotDto>(`${base}/effective`),
    ])
    const direct = await Promise.all(directDtos.map((item) => apiRequest<RegulationDto>(byId(item.regulationId))))
    const fromSnapshot = (item: SnapshotItemDto): AssignedRegulation => ({
      ...assigned(toRegulation(item.regulation), false, item.sourceLabel), source: item.source,
    })
    return {
      host: { type, id: hostId, name: snapshot.host.name, description: snapshot.host.code },
      checkedAt: snapshot.checkedAt,
      direct: direct.map((dto) => {
        const item = toRegulation(dto)
        const result = assigned(item, true, `${item.scope} · ${snapshot.host.name}`)
        const permission = snapshot.direct.find((entry) => entry.regulation.regulationId === item.id)
        if (permission) result.capabilities.canRemove = capability(permission.canRemove, permission.removeBlockedReason)
        return result
      }),
      inherited: snapshot.inherited.map(fromSnapshot),
    }
  },
  async getCandidates(type: HostType, hostId: string): Promise<CandidateRegulation[]> {
    const [all, directDtos] = await Promise.all([
      listRaw(),
      apiRequest<AssignmentDto[]>(assignmentPath(type, hostId)),
    ])
    const assignedIds = new Set(directDtos.map((item) => item.regulationId))
    const scope = type === 'ship' ? 'SHIP' : 'CRUISE'
    return all.filter((item) => item.scope === scope && !assignedIds.has(item.id)).map((regulation) => ({ regulation, capabilities: capabilitiesFor(regulation) }))
  },
  async checkConflict(type: HostType, hostId: string, regulationId?: string) {
    const id = regulationId ?? hostId
    const base = assignmentPath(type, regulationId ? hostId : '')
    if (!regulationId) {
      return normalizeConflict({ hasConflict: true, canProceed: false, message: 'Thiếu host ID cho precheck.' })
    }
    return normalizeConflict(await apiRequest<ConflictDto>(`${base}/precheck`, { method: 'POST', body: { regulationId: id } }))
  },
  async assign(type: HostType, hostId: string, regulationId: string) {
    await apiRequest<unknown>(assignmentPath(type, hostId), { method: 'POST', body: { regulationId } })
    return { message: 'Đã gán quy định thành công.' }
  },
  async remove(type: HostType, hostId: string, regulationId: string) {
    await apiRequest<void>(`${assignmentPath(type, hostId)}/${encodeURIComponent(regulationId)}`, { method: 'DELETE' })
    return { message: 'Đã gỡ liên kết quy định.' }
  },
}
