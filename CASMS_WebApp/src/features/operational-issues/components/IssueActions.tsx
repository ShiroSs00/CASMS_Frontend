import { useState } from 'react'

import { useIssueActions } from '../hooks/useIssueActions'
import { mockHandlers } from '../mocks/fixtures'
import type { IssueAction } from '../model/issue-actions'
import { getIssueActionAvailability } from '../model/issue-actions'
import type { OperationalIssue } from '../model/issue'
import { AssignHandlerForm } from './actions/AssignHandlerForm'
import { CloseIssueAction } from './actions/CloseIssueAction'
import { RecordResolutionForm } from './actions/RecordResolutionForm'
import { ReopenIssueForm } from './actions/ReopenIssueForm'
import { StartHandlingAction } from './actions/StartHandlingAction'
import { VerifyResolutionForm } from './actions/VerifyResolutionForm'
import styles from './OperationalIssues.module.css'

const labels: Record<IssueAction, string> = {
  ASSIGN_HANDLER: 'Phân công người xử lý',
  START_HANDLING: 'Bắt đầu xử lý',
  RECORD_RESOLUTION: 'Ghi nhận resolution',
  VERIFY_RESOLUTION: 'Xác minh resolution',
  CLOSE: 'Đóng sự cố',
  REOPEN: 'Mở lại sự cố',
}

type Props = {
  issue: OperationalIssue
  onChanged: () => void
}

export function IssueActions({ issue, onChanged }: Props) {
  const [activeAction, setActiveAction] = useState<IssueAction | null>(null)
  const actions = useIssueActions(issue.id, onChanged)
  const availability = getIssueActionAvailability(issue)
  const availableActions = (Object.keys(availability) as IssueAction[]).filter(
    (action) => availability[action].visible,
  )

  return (
    <section className={styles.panel}>
      <h2>Thao tác</h2>
      {issue.status === 'CLOSED' ? (
        <div className={styles.infoBanner}>CLOSED là read-only trong normal operations.</div>
      ) : availableActions.length ? (
        <div className={styles.actionStack}>
          {availableActions.map((action, index) => (
            <div key={action}>
              <button
                className={index === 0 ? styles.primaryButton : styles.secondaryButton}
                disabled={!availability[action].enabled || actions.pendingAction !== null}
                onClick={() => setActiveAction(action)}
                title={availability[action].reason}
                type="button"
              >
                {labels[action]}
              </button>
              {!availability[action].enabled && availability[action].reason ? (
                <p className={styles.actionHint}>{availability[action].reason}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p>Không có action phù hợp state hiện tại.</p>
      )}

      {actions.feedback ? (
        <div
          className={
            actions.feedback.tone === 'success'
              ? styles.successBanner
              : actions.feedback.tone === 'warning'
                ? styles.warningBanner
                : styles.errorBanner
          }
          role="status"
        >
          {actions.feedback.message}
        </div>
      ) : null}

      <AssignHandlerForm
        handlers={mockHandlers}
        open={activeAction === 'ASSIGN_HANDLER'}
        pending={actions.pendingAction === 'ASSIGN_HANDLER'}
        onClose={() => setActiveAction(null)}
        onSubmit={actions.assign}
      />
      <StartHandlingAction
        assigneeName={issue.assignedTo?.name ?? null}
        open={activeAction === 'START_HANDLING'}
        pending={actions.pendingAction === 'START_HANDLING'}
        onClose={() => setActiveAction(null)}
        onSubmit={actions.start}
      />
      <RecordResolutionForm
        open={activeAction === 'RECORD_RESOLUTION'}
        pending={actions.pendingAction === 'RECORD_RESOLUTION'}
        onClose={() => setActiveAction(null)}
        onSubmit={actions.recordResolution}
      />
      <VerifyResolutionForm
        open={activeAction === 'VERIFY_RESOLUTION'}
        pending={actions.pendingAction === 'VERIFY_RESOLUTION'}
        onClose={() => setActiveAction(null)}
        onSubmit={actions.verifyResolution}
      />
      <CloseIssueAction
        open={activeAction === 'CLOSE'}
        pending={actions.pendingAction === 'CLOSE'}
        onClose={() => setActiveAction(null)}
        onSubmit={actions.close}
      />
      <ReopenIssueForm
        open={activeAction === 'REOPEN'}
        pending={actions.pendingAction === 'REOPEN'}
        onClose={() => setActiveAction(null)}
        onSubmit={actions.reopen}
      />
    </section>
  )
}
