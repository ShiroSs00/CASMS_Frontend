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

const hidden: IssueActionAvailability = { visible: false, enabled: false }

export function getIssueActionAvailability(
  issue: OperationalIssue,
): Record<IssueAction, IssueActionAvailability> {
  if (issue.status === 'CLOSED') {
    return Object.fromEntries(ISSUE_ACTIONS.map((action) => [action, hidden])) as Record<
      IssueAction,
      IssueActionAvailability
    >
  }

  return {
    ASSIGN_HANDLER: {
      visible: issue.status === 'OPEN',
      enabled: issue.status === 'OPEN',
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
      visible: issue.status === 'RESOLVED',
      enabled: issue.status === 'RESOLVED',
      reason: 'Action contract chưa xác nhận transition/payload.',
    },
    CLOSE: {
      visible: issue.status === 'RESOLVED',
      enabled: issue.status === 'RESOLVED',
      reason: 'Close criteria và bằng chứng verification chưa được backend xác nhận.',
    },
    REOPEN: {
      visible: issue.status === 'RESOLVED',
      enabled: issue.status === 'RESOLVED',
    },
  }
}
