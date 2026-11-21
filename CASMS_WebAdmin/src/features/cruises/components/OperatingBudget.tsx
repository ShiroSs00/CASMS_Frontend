import { useEffect, useId, useRef, useState } from 'react'
import { ApiError } from '@/shared/api'
import { Badge, Button, Field, Notice } from '@/shared/ui'
import { formatOperatingBudget, operatingBudgetInput, preparationApi, type OperatingBudget as Budget } from '../api/preparation-api'
import styles from './ManagerWorkspace.module.css'

export function OperatingBudget({
  cruiseId,
  budget,
  loading,
  loadError,
  retry,
  onSaved,
}: {
  cruiseId: string
  budget: Budget | null
  loading: boolean
  loadError: Error | null
  retry: () => void
  onSaved: () => void
}) {
  const field = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const editing = draft !== null
  useEffect(() => {
    if (editing) input.current?.focus()
  }, [editing])

  if (loadError instanceof ApiError && loadError.status === 403) return null
  const text = draft?.trim() ?? ''
  const value = operatingBudgetInput(text)

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
      {budget && draft === null && (
        <div className={styles.budgetSummaryRow}>
          <div className={styles.budgetAmountGroup}>
            <strong className={styles.budgetAmount}>
              {budget.amountVnd ? formatOperatingBudget(budget.amountVnd) : 'Chưa nhập ngân sách'}
            </strong>
            <Badge
              label={!budget.amountVnd ? 'Cần nhập dự kiến' : {
                DRAFT: 'Đã lưu dự kiến', SUBMITTED: 'Chờ duyệt ngân sách',
                APPROVED: 'Ngân sách đã được duyệt', REJECTED: 'Ngân sách cần điều chỉnh',
              }[budget.status]}
              tone={budget.status === 'APPROVED' ? 'success' : budget.status === 'DRAFT' && budget.amountVnd ? 'neutral' : 'warning'}
            />
            {budget.rejectionReason && <span className={styles.sectionMeta}>{budget.rejectionReason}</span>}
            {budget.amountVnd && (
              <span className={styles.sectionMeta}>Chưa gồm thuế và phí cảng</span>
            )}
          </div>
          {budget.canEdit && (
            <Button
              tone="secondary"
              size="compact"
              autoWidth
              onClick={() => {
                setDraft(budget.amountVnd ?? '')
                setError('')
              }}
            >
              {budget.amountVnd ? 'Điều chỉnh ngân sách' : 'Nhập ngân sách'}
            </Button>
          )}
        </div>
      )}
      {budget?.canEdit && draft !== null && (
        <form
          className={styles.budgetEditor}
          noValidate
          onSubmit={async event => {
            event.preventDefault()
            if (!value || value === budget.amountVnd || lock.current) return
            lock.current = true
            setBusy(true)
            setError('')
            try {
              await preparationApi.saveOperatingBudget(cruiseId, budget.revision, value)
              setDraft(null)
              onSaved()
            } catch (cause) {
              if (cause instanceof ApiError && cause.status === 409) retry()
              setError(
                cause instanceof ApiError && cause.status === 409
                  ? 'Tour vừa được cập nhật. Kiểm tra ngân sách mới nhất rồi lưu lại.'
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
            label="Số tiền ngân sách vận hành dự kiến (VND)"
            hint={value ? formatOperatingBudget(value) : 'Ví dụ 18.000.000'}
            error={text && !value ? 'Nhập số tiền nguyên lớn hơn 0, tối đa 18 chữ số.' : undefined}
          >
            <input
              id={field}
              inputMode="numeric"
              ref={input}
              value={draft}
              maxLength={24}
              required
              disabled={busy}
              onChange={event => setDraft(event.target.value)}
            />
          </Field>
          <div className={styles.budgetActions}>
            <Button type="submit" autoWidth busy={busy} disabled={!value || value === budget.amountVnd}>
              Lưu ngân sách
            </Button>
            <Button
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
            </Button>
          </div>
        </form>
      )}
      {error && (
        <Notice tone="error" title="Không thể lưu ngân sách">
          {error}
        </Notice>
      )}
    </div>
  )
}
