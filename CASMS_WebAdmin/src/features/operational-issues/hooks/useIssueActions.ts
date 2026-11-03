import { useRef, useState } from 'react'
import { useSessionAccess } from '@/shared/auth'

import { operationalIssuesApi } from '../api/operational-issues-api'
import type { IssueAction } from '../model/issue-actions'
import { issueActionPermissions } from '../model/issue-actions'

export type ActionFeedback = {
  tone: 'success' | 'warning' | 'error'
  message: string
} | null

export function useIssueActions(issueId: string, onChanged: () => void) {
  const access = useSessionAccess()
  const [pendingAction, setPendingAction] = useState<IssueAction | null>(null)
  const [feedback, setFeedback] = useState<ActionFeedback>(null)
  const lock = useRef(false)

  async function run(action: IssueAction, operation: () => Promise<unknown>, success: string) {
    if (lock.current || !access.canDo(issueActionPermissions[action])) return false
    lock.current = true
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
      lock.current = false
      setPendingAction(null)
    }
  }

  return {
    pendingAction,
    feedback,
    clearFeedback: () => setFeedback(null),
    assign: (handlerId: string) =>
      run(
        'ASSIGN_HANDLER',
        () => operationalIssuesApi.assign(issueId, handlerId),
        'Đã phân công người xử lý.',
      ),
    start: () =>
      run(
        'START_HANDLING',
        () => operationalIssuesApi.start(issueId),
        'Đã bắt đầu xử lý sự cố.',
      ),
    recordResolution: (resolution: string) =>
      run(
        'RECORD_RESOLUTION',
        () => operationalIssuesApi.recordResolution(issueId, resolution),
        'Đã ghi nhận phương án xử lý; cần xác minh trước khi đóng sự cố.',
      ),
    verifyResolution: () =>
      run(
        'VERIFY_RESOLUTION',
        () => operationalIssuesApi.verify(issueId),
        'Đã xác minh phương án và xác nhận sự cố đã được xử lý.',
      ),
    close: () =>
      run('CLOSE', () => operationalIssuesApi.close(issueId), 'Đã đóng sự cố.'),
    reopen: () =>
      run(
        'REOPEN',
        () => operationalIssuesApi.reopen(issueId),
        'Đã mở lại sự cố. Kết quả xử lý và xác minh trước đó đã được xóa.',
      ),
  }
}
