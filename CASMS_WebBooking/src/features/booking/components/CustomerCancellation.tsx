import { useCallback, useId, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Modal, Notice, Panel } from '@/shared/ui'
import { cancellationApi, cancellationStatus } from '../api/cancellation-api'
import styles from './LiveBooking.module.css'

export function CustomerCancellation({ bookingId, bookingStatus, departureDatetime }: { bookingId: string; bookingStatus: string; departureDatetime?: string | null }) {
  const access = useSessionAccess()
  const allowed = access.status === 'ready' && access.roles.includes('PASSENGER')
  const query = useReadQuery(`customer-cancellation:${access.userId}:${bookingId}:${allowed}`, useCallback(
    signal => allowed ? cancellationApi.history(bookingId, signal) : Promise.resolve(null), [allowed, bookingId]))
  const reasonId = useId()
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [nowMs] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const activeRequest = useRef<{ reason: string; key: string } | null>(null)
  const inFlight = useRef(false)

  if (!allowed || query.error instanceof ApiError && [403, 404].includes(query.error.status)) return null
  const departed = Boolean(departureDatetime && Number.isFinite(Date.parse(departureDatetime)) && Date.parse(departureDatetime) <= nowMs)
  const active = query.data?.find(item => item.status === 'PENDING_OPS' || item.status === 'PENDING_FINANCE')
  const canRequestNew = Boolean(query.data && !active && bookingStatus !== 'Cancelled' && !departed)
  if (!query.loading && !query.error && !query.data?.length && !canRequestNew) return null

  function requestConfirmation() {
    setError('')
    if (!reason.trim()) {
      setReasonError('Vui lòng nhập lý do yêu cầu hủy.')
      return
    }
    setReasonError('')
    setConfirmOpen(true)
  }

  async function run(withdraw: boolean) {
    if (inFlight.current) return
    if (!withdraw && !reason.trim()) {
      setReasonError('Vui lòng nhập lý do yêu cầu hủy.')
      return
    }
    inFlight.current = true
    setBusy(true); setError(''); setMessage('')
    try {
      if (withdraw && active) {
        await cancellationApi.transition(active, 'withdraw')
        setMessage('Đã rút yêu cầu hủy.')
      } else {
        const normalized = reason.trim()
        if (activeRequest.current?.reason !== normalized) activeRequest.current = { reason: normalized, key: crypto.randomUUID() }
        const created = await cancellationApi.request(bookingId, normalized, activeRequest.current.key)
        activeRequest.current = null
        setReason('')
        setReasonError('')
        setConfirmOpen(false)
        setMessage(
          created?.status === 'COMPLETED'
            ? 'Đã hủy đặt chỗ thành công.'
            : created?.status === 'PENDING_OPS'
              ? 'Đã gửi yêu cầu hủy để bộ phận vận hành xác minh.'
              : 'Đã gửi yêu cầu hủy để bộ phận tài chính xem xét.',
        )
      }
      query.retry()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Chưa gửi được yêu cầu. Vui lòng thử lại.')
      if (value instanceof ApiError && value.status === 409) query.retry()
    } finally { inFlight.current = false; setBusy(false) }
  }

  return <Panel title="Yêu cầu hủy đặt chỗ">
    <div className={styles.stack}>
      {query.loading && <p role="status">Đang tải yêu cầu hủy…</p>}
      {query.error && <Notice title="Chưa tải được yêu cầu hủy" tone="error"><Button tone="secondary" onClick={query.retry}>Tải lại</Button></Notice>}
      {message && <p role="status">{message}</p>}
      {error && !confirmOpen && <Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}
      {!!query.data?.length && <ul>{query.data.map(item =>
        <li key={item.caseId}><strong>{cancellationStatus[item.status]}</strong><p>{item.reason}</p></li>)}</ul>}
      {active?.allowedActions.includes('withdraw') && <Button tone="secondary" busy={busy} onClick={() => void run(true)}>Rút yêu cầu hủy</Button>}
      {canRequestNew && <form className={styles.stack} noValidate onSubmit={event => { event.preventDefault(); requestConfirmation() }}>
        <Field htmlFor={reasonId} label="Lý do yêu cầu hủy *" hint="Đặt chỗ vẫn được giữ trong khi chờ bộ phận phụ trách xét duyệt." error={reasonError || undefined}>
          <textarea
            id={reasonId}
            value={reason}
            required
            maxLength={1000}
            aria-invalid={Boolean(reasonError)}
            onChange={event => { setReason(event.target.value); if (reasonError) setReasonError('') }}
          />
        </Field>
        <Button type="submit" busy={busy}>Gửi yêu cầu hủy</Button>
      </form>}
    </div>
    {confirmOpen && (
      <Modal
        title="Xác nhận gửi yêu cầu hủy đặt chỗ"
        busy={busy}
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <Button tone="secondary" autoWidth data-overlay-dismiss disabled={busy} onClick={() => setConfirmOpen(false)}>
              Quay lại
            </Button>
            <Button tone="danger" autoWidth busy={busy} onClick={() => void run(false)}>
              Xác nhận gửi yêu cầu hủy
            </Button>
          </>
        }
      >
        <p>Bạn chắc chắn muốn gửi yêu cầu hủy đặt chỗ này với lý do đã nhập? Trong thời gian chờ xét duyệt, bạn vẫn có thể rút yêu cầu nếu thay đổi ý định.</p>
        {error && <Notice title="Chưa gửi được yêu cầu" tone="error">{error}</Notice>}
      </Modal>
    )}
  </Panel>
}

