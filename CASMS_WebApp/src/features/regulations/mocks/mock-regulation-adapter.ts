import { DEFAULT_EFFECTIVE_AT, hostFixtures, regulationFixtures } from './fixtures'
import type {
  AssignedRegulation,
  AssignmentSnapshot,
  CandidateRegulation,
  ConflictResult,
  HostType,
  MockRegulation,
  MutationResult,
  Regulation,
  RegulationDraft,
  RegulationListItem,
  RegulationListQuery,
  RegulationStatus,
  RegulationTargetAssignment,
  RegulationUpdate,
} from '../model/regulation'
import { getEffectiveStatus } from '../model/regulation'

let regulations = regulationFixtures.map((item) => ({ ...item }))

const directAssignments: Record<string, string[]> = {
  'ship:CAS-AUR-01': ['reg-spd-004', 'reg-saf-002'],
  'cruise:CR-261120-01': ['reg-cap-003', 'reg-saf-006'],
}

function assignmentKey(type: HostType, hostId: string) {
  return `${type}:${hostId}`
}

function assignmentIds(type: HostType, hostId: string) {
  return directAssignments[assignmentKey(type, hostId)] ?? []
}

function hostContext(type: HostType, hostId: string) {
  const fixture = hostFixtures[type]
  if (fixture.id === hostId) return fixture
  return {
    type,
    id: hostId,
    name: hostId,
    description: `${hostId} · Chưa có dữ liệu liên kết trực tiếp`,
  }
}

function wait(duration = 260) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration))
}

function getRegulation(id: string) {
  return regulations.find((item) => item.id === id)
}

function copy<T>(value: T): T {
  return structuredClone(value)
}

function targetsFor(regulation: Regulation): RegulationTargetAssignment[] {
  if (regulation.scope === 'GLOBAL') {
    return [{ type: 'global', id: 'global', name: 'Toàn hệ thống', sourceLabel: 'GLOBAL' }]
  }

  return Object.entries(directAssignments)
    .filter(([, ids]) => ids.includes(regulation.id))
    .map(([key]) => {
      const [type, id] = key.split(':') as [HostType, string]
      const host = hostContext(type, id)
      return {
        type,
        id,
        name: host.name,
        sourceLabel: `Trực tiếp · ${type === 'ship' ? 'Ship regulation' : 'Cruise regulation'}`,
      }
    })
}

function capabilitiesFor(
  regulation: Regulation,
  hostType?: HostType,
  hostId?: string,
) {
  const ids = hostType && hostId ? assignmentIds(hostType, hostId) : []
  const isLastDirect = hostType
    ? ids.length === 1 && ids[0] === regulation.id
    : false

  return {
    canActivate: {
      allowed: regulation.status !== 'ACTIVE',
      reason:
        regulation.status === 'ACTIVE' ? 'Quy định đang hoạt động.' : undefined,
    },
    canDeactivate: {
      allowed: regulation.status === 'ACTIVE',
      reason:
        regulation.status !== 'ACTIVE'
          ? 'Chỉ quy định đang hoạt động mới có thể ngừng.'
          : undefined,
    },
    canAssign: {
      allowed: regulation.status === 'ACTIVE',
      reason:
        regulation.status !== 'ACTIVE'
          ? 'Chỉ quy định ACTIVE mới có thể được gán.'
          : undefined,
    },
    canRemove: {
      allowed: !isLastDirect,
      reason: isLastDirect
        ? 'Không thể gỡ đối tượng cuối cùng theo BR-REG-05.'
        : undefined,
    },
    canProceed: { allowed: true },
  }
}

export const mockRegulationAdapter = {
  async list(query: RegulationListQuery): Promise<RegulationListItem[]> {
    await wait()
    const search = query.search.trim().toLocaleLowerCase('vi')
    return copy(
      regulations
        .filter((item) => {
          const matchesSearch =
            !search ||
            item.code.toLocaleLowerCase('vi').includes(search) ||
            item.name.toLocaleLowerCase('vi').includes(search)
          return (
            matchesSearch &&
            (query.type === 'ALL' || item.type === query.type) &&
            (query.scope === 'ALL' || item.scope === query.scope) &&
            (query.status === 'ALL' || item.status === query.status)
          )
        })
        .map((item) => ({
          ...item,
          effectiveStatus: getEffectiveStatus(
            item,
            query.effectiveAt || DEFAULT_EFFECTIVE_AT,
          ),
        })),
    )
  },

  async get(id: string) {
    await wait(180)
    const regulation = getRegulation(id)
    return regulation
      ? {
          regulation: copy(regulation),
          capabilities: capabilitiesFor(regulation),
          targets: copy(targetsFor(regulation)),
        }
      : null
  },

  async create(draft: RegulationDraft) {
    await wait(420)
    if (
      regulations.some(
        (item) => item.code.toLocaleUpperCase() === draft.code.toLocaleUpperCase(),
      )
    ) {
      throw new Error('DUPLICATE_CODE')
    }
    const id = draft.code.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')
    const regulation: MockRegulation = {
      ...draft,
      id,
      status: 'DRAFT',
      hasBeenActive: false,
      version: 1,
    }
    regulations = [regulation, ...regulations]
    return copy(regulation)
  },

  async update(id: string, update: RegulationUpdate) {
    await wait(420)
    const current = getRegulation(id)
    if (!current) throw new Error('Không tìm thấy quy định.')
    if (current.version !== update.version) {
      throw new Error('STALE_DATA')
    }
    if (
      update.code &&
      regulations.some(
        (item) =>
          item.id !== id &&
          item.code.toLocaleUpperCase() === update.code?.toLocaleUpperCase(),
      )
    ) {
      throw new Error('DUPLICATE_CODE')
    }
    const changes = { ...update } as Partial<RegulationDraft> & { version?: number }
    delete changes.version
    const safeChanges = current.hasBeenActive
      ? Object.fromEntries(
          Object.entries(changes).filter(([key]) => key !== 'value'),
        )
      : changes
    const next = { ...current, ...safeChanges, version: current.version + 1 }
    regulations = regulations.map((item) => (item.id === id ? next : item))
    return copy(next)
  },

  async precheckStatus(id: string, nextStatus: RegulationStatus) {
    await wait(360)
    const regulation = getRegulation(id)
    if (!regulation) throw new Error('Không tìm thấy quy định.')
    if (nextStatus === 'ACTIVE' && regulation.type === 'SPEED') {
      const result: ConflictResult = {
        severity: 'warning',
        title: 'Có quy định tốc độ đang cùng hiệu lực',
        message:
          'Có thể tiếp tục vì đây là cảnh báo. Hãy kiểm tra phạm vi và thời gian hiệu lực trước khi xác nhận.',
        canProceed: true,
        comparedWith: [
          {
            code: 'REG-SPD-001',
            source: 'GLOBAL',
            content: '12 KNOT',
          },
        ],
      }
      return result
    }
    const result: ConflictResult = {
      severity: 'clear',
      title: 'Không phát hiện xung đột',
      message: 'Đã kiểm tra theo dữ liệu mock hiện tại. Có thể tiếp tục.',
      canProceed: true,
      comparedWith: [],
    }
    return result
  },

  async changeStatus(id: string, nextStatus: RegulationStatus) {
    await wait(500)
    const current = getRegulation(id)
    if (!current) throw new Error('Không tìm thấy quy định.')
    const next = {
      ...current,
      status: nextStatus,
      hasBeenActive: current.hasBeenActive || nextStatus === 'ACTIVE',
      version: current.version + 1,
    }
    regulations = regulations.map((item) => (item.id === id ? next : item))
    return copy(next)
  },

  async getAssignments(type: HostType, hostId: string): Promise<AssignmentSnapshot> {
    await wait()
    const host = hostContext(type, hostId)
    const direct = assignmentIds(type, hostId)
      .map(getRegulation)
      .filter((item): item is MockRegulation => Boolean(item))
      .map<AssignedRegulation>((regulation) => ({
        regulation: copy(regulation),
        source: regulation.scope,
        sourceLabel: `${regulation.scope} · ${host.name}`,
        direct: true,
        capabilities: capabilitiesFor(regulation, type, hostId),
      }))

    const inheritedScopes = type === 'ship' ? ['GLOBAL'] : ['SHIP', 'GLOBAL']
    const inherited = regulations
      .filter(
        (item) =>
          item.status === 'ACTIVE' && inheritedScopes.includes(item.scope),
      )
      .slice(0, type === 'ship' ? 1 : 2)
      .map<AssignedRegulation>((regulation) => ({
        regulation: copy(regulation),
        source: regulation.scope,
        sourceLabel:
          regulation.scope === 'GLOBAL'
            ? 'GLOBAL · Toàn hệ thống'
            : 'SHIP · CASMS Aurora',
        direct: false,
        capabilities: {
          ...capabilitiesFor(regulation),
          canRemove: {
            allowed: false,
            reason: 'Chỉ liên kết trực tiếp mới có thể gỡ tại đây.',
          },
        },
      }))

    return copy({
      host,
      checkedAt: DEFAULT_EFFECTIVE_AT,
      direct,
      inherited,
    })
  },

  async getCandidates(
    type: HostType,
    hostId: string,
  ): Promise<CandidateRegulation[]> {
    await wait(220)
    const assigned = new Set(assignmentIds(type, hostId))
    const requiredScope = type === 'ship' ? 'SHIP' : 'CRUISE'
    return copy(
      regulations
        .filter((item) => item.scope === requiredScope && !assigned.has(item.id))
        .map((regulation) => ({
          regulation,
          capabilities: capabilitiesFor(regulation),
        })),
    )
  },

  async checkConflict(type: HostType, regulationId: string) {
    await wait(regulationId === 'reg-saf-002' ? 650 : 380)
    const regulation = getRegulation(regulationId)
    if (!regulation) {
      const result: ConflictResult = {
        severity: 'unavailable',
        title: 'Chưa xác định / kiểm tra thất bại',
        message:
          'Không thể tải kết quả kiểm tra. Không coi đây là trạng thái không có xung đột.',
        canProceed: false,
        comparedWith: [],
      }
      return result
    }
    if (regulation.type === 'CAPACITY') {
      const result: ConflictResult = {
        severity: 'blocking',
        title: 'Xung đột chặn thao tác',
        message: 'Giới hạn khách không tương thích với quy định đang áp dụng.',
        canProceed: false,
        comparedWith: [
          {
            code: 'REG-CAP-009',
            source: type === 'cruise' ? 'SHIP · CASMS Aurora' : 'GLOBAL',
            content: '80 PERSON',
          },
        ],
      }
      return result
    }
    if (regulation.type === 'SPEED') {
      const result: ConflictResult = {
        severity: 'warning',
        title: 'Cảnh báo xung đột tốc độ',
        message:
          'Có quy định tốc độ khác cùng hiệu lực. Có thể tiếp tục sau khi xác nhận.',
        canProceed: true,
        comparedWith: [
          { code: 'REG-SPD-001', source: 'GLOBAL', content: '12 KNOT' },
        ],
      }
      return result
    }
    const result: ConflictResult = {
      severity: 'clear',
      title: 'Không phát hiện xung đột',
      message: 'Kết quả kiểm tra cho phép gán quy định này.',
      canProceed: true,
      comparedWith: [],
    }
    return result
  },

  async assign(
    type: HostType,
    hostId: string,
    regulationId: string,
  ): Promise<MutationResult> {
    await wait(480)
    const key = assignmentKey(type, hostId)
    const current = assignmentIds(type, hostId)
    if (!current.includes(regulationId)) {
      directAssignments[key] = [...current, regulationId]
    }
    return { message: 'Đã gán quy định thành công.' }
  },

  async remove(
    type: HostType,
    hostId: string,
    regulationId: string,
  ): Promise<MutationResult> {
    await wait(480)
    const key = assignmentKey(type, hostId)
    const current = assignmentIds(type, hostId)
    if (current.length <= 1) {
      throw new Error('LAST_TARGET')
    }
    directAssignments[key] = current.filter(
      (id) => id !== regulationId,
    )
    return { message: 'Đã gỡ liên kết quy định.' }
  },
}
