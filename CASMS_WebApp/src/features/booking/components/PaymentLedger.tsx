import { useCallback, useRef, useState, type FormEvent } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Field, Modal, Notice, Panel } from '@/shared/ui'
import { BookingReadState } from './RealBookingUI'
import { bookingMoney } from '../model/booking-presentation'
import styles from './LiveBooking.module.css'

type Payment = { paymentId: string; bookingId: string; requestedAmount: number; confirmedAmount: number | null; currency: string; paymentMethod: string; status: string; processorReference: string | null; internalReceiptReference: string | null }
export function PaymentLedger({ bookingId, currency, onChanged }: { bookingId: string; currency: string; onChanged: () => void }) {
  const access = useSessionAccess()
  const canRead = access.has('PAYMENT_READ') || access.has('PAYMENT_REPORT'), canWrite = access.has('PAYMENT_PROCESS')
  const query = useReadQuery(`payments:${access.userId}:${bookingId}:${canRead}`, useCallback(signal => canRead ? apiRequest<Payment[]>(`/payment/booking/${encodeURIComponent(bookingId)}`, { signal }).then(rows => {
    if (!Array.isArray(rows) || rows.some(row => !row.paymentId || row.bookingId !== bookingId || !Number.isFinite(row.requestedAmount) || !row.currency)) throw new Error('Không đọc được lịch sử giao dịch.')
    return rows
  }) : Promise.resolve([]), [canRead, bookingId]))
  const [amount, setAmount] = useState(''), [method, setMethod] = useState('Cash'), [reference, setReference] = useState('')
  const [pending, setPending] = useState<Payment | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false), requestKey = useRef<{ payload: string; key: string } | null>(null)
  async function create(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !canWrite || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return
    lock.current = true; setBusy(true); setError('')
    const payload = JSON.stringify({ bookingId, requestedAmount: Number(amount), currency, paymentMethod: method })
    if (requestKey.current?.payload !== payload) requestKey.current = { payload, key: crypto.randomUUID() }
    try {
      const row = await apiRequest<Payment>('/payment/process', { method: 'POST', body: { ...JSON.parse(payload), idempotencyKey: requestKey.current.key } })
      if (row.bookingId !== bookingId || !row.paymentId) throw new Error('Giao dịch trả về không khớp đặt chỗ. Kiểm tra lịch sử trước khi gửi lại.')
      query.retry(); onChanged(); setAmount(''); requestKey.current = null
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa tạo được giao dịch. Kiểm tra lịch sử trước khi gửi lại.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function confirm() {
    if (!pending || lock.current || !canWrite || !reference.trim()) return
    lock.current = true; setBusy(true); setError('')
    try {
      const row = await apiRequest<Payment>(`/payment/${encodeURIComponent(pending.paymentId)}/confirm`, { method: 'POST', body: { confirmedAmount: pending.requestedAmount, processorReference: reference.trim() } })
      if (row.paymentId !== pending.paymentId || row.status !== 'Confirmed') throw new Error('Chưa xác nhận được trạng thái giao dịch. Tải lại lịch sử.')
      setPending(null); setReference(''); query.retry(); onChanged()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa xác nhận được giao dịch.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Thu tiền & lịch sử giao dịch" subtitle="Khoản thu được ghi nhận riêng với lịch thanh toán của hợp đồng.">
    {canRead && <><BookingReadState {...query} />{query.data && <DataTable label="Lịch sử thanh toán" headers={['Phương thức', 'Yêu cầu', 'Đã thu', 'Trạng thái', 'Chứng từ', '']}>
      {query.data.map(row => <tr key={row.paymentId}><td>{row.paymentMethod === 'Cash' ? 'Tiền mặt' : 'Sandbox'}</td><td>{bookingMoney(row.requestedAmount, row.currency)}</td><td>{row.confirmedAmount == null ? '—' : bookingMoney(row.confirmedAmount, row.currency)}</td><td>{row.status}</td><td>{row.internalReceiptReference || row.processorReference || '—'}</td><td>{canWrite && row.status === 'Pending' && <Button tone="secondary" disabled={busy} onClick={() => { setPending(row); setReference(''); setError('') }}>Xác nhận đã thu</Button>}</td></tr>)}
    </DataTable>}{query.data?.length === 0 && <p>Chưa có giao dịch thanh toán.</p>}</>}
    {error && !pending && <Notice title="Chưa ghi nhận được" tone="error">{error}</Notice>}
    {canWrite && <form onSubmit={create} className={styles.stack}><Field htmlFor="payment-amount" label={`Số tiền cần thu (${currency})`}><input id="payment-amount" type="number" min="0.01" step="0.01" required disabled={busy} value={amount} onChange={event => setAmount(event.target.value)} /></Field><Field htmlFor="payment-method" label="Phương thức"><select id="payment-method" disabled={busy} value={method} onChange={event => setMethod(event.target.value)}><option value="Cash">Tiền mặt tại quầy</option><option value="GatewaySandbox">GatewaySandbox (mô phỏng)</option></select></Field><Button type="submit" disabled={busy || !currency}>Tạo giao dịch chờ thu</Button></form>}
    <p>Chỉ xác nhận sau khi đối chiếu chứng từ. Trạng thái từng kỳ và booking được hiển thị theo dữ liệu máy chủ; ghi nhận tiền không thay thế việc chấp nhận hợp đồng.</p>
    {pending && <Modal title="Xác nhận khoản đã thu" busy={busy} onClose={() => setPending(null)}><p>{bookingMoney(pending.requestedAmount, pending.currency)} · {pending.paymentMethod}</p><Field htmlFor="payment-reference" label="Mã biên nhận / tham chiếu giao dịch"><input id="payment-reference" value={reference} disabled={busy} onChange={event => setReference(event.target.value)} /></Field>{error && <Notice title="Chưa xác nhận được" tone="error">{error}</Notice>}<Button disabled={busy || !reference.trim()} onClick={() => void confirm()}>Xác nhận đã đối chiếu và thu đủ</Button></Modal>}
  </Panel>
}
