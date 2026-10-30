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
import { regulationInstant,regulationSource,regulationValue,getEffectiveStatus } from '../model/regulation'
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
    effectiveFrom: regulationInstant(draft.effectiveFrom),
    effectiveTo: draft.effectiveTo ? regulationInstant(draft.effectiveTo) : null,
  }
}

const capability = (allowed: boolean, reason?: string) => ({ allowed, ...(reason ? { reason } : {}) })
function capabilitiesFor(regulation: MockRegulation): RegulationCapabilities {
  const now = Date.now()
  const activationBlockedReason = regulation.status !== 'DRAFT' && regulation.status !== 'INACTIVE'
    ? 'Chỉ quy định nháp hoặc đã ngừng kích hoạt mới có thể kích hoạt.'
    : new Date(regulation.effectiveFrom).getTime() > now
      ? 'Chưa đến thời điểm bắt đầu hiệu lực. Hãy chờ đến thời điểm đó hoặc chỉnh lại thời gian hiệu lực.'
      : regulation.effectiveTo && new Date(regulation.effectiveTo).getTime() < now
        ? 'Quy định đã hết thời gian hiệu lực. Hãy chỉnh thời điểm kết thúc hiệu lực trước khi kích hoạt.'
        : undefined
  return {
    canActivate: capability(!activationBlockedReason, activationBlockedReason),
    canDeactivate: capability(regulation.status === 'ACTIVE', 'Chỉ quy định đã kích hoạt mới có thể ngừng kích hoạt.'),
    canAssign: capability(regulation.status === 'ACTIVE', 'Cần kích hoạt quy định trước khi gán.'),
    canRemove: capability(true),
    canProceed: capability(true),
  }
}

function normalizeConflict(dto: ConflictDto): ConflictResult {
  if(!dto||typeof dto.canProceed!=='boolean'||!['CLEAR','WARNING','BLOCKING'].includes(dto.severity)||!Array.isArray(dto.comparedWith))throw new ApiError('Phản hồi kiểm tra xung đột chưa đầy đủ. Chưa thể tiếp tục thao tác.',502,'REGULATION_CONFLICT_RESPONSE_INVALID')
  const blocking = dto.canProceed !== true || dto.severity === 'BLOCKING'
  const hasConflict = dto.severity === 'WARNING'
  return {
    severity: blocking ? 'blocking' : hasConflict ? 'warning' : 'clear',
    title: blocking ? 'Xung đột chặn thao tác' : hasConflict ? 'Cảnh báo xung đột' : 'Không phát hiện xung đột',
    message: dto.message,
    canProceed: !blocking,
    comparedWith: dto.comparedWith.map((item) => ({ code: item.code, source: regulationSource(item.scope), content: regulationValue({value:item.value,unit:item.unit as import('../model/regulation').RegulationUnit|null}) })),
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
    if(!snapshot?.host||snapshot.host.id!==hostId||!Array.isArray(snapshot.direct)||!Array.isArray(snapshot.inherited))throw new ApiError('Phản hồi quy định chưa khớp với đối tượng đang xem. Tải lại danh sách.',502,'REGULATION_ASSIGNMENT_RESPONSE_INVALID')
    const fromSnapshot = (item: SnapshotItemDto): AssignedRegulation => ({
      ...assigned(toRegulation(item.regulation), false, regulationSource(item.sourceLabel)), source: item.source,
    })
    return {
      host: { type, id: hostId, name: snapshot.host.name, description: snapshot.host.code },
      checkedAt: snapshot.checkedAt,
      direct: direct.filter(dto=>dto.scope!=='GLOBAL').map((dto) => {
        const item = toRegulation(dto)
        const result = assigned(item, true, `${regulationSource(item.scope)} · ${snapshot.host.name}`)
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
      return { severity: 'blocking', title: 'Xung đột chặn thao tác', message: 'Chưa xác định tàu hoặc lần khởi hành cần kiểm tra.', canProceed: false, comparedWith: [] } satisfies ConflictResult
    }
    return normalizeConflict(await apiRequest<ConflictDto>(`${base}/precheck`, { method: 'POST', body: { regulationId: id } }))
  },
  async assign(type: HostType, hostId: string, regulationId: string) {
    const body = type === 'ship' ? { shipId: hostId, regulationId } : { cruiseId: hostId, regulationId }
    await apiRequest<unknown>(assignmentPath(type, hostId), { method: 'POST', body })
    let actual:AssignmentSnapshot
    try{actual=await this.getAssignments(type,hostId)}catch{throw new ApiError('Đã gửi yêu cầu gán nhưng chưa đọc lại được liên kết. Tải lại danh sách trước khi thao tác tiếp.',502,'REGULATION_READBACK_UNCONFIRMED')}
    if(!actual.direct.some(item=>item.regulation.id===regulationId))throw new ApiError('Chưa xác nhận được liên kết sau khi gán. Tải lại danh sách trước khi thao tác tiếp.',502,'REGULATION_READBACK_UNCONFIRMED')
    return { message: 'Đã gán quy định.' }
  },
  async remove(type: HostType, hostId: string, regulationId: string) {
    await apiRequest<void>(`${assignmentPath(type, hostId)}/${encodeURIComponent(regulationId)}`, { method: 'DELETE' })
    let actual:AssignmentSnapshot
    try{actual=await this.getAssignments(type,hostId)}catch{throw new ApiError('Đã gửi yêu cầu gỡ nhưng chưa đọc lại được liên kết. Tải lại danh sách trước khi thao tác tiếp.',502,'REGULATION_READBACK_UNCONFIRMED')}
    if(actual.direct.some(item=>item.regulation.id===regulationId))throw new ApiError('Chưa xác nhận được việc gỡ liên kết. Tải lại danh sách trước khi thao tác tiếp.',502,'REGULATION_READBACK_UNCONFIRMED')
    return { message: 'Đã gỡ quy định khỏi đối tượng.' }
  },
}
