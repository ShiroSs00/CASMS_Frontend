import { useCallback, useRef, useState, type FormEvent } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, DataTable, Field, Modal, Notice, Panel } from '@/shared/ui'
import { BookingReadState } from './RealBookingUI'
import { bookingMoney } from '../model/booking-presentation'
import styles from './LiveBooking.module.css'
import { paymentApi, type Payment } from '../api/payment-api'
import {paymentConfirmation,paymentIntent} from '../model/payment-intent'
import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
import { paymentStatusLabels } from '../model/experience-copy'

const paymentStatusLabel = paymentStatusLabels
const paymentStatusTone: Record<Payment['status'], 'warning' | 'success' | 'error' | 'neutral'> = {
  Pending: 'warning',
  Confirmed: 'success',
  Failed: 'error',
  Cancelled: 'neutral',
}

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
  const rows = query.data ?? []
  const confirmedTotal = rows.filter(row => row.status === 'Confirmed').reduce((sum, row) => sum + (row.confirmedAmount ?? 0), 0)
  async function create(event: FormEvent) {
    event.preventDefault()
    if (lock.current || confirmUnknown || intent.storageError || !canWrite || !['USD','VND'].includes(currency) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return
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
  return <Panel title="Thu tiền & lịch sử giao dịch" subtitle="Bước 1: Tạo giao dịch chờ xác nhận. Bước 2: Đối chiếu chứng từ và xác nhận đã thu trên từng dòng.">
    {frozen&&<Notice title="Cần đối chiếu khoản thu trước khi tiếp tục" tone="warning">{intent.storageError?'Không đọc hoặc lưu được mã yêu cầu trên trình duyệt; chưa gửi yêu cầu mới.':confirmUnknown?'Chưa xác định kết quả xác nhận hoặc không lưu được trạng thái. Đối chiếu lịch sử với bộ phận thanh toán trước khi tiếp tục; không gửi lại xác nhận tự động.':'Khoản thu trước chưa rõ kết quả. Chỉ được gửi lại đúng số tiền, tiền tệ, phương thức và mã yêu cầu đã lưu.'}</Notice>}
    {canReconcile&&<div className={styles.formActions}><Button tone="secondary" size="compact" autoWidth onClick={()=>{if(confirmation.clear())setConfirmUnknown(false)}}>Đã đối chiếu giao dịch đã xác nhận</Button></div>}
    {canRead ? <div className={styles.financeToolbar}>
      <div className={styles.financeToolbarStats}>
        <span>Tổng giao dịch: <strong>{rows.length}</strong></span>
        {['USD', 'VND'].includes(currency) && <span>Đã xác nhận thu: <strong>{bookingMoney(confirmedTotal, currency)}</strong></span>}
      </div>
      <Button tone="secondary" size="compact" autoWidth disabled={busy || query.loading} onClick={() => { setPending(null); setError(''); query.retry(); onChanged() }}>Tải lại khoản thu</Button>
    </div> : <Notice title="Chưa có quyền xem khoản thu">Tài khoản cần quyền đọc hoặc báo cáo thanh toán để đối chiếu lịch sử.</Notice>}
    {canWrite && !['USD','VND'].includes(currency) && <Notice title="Cần đối chiếu tiền tệ" tone="warning">Cần xác định đơn vị tiền tệ của đặt chỗ trước khi thu.</Notice>}
    {canRead && <><BookingReadState {...query} />{query.data && (query.data.length > 0 ? <DataTable label="Lịch sử thanh toán" headers={['Phương thức', 'Yêu cầu', 'Đã thu', 'Trạng thái', 'Chứng từ', '']}>
      {query.data.map(row => <tr key={row.paymentId}><td>{row.paymentMethod === 'Cash' ? 'Tiền mặt' : 'Sandbox'}</td><td className={styles.numericCell}>{bookingMoney(row.requestedAmount, row.currency)}</td><td className={styles.numericCell}>{row.confirmedAmount == null ? '—' : bookingMoney(row.confirmedAmount, row.currency)}</td><td><Badge label={paymentStatusLabel[row.status]} tone={paymentStatusTone[row.status]} /></td><td className={styles.monoCode}>{row.internalReceiptReference || row.processorReference || '—'}</td><td>{canWrite && row.status === 'Pending' && <Button tone="primary" size="compact" autoWidth disabled={busy || frozen} onClick={() => { setPending(row); setReference(''); setError('') }}>Xác nhận đã thu</Button>}</td></tr>)}
    </DataTable> : <p className={styles.helper}>Chưa có giao dịch thanh toán nào cho đặt chỗ này.</p>)}</>}
    {error && !pending && <Notice title="Chưa ghi nhận được" tone="error">{error}</Notice>}
    {canWrite && ['USD','VND'].includes(currency) && <div className={styles.financeFormSection}>
      <h3 className={styles.financeSubheading}>Ghi nhận giao dịch mới</h3>
      <form onSubmit={create} className={styles.financePaymentForm}>
        <div className={styles.financePaymentFields}>
          <Field htmlFor="payment-amount" label={`Số tiền yêu cầu thu (${currency})`}><input id="payment-amount" type="number" min={currency === 'VND' ? 1 : 0.01} step={currency === 'VND' ? 1 : 0.01} placeholder={currency === 'VND' ? 'Ví dụ: 5000000' : 'Ví dụ: 150'} required disabled={busy || frozen} value={amount} onChange={event => setAmount(event.target.value)} /></Field>
          <Field htmlFor="payment-method" label="Phương thức"><select id="payment-method" disabled={busy || frozen} value={method} onChange={event => setMethod(event.target.value)}><option value="Cash">Tiền mặt tại quầy</option><option value="GatewaySandbox">GatewaySandbox (mô phỏng)</option></select></Field>
        </div>
        <div className={styles.formActions}><Button type="submit" autoWidth disabled={busy || confirmUnknown || intent.storageError}>{intent.record ? 'Gửi lại đúng yêu cầu thu tiền' : 'Tạo giao dịch chờ xác nhận'}</Button></div>
      </form>
    </div>}
    <p className={styles.helper}>Chỉ xác nhận sau khi đối chiếu chứng từ. Trạng thái từng kỳ và đặt chỗ được hiển thị theo dữ liệu máy chủ; ghi nhận tiền không thay thế việc chấp nhận hợp đồng.</p>
    {pending && <Modal title="Xác nhận khoản đã thu" busy={busy} onClose={() => setPending(null)}>
      <p>Số tiền: <strong>{bookingMoney(pending.requestedAmount, pending.currency)}</strong> · {pending.paymentMethod === 'Cash' ? 'Tiền mặt tại quầy' : 'GatewaySandbox'}</p>
      <Field htmlFor="payment-reference" label="Mã biên nhận / tham chiếu giao dịch"><input id="payment-reference" value={reference} disabled={busy} onChange={event => setReference(event.target.value)} /></Field>
      {error && <Notice title="Chưa xác nhận được" tone="error">{error}</Notice>}
      <div className={styles.formActions}>
        <Button autoWidth disabled={busy || confirmUnknown || !reference.trim()} onClick={() => void confirm()}>Xác nhận đã đối chiếu và thu đủ</Button>
        <Button tone="secondary" autoWidth disabled={busy} onClick={() => setPending(null)}>Hủy</Button>
      </div>
    </Modal>}
  </Panel>
}
