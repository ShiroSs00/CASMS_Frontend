import type { IssueQuery } from '../model/issue-query'
import type { OperationalIssue, PersonReference } from '../model/issue'
import { initialIssues, mockCruises, mockHandlers, mockShips } from './fixtures'

export type IssueListResult = {
  items: OperationalIssue[]
  total: number
  page: number
  pageSize: number
}

const actor: PersonReference = { id: 'ops-user', name: 'Nhân viên vận hành' }
const issues = initialIssues.map(cloneIssue)

export class IssueAdapterError extends Error {
  readonly code: 'FORBIDDEN' | 'NOT_FOUND'

  constructor(code: 'FORBIDDEN' | 'NOT_FOUND', message: string) {
    super(message)
    this.name = 'IssueAdapterError'
    this.code = code
  }
}

function cloneIssue(issue: OperationalIssue): OperationalIssue {
  return {
    ...issue,
    ship: { ...issue.ship },
    cruise: issue.cruise ? { ...issue.cruise } : null,
    assignedTo: issue.assignedTo ? { ...issue.assignedTo } : null,
    resolution: issue.resolution
      ? { ...issue.resolution, resolvedBy: { ...issue.resolution.resolvedBy } }
      : null,
    impactSummary: [...issue.impactSummary],
    events: issue.events.map((event) => ({ ...event, actor: { ...event.actor } })),
  }
}

function delay(ms = 260) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function findIssue(id: string) {
  const issue = issues.find((candidate) => candidate.id === id)
  if (!issue) throw new IssueAdapterError('NOT_FOUND', 'Không tìm thấy sự cố.')
  return issue
}

function nextMockTimestamp(issue: OperationalIssue) {
  const eventTimes = issue.events.map((event) => new Date(event.occurredAt).getTime())
  const latestKnownTime = Math.max(new Date(issue.reportedAt).getTime(), ...eventTimes)
  return new Date(Math.max(Date.now(), latestKnownTime + 60_000)).toISOString()
}

function addEvent(
  issue: OperationalIssue,
  event: Omit<OperationalIssue['events'][number], 'id' | 'actor' | 'occurredAt'>,
) {
  const createdEvent: OperationalIssue['events'][number] = {
    ...event,
    id: `evt-${issue.id}-${Date.now()}`,
    actor,
    occurredAt: nextMockTimestamp(issue),
  }
  issue.events.push(createdEvent)
  return createdEvent
}

export const mockOperationalIssues = {
  mode: 'mock' as const,
  handlers: mockHandlers,
  ships: mockShips,
  cruises: mockCruises,

  async list(query: IssueQuery): Promise<IssueListResult> {
    await delay()
    const term = query.search.toLocaleLowerCase('vi')
    const filtered = issues.filter((issue) => {
      const searchable = [
        issue.code,
        issue.displayTitle,
        issue.description,
        issue.ship.name,
        issue.cruise?.code ?? '',
        issue.cruise?.name ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('vi')

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
    return {
      items: filtered.slice(start, start + query.pageSize).map(cloneIssue),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
    }
  },

  async detail(id: string) {
    await delay(180)
    if (id === 'forbidden') {
      throw new IssueAdapterError('FORBIDDEN', 'Không đủ quyền xem sự cố này.')
    }
    return cloneIssue(findIssue(id))
  },

  async assign(id: string, handlerId: string, note: string) {
    await delay()
    const issue = findIssue(id)
    if (issue.status !== 'OPEN') throw new Error('Chỉ phân công issue OPEN trong mock này.')
    const handler = mockHandlers.find((candidate) => candidate.id === handlerId)
    if (!handler) throw new Error('Người xử lý không hợp lệ.')
    issue.assignedTo = handler
    addEvent(issue, {
      kind: 'ASSIGNED',
      description: note.trim() || `Phân công cho ${handler.name}.`,
    })
    return cloneIssue(issue)
  },

  async start(id: string) {
    await delay()
    const issue = findIssue(id)
    if (issue.status !== 'OPEN') throw new Error('Issue không còn ở trạng thái OPEN.')
    if (!issue.assignedTo) throw new Error('BR-OI-08: cần assigned_to trước khi bắt đầu.')
    issue.status = 'IN_PROGRESS'
    addEvent(issue, {
      kind: 'STARTED',
      description: `${issue.assignedTo.name} bắt đầu xử lý.`,
      fromStatus: 'OPEN',
      toStatus: 'IN_PROGRESS',
    })
    return cloneIssue(issue)
  },

}
