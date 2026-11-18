import { useCallback, useId, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Notice, Panel } from '@/shared/ui'
import { cancellationApi, cancellationStatus } from '../api/cancellation-api'
import styles from './LiveBooking.module.css'

export function CustomerCancellation({ bookingId, bookingStatus }: { bookingId: string; bookingStatus: string }) {
  const access = useSessionAccess()
  const allowed = access.status === 'ready' && access.roles.includes('PASSENGER')
  const query = useReadQuery(`customer-cancellation:${access.userId}:${bookingId}:${allowed}`, useCallback(
    signal => allowed ? cancellationApi.history(bookingId, signal) : Promise.resolve(null), [allowed, bookingId]))
  const reasonId = useId()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const activeRequest = useRef<{ reason: string; key: string } | null>(null)
  const inFlight = useRef(false)

  if (!allowed || query.error instanceof ApiError && [403, 404].includes(query.error.status)) return null
  const active = query.data?.find(item => item.status === 'PENDING_OPS' || item.status === 'PENDING_FINANCE')

  async function run(withdraw: boolean) {
    if (inFlight.current) return
    if (!withdraw && !reason.trim()) { setError('Nhập lý do yêu cầu hủy.'); return }
    inFlight.current = true
    setBusy(true); setError(''); setMessage('')
    try {
      if (withdraw && active) {
        await cancellationApi.transition(active, 'withdraw')
        setMessage('Đã rút yêu cầu hủy.')
      } else {
        const normalized = reason.trim()
        if (activeRequest.current?.reason !== normalized) activeRequest.current = { reason: normalized, key: crypto.randomUUID() }
        await cancellationApi.request(bookingId, normalized, activeRequest.current.key)
        activeRequest.current = null
        setReason('')
        setMessage('Đã gửi yêu cầu hủy để bộ phận tài chính xem xét.')
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
      {error && <Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}
      {!!query.data?.length && <ul>{query.data.map(item =>
        <li key={item.caseId}><strong>{cancellationStatus[item.status]}</strong><p>{item.reason}</p></li>)}</ul>}
      {active?.allowedActions.includes('withdraw') && <Button tone="secondary" busy={busy} onClick={() => void run(true)}>Rút yêu cầu hủy</Button>}
      {query.data && !active && bookingStatus !== 'Cancelled' && <form className={styles.stack} onSubmit={event => { event.preventDefault(); void run(false) }}>
        <Field htmlFor={reasonId} label="Lý do yêu cầu hủy" hint="Đặt chỗ được giữ trong khi chờ duyệt.">
          <textarea id={reasonId} value={reason} required maxLength={1000} onChange={event => setReason(event.target.value)}/>
        </Field>
        <Button type="submit" busy={busy}>Gửi yêu cầu hủy</Button>
      </form>}
    </div>
  </Panel>
}

