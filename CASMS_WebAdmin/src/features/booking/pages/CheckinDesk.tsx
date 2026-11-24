import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiRequest } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Field, Modal, Notice, Panel } from '@/shared/ui'
import { checkinLabels } from '@/domain/cruise-manifest'
import { decodeBookingDetail, type BookingDetail } from '../api/real-booking-api'
import styles from '../components/LiveBooking.module.css'

type Checkin = { checkinStatus: string; boardingBlockReason?: string | null }
function decodeCheckin(value: unknown): Checkin {
  if (!value || typeof value !== 'object' || !('checkinStatus' in value) || !['NotStarted', 'InProgress', 'NeedsReview', 'Completed', 'BoardingReady'].includes(String(value.checkinStatus))
    || ('boardingBlockReason' in value && value.boardingBlockReason != null && typeof value.boardingBlockReason !== 'string')) throw new Error('Chưa đọc được hồ sơ check-in hợp lệ. Tải lại trạng thái trước khi thao tác tiếp.')
  const row = value as Checkin
  return { checkinStatus: row.checkinStatus, boardingBlockReason: row.boardingBlockReason }
}

/** Shared by the existing lookup desk and the Departure manifest. Backend validates every transition. */
export function PassengerCheckinActions({ passengerId, fullName, bookingStatus, onChanged }: { passengerId:string; fullName:string; bookingStatus:string; onChanged?:()=>void }) {
  const access=useSessionAccess(),lock=useRef(false)
  const [result,setResult]=useState<Checkin|null>(null),[action,setAction]=useState<'start'|'complete'|null>(null)
  const [emergencyName,setEmergencyName]=useState(''),[emergencyPhone,setEmergencyPhone]=useState('')
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[canStart,setCanStart]=useState(false),[uncertain,setUncertain]=useState(false)
  async function status() {
    if(lock.current||!access.canDo('CHECKIN_READ'))return
    lock.current=true;setBusy(true);setError('');setCanStart(false);setResult(null)
    try { const row=decodeCheckin(await apiRequest(`/checkin/passenger/${encodeURIComponent(passengerId)}/status`));setResult(row);setCanStart(row.checkinStatus==='NotStarted');setUncertain(false) }
    catch(reason) { if(reason instanceof ApiError&&reason.status===404){setCanStart(true);setUncertain(false)}else setError(reason instanceof Error?reason.message:'Chưa đọc được trạng thái check-in.') }
    finally {lock.current=false;setBusy(false)}
  }
  useEffect(() => {
    void status()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passengerId])
  async function submit() {
    if(!action||lock.current||uncertain||bookingStatus!=='Confirmed'||!access.canDo(action==='start'?'CHECKIN_CREATE':'CHECKIN_UPDATE'))return
    if(action==='start'&&(!emergencyName.trim()||!emergencyPhone.trim())){setError('Vui lòng nhập đầy đủ tên và số điện thoại người liên hệ khẩn cấp.');return}
    lock.current=true;setBusy(true);setError('')
    try {
      const query=action==='start'?{emergencyContactName:emergencyName.trim(),emergencyContactPhone:emergencyPhone.trim()}:undefined
      const row=decodeCheckin(await apiRequest(`/checkin/passenger/${encodeURIComponent(passengerId)}/${action}`,{method:'POST',query}))
      if(row.checkinStatus!==(action==='start'?'InProgress':'BoardingReady'))throw new Error('Chưa xác nhận được kết quả. Hãy đọc lại trạng thái trước khi gửi lại.')
      setResult(row);setCanStart(false);setAction(null);setEmergencyName('');setEmergencyPhone('');onChanged?.()
    } catch(reason) {setUncertain(true);setAction(null);setError(reason instanceof Error?reason.message:'Chưa cập nhật được check-in.')}
    finally {lock.current=false;setBusy(false)}
  }
  return <Panel title={`Check-in · ${fullName}`}>
    {bookingStatus!=='Confirmed'&&<Notice title="Đặt chỗ chưa được xác nhận" tone="warning">Chỉ đặt chỗ đã xác nhận mới được làm thủ tục.</Notice>}
    {access.canDo('CHECKIN_READ')?<Button tone="secondary" disabled={busy} onClick={()=>void status()}>Đọc lại trạng thái hành khách</Button>:<Notice title="Chưa có quyền đọc hồ sơ Check-in">Không thể xác nhận trạng thái thủ tục khi chưa có quyền đọc hồ sơ.</Notice>}
    <p>{result?checkinLabels[result.checkinStatus]:canStart?'Chưa bắt đầu Check-in':'Đang đọc trạng thái thủ tục…'}</p>
    {result?.boardingBlockReason&&<Notice title="Điều kiện còn thiếu" tone="warning">{result.boardingBlockReason}</Notice>}
    {error&&<Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}
    {uncertain&&<Notice title="Cần đối chiếu hồ sơ Check-in" tone="warning">Đọc lại trạng thái hành khách trước khi tiếp tục; chưa gửi lại thao tác.</Notice>}
    {access.canDo('CHECKIN_CREATE')&&canStart&&<Button disabled={busy||uncertain||bookingStatus!=='Confirmed'} onClick={()=>{setError('');setAction('start')}}>Bắt đầu Check-in</Button>}
    {access.canDo('CHECKIN_UPDATE')&&result?.checkinStatus==='InProgress'&&<Button disabled={busy||uncertain||bookingStatus!=='Confirmed'} onClick={()=>{setError('');setAction('complete')}}>Xác nhận hoàn tất kiểm tra</Button>}
    {action&&<Modal quiet title={action==='start'?'Bắt đầu Check-in':'Hoàn tất kiểm tra'} description={fullName} busy={busy}
      onClose={()=>setAction(null)}
      footer={<><Button tone="secondary" autoWidth data-overlay-dismiss onClick={()=>setAction(null)}>Quay lại</Button><Button autoWidth disabled={uncertain||(action==='start'&&(!emergencyName.trim()||!emergencyPhone.trim()))} busy={busy} onClick={()=>void submit()}>Xác nhận</Button></>}>
      <p>Đối chiếu hành khách, hợp đồng, chứng từ và yêu cầu an toàn tại quầy trước khi xác nhận.</p>
      {action==='start'&&<div className={styles.deskLookup}>
        <Field htmlFor="checkin-emergency-name" label="Tên người liên hệ khẩn cấp *"><input id="checkin-emergency-name" required disabled={busy} value={emergencyName} onChange={e=>setEmergencyName(e.target.value)} placeholder="Ví dụ: Lê Văn B"/></Field>
        <Field htmlFor="checkin-emergency-phone" label="Số điện thoại liên hệ khẩn cấp *"><input id="checkin-emergency-phone" required disabled={busy} value={emergencyPhone} onChange={e=>setEmergencyPhone(e.target.value)} placeholder="Ví dụ: 0901112223"/></Field>
      </div>}
      {error&&<Notice title="Chưa cập nhật được" tone="error">{error}</Notice>}
    </Modal>}
  </Panel>
}

/** Retained lookup entry point; the Check-in navigation now opens a Departure manifest first. */
export function CheckinDesk() {
  const access=useSessionAccess(),lock=useRef(false)
  const [reference,setReference]=useState(''),[email,setEmail]=useState(''),[booking,setBooking]=useState<BookingDetail|null>(null),[selected,setSelected]=useState('')
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  async function lookup(event:FormEvent) {
    event.preventDefault();if(lock.current||!reference.trim()||!email.trim())return
    lock.current=true;setBusy(true);setError('');setBooking(null);setSelected('')
    try {setBooking(decodeBookingDetail(await apiRequest('/booking/lookup',{query:{reference:reference.trim(),email:email.trim()}})))}
    catch(reason){setError(reason instanceof Error?reason.message:'Chưa tra cứu được đặt chỗ.')}
    finally{lock.current=false;setBusy(false)}
  }
  const passenger=booking?.passengers.find(p=>p.bookingPassengerId===selected&&p.participationStatus==='Active')
  return <div className={styles.checkinDesk}><aside className={styles.checkinSearch}><Panel title="Tra cứu tại quầy"><form onSubmit={lookup} className={styles.deskLookup}><Field htmlFor="desk-reference" label="Mã đặt chỗ"><input id="desk-reference" required disabled={busy} value={reference} onChange={e=>setReference(e.target.value)}/></Field><Field htmlFor="desk-email" label="Email người đại diện"><input id="desk-email" required type="email" disabled={busy} value={email} onChange={e=>setEmail(e.target.value)}/></Field><Button type="submit" disabled={busy}>Tra cứu đặt chỗ</Button></form></Panel></aside><div className={styles.checkinRecords}>
    {error&&<Notice title="Chưa tra cứu được" tone="error">{error}</Notice>}
    {booking&&<Panel title={booking.bookingReference}><p>{booking.cruiseName}</p><DataTable label="Hành khách làm thủ tục" headers={['Hành khách','Cabin','Thao tác']}>{booking.passengers.map(p=><tr key={p.bookingPassengerId}><td>{p.fullName}</td><td>{p.cabinNumber||'Chưa phân Cabin'}</td><td>{access.canDo('CHECKIN_READ')&&<Button tone="secondary" disabled={busy||p.participationStatus!=='Active'} onClick={()=>setSelected(p.bookingPassengerId)}>Xem thủ tục</Button>}</td></tr>)}</DataTable></Panel>}
    {passenger&&booking&&<PassengerCheckinActions key={passenger.bookingPassengerId} passengerId={passenger.bookingPassengerId} fullName={passenger.fullName} bookingStatus={booking.bookingStatus}/>}
    {!booking&&!busy&&!error&&<Empty title="Chưa chọn hành khách"/>}
  </div></div>
}
