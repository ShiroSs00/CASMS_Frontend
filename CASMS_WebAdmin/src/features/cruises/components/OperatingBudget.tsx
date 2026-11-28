import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '@/shared/api'
import { businessErrorMessage } from '@/shared/api/business-errors'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, Field, Modal, Notice } from '@/shared/ui'
import { formatOperatingBudget, operatingBudgetInput, preparationApi, type OperatingBudget as Budget } from '../api/preparation-api'
import styles from './ManagerWorkspace.module.css'

export function OperatingBudget({
  cruiseId,
  budget,
  loading,
  loadError,
  retry,
  onSaved,
  prioritizeEntry = false,
  reviewAllowed = true,
}: {
  cruiseId: string
  budget: Budget | null
  loading: boolean
  loadError: Error | null
  retry: () => void
  onSaved: () => void
  prioritizeEntry?: boolean
  reviewAllowed?: boolean
}) {
  const access = useSessionAccess()
  const field = useId()
  const rejectField = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const lock = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const entryRequired = prioritizeEntry && Boolean(budget?.canEdit && !budget.amountVnd)
  const explicitEditing = draft !== null
  const editing = explicitEditing || entryRequired
  useEffect(() => {
    if (explicitEditing) input.current?.focus()
  }, [explicitEditing])

  if (loadError instanceof ApiError && loadError.status === 403) return null
  const text = draft?.trim() ?? ''
  const value = operatingBudgetInput(text)

  const canSubmitBudget = Boolean(
    budget?.amountVnd
    && (budget.status === 'DRAFT' || budget.status === 'REJECTED')
    && access.roles.includes('CRUISE_MANAGER')
    && access.canDo('CRUISE_PREPARATION_SUBMIT'),
  )
  const canReviewBudget = Boolean(
    reviewAllowed && budget?.status === 'SUBMITTED'
    && access.roles.includes('OPERATIONS_MANAGER')
    && access.canDo('CRUISE_PREPARATION_CONFIRM'),
  )

  async function submitBudgetForApproval() {
    if (!budget || !canSubmitBudget || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await preparationApi.submitOperatingBudget(cruiseId, budget.revision, budget.reviewRevision)
      setSuccess('Đã gửi ngân sách vận hành để Quản lý vận hành xét duyệt.')
      onSaved()
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) retry()
      setError(
        cause instanceof ApiError
          ? businessErrorMessage(cause.code, cause.message)
          : 'Chưa gửi duyệt được ngân sách. Vui lòng thử lại.',
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  async function reviewBudget(decision: 'APPROVE' | 'REJECT', reason?: string) {
    if (!budget || !canReviewBudget || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setRejectError('')
    setSuccess('')
    try {
      await preparationApi.reviewOperatingBudget(cruiseId, budget.reviewRevision, decision, reason)
      setRejectOpen(false)
      setRejectReason('')
      setSuccess(
        decision === 'APPROVE'
          ? 'Đã duyệt ngân sách vận hành.'
          : 'Đã trả lại ngân sách vận hành để Quản lý lịch trình điều chỉnh.',
      )
      onSaved()
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) retry()
      const msg = cause instanceof ApiError
        ? businessErrorMessage(cause.code, cause.message)
        : 'Chưa cập nhật được quyết định xét duyệt ngân sách.'
      if (decision === 'REJECT') setRejectError(msg)
      else setError(msg)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  function handleRejectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!rejectReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối ngân sách.')
      return
    }
    void reviewBudget('REJECT', rejectReason.trim())
  }

  return (
    <div id="operating-budget" className={styles.budgetInlineCard} aria-label="Ngân sách vận hành">
      {loading && (
        <p className={styles.sectionMeta} role="status">
          Đang tải ngân sách…
        </p>
      )}
      {loadError && (
        <Notice tone="error" title="Chưa tải được ngân sách">
          <Button tone="secondary" onClick={retry}>
            Thử lại
          </Button>
        </Notice>
      )}
      {budget && !editing && (
        <div className={styles.budgetSummaryRow}>
          <div className={styles.budgetAmountGroup}>
            <strong className={styles.budgetAmount}>
              {budget.amountVnd ? formatOperatingBudget(budget.amountVnd) : 'Chưa nhập ngân sách'}
            </strong>
            {!prioritizeEntry && <Badge
              label={!budget.amountVnd ? 'Cần nhập dự kiến' : {
                DRAFT: 'Đã lưu dự kiến', SUBMITTED: 'Chờ duyệt ngân sách',
                APPROVED: 'Ngân sách đã được duyệt', REJECTED: 'Ngân sách cần điều chỉnh',
              }[budget.status]}
              tone={budget.status === 'APPROVED' ? 'success' : budget.status === 'DRAFT' && budget.amountVnd ? 'neutral' : 'warning'}
            />}
            {budget.rejectionReason && <span className={styles.sectionMeta}>{budget.rejectionReason}</span>}
            {budget.amountVnd && (
              <span className={styles.sectionMeta}>Chưa gồm thuế và phí cảng</span>
            )}
          </div>
          <div className={styles.budgetActions}>
            {budget.canEdit && (
              <Button
                tone="secondary"
                size="compact"
                autoWidth
                disabled={busy}
                onClick={() => {
                  setDraft(budget.amountVnd ?? '')
                  setError('')
                  setSuccess('')
                }}
              >
                {budget.amountVnd ? 'Điều chỉnh ngân sách' : 'Nhập ngân sách'}
              </Button>
            )}
            {canSubmitBudget && (
              <Button
                size="compact"
                autoWidth
                busy={busy}
                disabled={busy}
                onClick={() => void submitBudgetForApproval()}
              >
                Gửi duyệt ngân sách
              </Button>
            )}
            {canReviewBudget && (
              <>
                <Button
                  size="compact"
                  autoWidth
                  busy={busy}
                  disabled={busy}
                  onClick={() => void reviewBudget('APPROVE')}
                >
                  Duyệt ngân sách
                </Button>
                <Button
                  tone="secondary"
                  size="compact"
                  autoWidth
                  disabled={busy}
                  onClick={() => {
                    setRejectOpen(true)
                    setRejectReason('')
                    setRejectError('')
                  }}
                >
                  Từ chối
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {budget?.canEdit && editing && (
        <form
          className={styles.budgetEditor}
          noValidate
          onSubmit={async event => {
            event.preventDefault()
            if (!value || value === budget.amountVnd || lock.current) return
            lock.current = true
            setBusy(true)
            setError('')
            setSuccess('')
            try {
              await preparationApi.saveOperatingBudget(cruiseId, budget.revision, value)
              setDraft(null)
              setSuccess('Đã lưu ngân sách vận hành dự kiến.')
              onSaved()
            } catch (cause) {
              if (cause instanceof ApiError && cause.status === 409) retry()
              setError(
                cause instanceof ApiError && cause.status === 409
                  ? 'Tour vừa được cập nhật. Kiểm tra ngân sách mới nhất rồi lưu lại.'
                  : cause instanceof ApiError
                    ? businessErrorMessage(cause.code, cause.message)
                    : 'Chưa lưu được ngân sách. Vui lòng thử lại.',
              )
            } finally {
              lock.current = false
              setBusy(false)
            }
          }}
        >
          <Field
            htmlFor={field}
            label="Số tiền ngân sách vận hành dự kiến (VND) *"
            hint={value ? formatOperatingBudget(value) : 'Ví dụ 18.000.000'}
            error={text && !value ? 'Nhập số tiền nguyên lớn hơn 0, tối đa 18 chữ số.' : undefined}
          >
            <div className={styles.budgetInputAction}><input
              id={field}
              inputMode="numeric"
              ref={input}
              value={draft ?? ''}
              maxLength={24}
              required
              disabled={busy}
              onChange={event => setDraft(event.target.value)}
            /><Button type="submit" autoWidth busy={busy} disabled={!value || value === budget.amountVnd}>Lưu ngân sách</Button></div>
          </Field>
          <div className={styles.budgetActions}>
            {!entryRequired && <Button
              type="button"
              tone="secondary"
              autoWidth
              disabled={busy}
              onClick={() => {
                setDraft(null)
                setError('')
              }}
            >
              Hủy
            </Button>}
          </div>
        </form>
      )}
      {success && (
        <Notice tone="success" title="Đã cập nhật ngân sách">
          {success}
        </Notice>
      )}
      {error && (
        <Notice tone="error" title="Không thể cập nhật ngân sách">
          {error}
        </Notice>
      )}
      {rejectOpen && canReviewBudget && (
        <Modal
          busy={busy}
          title="Từ chối ngân sách vận hành"
          description="Ghi rõ nội dung cần điều chỉnh để Quản lý lịch trình cập nhật và gửi lại."
          onClose={() => { if (!busy) setRejectOpen(false) }}
          footer={
            <>
              <Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={() => setRejectOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" form="reject-operating-budget-form" tone="danger" busy={busy} disabled={busy}>
                {busy ? 'Đang gửi…' : 'Xác nhận từ chối'}
              </Button>
            </>
          }
        >
          <form id="reject-operating-budget-form" noValidate onSubmit={handleRejectSubmit} style={{ display: 'grid', gap: '12px' }}>
            {rejectError && <Notice tone="error" title="Chưa từ chối được ngân sách">{rejectError}</Notice>}
            <Field htmlFor={rejectField} label="Lý do từ chối *">
              <textarea
                id={rejectField}
                required
                rows={3}
                maxLength={500}
                disabled={busy}
                value={rejectReason}
                onChange={event => {
                  setRejectReason(event.target.value)
                  if (rejectError) setRejectError('')
                }}
              />
            </Field>
          </form>
        </Modal>
      )}
    </div>
  )
}
