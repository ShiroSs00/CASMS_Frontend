import type { OperationalIssue } from './issue'

export const ISSUE_ACTIONS = [
  'ASSIGN_HANDLER',
  'START_HANDLING',
  'RECORD_RESOLUTION',
  'VERIFY_RESOLUTION',
  'CLOSE',
  'REOPEN',
] as const

export type IssueAction = (typeof ISSUE_ACTIONS)[number]

export type IssueActionAvailability = {
  visible: boolean
  enabled: boolean
  reason?: string
}

export function getIssueActionAvailability(
  issue: OperationalIssue,
): Record<IssueAction, IssueActionAvailability> {
  return {
    ASSIGN_HANDLER: {
      visible: issue.status === 'OPEN' || issue.status === 'IN_PROGRESS',
      enabled: issue.status === 'OPEN' || issue.status === 'IN_PROGRESS',
    },
    START_HANDLING: {
      visible: issue.status === 'OPEN',
      enabled: issue.status === 'OPEN' && issue.assignedTo !== null,
      reason: issue.assignedTo ? undefined : 'Cần phân công người xử lý trước.',
    },
    RECORD_RESOLUTION: {
      visible: issue.status === 'IN_PROGRESS',
      enabled: issue.status === 'IN_PROGRESS',
    },
    VERIFY_RESOLUTION: {
      visible: issue.status === 'IN_PROGRESS',
      enabled: issue.status === 'IN_PROGRESS' && Boolean(issue.resolution?.trim()),
      reason: issue.status === 'IN_PROGRESS' && !issue.resolution?.trim()
        ? 'Cần ghi resolution trước khi xác minh.'
        : undefined,
    },
    CLOSE: {
      visible: issue.status === 'RESOLVED',
      enabled:
        issue.status === 'RESOLVED' &&
        Boolean(issue.resolution && issue.resolvedBy && issue.resolvedAt && issue.verifiedAt),
      reason:
        issue.status === 'RESOLVED' &&
        !(issue.resolution && issue.resolvedBy && issue.resolvedAt && issue.verifiedAt)
          ? 'Cần resolution và xác minh thành công trước khi đóng.'
          : undefined,
    },
    REOPEN: {
      visible: issue.status === 'RESOLVED' || issue.status === 'CLOSED',
      enabled: issue.status === 'RESOLVED' || issue.status === 'CLOSED',
    },
  }
}
