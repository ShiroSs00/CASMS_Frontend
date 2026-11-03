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

/** SQL-shaped boundary matching FOREP.sql OperationalIssue. */
export type OperationalIssueRecord = {
  issueId: string
  issueCode: string
  cruiseId: string | null
  shipId: string
  cabinId: string | null
  issueType: IssueType
  severity: IssueSeverity
  description: string
  reportedAt: string
  resolvedAt: string | null
  status: IssueStatus
  reportedBy: string
  resolvedBy: string | null
  resolution: string | null
  assignedTo: string | null
  createdAt: string
  updatedAt: string
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
  reportedBy: PersonReference
  reportedAt: string
  assignedTo: PersonReference | null
  resolution: string | null
  resolvedBy: PersonReference | null
  resolvedAt: string | null
  verifiedBy?: PersonReference | null
  verifiedAt?: string | null
  createdAt: string
  updatedAt: string
}

export const issueStatusLabels: Record<IssueStatus, string> = {
  OPEN: 'Chờ xử lý',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã xác minh xử lý',
  CLOSED: 'Đã đóng',
}

export const issueSeverityLabels: Record<IssueSeverity, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  CRITICAL: 'Nghiêm trọng',
}
