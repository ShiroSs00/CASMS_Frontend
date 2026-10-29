import { useCallback, useRef, useState, type FormEvent } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Field, Modal, Notice, Panel } from '@/shared/ui'
import { BookingReadState } from './RealBookingUI'
import { bookingMoney } from '../model/booking-presentation'
import styles from './LiveBooking.module.css'
import { paymentApi, type Payment } from '../api/payment-api'
import {paymentConfirmation,paymentIntent} from '../model/payment-intent'
import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'

const paymentStatusLabel: Record<Payment['status'], string> = { Pending: 'Chờ xác nhận', Confirmed: 'Đã xác nhận khoản thu', Failed: 'Giao dịch lỗi', Cancelled: 'Đã hủy' }

export function PaymentLedger({ bookingId, currency, onChanged }: { bookingId: string; currency: string; onChanged: () => void }) {
  const access=useSessionAccess()
  return <PaymentLedgerContent key={access.userId+':'+bookingId} bookingId={bookingId} currency={currency} onChanged={onChanged}/>
}
function PaymentLedgerContent({ bookingId, currency, onChanged }: { bookingId: string; currency: string; onChanged: () => void }) {
  const access = useSessionAccess()
  const canRead = access.canDo('PAYMENT_READ') || access.canDo('PAYMENT_REPORT'), canWrite = access.canDo('PAYMENT_PROCESS')
  const query = useReadQuery(`payments:${access.userId}:${bookingId}:${canRead}`, useCallback(signal => canRead ? paymentApi.list(bookingId, signal) : Promise.resolve([]), [canRead, bookingId]))
  const [intent]=useState(()=>paymentIntent(access.userId??'',bookingId,{getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value)}))
  const [amount, setAmount] = useState(()=>intent.record?String(intent.record.payload.requestedAmount):''), [method, setMethod] = useState(()=>intent.record?.payload.paymentMethod??'Cash'), [reference, setReference] = useState('')
  const [pending, setPending] = useState<Payment | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  const [confirmation]=useState(()=>paymentConfirmation(access.userId??'',bookingId,{getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value)}))
  const [confirmUnknown,setConfirmUnknown]=useState(()=>Boolean(confirmation.pending)||confirmation.storageError)
  const canReconcile=Boolean(confirmUnknown&&!query.loading&&!query.error&&confirmation.pending&&query.data?.some(row=>row.paymentId===confirmation.pending&&row.status==='Confirmed'))
  const frozen=Boolean(intent.record)||intent.storageError||confirmUnknown
  async function create(event: FormEvent) {
    event.preventDefault()
    if (lock.current || confirmUnknown || intent.storageError || !canWrite || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return
    lock.current = true; setBusy(true); setError('')
    try {
      await intent.execute({ bookingId, requestedAmount: Number(amount), currency, paymentMethod: method },paymentApi.create)
      query.retry(); onChanged(); setAmount('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa tạo được giao dịch. Kiểm tra lịch sử trước khi gửi lại.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function confirm() {
    if (!pending || lock.current || confirmUnknown || intent.record || intent.storageError || !canWrite || !reference.trim()) return
    if (!confirmation.begin(pending.paymentId)) { setConfirmUnknown(true); setError('Không lưu được trạng thái xác nhận. Đối chiếu lịch sử trước khi tiếp tục.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      await paymentApi.confirm(pending, reference)
      if (!confirmation.clear()) setConfirmUnknown(true)
      setPending(null); setReference(''); query.retry(); onChanged()
    } catch (reason) { if(mutationOutcomeUnknown(reason)||!confirmation.clear())setConfirmUnknown(true);setError(reason instanceof Error ? reason.message : 'Chưa xác nhận được giao dịch.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Thu tiền & lịch sử giao dịch" subtitle="Khoản thu được ghi nhận riêng với lịch thanh toán của hợp đồng.">
    {frozen&&<Notice title="Cần đối chiếu khoản thu trước khi tiếp tục" tone="warning">{intent.storageError?'Không đọc hoặc lưu được mã yêu cầu trên trình duyệt; chưa gửi yêu cầu mới.':confirmUnknown?'Chưa xác định kết quả xác nhận hoặc không lưu được trạng thái. Đối chiếu lịch sử với bộ phận thanh toán trước khi tiếp tục; không gửi lại xác nhận tự động.':'Khoản thu trước chưa rõ kết quả. Chỉ được gửi lại đúng số tiền, tiền tệ, phương thức và mã yêu cầu đã lưu.'}</Notice>}
    {canReconcile&&<Button tone="secondary" onClick={()=>{if(confirmation.clear())setConfirmUnknown(false)}}>Đã đối chiếu giao dịch đã xác nhận</Button>}
    {canRead ? <Button tone="secondary" disabled={busy || query.loading} onClick={() => { setPending(null); setError(''); query.retry(); onChanged() }}>Tải lại khoản thu</Button> : <Notice title="Chưa có quyền xem khoản thu">Tài khoản cần quyền đọc hoặc báo cáo thanh toán để đối chiếu lịch sử.</Notice>}
    {canWrite && !currency && <Notice title="Chưa xác định được tiền tệ" tone="warning">Chọn đặt chỗ có thông tin tiền tệ hoặc mở được hợp đồng trước khi tạo khoản thu. Các giao dịch có sẵn vẫn được xác nhận theo tiền tệ của từng giao dịch.</Notice>}
    {canRead && <><BookingReadState {...query} />{query.data && <DataTable label="Lịch sử thanh toán" headers={['Phương thức', 'Yêu cầu', 'Đã thu', 'Trạng thái', 'Chứng từ', '']}>
      {query.data.map(row => <tr key={row.paymentId}><td>{row.paymentMethod === 'Cash' ? 'Tiền mặt' : 'Sandbox'}</td><td>{bookingMoney(row.requestedAmount, row.currency)}</td><td>{row.confirmedAmount == null ? '—' : bookingMoney(row.confirmedAmount, row.currency)}</td><td>{paymentStatusLabel[row.status]}</td><td>{row.internalReceiptReference || row.processorReference || '—'}</td><td>{canWrite && row.status === 'Pending' && <Button tone="secondary" disabled={busy || frozen} onClick={() => { setPending(row); setReference(''); setError('') }}>Xác nhận đã thu</Button>}</td></tr>)}
    </DataTable>}{query.data?.length === 0 && <p>Chưa có giao dịch thanh toán.</p>}</>}
    {error && !pending && <Notice title="Chưa ghi nhận được" tone="error">{error}</Notice>}
    {canWrite && currency && <form onSubmit={create} className={styles.stack}><Field htmlFor="payment-amount" label={`Số tiền cần thu (${currency})`}><input id="payment-amount" type="number" min="0.01" step="0.01" required disabled={busy || frozen} value={amount} onChange={event => setAmount(event.target.value)} /></Field><Field htmlFor="payment-method" label="Phương thức"><select id="payment-method" disabled={busy || frozen} value={method} onChange={event => setMethod(event.target.value)}><option value="Cash">Tiền mặt tại quầy</option><option value="GatewaySandbox">GatewaySandbox (mô phỏng)</option></select></Field><Button type="submit" disabled={busy || confirmUnknown || intent.storageError || !currency}>{intent.record ? 'Gửi lại đúng yêu cầu thu tiền' : 'Tạo giao dịch chờ thu'}</Button></form>}
    <p>Chỉ xác nhận sau khi đối chiếu chứng từ. Trạng thái từng kỳ và booking được hiển thị theo dữ liệu máy chủ; ghi nhận tiền không thay thế việc chấp nhận hợp đồng.</p>
    {pending && <Modal title="Xác nhận khoản đã thu" busy={busy} onClose={() => setPending(null)}><p>{bookingMoney(pending.requestedAmount, pending.currency)} · {pending.paymentMethod}</p><Field htmlFor="payment-reference" label="Mã biên nhận / tham chiếu giao dịch"><input id="payment-reference" value={reference} disabled={busy} onChange={event => setReference(event.target.value)} /></Field>{error && <Notice title="Chưa xác nhận được" tone="error">{error}</Notice>}<Button disabled={busy || confirmUnknown || !reference.trim()} onClick={() => void confirm()}>Xác nhận đã đối chiếu và thu đủ</Button></Modal>}
  </Panel>
}
