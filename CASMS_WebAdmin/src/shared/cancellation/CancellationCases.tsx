import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Notice, Panel } from '@/shared/ui'
import { cancellationApi, cancellationStatus, type CancellationCase } from './api'
import styles from './CancellationCases.module.css'

const actionLabels = { verify: 'Xác nhận đã đối chiếu sự cố', approve: 'Duyệt hủy đặt chỗ', reject: 'Từ chối yêu cầu', withdraw: 'Rút yêu cầu' }
type Action = CancellationCase['allowedActions'][number]

function CaseActions({ item, onChanged }: { item: CancellationCase; onChanged: () => void }) {
  const [action, setAction] = useState<Action | ''>('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const field = useId()
  if (!item.allowedActions.length) return null
  const choices = item.allowedActions
  const requiresReason = action === 'approve' || action === 'reject'

  async function submit() {
    if (!action || !choices.includes(action) || lock.current || (requiresReason && !reason.trim())) return
    lock.current = true; setBusy(true); setError('')
    try {
      await cancellationApi.transition(item, action, reason.trim())
      setAction(''); setReason(''); onChanged()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Chưa thực hiện được thao tác. Vui lòng thử lại.')
      if (value instanceof ApiError && value.status === 409) onChanged()
    } finally { lock.current = false; setBusy(false) }
  }
  return <form className={styles.stack} onSubmit={e => { e.preventDefault(); void submit() }}>
    <Field htmlFor={field} label="Thao tác">
      <select id={field} value={action} disabled={busy} onChange={e => setAction(e.target.value as Action | '')}>
        <option value="">Chọn thao tác</option>
        {choices.map(choice => <option key={choice} value={choice}>{actionLabels[choice]}</option>)}
      </select>
    </Field>
    {requiresReason && <Field htmlFor={field + '-reason'} label="Lý do quyết định">
      <textarea id={field + '-reason'} required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/>
    </Field>}
    {action === 'approve' && <p>Khi duyệt, hệ thống sẽ hủy đặt chỗ và giải phóng cabin.</p>}
    {error && <Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}
    <Button type="submit" disabled={!action || (requiresReason && !reason.trim())} busy={busy}>
      {action ? actionLabels[action] : 'Xác nhận thao tác'}
    </Button>
  </form>
}

function Cases({ items, onChanged }: { items: CancellationCase[]; onChanged: () => void }) {
  if (!items.length) return <p>Chưa có yêu cầu hủy.</p>
  return <ul className={styles.stack}>{items.map(item => <li key={item.caseId}>
    <strong>{cancellationStatus[item.status]}</strong>
    <p>{item.reason}</p>
    <p>Mã hồ sơ đặt chỗ: {item.bookingId}</p>
    {item.issueId && <p>Mã sự cố: {item.issueId}</p>}
    <CaseActions item={item} onChanged={onChanged}/>
  </li>)}</ul>
}

export function CancellationQueue({ issueId, operations = false }: { issueId?: string; operations?: boolean }) {
  const access = useSessionAccess()
  const allowed = access.status === 'ready' && (operations || issueId
    ? access.roles.includes('OPERATIONS_MANAGER') : access.roles.includes('FINANCE_OFFICER') && access.has('PAYMENT_REFUND'))
  const [page, setPage] = useState(0)
  const query = useReadQuery(`cancellation-queue:${access.userId}:${issueId}:${page}:${allowed}`,
    useCallback(signal => allowed ? cancellationApi.queue(page, signal, issueId) : Promise.resolve(null), [allowed, issueId, page]))
  if (!allowed || query.error instanceof ApiError && query.error.status === 404) return null
  return <Panel title={issueId ? 'Yêu cầu hủy liên quan đến sự cố' : operations ? 'Yêu cầu hủy cần OPS đối chiếu' : 'Yêu cầu hủy chờ tài chính duyệt'}>
    {query.loading && <p role="status">Đang tải yêu cầu hủy…</p>}
    {query.error && <Notice title="Chưa tải được yêu cầu hủy" tone="error"><Button tone="secondary" onClick={query.retry}>Tải lại</Button></Notice>}
    {query.data && <><Cases items={query.data.content} onChanged={query.retry}/>
      {query.data.totalPages > 1 || page > 0 ? <nav aria-label="Trang yêu cầu hủy">
        <Button tone="secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Trang trước</Button>
        <Button tone="secondary" disabled={page + 1 >= query.data.totalPages} onClick={() => setPage(p => p + 1)}>Trang sau</Button>
      </nav> : null}
    </>}
  </Panel>
}

export function StaffCancellation({ bookingId, bookingStatus, onChanged, onLegacyAvailable }: {
  bookingId: string; bookingStatus: string; onChanged: () => void; onLegacyAvailable: (id: string) => void
}) {
  const access = useSessionAccess()
  const allowed = access.status === 'ready' && (access.roles.includes('BOOKING_AGENT') || access.roles.includes('FINANCE_OFFICER'))
  const canRequest = access.roles.includes('BOOKING_AGENT') && access.has('BOOKING_CANCEL')
  const query = useReadQuery(`staff-cancellation:${access.userId}:${bookingId}:${allowed}`,
    useCallback(signal => allowed ? cancellationApi.history(bookingId, signal) : Promise.resolve(null), [allowed, bookingId]))
  const field = useId()
  const [reason, setReason] = useState('')
  const [scenario, setScenario] = useState<CancellationCase['scenario']>('CUSTOMER')
  const [issueId, setIssueId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const savedKey = useRef<{ payload: string; key: string } | null>(null)
  const lock = useRef(false)

  const legacyAvailable = query.error instanceof ApiError && query.error.status === 404
  useEffect(() => {
    onLegacyAvailable(canRequest && legacyAvailable ? bookingId : '')
  }, [bookingId, canRequest, legacyAvailable, onLegacyAvailable])

  if (!allowed || query.error instanceof ApiError && [403, 404].includes(query.error.status)) return null
  function refresh() { query.retry(); onChanged() }
  async function submit() {
    if (lock.current || !reason.trim()) return
    lock.current = true; setBusy(true); setError('')
    try {
      const issue = scenario === 'OPERATIONAL_DISRUPTION' ? issueId.trim() : undefined
      const payload = JSON.stringify([scenario, reason.trim(), issue])
      if (savedKey.current?.payload !== payload) savedKey.current = { payload, key: crypto.randomUUID() }
      await cancellationApi.request(bookingId, reason.trim(), savedKey.current.key, scenario, issue)
      savedKey.current = null
      setReason(''); setIssueId(''); refresh()
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Chưa gửi được yêu cầu hủy.')
      if (value instanceof ApiError && value.status === 409) query.retry()
    } finally { lock.current = false; setBusy(false) }
  }

  return <Panel title="Yêu cầu hủy đặt chỗ">
    {query.loading && <p role="status">Đang tải yêu cầu hủy…</p>}
    {query.error && <Notice title="Chưa tải được yêu cầu hủy" tone="error"><Button tone="secondary" onClick={query.retry}>Tải lại</Button></Notice>}
    {query.data && <Cases items={query.data} onChanged={refresh}/>}
    {canRequest && bookingStatus !== 'Cancelled' && query.data && !query.data.some(item =>
      ['PENDING_OPS','PENDING_FINANCE'].includes(item.status)) && <form className={styles.stack} onSubmit={e => { e.preventDefault(); void submit() }}>
      <Field htmlFor={field + '-scenario'} label="Nguồn yêu cầu">
        <select id={field + '-scenario'} value={scenario} onChange={e => setScenario(e.target.value as CancellationCase['scenario'])}>
          <option value="CUSTOMER">Khách hàng</option><option value="COMPANY">Công ty</option>
          <option value="OPERATIONAL_DISRUPTION">Sự cố vận hành</option>
        </select>
      </Field>
      {scenario === 'OPERATIONAL_DISRUPTION' && <Field htmlFor={field + '-issue'} label="ID sự cố của chuyến">
        <input id={field + '-issue'} required value={issueId} onChange={e => setIssueId(e.target.value)}/>
      </Field>}
      <Field htmlFor={field} label="Lý do yêu cầu hủy"><textarea id={field} required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/></Field>
      {error && <Notice title="Chưa gửi được yêu cầu hủy" tone="error">{error}</Notice>}
      <Button type="submit" busy={busy}>Gửi yêu cầu hủy</Button>
    </form>}
  </Panel>
}
