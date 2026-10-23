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
    value: dto.value,
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
  const now = Date.now()
  const activationBlockedReason = regulation.status !== 'DRAFT' && regulation.status !== 'INACTIVE'
    ? 'Chỉ quy định DRAFT hoặc INACTIVE mới có thể kích hoạt.'
    : new Date(regulation.effectiveFrom).getTime() > now
      ? 'Chưa đến thời điểm bắt đầu hiệu lực. Hãy chờ đến thời điểm đó hoặc chỉnh lại thời gian hiệu lực.'
      : regulation.effectiveTo && new Date(regulation.effectiveTo).getTime() < now
        ? 'Quy định đã hết thời gian hiệu lực. Hãy chỉnh thời điểm kết thúc hiệu lực trước khi kích hoạt.'
        : undefined
  return {
    canActivate: capability(!activationBlockedReason, activationBlockedReason),
    canDeactivate: capability(regulation.status === 'ACTIVE', 'Chỉ ACTIVE có thể deactivate.'),
    canAssign: capability(regulation.status === 'ACTIVE', 'Chỉ regulation ACTIVE mới có hiệu lực để gán.'),
    canRemove: capability(true),
    canProceed: capability(true),
  }
}

function normalizeConflict(dto: ConflictDto): ConflictResult {
  const blocking = dto.canProceed !== true || dto.severity === 'BLOCKING'
  const hasConflict = dto.severity === 'WARNING'
  return {
    severity: blocking ? 'blocking' : hasConflict ? 'warning' : 'clear',
    title: blocking ? 'Xung đột chặn thao tác' : hasConflict ? 'Cảnh báo xung đột' : 'Không phát hiện xung đột',
    message: `${dto.message} (${dto.context} · ${dto.code})`,
    canProceed: !blocking,
    comparedWith: dto.comparedWith.map((item) => ({ code: item.code, source: item.scope, content: `${item.value} ${item.unit ?? ''}`.trim() })),
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
  async conflicts(id: string) { return normalizeConflict(await apiRequest<ConflictDto>(`${byId(id)}/conflicts`, { query: { context: 'ACTIVATE' } })) },
  async list(query: RegulationListQuery): Promise<RegulationListItem[]> {
    const rows = query.effectiveOnly
      ? (await apiRequest<RegulationDto[]>(`${root}/effective`)).map(toRegulation)
      : await listRaw()
    const term = query.search.trim().toLocaleLowerCase('vi')
    return rows.filter((item) =>
      (!term || `${item.code} ${item.name}`.toLocaleLowerCase('vi').includes(term)) &&
      (query.type === 'ALL' || item.type === query.type) &&
      (query.scope === 'ALL' || item.scope === query.scope) &&
      (query.status === 'ALL' || item.status === query.status),
    ).map((item) => ({ ...item, effectiveStatus: getEffectiveStatus(item, query.effectiveAt || new Date().toISOString()) }))
  },
  async listEffective(): Promise<RegulationListItem[]> {
    const rows = (await apiRequest<RegulationDto[]>(`${root}/effective`)).map(toRegulation)
    return rows.map((item) => ({ ...item, effectiveStatus: 'EFFECTIVE' }))
  },
  async deleteUnused(id: string): Promise<void> {
    await apiRequest<void>(byId(id), { method: 'DELETE' })
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
    if (nextStatus !== 'ACTIVE') return { severity: 'clear', title: 'Không cần kiểm tra kích hoạt', message: 'Xác nhận thay đổi trạng thái.', canProceed: true, comparedWith: [] } satisfies ConflictResult
    await apiRequest<void>(`${byId(id)}/validate`, { method: 'POST' })
    const current = toRegulation(await apiRequest<RegulationDto>(byId(id)))
    const activation = capabilitiesFor(current).canActivate
    if (!activation.allowed) {
      return { severity: 'blocking', title: 'Chưa thể kích hoạt', message: activation.reason!, canProceed: false, comparedWith: [] } satisfies ConflictResult
    }
    return normalizeConflict(await apiRequest<ConflictDto>(`${byId(id)}/conflicts`, { query: { context: 'ACTIVATE' } }))
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
      return { severity: 'blocking', title: 'Xung đột chặn thao tác', message: 'Thiếu host ID cho precheck.', canProceed: false, comparedWith: [] } satisfies ConflictResult
    }
    return normalizeConflict(await apiRequest<ConflictDto>(`${base}/precheck`, { method: 'POST', body: { regulationId: id } }))
  },
  async assign(type: HostType, hostId: string, regulationId: string) {
    const body = type === 'ship' ? { shipId: hostId, regulationId } : { cruiseId: hostId, regulationId }
    await apiRequest<unknown>(assignmentPath(type, hostId), { method: 'POST', body })
    return { message: 'Đã gán quy định thành công.' }
  },
  async remove(type: HostType, hostId: string, regulationId: string) {
    await apiRequest<void>(`${assignmentPath(type, hostId)}/${encodeURIComponent(regulationId)}`, { method: 'DELETE' })
    return { message: 'Đã gỡ liên kết quy định.' }
  },
}
