import type { IssueSeverity, IssueStatus } from '../model/issue'
import { issueSeverityLabels, issueStatusLabels } from '../model/issue'
import styles from './OperationalIssues.module.css'

const statusClasses: Record<IssueStatus, string> = {
  OPEN: styles.statusOpen,
  IN_PROGRESS: styles.statusProgress,
  RESOLVED: styles.statusResolved,
  CLOSED: styles.statusClosed,
}

const severityClasses: Record<IssueSeverity, string> = {
  LOW: styles.severityLow,
  MEDIUM: styles.severityMedium,
  HIGH: styles.severityHigh,
  CRITICAL: styles.severityCritical,
}

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span className={`${styles.statusBadge} ${styles.tableBadge} ${statusClasses[status]}`}>
      {issueStatusLabels[status]}
    </span>
  )
}

export function IssueSeverityBadge({ severity }: { severity: IssueSeverity }) {
  return (
    <span className={`${styles.statusBadge} ${styles.tableBadge} ${severityClasses[severity]}`}>
      {issueSeverityLabels[severity]}
    </span>
  )
}
