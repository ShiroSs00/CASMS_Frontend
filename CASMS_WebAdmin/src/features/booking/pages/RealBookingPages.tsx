import { StaffCancellation } from '@/shared/cancellation'
import { CruisePackageEntitlements } from '@/domain/cruise-package';
import { CruisePackageBookingHistory } from '../components/CruisePackageBookingCabin';
import { BookingContractAcceptance } from '../components/BookingContractAcceptance';

import { bookingStatusName, bookingWhen, bookingPlanName } from '../model/real-booking-view';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { PermissionLink as Link } from '@/shared/ui';
import { useReadQuery } from '@/shared/api';
import { useSessionAccess } from '@/shared/auth';
import { Badge, Button, ButtonLink, DataTable, Empty, Field, ListFooter, Modal, Notice, PageHeader, Panel, RecordFacts } from '@/shared/ui';
import { realBookingApi, type BookingDetail } from '../api/real-booking-api';
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI';
import { bookingMutationFailure } from '../model/booking-mutation';
import styles from '../components/LiveBooking.module.css';
import listStyles from '../components/BookingList.module.css';
import agentStyles from '../components/BookingAgent.module.css';
import { bookingLookupErrors } from '../model/booking-agent';


import { BookingInstallments } from '../components/BookingInstallments';


import { canManageBooking } from '../model/booking-permissions';
export function RealBookingList() {
    const access = useSessionAccess();
    const [status, setStatus] = useState(''), [page, setPage] = useState(0), [cruiseId, setCruiseId] = useState('');
    const choices = useReadQuery('booking-history-cruises:' + access.userId, realBookingApi.historyCruises);
    const list = useReadQuery(`booking-list:${access.userId}:${page}:${status}:${cruiseId}`, useCallback(signal => realBookingApi.list(page, status || undefined, cruiseId || undefined, signal), [page, status, cruiseId]));
    const root = '/admin/bookings';
    const filtered = Boolean(status || cruiseId);
    const resetFilters = () => { setStatus(''); setCruiseId(''); setPage(0); };
    return <RealBookingFrame><div className={agentStyles.workspace}>
    <PageHeader title="Quản lý đặt chỗ" breadcrumb="Đặt chỗ" description="Tra cứu và xử lý đặt chỗ trong phạm vi tài khoản được phép xem." actions={<><ButtonLink tone="secondary" to={root + '/cruises'}>Chuyến đang mở bán</ButtonLink><ButtonLink tone="secondary" to={root + '/lookup'}>Tra cứu bằng mã</ButtonLink>
        {access.canDo('BOOKING_CREATE') && <ButtonLink to={root + '/new'}>Tạo đặt chỗ</ButtonLink>}</>}/>
    <section aria-label="Bộ lọc đặt chỗ">
      <div className={agentStyles.toolbar}>
        <Field htmlFor="booking-cruise" label="Chuyến có đặt chỗ"><select value={cruiseId} onChange={event => { setCruiseId(event.target.value); setPage(0); }}>
          <option value="">Tất cả chuyến trong phạm vi xem</option>{choices.data?.map(item => <option key={item.cruiseId} value={item.cruiseId}>{item.cruiseName}</option>)}
        </select></Field>
        <Field htmlFor="booking-status" label="Trạng thái đặt chỗ"><select value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}>
          <option value="">Tất cả trạng thái</option>{Object.entries(bookingStatusName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></Field>
        <div className={agentStyles.toolbarActions}><Button tone="secondary" onClick={() => { list.retry(); choices.retry(); }}>Tải lại</Button><Button tone="text" disabled={!filtered} onClick={resetFilters}>Xóa bộ lọc</Button></div>
      </div>
      <p className={agentStyles.helper}>Bộ lọc chuyến được tổng hợp từ đặt chỗ bạn được phép xem, bao gồm chuyến đã đóng bán.</p>
      {choices.loading && <p role="status">Đang tải bộ lọc chuyến…</p>}
      {choices.error && <Notice title="Chưa tải được bộ lọc chuyến" tone="warning">Danh sách đặt chỗ vẫn được tải độc lập. <Button tone="text" onClick={choices.retry}>Thử lại bộ lọc</Button></Notice>}
    </section>
    <section className={`${agentStyles.table} ${agentStyles.bookingTable}`} aria-labelledby="booking-register-heading">
      <div className={agentStyles.resultsHeading}><h2 id="booking-register-heading">Danh sách đặt chỗ</h2>{!list.loading && !list.error && list.data && <span aria-live="polite">{list.data.totalElements.toLocaleString('vi-VN')} đặt chỗ</span>}</div>
      <BookingReadState {...list} publicResource={undefined}/>
      {list.data && !list.loading && !list.error && (list.data.content.length ? <>
        <DataTable label="Danh sách đặt chỗ" headers={['Mã đặt chỗ', 'Tên chuyến', 'Tạo lúc (giờ Việt Nam)', 'Hành khách', 'Tổng giá vé', 'Trạng thái', 'Thao tác']}>
          {list.data.content.map(item => <tr key={item.bookingId}>
            <td><Link className={listStyles.reference} to={`${root}/${item.bookingId}`}>{item.bookingReference}</Link></td>
            <td><span className={listStyles.cruise}>{item.cruiseName}</span></td>
            <td>{bookingWhen(item.createdAt)}</td><td className={agentStyles.numeric}>{item.passengerCount ?? 'Chưa cung cấp'}</td><td className={agentStyles.numeric}>{item.agreedFareAmount != null && item.currency ? `${item.agreedFareAmount.toLocaleString('vi-VN')} ${item.currency}` : 'Chưa cung cấp'}</td>
            <td><Badge label={bookingStatusName[item.bookingStatus] ?? item.bookingStatus} tone={item.bookingStatus === 'Confirmed' ? 'success' : item.bookingStatus === 'Cancelled' ? 'neutral' : 'warning'}/></td>
            {false}
            <td><Link className={listStyles.detail} aria-label={`Chi tiết đặt chỗ ${item.bookingReference}`} to={`${root}/${item.bookingId}`}>Xem chi tiết →</Link></td>
          </tr>)}
        </DataTable>
      </> : <Empty title={filtered ? 'Không tìm thấy đặt chỗ phù hợp' : 'Chưa có đặt chỗ trong phạm vi xem'}>
        <p>{filtered ? 'Thử thay đổi chuyến khởi hành hoặc trạng thái.' : 'Chưa có kết quả trong phạm vi tài khoản được phép xem. Bạn có thể tải lại hoặc tra cứu bằng mã; kết quả này chưa xác định được tình trạng phân công chuyến.'}</p>
        {filtered && <Button tone="secondary" onClick={resetFilters}>Xóa bộ lọc</Button>}
      </Empty>)}
      {list.data && !list.loading && !list.error && <ListFooter summary={`${list.data.totalElements.toLocaleString('vi-VN')} đặt chỗ${filtered ? ' phù hợp bộ lọc' : ''}`}>
        {list.data.totalPages > 1 && <><Button tone="secondary" size="compact" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>← Trang trước</Button>
          <span>Trang {page + 1} / {list.data.totalPages}</span>
          <Button tone="secondary" size="compact" disabled={page + 1 >= list.data.totalPages} onClick={() => setPage(value => value + 1)}>Trang sau →</Button></>}
      </ListFooter>}
    </section></div>
  </RealBookingFrame>;
}
export function RealBookingDetail({ related }: {
    related?: (bookingId: string) => ReactNode;
}) {
    const { bookingId = '' } = useParams();
    const access = useSessionAccess();
    const [legacyCancelId, setLegacyCancelId] = useState('');
    const detail = useReadQuery('real-booking:' + access.userId + ':' + bookingId, useCallback(signal => realBookingApi.get(bookingId, signal), [bookingId]));
    const content = <>{false}<PageHeader title={detail.data?.bookingReference ?? 'Chi tiết đặt chỗ'} breadcrumb="ĐẶT CHỖ / CHI TIẾT" actions={<ButtonLink tone="secondary" to={'/admin/bookings'}>Danh sách đặt chỗ</ButtonLink>}/><BookingReadState {...detail} publicResource={undefined}/>{detail.data && <><div className={`${styles.recordWorkspace} ${agentStyles.detail}`}><div><BookingRecord booking={detail.data}/></div><aside className={styles.recordActions}><>{<BookingContractAcceptance key={bookingId + ':' + detail.data.contractStatus} booking={detail.data} onChanged={detail.retry}/>}<CruisePackageBookingHistory booking={detail.data}/>{detail.data.passengers.some(p => p.farePackageOfferId) && <CruisePackageEntitlements bookingId={bookingId} passengers={detail.data.passengers}/>}{detail.data.passengers.some(p => p.farePackageOfferId) ? <Notice title="Cabin theo gói du thuyền" tone="info">Luồng hiện tại chưa hỗ trợ đổi cabin của gói du thuyền. Nhóm và cabin đã phân được giữ nguyên.</Notice> : null}<StaffCancellation confirmRequest key={bookingId + "-cancellation"} bookingId={bookingId} bookingStatus={detail.data.bookingStatus} onChanged={detail.retry} onLegacyAvailable={setLegacyCancelId}/><BookingOperations key={bookingId} legacyCancelAllowed={legacyCancelId === bookingId} booking={detail.data} onChanged={detail.retry}/></></aside></div>{related&&!detail.data.passengers.some(passenger=>passenger.farePackageOfferId)&&<details className={styles.legacyPackages}>
      <summary>Gói dịch vụ của hành khách</summary>
      {related(bookingId)}
    </details>}</>}</>;
    return <RealBookingFrame>{content}</RealBookingFrame>;
}
export function BookingRecord({ booking }: {
    booking: BookingDetail;
}) {
    return <><Panel title="Chuyến khởi hành và điều khoản thanh toán"><RecordFacts entries={[
            ['Mã đặt chỗ', booking.bookingReference], ['Trạng thái', bookingStatusName[booking.bookingStatus]], ['Tên chuyến', booking.cruiseName],
            ['Thời gian · giờ Việt Nam', `${bookingWhen(booking.departureDatetime)} → ${bookingWhen(booking.returnDatetime)}`],
            ['Tên tàu', booking.shipName ?? 'Chưa cung cấp'], ['Mã chuyến', booking.cruiseCode ?? 'Chưa cung cấp'], ['Giá vé', `${booking.agreedFareAmount ?? 'Chưa có'} ${booking.currency ?? ''}`], ['Cọc yêu cầu', `${booking.requiredDepositAmount ?? 'Chưa có'} ${booking.currency ?? ''}`],
            ['Hạn thanh toán', bookingWhen(booking.finalPaymentDueAt)], ['Hồ sơ điều khoản', booking.contractReference ?? 'Chưa có'],
            ['Mã hồ sơ bản ký', booking.contractDocumentReference ?? 'Chưa cung cấp'], ['Ghi nhận bản ký lúc', bookingWhen(booking.contractAcceptedAt)], ['Đã thu được đối soát', booking.totalPaidAmount == null ? 'Chưa cung cấp' : `${booking.totalPaidAmount} ${booking.currency}`], ['Còn phải thanh toán', booking.outstandingBalance == null ? 'Chưa cung cấp' : `${booking.outstandingBalance} ${booking.currency}`], ['Trạng thái hợp đồng', booking.contractStatus ? ({ Draft: 'Bản nháp', Accepted: 'Đã chấp thuận', Cancelled: 'Đã hủy' } as Record<string, string>)[booking.contractStatus] ?? booking.contractStatus : 'Chưa có trạng thái'],
        ]}/>{booking.contractSigningInstructions && <p>{booking.contractSigningInstructions}</p>}{booking.cancellationReason && <p>Lý do hủy: {booking.cancellationReason}</p>}<p>Hình thức: {bookingPlanName(booking.paymentPlan)}</p><BookingInstallments booking={booking}/><p>Thanh toán theo hướng dẫn đã được xác nhận. Trạng thái đặt chỗ được cập nhật sau khi đối soát.</p></Panel><Panel title="Hành khách & Cabin" className={agentStyles.table}><DataTable label="Hành khách đặt chỗ" headers={['Hành khách', 'Ngày sinh / Quốc tịch', 'Liên hệ', 'Cabin', 'Gói dịch vụ', 'Trạng thái']}>{booking.passengers.map(item => <tr key={item.bookingPassengerId}><th scope="row">{item.fullName}</th><td>{item.dateOfBirth ?? 'Chưa cung cấp'}<br />{item.nationality ?? 'Chưa cung cấp'}</td><td>{item.email ?? 'Chưa cung cấp'}<br />{item.phoneNumber ?? 'Chưa cung cấp'}</td><td>{item.cabinNumber ?? 'Chưa phân Cabin'}</td><td>{item.tourPackageName ?? 'Chưa chọn gói'}</td><td>{item.participationStatus === 'Active' ? 'Tham gia' : 'Đã hủy'}</td></tr>)}</DataTable></Panel></>;
}
function BookingOperations({ booking, onChanged, legacyCancelAllowed }: {
    booking: BookingDetail;
    onChanged: () => void;
    legacyCancelAllowed: boolean;
}) {
    const access = useSessionAccess(), lock = useRef(false);
    const [uncertain, setUncertain] = useState(false);
    const [action, setAction] = useState<'confirm' | 'cancel' | 'cabin' | null>(null), [reason, setReason] = useState(''), [person, setPerson] = useState(''), [cabinId, setCabinId] = useState(''), [acknowledged, setAcknowledged] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const cabins = useReadQuery('booking-change-cabins:' + booking.cruiseId + action, useCallback(signal => action === 'cabin' ? realBookingApi.cabins(booking.cruiseId, signal) : Promise.resolve(null), [booking.cruiseId, action]));
    const permitted = (value: NonNullable<typeof action>) => (value !== 'cancel' || legacyCancelAllowed) && canManageBooking(value, booking.bookingStatus, access) && (value !== 'confirm' || booking.contractStatus === 'Accepted') && (value !== 'cabin' || booking.passengers.some(p => !p.farePackageOfferId && p.participationStatus === 'Active'));
    async function confirm() {
        if (!action || !permitted(action) || lock.current || uncertain)
            return;
        if (action === 'cancel' && !reason.trim()) {
            setError('Nhập lý do hủy đặt chỗ.');
            return;
        }
        if (action === 'confirm' && !acknowledged) {
            setError('Cần đối soát tiền cọc/thanh toán trước khi xác nhận.');
            return;
        }
        if (action === 'cabin' && (!booking.passengers.some(item => item.bookingPassengerId === person && !item.farePackageOfferId && item.participationStatus === 'Active' && item.cabinId !== cabinId) || !cabins.data?.some(item => item.cabinId === cabinId && item.remainingCapacity >= 1))) {
            setError('Chọn hành khách đang tham gia và phòng trống khác.');
            return;
        }
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            const saved = action === 'confirm' ? await realBookingApi.confirm(booking.bookingId) : action === 'cancel' ? await realBookingApi.cancel(booking.bookingId, reason) : await realBookingApi.changeCabin(person, cabinId, reason);
            if (saved.bookingId !== booking.bookingId)
                throw new Error('Kết quả không thuộc đặt chỗ này; tải lại để kiểm tra trước thao tác tiếp.');
            setAction(null);
            onChanged();
        }
        catch (value) {
            const failure = bookingMutationFailure(value);
            setError(failure.message);
            setUncertain(failure.uncertain);
            if (failure.conflict) cabins.retry();
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    if (!(['confirm', 'cancel', 'cabin'] as const).some(permitted) && !(booking.bookingStatus === 'Draft' && access.canDo('BOOKING_CONFIRM')))
        return null;
    const labels = { confirm: 'Xác nhận đặt chỗ', cancel: 'Hủy đặt chỗ', cabin: 'Đổi Cabin' };
    return <Panel title="Quản lý đặt chỗ"><div className={agentStyles.actions}>{uncertain && <Notice title="Cần kiểm tra kết quả thao tác" tone="warning">Chưa xác định được kết quả; không gửi lại để tránh thao tác trùng. <Button onClick={onChanged}>Tải lại đặt chỗ để kiểm tra</Button></Notice>}{(['confirm', 'cancel', 'cabin'] as const).filter(permitted).map(value => <Button key={value} tone={value === 'cancel' ? 'danger' : 'secondary'} disabled={busy || uncertain || !permitted(value)} onClick={() => { setAction(value); setError(''); setAcknowledged(false); }}>{labels[value]}</Button>)}</div>{booking.bookingStatus === 'Draft' && access.canDo('BOOKING_CONFIRM') && booking.contractStatus !== 'Accepted' && <p>Ghi nhận hợp đồng đã ký trước khi xác nhận đặt chỗ. Các khoản thu vẫn phải được hệ thống đối soát.</p>}{action && permitted(action) && <Modal title={labels[action]} busy={busy} onClose={() => setAction(null)} footer={<><Button tone="secondary" disabled={busy} onClick={() => setAction(null)}>Quay lại</Button><Button tone={action === 'cancel' ? 'danger' : 'primary'} disabled={busy || uncertain || !permitted(action)} onClick={() => void confirm()}>{labels[action]}</Button></>}>{action === 'confirm' && <><p>Hệ thống sẽ kiểm tra hợp đồng, khoản thu đã xác nhận và sức chứa trước khi xác nhận đặt chỗ.</p><label><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)}/> Tôi đã kiểm tra chứng từ cọc/thanh toán bên ngoài.</label></>}{action === 'cabin' && <><BookingReadState {...cabins}/><p>Cabin hiện tại: {booking.passengers.find(p => p.bookingPassengerId === person)?.cabinNumber ?? 'Chưa chọn hành khách'} → Cabin mới: {cabins.data?.find(c => c.cabinId === cabinId)?.cabinNumber ?? 'Chưa chọn'}</p><Field htmlFor="booking-person" label="Hành khách"><select id="booking-person" value={person} onChange={event => { setPerson(event.target.value); setCabinId(''); }}><option value="">Chọn hành khách</option>{booking.passengers.filter(item => !item.farePackageOfferId && item.participationStatus === 'Active').map(item => <option key={item.bookingPassengerId} value={item.bookingPassengerId}>{item.fullName} · {item.cabinNumber ?? 'Chưa phân Cabin'}</option>)}</select></Field><Field htmlFor="booking-new-cabin" label="Cabin trống mới"><select id="booking-new-cabin" value={cabinId} onChange={event => setCabinId(event.target.value)}><option value="">Chọn Cabin trống</option>{cabins.data?.filter(item => item.remainingCapacity > 0 && item.cabinId !== booking.passengers.find(p => p.bookingPassengerId === person)?.cabinId).map(item => <option key={item.cabinId} value={item.cabinId}>Boong {item.deckNumber} · {item.cabinNumber} · Còn {item.remainingCapacity} chỗ</option>)}</select></Field></>}{action !== 'confirm' && <Field htmlFor="booking-reason" label={action === 'cancel' ? 'Lý do hủy *' : 'Lý do đổi Cabin'}><textarea id="booking-reason" value={reason} onChange={event => setReason(event.target.value)}/></Field>}{error && <Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}{uncertain && <Notice title="Kiểm tra kết quả trước khi thao tác tiếp" tone="warning">Đóng hộp thoại và tải lại đặt chỗ để kiểm tra kết quả. Thao tác gửi lại đang được khóa.</Notice>}</Modal>}</Panel>;
}
export function BookingLookupPage() {
    const [params] = useSearchParams();
    const [reference, setReference] = useState(() => params.get('reference') ?? ''), [email, setEmail] = useState(''), [phone, setPhone] = useState(''), [data, setData] = useState<BookingDetail | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), lock = useRef(false);
    const requestRef = useRef<AbortController | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [validation, setValidation] = useState(0);
    useEffect(() => { if (validation) document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [validation]);
    useEffect(() => () => requestRef.current?.abort(), []);
    async function lookup() {
        if (lock.current)
            return;
        setData(null);
        setError('');
        const invalid = bookingLookupErrors(reference, email, phone);
        setFieldErrors(invalid);
        if (Object.keys(invalid).length) { setValidation(value => value + 1); return; }
        lock.current = true;
        setBusy(true);
        const controller = new AbortController();
        requestRef.current = controller;
        try {
            const result = await realBookingApi.lookup(reference, email, phone, controller.signal);
            if (!controller.signal.aborted)
                setData(result);
        }
        catch (value) {
            if (!controller.signal.aborted)
                setError(value instanceof Error ? value.message : 'Không tìm thấy đặt chỗ khớp thông tin.');
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return <RealBookingFrame><PageHeader title="Tra cứu đặt chỗ" breadcrumb="Đặt chỗ / Tra cứu" actions={<ButtonLink tone="secondary" to="/admin/bookings">Về danh sách đặt chỗ</ButtonLink>}/><Panel title="Thông tin tra cứu"><p>Tra cứu bằng mã và thông tin liên hệ không thay thế quyền quản lý chuyến được phân công.</p><form noValidate className={agentStyles.lookup} onSubmit={event => { event.preventDefault(); void lookup(); }}><fieldset disabled={busy} className={styles.draftFields}>{[['reference', 'Mã đặt chỗ', reference, setReference], ['email', 'Email đại diện', email, setEmail], ['phone', 'Số điện thoại đại diện', phone, setPhone]].map(([key, label, value, setter]) => <Field key={String(key)} htmlFor={'lookup-' + key} label={String(label)} error={fieldErrors[String(key)]}><input aria-invalid={Boolean(fieldErrors[String(key)])} id={'lookup-' + key} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={String(value)} onChange={event => { (setter as (value: string) => void)(event.target.value); setData(null); setError(''); setFieldErrors({}); }}/></Field>)}<Button type="submit" disabled={busy}>{busy ? 'Đang tra cứu…' : 'Tra cứu'}</Button></fieldset></form>{error && <Notice title="Không tra cứu được" tone="error">{error}</Notice>}</Panel>{data && <BookingRecord booking={data}/>}</RealBookingFrame>;
}
