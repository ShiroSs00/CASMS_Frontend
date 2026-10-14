import type { IssueQuery } from './issue-query'
import type {
  CruiseReference,
  IssueStatus,
  OperationalIssue,
  PersonReference,
  ShipReference,
} from './issue'

export type IssueDataSource = 'backend' | 'demo-fallback'

export type IssueStatusTotals = Record<IssueStatus, number> & { review: number }

export type IssueListResult = {
  items: OperationalIssue[]
  total: number
  page: number
  pageSize: number
  statusTotals: IssueStatusTotals
  handlers: PersonReference[]
  ships: ShipReference[]
  cruises: CruiseReference[]
  source: IssueDataSource
  sourceNotice?: string
}

export type IssueDetailResult = {
  issue: OperationalIssue
  handlers: PersonReference[]
  source: IssueDataSource
  sourceNotice?: string
}

export class IssueAdapterError extends Error {
  readonly code: 'FORBIDDEN' | 'NOT_FOUND'

  constructor(code: 'FORBIDDEN' | 'NOT_FOUND', message: string) {
    super(message)
    this.name = 'IssueAdapterError'
    this.code = code
  }
}

export type OperationalIssuesAdapter = {
  list(query: IssueQuery): Promise<IssueListResult>
  detail(id: string): Promise<IssueDetailResult>
  assign(id: string, handlerId: string, source: IssueDataSource): Promise<unknown>
  start(id: string, source: IssueDataSource): Promise<unknown>
  recordResolution(id: string, resolution: string, source: IssueDataSource): Promise<unknown>
  verifyResolution(id: string, source: IssueDataSource): Promise<unknown>
  close(id: string, source: IssueDataSource): Promise<unknown>
  reopen(id: string, source: IssueDataSource): Promise<unknown>
}
