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
    clearFeedback: () => setFeedback(null),
    assign: (handlerId: string, note: string) =>
      run(
        'ASSIGN_HANDLER',
        () => mockOperationalIssues.assign(issueId, handlerId, note),
        'Đã cập nhật assignee trong mock adapter.',
      ),
    start: () =>
      run(
        'START_HANDLING',
        () => mockOperationalIssues.start(issueId),
        'Đã chuyển sang IN_PROGRESS trong mock adapter.',
      ),
    blockUnconfirmed: (
      action: 'RECORD_RESOLUTION' | 'VERIFY_RESOLUTION' | 'CLOSE' | 'REOPEN',
    ) => {
      const messages = {
        RECORD_RESOLUTION:
          'Chưa gửi: field bắt buộc và status sau Record Resolution chưa được backend hoặc product xác nhận.',
        VERIFY_RESOLUTION:
          'Chưa gửi: transition/payload Verify Resolution chưa được backend hoặc product xác nhận.',
        CLOSE: 'Chưa gửi: Close criteria và bằng chứng verification chưa được xác nhận.',
        REOPEN:
          'Chưa gửi: trạng thái nguồn/đích, reason, permission và cách giữ resolution của Reopen chưa được xác nhận.',
      } satisfies Record<
        'RECORD_RESOLUTION' | 'VERIFY_RESOLUTION' | 'CLOSE' | 'REOPEN',
        string
      >
      setFeedback({
        tone: 'warning',
        message: messages[action],
      })
      return Promise.resolve(false)
    },
  }
}
