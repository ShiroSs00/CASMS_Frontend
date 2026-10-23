import { useRef, useState, type FormEvent } from 'react'
import { ApiError, apiRequest } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Field, Modal, Notice, Panel } from '@/shared/ui'
import { decodeBookingDetail, type BookingDetail } from '../api/real-booking-api'
import { bookingMoney } from '../model/booking-presentation'
import styles from '../components/LiveBooking.module.css'

type Checkin = { checkinStatus: string; boardingBlockReason?: string | null }
export function CheckinDesk() {
  const access = useSessionAccess(), lock = useRef(false)
  const [reference, setReference] = useState(''), [email, setEmail] = useState(''), [booking, setBooking] = useState<BookingDetail | null>(null)
  const [selected, setSelected] = useState(''), [result, setResult] = useState<Checkin | null>(null), [action, setAction] = useState<'start' | 'complete' | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [canStart, setCanStart] = useState(false)
  async function lookup(e: FormEvent) {
    e.preventDefault()
    if (lock.current || !reference.trim() || !email.trim()) return
    lock.current = true; setBusy(true); setError(''); setBooking(null); setSelected(''); setResult(null); setCanStart(false)
    try { setBooking(decodeBookingDetail(await apiRequest<unknown>('/booking/lookup', { query: { reference: reference.trim(), email: email.trim() } }))) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa tra cứu được đặt chỗ.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function status(id: string) {
    if (lock.current || !access.has('CHECKIN_READ')) return
    lock.current = true; setBusy(true); setSelected(id); setResult(null); setError(''); setCanStart(false)
    try { setResult(await apiRequest<Checkin>(`/checkin/passenger/${encodeURIComponent(id)}/status`)) }
    catch (reason) { if (reason instanceof ApiError && reason.status === 404) setCanStart(true); else setError(reason instanceof Error ? reason.message : 'Chưa đọc được trạng thái check-in.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function submit() {
    if (!action || !selected || lock.current || booking?.bookingStatus !== 'Confirmed' || !access.has(action === 'start' ? 'CHECKIN_CREATE' : 'CHECKIN_UPDATE')) return
    lock.current = true; setBusy(true); setError('')
    try {
      const row = await apiRequest<Checkin>(`/checkin/passenger/${encodeURIComponent(selected)}/${action}`, { method: 'POST' })
      if (row.checkinStatus !== (action === 'start' ? 'InProgress' : 'BoardingReady')) throw new Error('Chưa xác nhận được kết quả. Hãy đọc lại trạng thái trước khi gửi lại.')
      setResult(row); setAction(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa cập nhật được check-in.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <>
    <Panel title="Tra cứu hành khách tại quầy"><form onSubmit={lookup} className={styles.stack}><Field htmlFor="desk-reference" label="Mã đặt chỗ"><input id="desk-reference" required disabled={busy} value={reference} onChange={e => setReference(e.target.value)} /></Field><Field htmlFor="desk-email" label="Email người đại diện"><input id="desk-email" required type="email" disabled={busy} value={email} onChange={e => setEmail(e.target.value)} /></Field><Button type="submit" disabled={busy}>Tra cứu đặt chỗ</Button></form></Panel>
    {error && <Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}
    {booking && <Panel title={`${booking.bookingReference} · ${booking.bookingStatus}`}><p>{booking.cruiseName} · {bookingMoney(booking.agreedFareAmount, booking.currency)}</p>{booking.bookingStatus !== 'Confirmed' && <Notice title="Đặt chỗ chưa được xác nhận" tone="warning">Hoàn tất hợp đồng và thanh toán trước khi làm thủ tục.</Notice>}
      <DataTable label="Hành khách làm thủ tục" headers={['Khách', 'Cabin', 'Thao tác']}>{booking.passengers.map(p => <tr key={p.bookingPassengerId}><td>{p.fullName}</td><td>{p.cabinNumber || '—'}</td><td><Button tone="secondary" disabled={busy || !access.has('CHECKIN_READ')} onClick={() => void status(p.bookingPassengerId)}>Chọn / xem trạng thái</Button></td></tr>)}</DataTable>
      {selected && <><p>Hành khách: {booking.passengers.find(p => p.bookingPassengerId === selected)?.fullName} · {result?.checkinStatus ?? 'Chưa đọc được hồ sơ check-in'}</p>{result?.boardingBlockReason && <Notice title="Điều kiện còn thiếu" tone="warning">{result.boardingBlockReason}</Notice>}{access.has('CHECKIN_CREATE') && canStart && !result && <Button disabled={busy || booking.bookingStatus !== 'Confirmed'} onClick={() => setAction('start')}>Bắt đầu check-in</Button>}{access.has('CHECKIN_UPDATE') && result?.checkinStatus === 'InProgress' && <Button disabled={busy || booking.bookingStatus !== 'Confirmed'} onClick={() => setAction('complete')}>Xác nhận hoàn tất kiểm tra</Button>}</>}
    </Panel>}
    <Notice title="Trạng thái lên tàu">BoardingReady là trạng thái sẵn sàng do máy chủ trả về. Chưa có API cấp thẻ, quét QR hoặc ghi nhận khách đã lên tàu.</Notice>
    {action && <Modal title={action === 'start' ? 'Bắt đầu thủ tục' : 'Hoàn tất thủ tục'} busy={busy} onClose={() => setAction(null)}><p>Đối chiếu hành khách, hợp đồng, chứng từ và yêu cầu an toàn tại quầy trước khi xác nhận.</p>{error && <Notice title="Chưa cập nhật được" tone="error">{error}</Notice>}<Button disabled={busy} onClick={() => void submit()}>Xác nhận</Button></Modal>}
  </>
}
