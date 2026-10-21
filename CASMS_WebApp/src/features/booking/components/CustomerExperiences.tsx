import { useCallback, useState, type FormEvent } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Empty, Field, Notice, Panel } from '@/shared/ui'
import { customerExtrasApi as api, type CustomerRegistration, type CustomerServiceRequest } from '../api/customer-extras-api'
import { liveCruiseCatalogApi } from '../api/booking-api'
import type { LivePortCall } from '../api/live-itinerary-contract'
import type { BookingDetail } from '../api/real-booking-api'
import { bookingMoney } from '../model/booking-presentation'
import { bookingWhen } from '../model/real-booking-view'
import { useExtrasMutation } from '../model/use-extras-mutation'
import { BookingReadState } from './RealBookingUI'
import styles from './LiveBooking.module.css'

const statusName: Record<string, string> = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận đăng ký', CANCELLED: 'Đã hủy', COMPLETED: 'Đã hoàn tất', REQUESTED: 'Đã gửi yêu cầu', ACCEPTED: 'Đã tiếp nhận', IN_PROGRESS: 'Đang thực hiện', REJECTED: 'Đã từ chối', PLANNED: 'Chưa mở', OPEN: 'Đang mở', FULL: 'Hết chỗ' }
type Write = ReturnType<typeof useExtrasMutation>
function Feedback({ write }: { write: Write }) {
  return <>{write.error && <Notice title="Chưa hoàn tất thao tác" tone="error">{write.error}</Notice>}{write.uncertain && <Notice title="Cần kiểm tra kết quả trước khi gửi lại" tone="warning">Yêu cầu có thể đã được tiếp nhận. Các thao tác gửi đã khóa để tránh trùng. Tải lại danh sách hoặc chi tiết để đối chiếu; liên hệ hỗ trợ nếu chưa xác định được kết quả.</Notice>}{write.message && <p role="status">{write.message}</p>}</>
}
function Quantity({ id, value, change }: { id: string; value: number; change: (value: number) => void }) { return <Field htmlFor={id} label="Số lượng chỗ / đơn vị *"><input id={id} type="number" min={1} step={1} required value={Number.isNaN(value) ? '' : value} onChange={event => change(event.target.valueAsNumber)} /></Field> }
function Passenger({ booking, value, change, id }: { booking: BookingDetail; value: string; change: (value: string) => void; id: string }) {
  return <Field htmlFor={id} label="Hồ sơ của bạn trong đặt chỗ *" hint="Chỉ chọn hồ sơ thuộc tài khoản đang đăng nhập. Hệ thống kiểm tra quyền sở hữu; quyền xem Booking không cho phép thao tác thay mọi người trong nhóm."><select id={id} required value={value} onChange={event => change(event.target.value)}><option value="">Chọn hồ sơ của bạn</option>{booking.passengers.filter(person => person.participationStatus === 'Active').map(person => <option key={person.bookingPassengerId} value={person.bookingPassengerId}>{person.fullName}</option>)}</select></Field>
}
function Price({ amount, currency }: { amount: number | null; currency: string | null }) { return <p>{amount != null && currency ? bookingMoney(amount, currency) : 'Chưa có đủ thông tin giá và tiền tệ.'} · Chưa xác nhận đã thanh toán.</p> }

export function CustomerActivities({ booking }: { booking: BookingDetail }) {
  const access = useSessionAccess()
  const list = useReadQuery('customer-activities:' + booking.cruiseId, useCallback(signal => api.activities(booking.cruiseId, signal), [booking.cruiseId]))
  const [selected, select] = useState('')
  return <Panel title="Hoạt động trên chuyến đi"><p>Hoạt động dành cho chuyến của bạn. Chọn gói không tự động đăng ký hoạt động.</p><BookingReadState {...list} publicResource="hoạt động" />
    {list.data?.length === 0 && <Empty title="Chưa có hoạt động cho chuyến đi này" />}
    {list.data && <Field htmlFor="customer-activity" label="Chọn hoạt động"><select id="customer-activity" value={selected} onChange={event => select(event.target.value)}><option value="">Chọn để xem chi tiết và chỗ trống</option>{list.data.map(item => <option key={item.id} value={item.id}>{item.name} · {statusName[item.status]}</option>)}</select></Field>}
    {selected && list.data?.some(item => item.id === selected) && <ActivitySelection key={selected} id={selected} booking={booking} canRegister={access.has('ACTIVITY_REGISTRATION')} />}
  </Panel>
}

export function CustomerExcursions({ booking }: { booking: BookingDetail }) {
  const access = useSessionAccess()
  const query = useReadQuery('customer-excursion-stops:' + booking.cruiseId, useCallback(async signal => {
    const lookup = await liveCruiseCatalogApi.itinerary(booking.cruiseId, signal)
    if (lookup.kind === 'limit') throw new Error(`Chưa xác định được lịch trình sau ${lookup.pagesScanned}/${lookup.totalPages} trang. Không chọn tour khi chưa xác minh chuyến.`)
    return lookup.kind === 'found' ? liveCruiseCatalogApi.stops(lookup.itinerary.id, signal) : []
  }, [booking.cruiseId]))
  const [stop, setStop] = useState('')
  return <Panel title="Tour tham quan trên bờ"><BookingReadState {...query} publicResource="điểm dừng cho tour" />{query.data?.length === 0 && <Empty title="Chưa có điểm dừng liên kết cho chuyến đi" />}{query.data && <Field htmlFor="excursion-stop" label="Điểm dừng của chuyến đi"><select id="excursion-stop" value={stop} onChange={event => setStop(event.target.value)}><option value="">Chọn điểm dừng</option>{query.data.map(item => <option key={item.id} value={item.id}>{item.port || item.destination || 'Điểm dừng ' + (item.order ?? item.id)}</option>)}</select></Field>}{query.data?.filter(item => item.id === stop).map(item => <ExcursionList key={item.id} stop={item} booking={booking} canRegister={access.has('EXCURSION_BOOKING')} />)}</Panel>
}
function ExcursionList({ stop, booking, canRegister }: { stop: LivePortCall; booking: BookingDetail; canRegister: boolean }) {
  const query = useReadQuery('customer-excursions:' + stop.id, useCallback(signal => api.excursions(stop.id, signal), [stop.id]))
  const [selected, select] = useState('')
  return <div className={styles.stack}><BookingReadState {...query} publicResource="tour tham quan" />{query.data?.length === 0 && <Empty title="Chưa có tour đang mở tại điểm dừng này" />}{query.data && <Field htmlFor="customer-excursion" label="Tour đang mở"><select id="customer-excursion" value={selected} onChange={event => select(event.target.value)}><option value="">Chọn tour</option>{query.data.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}{selected && query.data?.some(item => item.id === selected) && <ExcursionSelection key={selected} id={selected} stopId={stop.id} booking={booking} canRegister={canRegister} />}</div>
}
function ExcursionSelection({ id, stopId, booking, canRegister }: { id: string; stopId: string; booking: BookingDetail; canRegister: boolean }) {
  const access = useSessionAccess(), write = useExtrasMutation(access.userId + ':' + booking.bookingId + ':excursion-create')
  const detail = useReadQuery('customer-excursion:' + stopId + ':' + id, useCallback(signal => api.excursion(id, stopId, signal), [id, stopId]))
  const [person, setPerson] = useState(''), [quantity, setQuantity] = useState(1), [openedAt] = useState(() => Date.now())
  const valid = Number.isSafeInteger(quantity) && quantity > 0
  const seats = useReadQuery('customer-excursion-seats:' + stopId + ':' + id + ':' + quantity, useCallback(signal => valid ? api.excursionAvailability(id, stopId, quantity, signal) : Promise.resolve(null), [id, stopId, quantity, valid]))
  const item = detail.data
  const allowed = canRegister && booking.bookingStatus === 'Confirmed' && item?.status === 'OPEN' && Date.parse(item.endTime) > openedAt && seats.data?.status === 'OPEN' && seats.data.availableCapacity >= quantity && valid && Boolean(person)
  function submit(event: FormEvent) { event.preventDefault(); if (allowed && item && Date.parse(item.endTime) > Date.now()) void write.run(() => api.registerExcursion(id, person, quantity), 'Đã tạo đăng ký tour. Tải lại Đăng ký của tôi để xem; chưa xác nhận thanh toán hay check-in.', seats.retry) }
  return <div className={styles.stack}><BookingReadState {...detail} publicResource="chi tiết tour" /><BookingReadState {...seats} publicResource="chỗ trống tour" />{item && <><h3>{item.name}</h3><p>{bookingWhen(item.startTime)} → {bookingWhen(item.endTime)}</p><p>Điểm tập trung: {item.meetingPoint || 'Chưa cung cấp'}</p><Price amount={item.price} currency={item.currency} /></>}{seats.data && <p role="status">Còn {seats.data.availableCapacity}/{seats.data.maximumCapacity} chỗ cho tour.</p>}{!canRegister ? <p>Phiên hiện tại chưa có quyền đăng ký tour.</p> : booking.bookingStatus !== 'Confirmed' ? <p>Chỉ đăng ký tour khi Booking đã xác nhận.</p> : <form onSubmit={submit}><fieldset disabled={write.busy || write.uncertain} className={styles.stack}><Passenger booking={booking} value={person} change={setPerson} id="excursion-passenger" /><Quantity id="excursion-quantity" value={quantity} change={setQuantity} /><Button type="submit" disabled={!allowed} aria-busy={write.busy}>Đăng ký tour tham quan</Button></fieldset></form>}<Feedback write={write} /></div>
}
function ActivitySelection({ id, booking, canRegister }: { id: string; booking: BookingDetail; canRegister: boolean }) {
  const access = useSessionAccess(), write = useExtrasMutation(access.userId + ':' + booking.bookingId + ':activity-create')
  const detail = useReadQuery('customer-activity:' + id, useCallback(signal => api.activity(id, booking.cruiseId, signal), [id, booking.cruiseId]))
  const seats = useReadQuery('customer-activity-seats:' + id, useCallback(signal => api.activityAvailability(id, signal), [id]))
  const [person, setPerson] = useState(''), [quantity, setQuantity] = useState(1), [openedAt] = useState(() => Date.now())
  const item = detail.data
  const allowed = canRegister && booking.bookingStatus === 'Confirmed' && item?.status === 'OPEN' && Date.parse(item.endTime) > openedAt && seats.data?.status === 'OPEN' && seats.data.availableSeats >= quantity && Number.isSafeInteger(quantity) && quantity > 0 && Boolean(person)
  function submit(event: FormEvent) { event.preventDefault(); if (allowed && item && Date.parse(item.endTime) > Date.now()) void write.run(() => api.registerActivity(id, person, quantity), 'Đã tạo đăng ký. Tải lại mục Đăng ký của tôi để xác nhận hoặc quản lý; chưa phải thanh toán hay check-in.', seats.retry) }
  return <div className={styles.stack}><BookingReadState {...detail} publicResource="chi tiết hoạt động" /><BookingReadState {...seats} publicResource="chỗ trống hoạt động" />
    {item && <><h3>{item.name}</h3><p>{item.description || 'Chưa có mô tả.'}</p><p>{bookingWhen(item.startTime)} → {bookingWhen(item.endTime)} · {item.location || 'Chưa có địa điểm'}</p><Price amount={item.price} currency={item.currency} /></>}
    {seats.data && <p role="status">Còn {seats.data.availableSeats}/{seats.data.capacity} chỗ · {statusName[seats.data.status]}</p>}
    {!canRegister ? <p>Phiên hiện tại chưa có quyền đăng ký hoạt động.</p> : booking.bookingStatus !== 'Confirmed' ? <p>Chỉ đăng ký khi Booking đã được xác nhận.</p> : <form onSubmit={submit}><fieldset disabled={write.busy || write.uncertain} className={styles.stack}><Passenger booking={booking} value={person} change={setPerson} id="activity-passenger" /><Quantity id="activity-quantity" value={quantity} change={setQuantity} /><Button type="submit" disabled={!allowed} aria-busy={write.busy}>Đăng ký hoạt động</Button></fieldset></form>}
    <Feedback write={write} />
  </div>
}

export function CustomerRegistrations({ booking }: { booking: BookingDetail }) {
  const list = useReadQuery('customer-registrations:' + booking.bookingId, api.registrations)
  const ids = new Set(booking.passengers.map(person => person.bookingPassengerId))
  const records = list.data?.filter(item => ids.has(item.bookingPassengerId))
  return <Panel title="Đăng ký của tôi"><p>Chỉ hiển thị đăng ký API cho phép xem, thuộc hành khách của đặt chỗ này. Xác nhận tham gia khác với thanh toán và check-in.</p><BookingReadState {...list} publicResource="đăng ký" /><Button tone="secondary" onClick={list.retry}>Tải lại đăng ký</Button>
    {records?.length === 0 && <Empty title="Chưa có đăng ký trong đặt chỗ này" />}
    {records?.map(item => <RecordEntry key={item.id} kind="activity" item={item} booking={booking} refresh={list.retry} />)}
  </Panel>
}

export function CustomerServices({ booking }: { booking: BookingDetail }) {
  const access = useSessionAccess(), [selected, select] = useState('')
  const list = useReadQuery('customer-services', api.services)
  return <Panel title="Dịch vụ bổ sung"><p>Yêu cầu riêng cho hồ sơ của tài khoản; chọn gói không tự đặt dịch vụ.</p><BookingReadState {...list} publicResource="dịch vụ" />
    {list.data?.length === 0 && <Empty title="Chưa có dịch vụ hoạt động" />}
    {list.data && <Field htmlFor="customer-service" label="Chọn dịch vụ"><select id="customer-service" value={selected} onChange={event => select(event.target.value)}><option value="">Chọn để xem chi tiết</option>{list.data.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
    {selected && list.data?.some(item => item.id === selected) && <ServiceSelection key={selected} id={selected} booking={booking} canCreate={access.has('SERVICE_REQUEST_CREATE')} />}
  </Panel>
}
function ServiceSelection({ id, booking, canCreate }: { id: string; booking: BookingDetail; canCreate: boolean }) {
  const access = useSessionAccess(), write = useExtrasMutation(access.userId + ':' + booking.bookingId + ':service-create')
  const detail = useReadQuery('customer-service:' + id, useCallback(signal => api.service(id, signal), [id]))
  const [quantity, setQuantity] = useState(1), [person, setPerson] = useState(''), [note, setNote] = useState('')
  const valid = Number.isSafeInteger(quantity) && quantity > 0
  const availability = useReadQuery('customer-service-availability:' + id + ':' + quantity, useCallback(signal => valid ? api.serviceAvailability(id, quantity, signal) : Promise.resolve(null), [id, quantity, valid]))
  const allowed = canCreate && booking.bookingStatus === 'Confirmed' && detail.data?.status === 'ACTIVE' && availability.data === true && valid && Boolean(person)
  function submit(event: FormEvent) { event.preventDefault(); if (allowed) void write.run(() => api.createRequest(id, person, quantity, note), 'Đã gửi yêu cầu dịch vụ. Tải lại mục Yêu cầu của tôi để xem xử lý; chưa xác nhận thanh toán.', availability.retry) }
  return <div className={styles.stack}><BookingReadState {...detail} publicResource="chi tiết dịch vụ" /><BookingReadState {...availability} publicResource="khả dụng dịch vụ" />
    {detail.data && <><h3>{detail.data.name}</h3><p>{detail.data.description || 'Chưa có mô tả.'}</p><Price amount={detail.data.price} currency={detail.data.currency} /></>}
    {availability.data != null && <p role="status">{availability.data ? 'Có thể yêu cầu số lượng này.' : 'Dịch vụ chưa đáp ứng số lượng này.'}</p>}
    {!canCreate ? <p>Phiên hiện tại chưa có quyền gửi yêu cầu dịch vụ.</p> : booking.bookingStatus !== 'Confirmed' ? <p>Chỉ yêu cầu dịch vụ cho Booking đã xác nhận.</p> : <form onSubmit={submit}><fieldset disabled={write.busy || write.uncertain} className={styles.stack}><Passenger booking={booking} value={person} change={setPerson} id="service-passenger" /><Quantity id="service-quantity" value={quantity} change={setQuantity} /><Field htmlFor="service-note" label="Ghi chú (tùy chọn)"><textarea id="service-note" maxLength={500} value={note} onChange={event => setNote(event.target.value)} /></Field><Button type="submit" disabled={!allowed} aria-busy={write.busy}>Gửi yêu cầu dịch vụ</Button></fieldset></form>}
    <Feedback write={write} />
  </div>
}
export function CustomerRequests({ booking }: { booking: BookingDetail }) {
  const list = useReadQuery('customer-service-requests:' + booking.bookingId, api.requests)
  const records = list.data?.filter(item => item.bookingId === booking.bookingId && booking.passengers.some(person => person.bookingPassengerId === item.bookingPassengerId))
  return <Panel title="Yêu cầu của tôi"><BookingReadState {...list} publicResource="yêu cầu dịch vụ" /><Button tone="secondary" onClick={list.retry}>Tải lại yêu cầu dịch vụ</Button>{records?.length === 0 && <Empty title="Chưa có yêu cầu dịch vụ trong đặt chỗ này" />}{records?.map(item => <RecordEntry key={item.id} kind="service" item={item} booking={booking} refresh={list.retry} />)}</Panel>
}

function RecordEntry({ kind, item, booking, refresh }: { kind: 'activity' | 'service'; item: CustomerRegistration | CustomerServiceRequest; booking: BookingDetail; refresh: () => void }) {
  const [opened, setOpened] = useState(false)
  const person = booking.passengers.find(person => person.bookingPassengerId === item.bookingPassengerId)
  return <section className={styles.selection}><p>{person?.fullName} · {statusName[item.status]} · {item.quantity} chỗ / đơn vị</p><p className={styles.helper}>Mã {item.id}</p><Button tone="secondary" aria-expanded={opened} onClick={() => setOpened(value => !value)}>{opened ? 'Đóng' : 'Chi tiết'} {kind === 'activity' ? 'đăng ký' : 'yêu cầu'} {item.id}</Button>{opened && <RecordDetails key={kind + item.id} kind={kind} id={item.id} booking={booking} refresh={refresh} />}</section>
}
function RecordDetails({ kind, id, booking, refresh }: { kind: 'activity' | 'service'; id: string; booking: BookingDetail; refresh: () => void }) {
  const access = useSessionAccess(), write = useExtrasMutation(access.userId + ':' + booking.bookingId + ':' + kind + ':' + id)
  const query = useReadQuery<CustomerRegistration | CustomerServiceRequest>(kind + '-record:' + id, useCallback(signal => kind === 'activity' ? api.registration(id, signal) : api.request(id, signal), [kind, id]))
  const [reason, setReason] = useState('')
  const item = query.data
  // A valid ID response must also belong to this Booking, including after retries.
  const belongs = item && booking.passengers.some(person => person.bookingPassengerId === item.bookingPassengerId && person.passengerId === item.passengerId) && (!('bookingId' in item) || item.bookingId === booking.bookingId)
  const canWrite = access.has(kind === 'activity' ? 'ACTIVITY_REGISTRATION' : 'SERVICE_REQUEST_CREATE') && belongs
  const pending = item?.status === (kind === 'activity' ? 'PENDING' : 'REQUESTED')
  function after() { query.retry(); refresh() }
  return <div className={styles.stack}><BookingReadState {...query} publicResource="chi tiết yêu cầu" />{item && !belongs && <Notice title="Dữ liệu không thuộc đặt chỗ này" tone="error">Không hiển thị chi tiết hoặc cho phép thao tác.</Notice>}
    {item && belongs && <><p role="status">Trạng thái hiện tại: {statusName[item.status]} · {item.quantity} chỗ / đơn vị</p><p>Mã {kind === 'activity' ? 'hoạt động / tour' : 'dịch vụ'}: {'serviceId' in item ? item.serviceId : item.activityId || item.excursionId}</p>{'note' in item && item.note && <p>Ghi chú đã lưu: {item.note}</p>}
      {canWrite && <fieldset disabled={write.busy || write.uncertain || query.loading} className={styles.stack}>
        {pending && <PendingEdit key={item.id + ':' + item.quantity} kind={kind} item={item} write={write} after={after} />}
        {pending && kind === 'activity' && <Button onClick={() => void write.run(() => api.confirmRegistration(id), 'Đã xác nhận đăng ký theo phản hồi API. Chưa xác nhận thanh toán hoặc điểm danh.', after)}>Xác nhận đăng ký</Button>}
        {(pending || item.status === (kind === 'activity' ? 'CONFIRMED' : 'ACCEPTED')) && <><Field htmlFor={kind + '-cancel-' + id} label={kind === 'activity' ? 'Lý do hủy (tùy chọn)' : 'Xác nhận hủy yêu cầu bằng nút bên dưới'}>{kind === 'activity' ? <textarea id={kind + '-cancel-' + id} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /> : <p id={kind + '-cancel-' + id}>Thao tác chỉ hủy yêu cầu dịch vụ, không hủy Booking.</p>}</Field><Button tone="secondary" onClick={() => void write.run(() => kind === 'activity' ? api.cancelRegistration(id, reason) : api.cancelRequest(id), 'Đã hủy theo phản hồi API.', after)}>Hủy {kind === 'activity' ? 'đăng ký' : 'yêu cầu dịch vụ'}</Button></>}
      </fieldset>}
    </>}<Feedback write={write} /><Button tone="secondary" onClick={query.retry}>Tải lại chi tiết</Button></div>
}
function PendingEdit({ kind, item, write, after }: { kind: 'activity' | 'service'; item: CustomerRegistration | CustomerServiceRequest; write: Write; after: () => void }) {
  const [quantity, setQuantity] = useState(item.quantity), [note, setNote] = useState('note' in item ? item.note || '' : '')
  const id = item.id
  function save(event: FormEvent) {
    event.preventDefault()
    if (!Number.isSafeInteger(quantity) || quantity < 1) return
    void write.run(() => kind === 'activity' ? api.updateRegistration(id, quantity, note) : api.updateRequest(id, quantity, note), 'Đã cập nhật từ phản hồi API.', after)
  }
  return <form onSubmit={save} className={styles.stack}><p>Số lượng hiện tại {item.quantity}. Nhập số lượng mới; ghi chú gửi lần này sẽ thay thế ghi chú cũ.{kind === 'activity' && ' Dịch vụ chưa trả lại ghi chú đã lưu của đăng ký.'}</p><Quantity id={kind + '-edit-' + id} value={quantity} change={setQuantity} /><Field htmlFor={kind + '-note-' + id} label="Ghi chú mới (tùy chọn)"><textarea id={kind + '-note-' + id} maxLength={500} value={note} onChange={event => setNote(event.target.value)} /></Field><Button type="submit" disabled={!Number.isSafeInteger(quantity) || quantity < 1}>Lưu thay đổi</Button></form>
}
