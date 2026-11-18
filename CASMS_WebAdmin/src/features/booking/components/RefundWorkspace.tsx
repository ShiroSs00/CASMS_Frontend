import { useCallback, useId, useRef, useState } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { downloadCsv } from '@/shared/lib/download-csv'
import { Button, Field, Notice, Panel } from '@/shared/ui'
import styles from './LiveBooking.module.css'

type RefundTotal = { currency: string; status: string; count: number; requestedAmount: number; approvedAmount: number }
const refundStatus: Record<string, string> = {
  Requested: 'Đã yêu cầu', Approved: 'Đã duyệt', Completed: 'Đã ghi nhận hoàn', Failed: 'Cần đối soát', Rejected: 'Đã từ chối',
}
export function RefundSummary() {
  const access = useSessionAccess()
  const id = useId()
  const [from, setFrom] = useState('')
  const [until, setUntil] = useState('')
  const [rows, setRows] = useState<RefundTotal[] | null>(null)
  const [range, setRange] = useState<{ from: string; until: string } | null>(null)
  const exportLock = useRef(false)
  async function download() {
    if (!range || exportLock.current) return
    exportLock.current = true
    setBusy(true); setError('')
    try {
      const csv = await apiRequest<string>('/refunds/report/export', { method: 'POST', body: range })
      downloadCsv(csv, 'bao-cao-hoan-tien.csv')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Chưa xuất được báo cáo.')
    } finally { exportLock.current = false; setBusy(false) }
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <Panel title="Tổng hợp hoàn tiền">
    <form className={styles.stack} onSubmit={async e => {
      e.preventDefault()
      if (busy || !from || !until) return
      setBusy(true); setError(''); setRows(null); setRange(null)
      try {
        const start = new Date(from + 'T00:00:00+07:00')
        const end = new Date(new Date(until + 'T00:00:00+07:00').getTime() + 86_400_000)
        if (start >= end) { setError('Ngày kết thúc phải từ ngày bắt đầu trở đi.'); return }
        const applied = { from: start.toISOString(), until: end.toISOString() }
        setRows(await apiRequest<RefundTotal[]>('/refunds/report', { query: applied }))
        setRange(applied)
      } catch (value) { setError(value instanceof Error ? value.message : 'Chưa tải được số liệu.') }
      finally { setBusy(false) }
    }}>
      <Field htmlFor={id + '-from'} label="Từ ngày (giờ Việt Nam)"><input id={id + '-from'} type="date" required value={from} onChange={e => setFrom(e.target.value)}/></Field>
      <Field htmlFor={id + '-until'} label="Đến hết ngày (giờ Việt Nam)"><input id={id + '-until'} type="date" required value={until} onChange={e => setUntil(e.target.value)}/></Field>
      <Button type="submit" busy={busy}>Xem tổng hợp</Button>
    </form>
    {error && <Notice title="Chưa tải được tổng hợp" tone="error">{error}</Notice>}
    {range && access.has('REPORT_GENERATE') && <Button tone="secondary" busy={busy} onClick={() => void download()}>Xuất CSV</Button>}
    {rows && (rows.length ? <ul>{rows.map(row => <li key={row.currency + row.status}>
      {row.currency} · {refundStatus[row.status] ?? 'Chưa xác định'} · {row.count} yêu cầu
      <p>Yêu cầu {row.requestedAmount.toLocaleString('vi-VN')} · Đã duyệt {row.approvedAmount.toLocaleString('vi-VN')}</p>
    </li>)}</ul> : <p>Không có yêu cầu hoàn tiền trong khoảng ngày đã chọn.</p>)}
  </Panel>
}


type RefundRecord = {
  refundId: string
  status: string
  refundReason: string
  rejectionReason?: string
  approvedAmount?: number
  requestedAmount: number
  currency: string
  processorOrReceiptReference?: string
  adjustmentInvoiceId?: string
}
type RefundAction = 'approve' | 'reject' | 'complete'
const refundActionLabels = {
  approve: 'Duyệt số tiền hoàn', reject: 'Từ chối hoàn tiền', complete: 'Ghi nhận chứng từ hoàn tiền',
}
function ManualRefundAction({ record, onChanged }: { record: RefundRecord; onChanged: () => void }) {
  const id = useId()
  const [action, setAction] = useState<RefundAction | ''>('')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const options: RefundAction[] = record.status === 'Requested' ? ['approve', 'reject']
    : record.status === 'Approved' ? ['complete', 'reject'] : []
  if (!options.length) return null
  async function submit() {
    const input = value.trim()
    if (lock.current || !action || !options.includes(action) || !input) return
    if (action === 'approve' && (!/^\d+(\.\d{1,4})?$/.test(input)
        || Number(input) <= 0 || Number(input) > record.requestedAmount)) {
      setError('Nhập số tiền dương trong giới hạn yêu cầu, tối đa 4 chữ số thập phân.')
      return
    }
    lock.current = true; setBusy(true); setError('')
    try {
      await apiRequest(`/refunds/${encodeURIComponent(record.refundId)}/${action}`, {
        method: 'POST',
        ...(action === 'reject' ? { query: { reason: input } } : {
          body: action === 'approve' ? { approvedAmount: input } : { processorOrReceiptReference: input },
        }),
      })
      setAction(''); setValue(''); onChanged()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Chưa lưu được thao tác hoàn tiền.')
      if (failure instanceof ApiError && failure.status === 409) onChanged()
    } finally { lock.current = false; setBusy(false) }
  }
  const label = action === 'approve' ? `Số tiền duyệt (${record.currency})`
    : action === 'reject' ? 'Lý do từ chối' : 'Mã biên lai hoặc giao dịch'
  return <form className={styles.stack} onSubmit={event => { event.preventDefault(); void submit() }}>
    <Field htmlFor={id} label="Thao tác hoàn tiền">
      <select id={id} value={action} disabled={busy} onChange={event => {
        setAction(event.target.value as RefundAction | ''); setValue(''); setError('')
      }}>
        <option value="">Chọn thao tác</option>
        {options.map(option => <option key={option} value={option}>{refundActionLabels[option]}</option>)}
      </select>
    </Field>
    {action && <Field htmlFor={id + '-value'} label={label} error={error || undefined}
      hint={action === 'complete' ? 'Dùng mã trên chứng từ của giao dịch đã thực hiện.' : undefined}>
      <input id={id + '-value'} required value={value} maxLength={action === 'reject' ? 1000 : 255}
        inputMode={action === 'approve' ? 'decimal' : undefined} onChange={event => setValue(event.target.value)}/>
    </Field>}
    {action && <Button type="submit" busy={busy}>{refundActionLabels[action]}</Button>}
  </form>
}

export function RefundHistory({ bookingId }: { bookingId: string }) {
  const access = useSessionAccess()
  const allowed = access.status === 'ready' && access.roles.includes('FINANCE_OFFICER') && access.has('PAYMENT_REFUND')
  const query = useReadQuery(`finance-refunds:${access.userId}:${bookingId}:${allowed}`, useCallback(
    signal => allowed ? apiRequest<RefundRecord[]>(`/refunds/booking/${encodeURIComponent(bookingId)}`, { signal }) : Promise.resolve(null),
    [allowed, bookingId]))
  if (!allowed) return null
  return <Panel title="Hồ sơ hoàn tiền">
    {query.loading && <p role="status">Đang tải hồ sơ hoàn tiền…</p>}
    {query.error && <Notice title="Chưa tải được hồ sơ hoàn tiền" tone="error"><Button tone="secondary" onClick={query.retry}>Tải lại</Button></Notice>}
    {query.data && (query.data.length ? <ul>{query.data.map(row => <li key={row.refundId}>
      <strong>{refundStatus[row.status] ?? 'Chưa xác định'}</strong>
      <p>{row.refundReason} · {(row.approvedAmount ?? row.requestedAmount).toLocaleString('vi-VN')} {row.currency}</p>
      {row.rejectionReason && <p>Lý do từ chối: {row.rejectionReason}</p>}
      {row.processorOrReceiptReference && <p>Chứng từ ghi nhận: {row.processorOrReceiptReference}</p>}
      {row.adjustmentInvoiceId && <p>ID hóa đơn điều chỉnh: {row.adjustmentInvoiceId}</p>}
      <ManualRefundAction key={row.status} record={row} onChanged={query.retry}/>
    </li>)}</ul> : <p>Chưa có hồ sơ hoàn tiền.</p>)}
  </Panel>
}
