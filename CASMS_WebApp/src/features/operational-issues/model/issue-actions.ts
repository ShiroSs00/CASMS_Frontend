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
  const hasResolution = Boolean(issue.resolution && issue.resolvedBy && issue.resolvedAt)
  const hasVerification = Boolean(issue.verifiedBy && issue.verifiedAt)

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
      visible: issue.status === 'IN_PROGRESS' && hasResolution,
      enabled: issue.status === 'IN_PROGRESS' && hasResolution,
      reason:
        issue.status === 'IN_PROGRESS' && !hasResolution
          ? 'Cần ghi nhận resolution trước khi xác minh.'
          : undefined,
    },
    CLOSE: {
      visible: issue.status === 'RESOLVED',
      enabled: issue.status === 'RESOLVED' && hasResolution && hasVerification,
      reason:
        issue.status === 'RESOLVED' && !(hasResolution && hasVerification)
          ? 'Cần đủ resolution và thông tin xác minh trước khi đóng.'
          : undefined,
    },
    REOPEN: {
      visible: issue.status === 'RESOLVED' || issue.status === 'CLOSED',
      enabled: issue.status === 'RESOLVED' || issue.status === 'CLOSED',
    },
  }
}
