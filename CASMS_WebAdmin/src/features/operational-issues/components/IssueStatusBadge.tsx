import { Badge } from '@/shared/ui'
import type { IssueSeverity, IssueStatus } from '../model/issue'
import { issueSeverityLabels, issueStatusLabels } from '../model/issue'

const statusTones = { OPEN: 'error', IN_PROGRESS: 'info', RESOLVED: 'success', CLOSED: 'success' } as const
const severityTones = { LOW: 'success', MEDIUM: 'warning', HIGH: 'warning', CRITICAL: 'error' } as const

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return <Badge label={issueStatusLabels[status]} tone={statusTones[status]} />
}
export function IssueSeverityBadge({ severity }: { severity: IssueSeverity }) {
  return <Badge label={issueSeverityLabels[severity]} tone={severityTones[severity]} />
}
