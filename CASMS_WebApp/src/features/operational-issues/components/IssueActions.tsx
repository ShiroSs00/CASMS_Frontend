import { useRef, useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Button, Notice } from '@/shared/ui'
import { operationalIssuesApi } from '../api/operational-issues-api'

import { useIssueActions } from '../hooks/useIssueActions'
import type { IssueAction } from '../model/issue-actions'
import { getIssueActionAvailability, issueActionPermissions } from '../model/issue-actions'
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
  RECORD_RESOLUTION: 'Ghi nhận phương án xử lý',
  VERIFY_RESOLUTION: 'Xác minh phương án xử lý',
  CLOSE: 'Đóng sự cố',
  REOPEN: 'Mở lại sự cố',
}

type Props = {
  issue: OperationalIssue
  onChanged: () => void
}

export function IssueActions({ issue, onChanged }: Props) {
  const access = useSessionAccess()
  const [validation, setValidation] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [validating, setValidating] = useState(false)
  const validationLock = useRef(false)
  const [activeAction, setActiveAction] = useState<IssueAction | null>(null)
  const actions = useIssueActions(issue.id, onChanged)
  const availability = getIssueActionAvailability(issue)
  const availableActions = (Object.keys(availability) as IssueAction[]).filter(
    (action) => availability[action].visible && access.has(issueActionPermissions[action]),
  )

  return (
    <section className={styles.panel}>
      <h2>Thao tác</h2>
      {availableActions.length ? (
        <div className={styles.actionStack}>
          {availableActions.map((action, index) => (
            <div key={action}>
              {access.has(issueActionPermissions[action]) && <button
                className={index === 0 ? styles.primaryButton : styles.secondaryButton}
                disabled={!availability[action].enabled || actions.pendingAction !== null || !access.has(issueActionPermissions[action])}
                onClick={() => { actions.clearFeedback(); setActiveAction(action) }}
                title={availability[action].reason}
                type="button"
              >
                {labels[action]}
              </button>}
              {!access.has(issueActionPermissions[action]) && <p className={styles.actionHint}>Chưa có quyền thực hiện thao tác này.</p>}
              {!availability[action].enabled && availability[action].reason ? (
                <p className={styles.actionHint}>{availability[action].reason}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p>Không có thao tác phù hợp với trạng thái hiện tại.</p>
      )}

      {access.has('OPERATIONAL_ISSUE_READ') && <Button tone="secondary" disabled={validating || !access.has('OPERATIONAL_ISSUE_READ')} onClick={() => {
        if (validationLock.current || !access.has('OPERATIONAL_ISSUE_READ')) return
        validationLock.current = true
        setValidating(true); setValidation(null)
        void operationalIssuesApi.validate(issue.id).then(() => setValidation({ tone: 'success', message: 'Hồ sơ và trạng thái sự cố hợp lệ.' })).catch((error: unknown) => setValidation({ tone: 'error', message: error instanceof Error ? error.message : 'Không kiểm tra được sự cố.' })).finally(() => { validationLock.current = false; setValidating(false) })
      }}>{validating ? 'Đang kiểm tra…' : 'Kiểm tra hồ sơ sự cố'}</Button>}
      {validation && <Notice title="Kết quả kiểm tra" tone={validation.tone}>{validation.message}</Notice>}

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

      {activeAction === 'ASSIGN_HANDLER' && access.has(issueActionPermissions.ASSIGN_HANDLER) && <AssignHandlerForm
        currentHandlerId={issue.assignedTo?.id}
        open
        pending={actions.pendingAction === 'ASSIGN_HANDLER'}
        error={actions.feedback?.tone === 'error' ? actions.feedback.message : undefined}
        onClose={() => setActiveAction(null)}
        onSubmit={actions.assign}
      />}
      <StartHandlingAction
        assigneeName={issue.assignedTo?.name ?? null}
        open={activeAction !== null && access.has(issueActionPermissions[activeAction]) && activeAction === 'START_HANDLING'}
        pending={actions.pendingAction === 'START_HANDLING'}
        error={actions.feedback?.tone === 'error' ? actions.feedback.message : undefined}
        onClose={() => setActiveAction(null)}
        onSubmit={actions.start}
      />
      <RecordResolutionForm
        open={activeAction !== null && access.has(issueActionPermissions[activeAction]) && activeAction === 'RECORD_RESOLUTION'}
        pending={actions.pendingAction === 'RECORD_RESOLUTION'}
        error={actions.feedback?.tone === 'error' ? actions.feedback.message : undefined}
        onClose={() => setActiveAction(null)}
        onSubmit={actions.recordResolution}
      />
      <VerifyResolutionForm
        open={activeAction !== null && access.has(issueActionPermissions[activeAction]) && activeAction === 'VERIFY_RESOLUTION'}
        pending={actions.pendingAction === 'VERIFY_RESOLUTION'}
        error={actions.feedback?.tone === 'error' ? actions.feedback.message : undefined}
        onClose={() => setActiveAction(null)}
        onSubmit={actions.verifyResolution}
      />
      <CloseIssueAction
        open={activeAction !== null && access.has(issueActionPermissions[activeAction]) && activeAction === 'CLOSE'}
        pending={actions.pendingAction === 'CLOSE'}
        error={actions.feedback?.tone === 'error' ? actions.feedback.message : undefined}
        onClose={() => setActiveAction(null)}
        onSubmit={actions.close}
      />
      <ReopenIssueForm
        open={activeAction !== null && access.has(issueActionPermissions[activeAction]) && activeAction === 'REOPEN'}
        pending={actions.pendingAction === 'REOPEN'}
        error={actions.feedback?.tone === 'error' ? actions.feedback.message : undefined}
        onClose={() => setActiveAction(null)}
        onSubmit={actions.reopen}
      />
    </section>
  )
}
