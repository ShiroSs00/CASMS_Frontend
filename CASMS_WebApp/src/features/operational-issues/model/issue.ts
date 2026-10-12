export const ISSUE_TYPES = ['WEATHER', 'TECHNICAL', 'CABIN', 'SAFETY', 'OPERATIONAL'] as const
export const ISSUE_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export const ISSUE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const

export type IssueType = (typeof ISSUE_TYPES)[number]
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number]
export type IssueStatus = (typeof ISSUE_STATUSES)[number]

export type PersonReference = {
  id: string
  name: string
}

export type ShipReference = {
  id: string
  name: string
}

export type CruiseReference = {
  id: string
  code: string
  name: string
  shipId: string
}

export type IssueResolution = {
  summary: string
  rootCauseStatus: string
  residualImpact: string
  evidenceReference: string
  resolvedBy: PersonReference
  resolvedAt: string
}

export type IssueEventKind =
  | 'CREATED'
  | 'ASSIGNED'
  | 'STARTED'
  | 'RESOLVED'
  | 'REOPENED'
  | 'CLOSED'

export type IssueEvent = {
  id: string
  kind: IssueEventKind
  actor: PersonReference
  occurredAt: string
  description: string
  fromStatus?: IssueStatus
  toStatus?: IssueStatus
}

export type OperationalIssue = {
  id: string
  code: string
  displayTitle: string
  ship: ShipReference
  cruise: CruiseReference | null
  cabin: string | null
  type: IssueType
  severity: IssueSeverity
  status: IssueStatus
  description: string
  impactSummary: string[]
  linkedRequestCount: number
  reportedBy: PersonReference
  reportedAt: string
  assignedTo: PersonReference | null
  resolution: IssueResolution | null
  reopenCount: number
  events: IssueEvent[]
}

export const issueStatusLabels: Record<IssueStatus, string> = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
}

export const issueSeverityLabels: Record<IssueSeverity, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  CRITICAL: 'Nghiêm trọng',
}

export const issueEventLabels: Record<IssueEventKind, string> = {
  CREATED: 'Tạo sự cố',
  ASSIGNED: 'Phân công xử lý',
  STARTED: 'Bắt đầu xử lý',
  RESOLVED: 'Ghi nhận giải quyết',
  REOPENED: 'Mở lại sự cố',
  CLOSED: 'Đóng sự cố',
}
