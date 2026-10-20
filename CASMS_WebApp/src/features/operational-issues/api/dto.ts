import type { IssueSeverity, IssueStatus, IssueType } from '../model/issue'

export type OperationalIssueDto = {
  issueId: string
  issueCode: string
  cruiseId?: string | null
  cruiseCode?: string | null
  cruiseName?: string | null
  shipId: string
  shipName?: string | null
  cabinId?: string | null
  cabinNumber?: string | null
  issueType: IssueType
  severity: IssueSeverity
  description: string
  status: IssueStatus
  reportedBy?: string | null
  reportedById?: string | null
  resolvedById?: string | null
  verifiedById?: string | null
  reporterId?: string | null
  reporterName?: string | null
  reportedAt: string
  assignedTo?: string | null
  assignedToId?: string | null
  assignedToName?: string | null
  resolution?: string | null
  resolvedBy?: string | null
  resolvedByName?: string | null
  resolvedAt?: string | null
  verifiedBy?: string | null
  verifiedByName?: string | null
  verifiedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type CreateOperationalIssueRequest = {
  issueCode: string
  shipId: string
  cruiseId?: string | null
  cabinId?: string | null
  issueType: IssueType
  severity: IssueSeverity
  description: string
}

export type UpdateOperationalIssueRequest = {
  severity: IssueSeverity
  description: string
}
