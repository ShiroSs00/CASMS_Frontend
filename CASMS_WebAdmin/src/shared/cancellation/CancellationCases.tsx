import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, Field, Loading, Notice, Panel } from '@/shared/ui'
import { cancellationApi, cancellationStatus, type CancellationCase, type CancellationStatus } from './api'
import styles from './CancellationCases.module.css'

const actionLabels = { verify: 'Xác nhận đã đối chiếu sự cố', approve: 'Duyệt hủy đặt chỗ', reject: 'Từ chối yêu cầu', withdraw: 'Rút yêu cầu' }
const statusTones: Record<CancellationStatus, 'warning' | 'info' | 'success' | 'error' | 'neutral'> = {
  PENDING_OPS: 'warning',
  PENDING_FINANCE: 'info',
  COMPLETED: 'success',
  REJECTED: 'error',
  WITHDRAWN: 'neutral',
}
const scenarioLabels: Record<CancellationCase['scenario'], string> = {
  CUSTOMER: 'Khách hàng yêu cầu',
  COMPANY: 'Công ty đề xuất',
  OPERATIONAL_DISRUPTION: 'Sự cố vận hành',
}
const formatRequestedAt = (value: string) => Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  : value

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
  return <form className={styles.actionForm} onSubmit={e => { e.preventDefault(); void submit() }}>
    <div className={styles.actionFields}>
      <Field htmlFor={field} label="Thao tác">
        <select id={field} value={action} disabled={busy} onChange={e => setAction(e.target.value as Action | '')}>
          <option value="">Chọn thao tác</option>
          {choices.map(choice => <option key={choice} value={choice}>{actionLabels[choice]}</option>)}
        </select>
      </Field>
      {requiresReason && <Field htmlFor={field + '-reason'} label="Lý do quyết định">
        <textarea id={field + '-reason'} required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/>
      </Field>}
    </div>
    {action === 'approve' && <p className={styles.actionHint}>Khi duyệt, hệ thống sẽ hủy đặt chỗ và giải phóng cabin.</p>}
    {error && <Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}
    <div className={styles.actionFooter}>
      <Button type="submit" size="compact" autoWidth tone={action === 'reject' ? 'danger' : 'primary'} disabled={!action || (requiresReason && !reason.trim())} busy={busy}>
        {action ? actionLabels[action] : 'Xác nhận thao tác'}
      </Button>
    </div>
  </form>
}

function Cases({ items, onChanged, onInspectBooking }: {
  items: CancellationCase[]
  onChanged: () => void
  onInspectBooking?: (bookingId: string) => void
}) {
  if (!items.length) return <p className={styles.actionHint}>Chưa có yêu cầu hủy.</p>
  return <ul className={styles.caseList}>{items.map(item => <li key={item.caseId} className={styles.caseCard}>
    <div className={styles.caseHeader}>
      <div className={styles.caseHeaderMeta}>
        <Badge label={cancellationStatus[item.status]} tone={statusTones[item.status]} />
        <span>{scenarioLabels[item.scenario] ?? item.scenario}</span>
        <span>·</span>
        <span>{formatRequestedAt(item.requestedAt)}</span>
      </div>
      {onInspectBooking && <Button tone="secondary" size="compact" autoWidth onClick={() => onInspectBooking(item.bookingId)}>Mở khoản thu đặt chỗ</Button>}
    </div>
    <p className={styles.caseReason}>{item.reason}</p>
    <dl className={styles.caseFacts}>
      <div><dt>Mã hồ sơ đặt chỗ:</dt><dd className={styles.monoCode}>{item.bookingId}</dd></div>
      {item.issueId && <div><dt>Mã sự cố:</dt><dd className={styles.monoCode}>{item.issueId}</dd></div>}
    </dl>
    <CaseActions item={item} onChanged={onChanged}/>
  </li>)}</ul>
}

export function CancellationQueue({ issueId, operations = false, onInspectBooking }: {
  issueId?: string
  operations?: boolean
  onInspectBooking?: (bookingId: string) => void
}) {
  const access = useSessionAccess()
  const allowed = access.status === 'ready' && (operations || issueId
    ? access.roles.includes('OPERATIONS_MANAGER') : access.roles.includes('FINANCE_OFFICER') && access.has('PAYMENT_REFUND'))
  const [page, setPage] = useState(0)
  const query = useReadQuery(`cancellation-queue:${access.userId}:${issueId}:${page}:${allowed}`,
    useCallback(signal => allowed ? cancellationApi.queue(page, signal, issueId) : Promise.resolve(null), [allowed, issueId, page]))
  if (!allowed || query.error instanceof ApiError && query.error.status === 404) return null
  return <Panel title={issueId ? 'Yêu cầu hủy liên quan đến sự cố' : operations ? 'Yêu cầu hủy cần OPS đối chiếu' : 'Yêu cầu hủy chờ tài chính duyệt'}>
    {query.loading && <Loading label="Đang tải yêu cầu hủy…" />}
    {query.error && <Notice title="Chưa tải được yêu cầu hủy" tone="error"><Button tone="secondary" size="compact" autoWidth onClick={query.retry}>Tải lại</Button></Notice>}
    {query.data && <><Cases items={query.data.content} onChanged={query.retry} onInspectBooking={onInspectBooking}/>
      {query.data.totalPages > 1 || page > 0 ? <nav className={styles.pagination} aria-label="Trang yêu cầu hủy">
        <Button tone="secondary" size="compact" autoWidth disabled={page === 0} onClick={() => setPage(p => p - 1)}>Trang trước</Button>
        <span className={styles.actionHint}>Trang {page + 1} / {Math.max(1, query.data.totalPages)}</span>
        <Button tone="secondary" size="compact" autoWidth disabled={page + 1 >= query.data.totalPages} onClick={() => setPage(p => p + 1)}>Trang sau</Button>
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
    {query.loading && <Loading label="Đang tải yêu cầu hủy…" />}
    {query.error && <Notice title="Chưa tải được yêu cầu hủy" tone="error"><Button tone="secondary" size="compact" autoWidth onClick={query.retry}>Tải lại</Button></Notice>}
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
      <div className={styles.actionFooter}><Button type="submit" autoWidth busy={busy}>Gửi yêu cầu hủy</Button></div>
    </form>}
  </Panel>
}
