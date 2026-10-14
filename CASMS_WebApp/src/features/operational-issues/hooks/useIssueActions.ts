import { useState } from 'react'

import { operationalIssuesAdapter } from '../api/operational-issues-adapter'
import type { IssueAction } from '../model/issue-actions'
import type { IssueDataSource } from '../model/issue-adapter'

export type ActionFeedback = {
  tone: 'success' | 'warning' | 'error'
  message: string
} | null

export function useIssueActions(
  issueId: string,
  source: IssueDataSource,
  onChanged: () => void,
) {
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
        () => operationalIssuesAdapter.assign(issueId, handlerId, source),
        source === 'backend' ? 'Đã cập nhật người xử lý trên backend.' : 'Đã cập nhật người xử lý trong dữ liệu demo.',
      ),
    start: () =>
      run(
        'START_HANDLING',
        () => operationalIssuesAdapter.start(issueId, source),
        source === 'backend' ? 'Backend đã chuyển issue sang IN_PROGRESS.' : 'Đã chuyển dữ liệu demo sang IN_PROGRESS.',
      ),
    recordResolution: (resolution: string) =>
      run(
        'RECORD_RESOLUTION',
        () => operationalIssuesAdapter.recordResolution(issueId, resolution, source),
        'Đã ghi resolution; issue vẫn ở IN_PROGRESS cho đến khi được xác minh.',
      ),
    verifyResolution: () =>
      run(
        'VERIFY_RESOLUTION',
        () => operationalIssuesAdapter.verifyResolution(issueId, source),
        'Đã xác minh resolution và chuyển issue sang RESOLVED.',
      ),
    close: () =>
      run('CLOSE', () => operationalIssuesAdapter.close(issueId, source), 'Đã chuyển issue sang CLOSED.'),
    reopen: () =>
      run(
        'REOPEN',
        () => operationalIssuesAdapter.reopen(issueId, source),
        'Đã mở lại issue ở trạng thái OPEN và xóa resolution/verification cũ.',
      ),
  }
}
