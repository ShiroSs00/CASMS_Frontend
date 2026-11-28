import { useEffect, useRef, useState, type FormEvent } from 'react'
import { apiRequest } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Field, Loading, Modal, Notice, Panel, RecordFacts } from '@/shared/ui'
import { checkinLabels } from '@/domain/cruise-manifest'
import { decodeBookingDetail, type BookingDetail } from '../api/real-booking-api'
import styles from '../components/LiveBooking.module.css'
import { checkinApi, checkinFailureMessage, type CheckinRecord } from '../api/checkin-api'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'
import { bookingWhen } from '../model/real-booking-view'

const CHECKIN_COUNTRY_CODES = [
  ['+84', 'Việt Nam (+84)'],
  ['+1', 'Hoa Kỳ / Canada (+1)'],
  ['+65', 'Singapore (+65)'],
  ['+81', 'Nhật Bản (+81)'],
  ['+82', 'Hàn Quốc (+82)'],
  ['+44', 'Vương quốc Anh (+44)'],
  ['+61', 'Úc (+61)'],
  ['+33', 'Pháp (+33)'],
  ['+49', 'Đức (+49)'],
  ['+66', 'Thái Lan (+66)'],
  ['+60', 'Malaysia (+60)'],
] as const

function normalizeCheckinPhoneE164(countryCode: string, rawInput: string): string {
  const cleaned = rawInput.trim().replace(/[\s\-().]+/g, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2)
  return `${countryCode}${cleaned.startsWith('0') ? cleaned.slice(1) : cleaned}`
}

/** Shared by the existing lookup desk and the Departure manifest. Backend validates every transition. */
type PassengerCheckinProps = { passengerId:string; fullName:string; bookingStatus:string; initialStatus?:string|null; onChanged?:()=>void }
export function PassengerCheckinActions(props: PassengerCheckinProps) {
  const access = useSessionAccess()
  return <PassengerCheckinContent key={`${access.userId}:${props.passengerId}:${access.canDo('CHECKIN_READ')}`} {...props} />
}
function PassengerCheckinContent({ passengerId, fullName, bookingStatus, initialStatus, onChanged }: PassengerCheckinProps) {
  const access=useSessionAccess(),lock=useRef(false)
  const canRead = access.canDo('CHECKIN_READ'), actorId = access.userId
  const [result,setResult]=useState<CheckinRecord|null>(null),[action,setAction]=useState<'start'|'complete'|null>(null)
  const [emergencyName,setEmergencyName]=useState(''),[phoneCountryCode,setPhoneCountryCode]=useState('+84'),[emergencyPhone,setEmergencyPhone]=useState(''),[phoneError,setPhoneError]=useState('')
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[canStart,setCanStart]=useState(false),[uncertain,setUncertain]=useState(false)
  const [reading, setReading] = useState(canRead)
  function openContact() {
    setEmergencyName(result?.emergencyContactName ?? emergencyName)
    setEmergencyPhone(result?.emergencyContactPhone ?? emergencyPhone)
    setPhoneError(''); setError(''); setAction('start')
  }
  async function status() {
    if(lock.current||!canRead)return
    lock.current=true;setBusy(true);setReading(true);setError('');setCanStart(false);setResult(null)
    try { const row=await checkinApi.status(passengerId);setResult(row);setCanStart(!row || row.checkinStatus==='NotStarted');setUncertain(false);setAction(null) }
    catch(reason) { setError(reason instanceof Error?reason.message:'Chưa đọc được trạng thái check-in.') }
    finally {lock.current=false;setBusy(false);setReading(false)}
  }
  useEffect(() => {
    if (!canRead) return
    let active = true
    const controller = new AbortController()
    void checkinApi.status(passengerId, controller.signal)
      .then(data => {
        if (!active) return
        setResult(data)
        setCanStart(!data || data.checkinStatus === 'NotStarted')
        setUncertain(false)
        setError('')
      })
      .catch(reason => {
        if (!active) return
        setResult(null)
        setCanStart(false)
        setError(reason instanceof Error ? reason.message : 'Chưa đọc được trạng thái check-in.')
      })
      .finally(() => { if (active) setReading(false) })
    return () => { active = false; controller.abort() }
  }, [passengerId, canRead, actorId, initialStatus])
  async function submit() {
    if(!action||lock.current||uncertain||bookingStatus!=='Confirmed'||!access.canDo(action==='start'?'CHECKIN_CREATE':'CHECKIN_UPDATE'))return
    let normalizedPhone=''
    if(action==='start'){
      if(!emergencyName.trim()||!emergencyPhone.trim()){setError('Vui lòng nhập đầy đủ tên và số điện thoại người liên hệ khẩn cấp.');return}
      normalizedPhone=normalizeCheckinPhoneE164(phoneCountryCode,emergencyPhone)
      if(!/^\+[1-9]\d{6,14}$/.test(normalizedPhone)){
        setPhoneError('Kiểm tra mã quốc gia và số điện thoại (7–15 chữ số). Ví dụ: +84912345678.')
        return
      }
      setPhoneError('')
    }
    lock.current=true;setBusy(true);setError('')
    try {
      const row=action==='start' ? await checkinApi.start(passengerId,emergencyName,normalizedPhone) : await checkinApi.complete(passengerId)
      if(action==='start' ? !['InProgress','BoardingReady'].includes(row.checkinStatus) : row.checkinStatus!=='BoardingReady')throw new Error('Chưa xác nhận được kết quả. Hãy đọc lại trạng thái trước khi gửi lại.')
      setResult(row);setCanStart(false);setAction(null);setEmergencyName('');setEmergencyPhone('');setPhoneError('');onChanged?.()
    } catch(reason) {setUncertain(mutationOutcomeUnknown(reason));setError(checkinFailureMessage(reason))}
    finally {lock.current=false;setBusy(false)}
  }
  return <Panel title={`Check-in · ${fullName}`}>
    {bookingStatus!=='Confirmed'&&<Notice title="Đặt chỗ chưa được xác nhận" tone="warning">Chỉ đặt chỗ đã xác nhận mới được làm thủ tục.</Notice>}
    {!access.canDo('CHECKIN_READ') && <Notice title="Chưa có quyền đọc hồ sơ Check-in">Không thể xác nhận trạng thái thủ tục khi chưa có quyền đọc hồ sơ.</Notice>}
    {access.canDo('CHECKIN_READ') && (uncertain || Boolean(error)) && <Button tone="secondary" disabled={busy} onClick={()=>void status()}>Đọc lại trạng thái hành khách</Button>}
    {reading ? <Loading label="Đang đọc trạng thái thủ tục…" /> : result ? <RecordFacts entries={[
      ['Thủ tục hành khách', checkinLabels[result.checkinStatus]],
      ...(result.startedAt ? [['Bắt đầu lúc', bookingWhen(result.startedAt)]] as const : []),
      ...(result.completedAt ? [['Hoàn tất thủ tục', bookingWhen(result.completedAt)]] as const : []),
      ...(result.boardingReadyAt ? [['Đủ điều kiện lên tàu từ', bookingWhen(result.boardingReadyAt)]] as const : []),
    ]} /> : canStart ? <p>Chưa bắt đầu làm thủ tục.</p> : null}
    {result?.checkinStatus === 'BoardingReady' && <p className={styles.helper}>Hành khách đã đủ điều kiện lên tàu theo lần kiểm tra này. Đây chưa phải xác nhận hành khách đã lên tàu.</p>}
    {result?.boardingBlockReason&&<Notice title="Điều kiện còn thiếu" tone="warning">{result.boardingBlockReason}</Notice>}
    {error&&<Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}
    {uncertain&&<Notice title="Cần đối chiếu hồ sơ Check-in" tone="warning">Đọc lại trạng thái hành khách trước khi tiếp tục; chưa gửi lại thao tác.</Notice>}
    <div className={styles.formActions}>
    {canRead&&access.canDo('CHECKIN_CREATE')&&canStart&&<Button disabled={busy||reading||uncertain||bookingStatus!=='Confirmed'} onClick={openContact}>Bắt đầu làm thủ tục</Button>}
    {canRead&&access.canDo('CHECKIN_CREATE')&&result?.checkinStatus==='InProgress'&&<Button tone="secondary" disabled={busy||reading||uncertain||bookingStatus!=='Confirmed'} onClick={openContact}>{!result.emergencyContactName || !result.emergencyContactPhone ? 'Bổ sung liên hệ khẩn cấp' : 'Chỉnh sửa liên hệ khẩn cấp'}</Button>}
    {canRead&&access.canDo('CHECKIN_UPDATE')&&result?.checkinStatus==='InProgress'&&<Button disabled={busy||reading||uncertain||bookingStatus!=='Confirmed'} onClick={()=>{setError('');setAction('complete')}}>Kiểm tra điều kiện lên tàu</Button>}
    </div>
    {action&&<Modal quiet title={action==='start'?(canStart?'Bắt đầu làm thủ tục':'Liên hệ khẩn cấp'):'Kiểm tra điều kiện lên tàu'} description={fullName} busy={busy}
      onClose={()=>{if(!busy)setAction(null)}}
      footer={<><Button tone="secondary" autoWidth disabled={busy} data-overlay-dismiss onClick={()=>setAction(null)}>Quay lại</Button><Button autoWidth disabled={uncertain||(action==='start'&&(!emergencyName.trim()||!emergencyPhone.trim()))} busy={busy} onClick={()=>void submit()}>{action === 'start' ? canStart ? 'Bắt đầu làm thủ tục' : 'Lưu liên hệ khẩn cấp' : 'Kiểm tra và ghi nhận'}</Button></>}>
      <p>{action === 'start' ? 'Ghi nhận người liên hệ khẩn cấp cho hành khách này.' : 'Hệ thống kiểm tra hợp đồng, khoản phải thu trước khởi hành và liên hệ khẩn cấp. Chỉ ghi nhận đủ điều kiện lên tàu khi các kiểm tra đạt.'}</p>
      {action==='start'&&<div className={styles.deskLookup}>
        <Field htmlFor="checkin-emergency-name" label="Tên người liên hệ khẩn cấp *"><input id="checkin-emergency-name" required disabled={busy} value={emergencyName} onChange={e=>setEmergencyName(e.target.value)} placeholder="Ví dụ: Lê Văn B"/></Field>
        <Field htmlFor="checkin-emergency-cc" label="Mã quốc gia"><select id="checkin-emergency-cc" disabled={busy} value={phoneCountryCode} onChange={e=>{setPhoneCountryCode(e.target.value);if(phoneError)setPhoneError('')}}>{CHECKIN_COUNTRY_CODES.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></Field>
        <Field htmlFor="checkin-emergency-phone" label="Số điện thoại liên hệ khẩn cấp *" hint="Chọn mã quốc gia; có thể nhập số trong nước hoặc số bắt đầu bằng +." error={phoneError||undefined}><input id="checkin-emergency-phone" type="tel" required disabled={busy} aria-invalid={Boolean(phoneError)} value={emergencyPhone} onChange={e=>{setEmergencyPhone(e.target.value);if(phoneError)setPhoneError('')}} placeholder="Ví dụ: 0912345678 hoặc +84912345678"/></Field>
      </div>}
      {error&&<Notice title={uncertain ? 'Chưa xác nhận được kết quả' : 'Chưa cập nhật được'} tone={uncertain ? 'warning' : 'error'}>{error}</Notice>}
      {uncertain&&<Button tone="secondary" disabled={busy} onClick={()=>void status()}>Đối chiếu trạng thái vừa gửi</Button>}
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
    try {
      const saved = decodeBookingDetail(await apiRequest('/booking/lookup',{query:{reference:reference.trim(),email:email.trim()}}))
      if (saved.bookingReference.toLocaleLowerCase('vi') !== reference.trim().toLocaleLowerCase('vi')) throw new Error('Kết quả tra cứu không khớp mã đặt chỗ đã nhập. Kiểm tra lại trước khi làm thủ tục.')
      setBooking(saved)
    }
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
