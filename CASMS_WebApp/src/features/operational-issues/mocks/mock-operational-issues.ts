import type { IssueQuery } from '../model/issue-query'
import type {
  IssueStatus,
  OperationalIssue,
  OperationalIssueRecord,
  PersonReference,
} from '../model/issue'
import {
  initialIssueRecords,
  mockCabins,
  mockCruises,
  mockHandlers,
  mockPeople,
  mockShips,
} from './fixtures'

export type IssueStatusTotals = Record<IssueStatus, number> & { review: number }

export type IssueListResult = {
  items: OperationalIssue[]
  total: number
  page: number
  pageSize: number
  statusTotals: IssueStatusTotals
}

const currentActorId = 'ops-user'
const records = initialIssueRecords.map((record) => ({ ...record }))

export class IssueAdapterError extends Error {
  readonly code: 'FORBIDDEN' | 'NOT_FOUND'

  constructor(code: 'FORBIDDEN' | 'NOT_FOUND', message: string) {
    super(message)
    this.name = 'IssueAdapterError'
    this.code = code
  }
}

function delay(ms = 260) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function person(id: string | null): PersonReference | null {
  if (!id) return null
  return mockPeople.find((item) => item.id === id) ?? { id, name: id }
}

function titleFromDescription(description: string) {
  return description.split('.')[0]?.trim() || description
}

function toView(record: OperationalIssueRecord): OperationalIssue {
  const ship = mockShips.find((item) => item.id === record.shipId)
  if (!ship) throw new Error(`Không tìm thấy ship lookup ${record.shipId}.`)
  const reportedBy = person(record.reportedBy)
  if (!reportedBy) throw new Error(`Không tìm thấy reporter lookup ${record.reportedBy}.`)

  return {
    id: record.issueId,
    code: record.issueCode,
    displayTitle: titleFromDescription(record.description),
    ship: { ...ship },
    cruise: record.cruiseId
      ? { ...(mockCruises.find((item) => item.id === record.cruiseId) ?? {
          id: record.cruiseId,
          code: record.cruiseId,
          name: record.cruiseId,
          shipId: record.shipId,
        }) }
      : null,
    cabin: record.cabinId ? (mockCabins[record.cabinId] ?? record.cabinId) : null,
    type: record.issueType,
    severity: record.severity,
    status: record.status,
    description: record.description,
    reportedBy,
    reportedAt: record.reportedAt,
    assignedTo: person(record.assignedTo),
    resolution: record.resolution,
    resolvedBy: person(record.resolvedBy),
    resolvedAt: record.resolvedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function findRecord(id: string) {
  const record = records.find((candidate) => candidate.issueId === id)
  if (!record) throw new IssueAdapterError('NOT_FOUND', 'Không tìm thấy sự cố.')
  return record
}

function nextTimestamp(record: OperationalIssueRecord) {
  const latest = Math.max(
    new Date(record.reportedAt).getTime(),
    new Date(record.updatedAt).getTime(),
    record.resolvedAt ? new Date(record.resolvedAt).getTime() : 0,
  )
  return new Date(Math.max(Date.now(), latest + 60_000)).toISOString()
}

function assertResolvedFields(record: OperationalIssueRecord) {
  if (!record.resolution?.trim() || !record.resolvedBy || !record.resolvedAt) {
    throw new Error('Resolution, resolved_by và resolved_at phải đầy đủ trước khi đóng.')
  }
}

export const mockOperationalIssues = {
  mode: 'mock' as const,
  handlers: mockHandlers,
  ships: mockShips,
  cruises: mockCruises,

  async list(query: IssueQuery): Promise<IssueListResult> {
    await delay()
    const term = query.search.toLocaleLowerCase('vi')
    const views = records.map(toView)
    const filtered = views.filter((issue) => {
      const searchable = [
        issue.code, issue.displayTitle, issue.description, issue.ship.name,
        issue.cruise?.code ?? '', issue.cruise?.name ?? '',
      ].join(' ').toLocaleLowerCase('vi')
      return (
        (!term || searchable.includes(term)) &&
        (!query.severity || issue.severity === query.severity) &&
        (!query.status || issue.status === query.status) &&
        (!query.shipId || issue.ship.id === query.shipId) &&
        (!query.cruiseId || issue.cruise?.id === query.cruiseId) &&
        (!query.handlerId || issue.assignedTo?.id === query.handlerId)
      )
    })
    const start = (query.page - 1) * query.pageSize
    const statusTotals: IssueStatusTotals = {
      OPEN: filtered.filter((issue) => issue.status === 'OPEN').length,
      IN_PROGRESS: filtered.filter((issue) => issue.status === 'IN_PROGRESS').length,
      RESOLVED: filtered.filter((issue) => issue.status === 'RESOLVED').length,
      CLOSED: filtered.filter((issue) => issue.status === 'CLOSED').length,
      review: filtered.filter((issue) => issue.severity === 'CRITICAL').length,
    }
    return {
      items: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
      statusTotals,
    }
  },

  async detail(id: string) {
    await delay(180)
    if (id === 'forbidden') {
      throw new IssueAdapterError('FORBIDDEN', 'Không đủ quyền xem sự cố này.')
    }
    return toView(findRecord(id))
  },

  async assign(id: string, handlerId: string) {
    await delay()
    const record = findRecord(id)
    if (record.status !== 'OPEN') throw new Error('Chỉ phân công issue OPEN trong mock này.')
    if (!mockHandlers.some((candidate) => candidate.id === handlerId)) {
      throw new Error('Người xử lý không hợp lệ.')
    }
    record.assignedTo = handlerId
    record.updatedAt = nextTimestamp(record)
    return toView(record)
  },

  async start(id: string) {
    await delay()
    const record = findRecord(id)
    if (record.status !== 'OPEN') throw new Error('Issue không còn ở trạng thái OPEN.')
    if (!record.assignedTo) throw new Error('Cần assigned_to trước khi bắt đầu xử lý.')
    record.status = 'IN_PROGRESS'
    record.updatedAt = nextTimestamp(record)
    return toView(record)
  },

  async recordResolution(id: string, resolution: string) {
    await delay()
    const record = findRecord(id)
    if (record.status !== 'IN_PROGRESS') throw new Error('Chỉ issue IN_PROGRESS mới được resolve.')
    const normalized = resolution.trim()
    if (!normalized) throw new Error('Resolution không được để trống.')
    const timestamp = nextTimestamp(record)
    record.resolution = normalized
    record.resolvedBy = currentActorId
    record.resolvedAt = timestamp
    record.status = 'RESOLVED'
    record.updatedAt = timestamp
    return toView(record)
  },

  async verifyResolution(id: string) {
    await delay(220)
    const record = findRecord(id)
    if (record.status !== 'RESOLVED') throw new Error('Chỉ issue RESOLVED mới có thể xác minh.')
    assertResolvedFields(record)
    return { verified: true as const }
  },

  async close(id: string) {
    await delay()
    const record = findRecord(id)
    if (record.status !== 'RESOLVED') throw new Error('Chỉ issue RESOLVED mới có thể đóng.')
    assertResolvedFields(record)
    record.status = 'CLOSED'
    record.updatedAt = nextTimestamp(record)
    return toView(record)
  },

  async reopen(id: string) {
    await delay()
    const record = findRecord(id)
    if (record.status !== 'RESOLVED') throw new Error('Chỉ issue RESOLVED mới có thể mở lại.')
    record.status = 'IN_PROGRESS'
    record.updatedAt = nextTimestamp(record)
    return toView(record)
  },
}
