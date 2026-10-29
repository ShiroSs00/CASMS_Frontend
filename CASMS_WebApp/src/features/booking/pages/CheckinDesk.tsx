import { useRef, useState, type FormEvent } from 'react'
import { ApiError, apiRequest } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Field, Modal, Notice, Panel, ProcessGuide } from '@/shared/ui'
import { decodeBookingDetail, type BookingDetail } from '../api/real-booking-api'
import { bookingMoney } from '../model/booking-presentation'
import styles from '../components/LiveBooking.module.css'

type Checkin = { checkinStatus: string; boardingBlockReason?: string | null }
function decodeCheckin(value: unknown): Checkin {
  if (!value || typeof value !== 'object' || !('checkinStatus' in value) || !['NotStarted', 'InProgress', 'NeedsReview', 'Completed', 'BoardingReady'].includes(String(value.checkinStatus))
    || ('boardingBlockReason' in value && value.boardingBlockReason != null && typeof value.boardingBlockReason !== 'string')) throw new Error('Chưa đọc được hồ sơ check-in hợp lệ. Tải lại trạng thái trước khi thao tác tiếp.')
  const row = value as Checkin
  return { checkinStatus: row.checkinStatus, boardingBlockReason: row.boardingBlockReason }
}
export function CheckinDesk() {
  const access = useSessionAccess(), lock = useRef(false)
  const [reference, setReference] = useState(''), [email, setEmail] = useState(''), [booking, setBooking] = useState<BookingDetail | null>(null)
  const [selected, setSelected] = useState(''), [result, setResult] = useState<Checkin | null>(null), [action, setAction] = useState<'start' | 'complete' | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [canStart, setCanStart] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  async function lookup(e: FormEvent) {
    e.preventDefault()
    if (lock.current || !reference.trim() || !email.trim()) return
    lock.current = true; setBusy(true); setError(''); setBooking(null); setSelected(''); setResult(null); setCanStart(false)
    try { setBooking(decodeBookingDetail(await apiRequest<unknown>('/booking/lookup', { query: { reference: reference.trim(), email: email.trim() } }))) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa tra cứu được đặt chỗ.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function status(id: string) {
    if (lock.current || !access.canDo('CHECKIN_READ') || !booking?.passengers.some(p => p.bookingPassengerId === id && p.participationStatus === 'Active')) return
    lock.current = true; setBusy(true); setSelected(id); setResult(null); setError(''); setCanStart(false)
    try { const row = decodeCheckin(await apiRequest<unknown>(`/checkin/passenger/${encodeURIComponent(id)}/status`)); setResult(row); setCanStart(row.checkinStatus === 'NotStarted'); setUncertain(false) }
    catch (reason) { if (reason instanceof ApiError && reason.status === 404) { setCanStart(true); setUncertain(false) } else setError(reason instanceof Error ? reason.message : 'Chưa đọc được trạng thái check-in.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function submit() {
    if (!action || !selected || lock.current || uncertain || booking?.bookingStatus !== 'Confirmed' || !booking.passengers.some(p => p.bookingPassengerId === selected && p.participationStatus === 'Active') || !access.canDo(action === 'start' ? 'CHECKIN_CREATE' : 'CHECKIN_UPDATE')) return
    lock.current = true; setBusy(true); setError('')
    try {
      const row = decodeCheckin(await apiRequest<unknown>(`/checkin/passenger/${encodeURIComponent(selected)}/${action}`, { method: 'POST' }))
      if (row.checkinStatus !== (action === 'start' ? 'InProgress' : 'BoardingReady')) throw new Error('Chưa xác nhận được kết quả. Hãy đọc lại trạng thái trước khi gửi lại.')
      setResult(row); setCanStart(false); setAction(null)
    } catch (reason) { setUncertain(true); setAction(null); setError(reason instanceof Error ? reason.message : 'Chưa cập nhật được check-in.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <>
    <ProcessGuide label="Tiếp nhận hành khách" steps={[{title:"Tra cứu đặt chỗ",description:"Dùng mã đặt chỗ và email người đại diện."},{title:"Đối chiếu hồ sơ",description:"Chọn hành khách và kiểm tra thông tin tại quầy."},{title:"Kiểm tra trạng thái",description:"Đọc trạng thái mới nhất trước khi xác nhận thủ tục."}]} />
    <div className={styles.checkinDesk}><aside className={styles.checkinSearch}><Panel title="Tra cứu hành khách tại quầy"><form onSubmit={lookup} className={styles.deskLookup}><Field htmlFor="desk-reference" label="Mã đặt chỗ"><input id="desk-reference" required disabled={busy} value={reference} onChange={e => setReference(e.target.value)} /></Field><Field htmlFor="desk-email" label="Email người đại diện"><input id="desk-email" required type="email" disabled={busy} value={email} onChange={e => setEmail(e.target.value)} /></Field><Button type="submit" disabled={busy}>Tra cứu đặt chỗ</Button></form></Panel></aside><div className={styles.checkinRecords}>
    {error && <Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}
    {selected && access.canDo('CHECKIN_READ') && <Button tone="secondary" disabled={busy} onClick={() => void status(selected)}>Tải lại trạng thái hành khách</Button>}
    {uncertain && <Notice title="Cần đối chiếu hồ sơ check-in" tone="warning">Tải lại trạng thái hành khách để kiểm tra kết quả trước khi tiếp tục.</Notice>}
    {booking && <Panel title={`${booking.bookingReference} · ${booking.bookingStatus}`}><p>{booking.cruiseName} · {bookingMoney(booking.agreedFareAmount, booking.currency)}</p>{booking.bookingStatus !== 'Confirmed' && <Notice title="Đặt chỗ chưa được xác nhận" tone="warning">Hoàn tất hợp đồng và thanh toán trước khi làm thủ tục.</Notice>}
      <DataTable label="Hành khách làm thủ tục" headers={['Khách', 'Cabin', 'Thao tác']}>{booking.passengers.map(p => <tr key={p.bookingPassengerId}><td>{p.fullName}</td><td>{p.cabinNumber || '—'}</td><td>{access.canDo('CHECKIN_READ') && <Button tone="secondary" disabled={busy || p.participationStatus !== 'Active'} onClick={() => void status(p.bookingPassengerId)}>Chọn / xem trạng thái</Button>}</td></tr>)}</DataTable>
      {selected && <><p>Hành khách: {booking.passengers.find(p => p.bookingPassengerId === selected)?.fullName} · {result?.checkinStatus ?? 'Chưa đọc được hồ sơ check-in'}</p>{result?.boardingBlockReason && <Notice title="Điều kiện còn thiếu" tone="warning">{result.boardingBlockReason}</Notice>}{access.canDo('CHECKIN_CREATE') && canStart && (!result || result.checkinStatus === 'NotStarted') && <Button disabled={busy || uncertain || booking.bookingStatus !== 'Confirmed'} onClick={() => setAction('start')}>Bắt đầu check-in</Button>}{access.canDo('CHECKIN_UPDATE') && result?.checkinStatus === 'InProgress' && <Button disabled={busy || uncertain || booking.bookingStatus !== 'Confirmed'} onClick={() => setAction('complete')}>Xác nhận hoàn tất kiểm tra</Button>}</>}
    </Panel>}
    {!booking && !busy && !error && <Panel title="Hồ sơ hành khách"><Empty title="Chưa chọn hành khách"><p>Tra cứu bằng mã đặt chỗ và email người đại diện để mở danh sách hành khách.</p></Empty></Panel>}
    <Notice title="Trạng thái lên tàu">Trạng thái sẵn sàng lên tàu được xác nhận bởi hệ thống. Cấp thẻ, quét QR và ghi nhận khách đã lên tàu chưa khả dụng trên webapp.</Notice>
    </div></div>
    {action && <Modal title={action === 'start' ? 'Bắt đầu thủ tục' : 'Hoàn tất thủ tục'} busy={busy} onClose={() => setAction(null)}><p>Đối chiếu hành khách, hợp đồng, chứng từ và yêu cầu an toàn tại quầy trước khi xác nhận.</p>{error && <Notice title="Chưa cập nhật được" tone="error">{error}</Notice>}<Button disabled={busy} onClick={() => void submit()}>{action === 'start' ? 'Bắt đầu thủ tục' : 'Hoàn tất thủ tục'}</Button></Modal>}
  </>
}
