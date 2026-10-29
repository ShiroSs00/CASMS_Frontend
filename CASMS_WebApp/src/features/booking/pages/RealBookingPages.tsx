import {BookingContractAcceptance} from '../components/BookingContractAcceptance'
import { BookingPhotoNote } from '../components/BookingExperience'
import { bookingStatusName, bookingWhen, bookingPlanName } from '../model/real-booking-view'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { PermissionLink as Link } from '@/shared/ui'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, CollectionSummary, DataTable, Empty, Field, ListFilters, ListFooter, Modal, Notice, PageHeader, Panel, RecordFacts } from '@/shared/ui'
import { realBookingApi, type BookingDetail } from '../api/real-booking-api'
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI'
import { bookingMutationFailure } from '../model/booking-mutation'
import styles from '../components/LiveBooking.module.css'
import listStyles from '../components/BookingList.module.css'
import { ApiError } from '@/shared/api'
import { bookingLookupFailure } from '../model/booking-feedback'
import { BookingInstallments } from '../components/BookingInstallments'
import { PublicBookingRecord } from '../components/PublicBookingRecord'
import { bookingMoney } from '../model/booking-presentation'
import { canManageBooking } from '../model/booking-permissions'
export function RealBookingList({ admin = false }: { admin?: boolean }) {
  const access = useSessionAccess()
  const [status, setStatus] = useState(''), [page, setPage] = useState(0), [cruiseId, setCruiseId] = useState('')
  const choices = useReadQuery('booking-cruises', realBookingApi.cruises)
  const list = useReadQuery(`booking-list:${page}:${status}:${cruiseId}`, useCallback(signal => realBookingApi.list(page, status || undefined, cruiseId || undefined, signal), [page, status, cruiseId]))
  const root = admin ? '/admin/bookings' : '/my-bookings'
  const filtered = Boolean(status || cruiseId)
  const resetFilters = () => { setStatus(''); setCruiseId(''); setPage(0) }
  return <RealBookingFrame admin={admin}>
    <PageHeader title={admin ? 'Quản lý đặt chỗ' : 'Đặt chỗ của tôi'} breadcrumb="ĐẶT CHỖ"
      description="Theo dõi đặt chỗ theo chuyến đi và trạng thái xác nhận."
      actions={<><ButtonLink tone="secondary" to={admin ? root + '/lookup' : '/booking/lookup'}>Tra cứu bằng mã</ButtonLink>
        {(!admin || access.canDo('BOOKING_CREATE')) && <ButtonLink to={admin ? root + '/new' : '/booking/cabin-experience'}>Tạo đặt chỗ</ButtonLink>}</>} />
    <CollectionSummary count={list.loading || list.error ? null : list.data?.totalElements ?? null} visible={list.data?.content.length} filtered={filtered} label="Đặt chỗ trong kết quả" scope="Tổng kết quả từ hệ thống" />
    <div className={listStyles.registerWorkspace}><Panel className={listStyles.registerFilters} title="Bộ lọc" subtitle="Chọn chuyến đi hoặc trạng thái để thu hẹp danh sách.">
      <ListFilters label="Bộ lọc đặt chỗ" actions={<Button tone="secondary" disabled={!filtered} onClick={resetFilters}>Xóa bộ lọc</Button>}>
        <Field htmlFor="booking-cruise" label="Chuyến đi"><select id="booking-cruise" value={cruiseId} onChange={event => { setCruiseId(event.target.value); setPage(0) }}>
          <option value="">Tất cả chuyến đi</option>{choices.data?.map(item => <option key={item.cruiseId} value={item.cruiseId}>{item.cruiseCode} · {item.cruiseName}</option>)}
        </select></Field>
        <Field htmlFor="booking-status" label="Trạng thái"><select id="booking-status" value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}>
          <option value="">Tất cả trạng thái</option>{Object.entries(bookingStatusName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></Field>
      </ListFilters>
      {choices.error && <div className={listStyles.notice}><Notice title="Chưa tải được bộ lọc chuyến" tone="warning">Danh sách đặt chỗ vẫn được tải độc lập. <Button tone="secondary" onClick={choices.retry}>Thử lại</Button></Notice></div>}
    </Panel>
    <Panel className={listStyles.registerResults} title="Danh sách đặt chỗ">
      <BookingReadState {...list} publicResource={!admin ? 'danh sách đặt chỗ' : undefined} />
      {list.data && !list.loading && !list.error && (list.data.content.length ? <>
        <DataTable label="Danh sách đặt chỗ" headers={admin ? ['Mã đặt chỗ', 'Chuyến đi', 'Trạng thái', 'Thao tác'] : ['Mã đặt chỗ', 'Chuyến đi', 'Trạng thái', 'Khởi hành', 'Hành khách', 'Giá vé', 'Thao tác']}>
          {list.data.content.map(item => <tr key={item.bookingId}>
            <td><Link className={listStyles.reference} to={`${root}/${item.bookingId}`}>{item.bookingReference}</Link></td>
            <td><span className={listStyles.cruise}>{item.cruiseName}</span></td>
            <td><Badge label={bookingStatusName[item.bookingStatus] ?? item.bookingStatus} tone={item.bookingStatus === 'Confirmed' ? 'success' : item.bookingStatus === 'Cancelled' ? 'neutral' : 'warning'} /></td>
            {!admin && <><td>{bookingWhen(item.departureDatetime)}</td><td>{item.passengerCount ?? 'Chưa có'}</td><td>{item.agreedFareAmount != null && item.currency ? bookingMoney(item.agreedFareAmount, item.currency) : 'Chưa có báo giá'}</td></>}
            <td><Link className={listStyles.detail} aria-label={`Chi tiết đặt chỗ ${item.bookingReference}`} to={`${root}/${item.bookingId}`}>Xem chi tiết →</Link></td>
          </tr>)}
        </DataTable>
      </> : <Empty title={filtered ? 'Không tìm thấy đặt chỗ phù hợp' : 'Chưa có đặt chỗ'}>
        <p>{filtered ? 'Thử thay đổi chuyến đi hoặc trạng thái.' : 'Các đặt chỗ mới sẽ xuất hiện tại đây.'}</p>
        {filtered && <Button tone="secondary" onClick={resetFilters}>Xóa bộ lọc</Button>}
      </Empty>)}
      {list.data && !list.loading && !list.error && <ListFooter summary={`${list.data.totalElements.toLocaleString('vi-VN')} đặt chỗ${filtered ? ' phù hợp bộ lọc' : ''}`}>
        {list.data.totalPages > 1 && <><Button tone="secondary" size="compact" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>← Trang trước</Button>
          <span>Trang {page + 1} / {list.data.totalPages}</span>
          <Button tone="secondary" size="compact" disabled={page + 1 >= list.data.totalPages} onClick={() => setPage(value => value + 1)}>Trang sau →</Button></>}
      </ListFooter>}
    </Panel></div>
  </RealBookingFrame>
}
export function RealBookingDetail({ admin = false, related, customerIntro, showPassengerDetails = false }: { admin?: boolean; related?: (bookingId: string) => ReactNode; customerIntro?: ReactNode; showPassengerDetails?: boolean }) {
  const { bookingId = '' } = useParams()
  const detail = useReadQuery('real-booking:' + bookingId, useCallback(signal => realBookingApi.get(bookingId, signal), [bookingId]))
  const content = <>{!admin && customerIntro}<PageHeader title={detail.data?.bookingReference ?? 'Chi tiết đặt chỗ'} breadcrumb="ĐẶT CHỖ / CHI TIẾT" description="Thông tin hành khách, phòng đã chọn và hợp đồng. Thanh toán thực tế cần được đối soát riêng." actions={<ButtonLink tone="secondary" to={admin ? '/admin/bookings' : '/my-bookings'}>Danh sách đặt chỗ</ButtonLink>} /><BookingReadState {...detail} publicResource={!admin ? 'chi tiết đặt chỗ' : undefined} />{detail.data && <><div className={admin ? styles.recordWorkspace : undefined}><div><BookingRecord booking={detail.data} publicView={!admin} showPassengerDetails={!admin && showPassengerDetails} /></div><aside className={admin ? styles.recordActions : undefined}><>{admin&&<BookingContractAcceptance key={bookingId+':'+detail.data.contractStatus} booking={detail.data} onChanged={detail.retry}/>}<BookingOperations publicView={!admin} key={bookingId} booking={detail.data} onChanged={detail.retry} /></></aside></div>{admin && related?.(bookingId)}</>}</>
  return <RealBookingFrame admin={admin}>{admin ? content : <div className={styles.stack}>{content}</div>}</RealBookingFrame>
}
export function BookingRecord({ booking, publicView = false, showPassengerDetails = false }: { booking: BookingDetail; publicView?: boolean; showPassengerDetails?: boolean }) {
  if (publicView) return <PublicBookingRecord booking={booking} showPassengerDetails={showPassengerDetails} />
  return <><Panel title="Chuyến đi và điều khoản thanh toán"><RecordFacts entries={[
    ['Mã đặt chỗ', booking.bookingReference], ['Trạng thái', bookingStatusName[booking.bookingStatus]], ['Chuyến đi', booking.cruiseName],
    ['Thời gian · giờ Việt Nam', `${bookingWhen(booking.departureDatetime)} → ${bookingWhen(booking.returnDatetime)}`],
    ['Giá vé', `${booking.agreedFareAmount ?? 'Chưa có'} ${booking.currency ?? ''}`], ['Cọc yêu cầu', `${booking.requiredDepositAmount ?? 'Chưa có'} ${booking.currency ?? ''}`],
    ['Hạn thanh toán', bookingWhen(booking.finalPaymentDueAt)], ['Hồ sơ điều khoản', booking.contractReference ?? 'Chưa có'],
    ['Trạng thái hợp đồng', booking.contractStatus ? ({ Draft: 'Bản nháp', Accepted: 'Đã chấp thuận', Cancelled: 'Đã hủy' } as Record<string, string>)[booking.contractStatus] ?? booking.contractStatus : 'Chưa có trạng thái'],
  ]} />{booking.contractSigningInstructions && <p>{booking.contractSigningInstructions}</p>}{booking.cancellationReason && <p>Lý do hủy: {booking.cancellationReason}</p>}<p>Hình thức: {bookingPlanName(booking.paymentPlan)}</p><BookingInstallments booking={booking} /><p>Thanh toán theo hướng dẫn đã được xác nhận. Trạng thái đặt chỗ được cập nhật sau khi đối soát.</p></Panel><Panel title="Hành khách & phòng"><DataTable label="Hành khách đặt chỗ" headers={['Hành khách', 'Phòng', 'Gói dịch vụ', 'Trạng thái']} >{booking.passengers.map(item => <tr key={item.bookingPassengerId}><td>{item.fullName}</td><td>{item.cabinNumber ?? 'Chưa gán phòng'}</td><td>{item.tourPackageName ?? 'Chưa chọn gói'}</td><td>{item.participationStatus === 'Active' ? 'Tham gia' : 'Đã hủy'}</td></tr>)}</DataTable></Panel></>
}
function BookingOperations({ booking, onChanged, publicView=false }: { booking: BookingDetail; onChanged: () => void; publicView?: boolean }) {
  const access = useSessionAccess(), lock = useRef(false)
  const [uncertain, setUncertain] = useState(false)
  const [action, setAction] = useState<'confirm' | 'cancel' | 'cabin' | null>(null), [reason, setReason] = useState(''), [person, setPerson] = useState(''), [cabinId, setCabinId] = useState(''), [acknowledged, setAcknowledged] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const cabins = useReadQuery('booking-change-cabins:' + booking.cruiseId + action, useCallback(signal => action === 'cabin' ? realBookingApi.cabins(booking.cruiseId, signal) : Promise.resolve(null), [booking.cruiseId, action]))
  const permitted = (value: NonNullable<typeof action>) => !publicView && canManageBooking(value,booking.bookingStatus,access) && (value !== 'confirm' || booking.contractStatus === 'Accepted')
  async function confirm() {
    if (!action || !permitted(action) || lock.current || uncertain) return
    if (action === 'cancel' && !reason.trim()) { setError('Nhập lý do hủy đặt chỗ.'); return }
    if (action === 'confirm' && !acknowledged) { setError('Cần đối soát tiền cọc/thanh toán trước khi xác nhận.'); return }
    if (action === 'cabin' && (!booking.passengers.some(item => item.bookingPassengerId === person && item.participationStatus === 'Active' && item.cabinId !== cabinId) || !cabins.data?.some(item => item.cabinId === cabinId && item.remainingCapacity >= 1))) { setError('Chọn hành khách đang tham gia và phòng trống khác.'); return }
    lock.current = true; setBusy(true); setError('')
    try { const saved = action === 'confirm' ? await realBookingApi.confirm(booking.bookingId) : action === 'cancel' ? await realBookingApi.cancel(booking.bookingId, reason) : await realBookingApi.changeCabin(person, cabinId, reason); if (saved.bookingId !== booking.bookingId) throw new Error('Kết quả không thuộc đặt chỗ này; tải lại để kiểm tra trước thao tác tiếp.'); setAction(null); onChanged() }
    catch (value) { const failure = bookingMutationFailure(value); setError(failure.message); setUncertain(failure.uncertain); if (failure.conflict) cabins.retry() }
    finally { lock.current = false; setBusy(false) }
  }
  if (!(['confirm', 'cancel', 'cabin'] as const).some(permitted)) return null
  const labels = { confirm: 'Xác nhận đặt chỗ', cancel: 'Hủy đặt chỗ', cabin: 'Đổi phòng' }
  return <Panel title="Quản lý đặt chỗ">{uncertain && <Notice title="Cần kiểm tra kết quả thao tác" tone="warning">Chưa xác định được kết quả; không gửi lại để tránh thao tác trùng. <Button onClick={onChanged}>Tải lại đặt chỗ để kiểm tra</Button></Notice>}{(['confirm', 'cancel', 'cabin'] as const).filter(permitted).map(value => <Button key={value} tone={value === 'cancel' ? 'danger' : 'secondary'} disabled={busy || uncertain || !permitted(value)} onClick={() => { setAction(value); setError(''); setAcknowledged(false) }}>{labels[value]}</Button>)}{action && permitted(action) && <Modal title={labels[action]} busy={busy} onClose={() => setAction(null)}>{action === 'confirm' && <><p>Hệ thống sẽ kiểm tra hợp đồng, khoản thu đã xác nhận và sức chứa trước khi xác nhận đặt chỗ.</p><label><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /> Tôi đã kiểm tra chứng từ cọc/thanh toán bên ngoài.</label></>}{action === 'cabin' && <><BookingReadState {...cabins} /><Field htmlFor="booking-person" label="Hành khách"><select id="booking-person" value={person} onChange={event => setPerson(event.target.value)}><option value="">Chọn hành khách</option>{booking.passengers.filter(item => item.participationStatus === 'Active').map(item => <option key={item.bookingPassengerId} value={item.bookingPassengerId}>{item.fullName} · {item.cabinNumber ?? 'Chưa có phòng'}</option>)}</select></Field><Field htmlFor="booking-new-cabin" label="Phòng trống mới"><select id="booking-new-cabin" value={cabinId} onChange={event => setCabinId(event.target.value)}><option value="">Chọn phòng trống</option>{cabins.data?.map(item => <option key={item.cabinId} value={item.cabinId}>Boong {item.deckNumber} · {item.cabinNumber} · Còn {item.remainingCapacity} chỗ</option>)}</select></Field></>}{action !== 'confirm' && <Field htmlFor="booking-reason" label={action === 'cancel' ? 'Lý do hủy *' : 'Lý do đổi phòng'}><textarea id="booking-reason" value={reason} onChange={event => setReason(event.target.value)} /></Field>}{error && <Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}{uncertain && <Notice title="Kiểm tra kết quả trước khi thao tác tiếp" tone="warning">Đóng hộp thoại và tải lại đặt chỗ để kiểm tra kết quả. Thao tác gửi lại đang được khóa.</Notice>}<Button disabled={busy || uncertain || !permitted(action)} onClick={() => void confirm()}>{labels[action]}</Button></Modal>}</Panel>
}
export function BookingLookupPage({ admin = false }: { admin?: boolean }) {
  const [params] = useSearchParams()
  const [reference, setReference] = useState(() => params.get('reference') ?? ''), [email, setEmail] = useState(''), [phone, setPhone] = useState(''), [data, setData] = useState<BookingDetail | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), lock = useRef(false)
  const requestRef = useRef<AbortController | null>(null)
  const [missing, setMissing] = useState<Record<string, string>>({})
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const errorSummary = useRef<HTMLDivElement>(null)
  useEffect(() => { if (!admin && error && !Object.values(missing).some(Boolean)) errorSummary.current?.focus() }, [admin, error, missing, busy])
  useEffect(() => { if (data && !admin) resultHeading.current?.focus() }, [data, admin])
  useEffect(() => () => requestRef.current?.abort(), [])
  async function lookup() { if (lock.current) return; setData(null); setError(''); if (!reference.trim() || (!email.trim() && !phone.trim())) {
    if (!admin) { const fields: Record<string, string> = {}; if (!reference.trim()) fields.reference = 'Nhập mã đặt chỗ đã nhận.'; if (!email.trim() && !phone.trim()) fields.email = 'Nhập email hoặc số điện thoại đại diện.'; setMissing(fields); document.getElementById('lookup-' + Object.keys(fields)[0])?.focus() }
    setError('Nhập mã đặt chỗ và email hoặc số điện thoại đại diện.'); return
  } setMissing({}); lock.current = true; setBusy(true); const controller = new AbortController(); requestRef.current = controller; try { const result = await realBookingApi.lookup(reference, email, phone, controller.signal); if (!controller.signal.aborted) setData(result) } catch (value) { if (!controller.signal.aborted) setError(admin ? value instanceof Error ? value.message : 'Không tìm thấy đặt chỗ khớp thông tin.' : bookingLookupFailure(value instanceof ApiError ? value.status : undefined)) } finally { lock.current = false; setBusy(false) } }
  if (!admin) return <RealBookingFrame><div className={styles.stack}>
    <div className={styles.journeyTopline}><Link to="/cruises">← Khám phá hành trình</Link><p className={styles.helper}>Không cần đăng nhập</p></div>
    <PageHeader title="Tra cứu đặt chỗ" breadcrumb="HÀNH TRÌNH / ĐẶT CHỖ" description="Xem thông tin hành khách, phòng, hợp đồng và lịch thanh toán bằng mã đặt chỗ của bạn." />
    <div className={styles.lookupGrid}><Panel title="Thông tin tra cứu"><form aria-busy={busy} onSubmit={event => { event.preventDefault(); void lookup() }}><fieldset disabled={busy} className={styles.draftFields}>
      <Field htmlFor="lookup-reference" label="Mã đặt chỗ" hint="Mã được hiển thị sau khi hệ thống tiếp nhận đặt chỗ." error={missing.reference}><input id="lookup-reference" value={reference} autoComplete="off" spellCheck={false} aria-required="true" aria-invalid={Boolean(missing.reference)} aria-describedby="lookup-reference-hint" onChange={event => { setReference(event.target.value); setMissing(current => ({ ...current, reference: '' })); setData(null); setError('') }} /></Field>
      <p className={styles.helper} id="lookup-contact-help">Nhập email <strong>hoặc</strong> số điện thoại của người đại diện. Không cần nhập cả hai.</p>
      <div className={styles.lookupContact}>
        <Field htmlFor="lookup-email" label="Email đại diện" error={missing.email}><input id="lookup-email" type="email" autoComplete="email" value={email} aria-invalid={Boolean(missing.email)} aria-describedby={missing.email ? 'lookup-contact-help lookup-email-hint' : 'lookup-contact-help'} onChange={event => { setEmail(event.target.value); setMissing(current => ({ ...current, email: '' })); setData(null); setError('') }} /></Field>
        <Field htmlFor="lookup-phone" label="Số điện thoại đại diện"><input id="lookup-phone" type="tel" autoComplete="tel" value={phone} aria-describedby="lookup-contact-help" onChange={event => { setPhone(event.target.value); setMissing(current => ({ ...current, email: '' })); setData(null); setError('') }} /></Field>
      </div><Button type="submit" disabled={busy}>{busy ? 'Đang tra cứu…' : 'Tra cứu'}</Button>
    </fieldset></form>{error && <div id="lookup-error-summary" ref={errorSummary} tabIndex={-1} role="region" aria-label="Không tra cứu được"><Notice title="Không tra cứu được" tone="error">{error}</Notice></div>}</Panel>
    <aside className={styles.lookupHelp}><BookingPhotoNote /><h2>Bạn cần chuẩn bị gì?</h2><p>Mã đặt chỗ và thông tin liên hệ đã dùng khi đặt. Kiểm tra lại ký tự và thông tin người đại diện nếu chưa tìm thấy.</p><p className={styles.helper}>Tra cứu chỉ hiển thị dữ liệu được hệ thống trả về; không tự xác nhận Booking hoặc thanh toán.</p></aside></div>
    {data && <section className={styles.stack} aria-label="Kết quả tra cứu"><h2 ref={resultHeading} tabIndex={-1}>Kết quả tra cứu · {data.bookingReference}</h2><BookingRecord booking={data} publicView /></section>}
  </div></RealBookingFrame>
  return <RealBookingFrame admin={admin}><PageHeader title="Tra cứu đặt chỗ" breadcrumb="HÀNH TRÌNH / ĐẶT CHỖ" description="Tra cứu hồ sơ bằng mã đặt chỗ và thông tin liên hệ của người đại diện." /><Panel title="Thông tin tra cứu"><form onSubmit={event => { event.preventDefault(); void lookup() }}><fieldset disabled={busy} className={styles.draftFields}>{[['reference', 'Mã đặt chỗ', reference, setReference], ['email', 'Email đại diện', email, setEmail], ['phone', 'Số điện thoại đại diện', phone, setPhone]].map(([key, label, value, setter]) => <Field key={String(key)} htmlFor={'lookup-' + key} label={String(label)}><input id={'lookup-' + key} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={String(value)} onChange={event => { (setter as (value: string) => void)(event.target.value); setData(null); setError('') }} /></Field>)}<Button type="submit" disabled={busy}>{busy ? 'Đang tra cứu…' : 'Tra cứu'}</Button></fieldset></form>{error && <Notice title="Không tra cứu được" tone="error">{error}</Notice>}</Panel>{data && <BookingRecord booking={data} />}</RealBookingFrame>
}
