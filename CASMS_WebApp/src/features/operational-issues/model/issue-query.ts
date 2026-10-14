import { sanitizePageSize } from '../../../shared/pagination.ts'
import { ISSUE_SEVERITIES, ISSUE_STATUSES } from './issue.ts'
import type { IssueSeverity, IssueStatus } from './issue'

export type IssueQuery = {
  search: string
  severity: IssueSeverity | ''
  status: IssueStatus | ''
  shipId: string
  cruiseId: string
  handlerId: string
  page: number
  pageSize: number
}

export const DEFAULT_ISSUE_QUERY: IssueQuery = {
  search: '',
  severity: '',
  status: '',
  shipId: '',
  cruiseId: '',
  handlerId: '',
  page: 1,
  pageSize: 4,
}

export const ISSUE_PAGE_SIZE_OPTIONS = [4, 10, 20, 50] as const

function isOneOf<T extends string>(value: string | null, values: readonly T[]): value is T {
  return value !== null && values.includes(value as T)
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function parseIssueQuery(params: URLSearchParams): IssueQuery {
  const severity = params.get('severity')
  const status = params.get('status')

  return {
    search: params.get('q')?.trim() ?? '',
    severity: isOneOf(severity, ISSUE_SEVERITIES) ? severity : '',
    status: isOneOf(status, ISSUE_STATUSES) ? status : '',
    shipId: params.get('ship') ?? '',
    cruiseId: params.get('cruise') ?? '',
    handlerId: params.get('handler') ?? '',
    page: positiveInteger(params.get('page'), DEFAULT_ISSUE_QUERY.page),
    pageSize: sanitizePageSize(
      Number(params.get('pageSize')),
      ISSUE_PAGE_SIZE_OPTIONS,
      DEFAULT_ISSUE_QUERY.pageSize,
    ),
  }
}

export function serializeIssueQuery(query: IssueQuery) {
  const params = new URLSearchParams()
  if (query.search) params.set('q', query.search)
  if (query.severity) params.set('severity', query.severity)
  if (query.status) params.set('status', query.status)
  if (query.shipId) params.set('ship', query.shipId)
  if (query.cruiseId) params.set('cruise', query.cruiseId)
  if (query.handlerId) params.set('handler', query.handlerId)
  if (query.page > 1) params.set('page', String(query.page))
  if (query.pageSize !== DEFAULT_ISSUE_QUERY.pageSize) {
    params.set('pageSize', String(query.pageSize))
  }
  return params
}

export function hasActiveIssueFilters(query: IssueQuery) {
  return Boolean(
    query.search ||
      query.severity ||
      query.status ||
      query.shipId ||
      query.cruiseId ||
      query.handlerId,
  )
}
