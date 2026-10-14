import { apiRequest } from '@/shared/api'
import type {
  CandidateRegulation, HostType, MockRegulation, MutationResult, RegulationCapabilities,
  RegulationDraft, RegulationListItem, RegulationListQuery, RegulationStatus,
  RegulationTargetAssignment, RegulationUpdate,
} from '../model/regulation'
import { getEffectiveStatus } from '../model/regulation'
import {
  mapRegulationDto, mapConflictDto, mapAssignmentSnapshot,
  type OperationalRegulationDto, type RegulationAssignmentDto,
  type RegulationConflictDto, type AssignmentSnapshotDto,
} from './contract'

function capabilities(regulation: MockRegulation, assigned = false): RegulationCapabilities {
  const active = regulation.status === 'ACTIVE'
  return {
    canActivate: { allowed: !active, reason: active ? 'Quy định đang hoạt động.' : undefined },
    canDeactivate: { allowed: active, reason: active ? undefined : 'Chỉ quy định ACTIVE mới có thể ngừng.' },
    canAssign: {
      allowed: active && !assigned,
      reason: assigned ? 'Quy định đã được gán.' : active ? undefined : 'Chỉ quy định ACTIVE mới có thể gán.',
    },
    // Actual remove permission comes from the backend snapshot, not direct row count.
    canRemove: { allowed: false },
    canProceed: { allowed: true },
  }
}

function requestBody(draft: RegulationDraft) {
  return {
    regulationCode: draft.code.trim(), name: draft.name.trim(), description: draft.description,
    regulationType: draft.type, scope: draft.scope, value: draft.value.trim(), unit: draft.unit,
    effectiveFrom: new Date(draft.effectiveFrom).toISOString(),
    effectiveTo: draft.effectiveTo ? new Date(draft.effectiveTo).toISOString() : null,
  }
}

async function allRegulations() {
  return (await apiRequest<OperationalRegulationDto[]>('/operational-regulations')).map(mapRegulationDto)
}

function assignmentPath(type: HostType, id: string) {
  return `/${type === 'ship' ? 'ships' : 'cruises'}/${encodeURIComponent(id)}/regulations`
}

export const regulationApi = {
  async list(query: RegulationListQuery): Promise<RegulationListItem[]> {
    const search = query.search.trim().toLocaleLowerCase('vi')
    return (await allRegulations())
      .filter((item) => (
        (!search || item.code.toLocaleLowerCase('vi').includes(search) || item.name.toLocaleLowerCase('vi').includes(search)) &&
        (query.type === 'ALL' || item.type === query.type) &&
        (query.scope === 'ALL' || item.scope === query.scope) &&
        (query.status === 'ALL' || item.status === query.status)
      ))
      .map((item) => ({
        ...item, effectiveStatus: getEffectiveStatus(item, query.effectiveAt || new Date().toISOString()),
      }))
  },

  async get(id: string) {
    const regulation = mapRegulationDto(await apiRequest<OperationalRegulationDto>(
      `/operational-regulations/${encodeURIComponent(id)}`,
    ))
    const targets: RegulationTargetAssignment[] = regulation.scope === 'GLOBAL'
      ? [{ type: 'global', id: 'global', name: 'Toàn hệ thống', sourceLabel: 'GLOBAL' }] : []
    return { regulation, capabilities: capabilities(regulation), targets }
  },

  async create(draft: RegulationDraft) {
    return mapRegulationDto(await apiRequest<OperationalRegulationDto>('/operational-regulations', {
      method: 'POST', body: requestBody(draft),
    }))
  },

  async update(id: string, update: RegulationUpdate) {
    const current = (await this.get(id)).regulation
    const draft: RegulationDraft = {
      code: update.code ?? current.code, name: update.name ?? current.name,
      description: update.description ?? current.description, type: update.type ?? current.type,
      scope: update.scope ?? current.scope, value: update.value ?? current.value,
      unit: update.unit === undefined ? current.unit : update.unit,
      effectiveFrom: update.effectiveFrom ?? current.effectiveFrom,
      effectiveTo: update.effectiveTo === undefined ? current.effectiveTo : update.effectiveTo,
    }
    return mapRegulationDto(await apiRequest<OperationalRegulationDto>(
      `/operational-regulations/${encodeURIComponent(id)}`, { method: 'PUT', body: requestBody(draft) },
    ))
  },

  async precheckStatus(id: string, nextStatus: RegulationStatus) {
    if (nextStatus !== 'ACTIVE') throw new Error('Precheck chỉ áp dụng khi kích hoạt quy định.')
    return mapConflictDto(await apiRequest<RegulationConflictDto>(
      `/operational-regulations/${encodeURIComponent(id)}/conflicts`, { query: { context: 'ACTIVATE' } },
    ))
  },

  async changeStatus(id: string, nextStatus: RegulationStatus) {
    if (nextStatus !== 'ACTIVE' && nextStatus !== 'INACTIVE') throw new Error('Trạng thái không hỗ trợ.')
    const action = nextStatus === 'ACTIVE' ? 'activate' : 'deactivate'
    return mapRegulationDto(await apiRequest<OperationalRegulationDto>(
      `/operational-regulations/${encodeURIComponent(id)}/${action}`, { method: 'PATCH' },
    ))
  },

  async getAssignments(type: HostType, hostId: string) {
    return mapAssignmentSnapshot(await apiRequest<AssignmentSnapshotDto>(
      `${assignmentPath(type, hostId)}/effective`,
    ))
  },

  async getCandidates(type: HostType, hostId: string): Promise<CandidateRegulation[]> {
    const [regulations, assigned] = await Promise.all([
      allRegulations(), apiRequest<RegulationAssignmentDto[]>(assignmentPath(type, hostId)),
    ])
    const ids = new Set(assigned.map((item) => item.regulationId))
    return regulations.filter((item) => item.scope === (type === 'ship' ? 'SHIP' : 'CRUISE'))
      .map((regulation) => ({ regulation, capabilities: capabilities(regulation, ids.has(regulation.id)) }))
  },

  async checkConflict(type: HostType, hostId: string, regulationId: string) {
    return mapConflictDto(await apiRequest<RegulationConflictDto>(
      `${assignmentPath(type, hostId)}/precheck`, { method: 'POST', body: { regulationId } },
    ))
  },

  async assign(type: HostType, hostId: string, regulationId: string): Promise<MutationResult> {
    const body = type === 'ship' ? { shipId: hostId, regulationId } : { cruiseId: hostId, regulationId }
    await apiRequest<RegulationAssignmentDto>(assignmentPath(type, hostId), { method: 'POST', body })
    return { message: 'Backend đã gán quy định thành công.' }
  },

  async remove(type: HostType, hostId: string, regulationId: string): Promise<MutationResult> {
    await apiRequest<void>(`${assignmentPath(type, hostId)}/${encodeURIComponent(regulationId)}`, { method: 'DELETE' })
    return { message: 'Backend đã gỡ liên kết quy định.' }
  },
}
