import { useState } from 'react'

import { mockOperationalIssues } from '../mocks/mock-operational-issues'
import type { IssueAction } from '../model/issue-actions'

export type ActionFeedback = {
  tone: 'success' | 'warning' | 'error'
  message: string
} | null

export function useIssueActions(issueId: string, onChanged: () => void) {
  const [pendingAction, setPendingAction] = useState<IssueAction | null>(null)
  const [feedback, setFeedback] = useState<ActionFeedback>(null)

  async function run(action: IssueAction, operation: () => Promise<unknown>, success: string) {
    if (pendingAction) return false
    setPendingAction(action)
    setFeedback(null)
    try {
      await operation()
      setFeedback({ tone: 'success', message: success })
      onChanged()
      return true
    } catch (error: unknown) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Không thể thực hiện thao tác.',
      })
      return false
    } finally {
      setPendingAction(null)
    }
  }

  return {
    pendingAction,
    feedback,
    assign: (handlerId: string) =>
      run(
        'ASSIGN_HANDLER',
        () => mockOperationalIssues.assign(issueId, handlerId),
        'Đã cập nhật assigned_to trong mock adapter.',
      ),
    start: () =>
      run(
        'START_HANDLING',
        () => mockOperationalIssues.start(issueId),
        'Đã chuyển sang IN_PROGRESS trong mock adapter.',
      ),
    recordResolution: (resolution: string) =>
      run(
        'RECORD_RESOLUTION',
        () => mockOperationalIssues.recordResolution(issueId, resolution),
        'Đã ghi resolution và chuyển sang RESOLVED.',
      ),
    verifyResolution: () =>
      run(
        'VERIFY_RESOLUTION',
        () => mockOperationalIssues.verifyResolution(issueId),
        'Đã kiểm tra đủ resolution, resolved_by và resolved_at. Kết quả không persisted.',
      ),
    close: () =>
      run('CLOSE', () => mockOperationalIssues.close(issueId), 'Đã chuyển current status sang CLOSED.'),
    reopen: () =>
      run(
        'REOPEN',
        () => mockOperationalIssues.reopen(issueId),
        'Đã chuyển current status sang IN_PROGRESS.',
      ),
  }
}
