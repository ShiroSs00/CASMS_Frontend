import { apiRequest } from '@/shared/api'

import type { IssueQuery } from '../model/issue-query'
import type { IssueStatus, OperationalIssue, PersonReference } from '../model/issue'
import type { CreateOperationalIssueRequest, OperationalIssueDto, UpdateOperationalIssueRequest } from './dto'

export type IssueStatusTotals = Record<IssueStatus, number> & { critical: number }
export type IssueListResult = {
  items: OperationalIssue[]
  total: number
  statusTotals: IssueStatusTotals
}

const person = (id: string | null | undefined, name?: string | null): PersonReference | null =>
  id ? { id, name: name?.trim() || id } : null

function toIssue(dto: OperationalIssueDto): OperationalIssue {
  const reporterId = dto.reportedById ?? dto.reportedBy ?? dto.reporterId ?? 'unknown'
  const assignedId = dto.assignedToId ?? dto.assignedTo ?? null
  const resolvedId = dto.resolvedById ?? dto.resolvedBy ?? null
  const verifiedId = dto.verifiedById ?? dto.verifiedBy ?? null
  return {
    id: dto.issueId,
    code: dto.issueCode,
    displayTitle: dto.description.split('.')[0]?.trim() || dto.description,
    ship: { id: dto.shipId, name: dto.shipName?.trim() || dto.shipId },
    cruise: dto.cruiseId
      ? {
          id: dto.cruiseId,
          code: dto.cruiseCode?.trim() || dto.cruiseId,
          name: dto.cruiseName?.trim() || dto.cruiseCode?.trim() || dto.cruiseId,
          shipId: dto.shipId,
        }
      : null,
    cabin: dto.cabinNumber ?? dto.cabinId ?? null,
    type: dto.issueType,
    severity: dto.severity,
    status: dto.status,
    description: dto.description,
    reportedBy: person(reporterId, dto.reporterName) ?? { id: reporterId, name: reporterId },
    reportedAt: dto.reportedAt,
    assignedTo: person(assignedId, dto.assignedToName),
    resolution: dto.resolution ?? null,
    resolvedBy: person(resolvedId, dto.resolvedByName),
    resolvedAt: dto.resolvedAt ?? null,
    verifiedBy: person(verifiedId, dto.verifiedByName),
    verifiedAt: dto.verifiedAt ?? null,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

let revision = 0
const listeners = new Set<() => void>()
const notify = () => { revision += 1; listeners.forEach((listener) => listener()) }
const path = (id: string) => `/operational-issues/${encodeURIComponent(id)}`

export const operationalIssuesApi = {
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) },
  getRevision: () => revision,
  async list(query: IssueQuery, signal?: AbortSignal): Promise<IssueListResult> {
    const rows = await apiRequest<OperationalIssueDto[]>('/operational-issues', {
      query: {
        status: query.status || undefined,
        shipId: query.shipId || undefined,
        cruiseId: query.cruiseId || undefined,
      },
      signal,
    })
    const items = rows.map(toIssue)
    return {
      items,
      total: items.length,
      statusTotals: {
        OPEN: items.filter((item) => item.status === 'OPEN').length,
        IN_PROGRESS: items.filter((item) => item.status === 'IN_PROGRESS').length,
        RESOLVED: items.filter((item) => item.status === 'RESOLVED').length,
        CLOSED: items.filter((item) => item.status === 'CLOSED').length,
        critical: items.filter((item) => item.severity === 'CRITICAL').length,
      },
    }
  },
  async detail(id: string, signal?: AbortSignal) {
    return toIssue(await apiRequest<OperationalIssueDto>(path(id), { signal }))
  },
  async create(body: CreateOperationalIssueRequest) {
    const result = toIssue(await apiRequest<OperationalIssueDto>('/operational-issues', { method: 'POST', body }))
    notify(); return result
  },
  async update(id: string, body: UpdateOperationalIssueRequest) {
    const result = toIssue(await apiRequest<OperationalIssueDto>(path(id), { method: 'PUT', body }))
    notify(); return result
  },
  async assign(id: string, assignedToId: string) {
    const result = toIssue(await apiRequest<OperationalIssueDto>(`${path(id)}/assign`, { method: 'PATCH', body: { assignedToId } }))
    notify(); return result
  },
  async start(id: string) {
    const result = toIssue(await apiRequest<OperationalIssueDto>(`${path(id)}/start`, { method: 'PATCH' }))
    notify(); return result
  },
  async recordResolution(id: string, resolution: string) {
    const result = toIssue(await apiRequest<OperationalIssueDto>(`${path(id)}/resolution`, { method: 'POST', body: { resolution } }))
    notify(); return result
  },
  async verify(id: string) {
    const result = toIssue(await apiRequest<OperationalIssueDto>(`${path(id)}/verify`, { method: 'PATCH' }))
    notify(); return result
  },
  async close(id: string) {
    const result = toIssue(await apiRequest<OperationalIssueDto>(`${path(id)}/close`, { method: 'PATCH' }))
    notify(); return result
  },
  async reopen(id: string) {
    const result = toIssue(await apiRequest<OperationalIssueDto>(`${path(id)}/reopen`, { method: 'PATCH' }))
    notify(); return result
  },
  async validate(id: string) {
    await apiRequest<void>(`${path(id)}/validate`, { method: 'POST' })
  },
}
