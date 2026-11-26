import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router';
import { StaffCancellation } from '@/shared/cancellation';
import { CruisePackageEntitlements } from '@/domain/cruise-package';
import { ApiError, useReadQuery } from '@/shared/api';
import { useSessionAccess } from '@/shared/auth';
import { Button, ButtonLink, DataTable, Empty, Field, ListFooter, Modal, Notice, PageHeader, Panel, PermissionLink as Link, RecordFacts } from '@/shared/ui';
import { realBookingApi, type BookingDetail } from '../api/real-booking-api';
import { CruisePackageBookingHistory } from '../components/CruisePackageBookingCabin';
import { BookingContractAcceptance } from '../components/BookingContractAcceptance';
import { BookingRecord, BookingStatusBadge } from '../components/BookingRecord';
import { BookingOperations } from '../components/BookingOperations';
import { BookingSaleCatalogue } from './BookingSaleCruises';
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI';
import { bookingStatusName, bookingWhen } from '../model/real-booking-view';
import { bookingMoney } from '../model/booking-presentation';
import { bookingLookupErrors } from '../model/booking-agent';
import styles from '../components/LiveBooking.module.css';
import listStyles from '../components/BookingList.module.css';
import agentStyles from '../components/BookingAgent.module.css';

export function RealBookingList() {
    const access = useSessionAccess();
    const [params, setParams] = useSearchParams();
    const statusParam = params.get('status') ?? '';
    const status = Object.hasOwn(bookingStatusName, statusParam) ? statusParam : '';
    const cruiseId = params.get('cruiseId') ?? '';
    const pageParam = Number(params.get('page') ?? 1);
    const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam - 1 : 0;
    const updateFilters = (cruise: string, bookingStatus: string, nextPage = 0) => {
      const next = new URLSearchParams();
      if (cruise) next.set('cruiseId', cruise);
      if (bookingStatus) next.set('status', bookingStatus);
      if (nextPage) next.set('page', String(nextPage + 1));
      setParams(next);
    };
    const choices = useReadQuery('booking-history-cruises:' + access.userId, realBookingApi.historyCruises);
    const list = useReadQuery(`booking-list:${access.userId}:${page}:${status}:${cruiseId}`, useCallback(signal => realBookingApi.list(page, status || undefined, cruiseId || undefined, signal), [page, status, cruiseId]));
    const root = '/admin/bookings';
    const filtered = Boolean(status || cruiseId);
    const cruiseFilter = useRef<HTMLSelectElement>(null);
    const resetFilters = () => {
      updateFilters('', '');
      cruiseFilter.current?.focus();
    };
    const detailPath = (id: string) => root + '/' + encodeURIComponent(id) + (params.size ? '?' + params : '');
    const bookingAgent = access.roles.length === 1 && access.roles[0] === 'BOOKING_AGENT';
    const [openPanel, setOpenPanel] = useState<'lookup' | 'sale' | null>(null);
    return <RealBookingFrame><div className={agentStyles.workspace}>
    <PageHeader title="Quản lý đặt chỗ" breadcrumb="" actions={<>{!bookingAgent && <><ButtonLink tone="secondary" to={root + '/cruises'}>Chuyến đang mở bán</ButtonLink><ButtonLink tone="secondary" to={root + '/lookup'}>Tra cứu bằng mã</ButtonLink></>}
        {access.roles.includes('BOOKING_AGENT') && access.canDo('BOOKING_CREATE') && <ButtonLink to={root + '/new'}>Đặt hộ tại quầy</ButtonLink>}</>}/>
    <section className={`${agentStyles.register} ${agentStyles.bookingTable}`} aria-labelledby="booking-register-heading">
      <div className={agentStyles.registerHeading}>
        <div><h2 id="booking-register-heading">Danh sách đặt chỗ</h2>{!list.loading && !list.error && list.data && <p aria-live="polite">{list.data.totalElements.toLocaleString('vi-VN')} đặt chỗ</p>}</div>
        {bookingAgent && access.canDo('BOOKING_READ') && <div className={agentStyles.toolbarActions}>
          <Button tone="secondary" autoWidth aria-haspopup="dialog" onClick={() => setOpenPanel('sale')}>Chuyến đang mở bán</Button>
          <Button tone="secondary" autoWidth aria-haspopup="dialog" onClick={() => setOpenPanel('lookup')}>Tra cứu nhanh</Button>
        </div>}
      </div>
      <div className={agentStyles.registerFilters} role="group" aria-label="Bộ lọc đặt chỗ">
      <div className={agentStyles.toolbar}>
        <Field htmlFor="booking-cruise" label="Chuyến có đặt chỗ"><select ref={cruiseFilter} id="booking-cruise" value={cruiseId} onChange={event => updateFilters(event.target.value, status)}>
          <option value="">Tất cả chuyến trong phạm vi xem</option>{cruiseId && !choices.data?.some(item => item.cruiseId === cruiseId) && <option value={cruiseId}>Chuyến đang lọc</option>}{choices.data?.map(item => <option key={item.cruiseId} value={item.cruiseId}>{item.cruiseName}</option>)}
        </select></Field>
        <Field htmlFor="booking-status" label="Trạng thái đặt chỗ"><select id="booking-status" value={status} onChange={event => updateFilters(cruiseId, event.target.value)}>
          <option value="">Tất cả trạng thái</option>{Object.entries(bookingStatusName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></Field>
        <div className={agentStyles.toolbarActions}><Button tone="secondary" autoWidth onClick={() => { list.retry(); choices.retry(); }}>Tải lại</Button>{filtered && <Button tone="text" autoWidth onClick={resetFilters}>Xóa bộ lọc</Button>}</div>
      </div>
      {choices.loading && <p role="status">Đang tải bộ lọc chuyến…</p>}
      {choices.error && <Notice title="Chưa tải được bộ lọc chuyến" tone="warning">Danh sách đặt chỗ vẫn được tải độc lập. <Button tone="text" onClick={choices.retry}>Thử lại bộ lọc</Button></Notice>}
      </div>
      <div className={agentStyles.registerResults}>
      <BookingReadState {...list} publicResource={undefined}/>
      {list.data && !list.loading && !list.error && (list.data.content.length ? <>
        <div className={agentStyles.desktopRows}>
          <p className={agentStyles.scrollHint}>Cuộn ngang để xem các cột còn lại.</p>
          <DataTable label="Danh sách đặt chỗ" headers={['Mã đặt chỗ', 'Tên chuyến', 'Tạo lúc (giờ VN)', 'Khách', 'Tổng giá vé', 'Trạng thái', 'Thao tác']}>
          {list.data.content.map(item => <tr key={item.bookingId}>
            <td><Link className={listStyles.reference} to={detailPath(item.bookingId)}>{item.bookingReference}</Link></td>
            <td><span className={listStyles.cruise}>{item.cruiseName}</span></td>
            <td>{bookingWhen(item.createdAt)}</td><td className={agentStyles.numeric}>{item.passengerCount ?? '—'}</td><td className={agentStyles.numeric}>{item.agreedFareAmount != null && item.currency ? bookingMoney(item.agreedFareAmount, item.currency) : '—'}</td>
            <td><BookingStatusBadge status={item.bookingStatus} /></td>
            <td><Link className={listStyles.detail} aria-label={`Chi tiết đặt chỗ ${item.bookingReference}`} to={detailPath(item.bookingId)}>Chi tiết</Link></td>
          </tr>)}
        </DataTable></div>
        <ul className={agentStyles.mobileRows} aria-label="Danh sách đặt chỗ">
          {list.data.content.map(item => <li key={item.bookingId}>
            <div className={agentStyles.resultsHeading}>
              <Link className={listStyles.reference} to={detailPath(item.bookingId)}>{item.bookingReference}</Link>
              <BookingStatusBadge status={item.bookingStatus} />
            </div>
            <p>{item.cruiseName}</p>
            <RecordFacts entries={[
              ['Ngày tạo', bookingWhen(item.createdAt)],
              ['Hành khách', item.passengerCount ?? 'Chưa cung cấp'],
              ['Tổng giá vé', item.agreedFareAmount != null && item.currency ? bookingMoney(item.agreedFareAmount, item.currency) : 'Chưa cung cấp'],
            ]} />
          </li>)}
        </ul>
      </> : <Empty className={agentStyles.registerEmpty} title={filtered ? 'Không tìm thấy đặt chỗ phù hợp' : 'Chưa có đặt chỗ trong phạm vi xem'}>
        <p>{filtered ? 'Thử thay đổi chuyến khởi hành hoặc trạng thái.' : 'Bạn có thể tải lại danh sách hoặc tra cứu nếu đã có mã đặt chỗ.'}</p>
      </Empty>)}
      {list.data && !list.loading && !list.error && (page > 0 || list.data.totalPages > 1) && <ListFooter summary={null}>
        <Button tone="secondary" size="compact" disabled={page === 0} onClick={() => updateFilters(cruiseId, status, page - 1)}>Trang trước</Button>
          <span>Trang {page + 1}{page < list.data.totalPages ? ' / ' + list.data.totalPages : ''}</span>
          <Button tone="secondary" size="compact" disabled={page + 1 >= list.data.totalPages} onClick={() => updateFilters(cruiseId, status, page + 1)}>Trang sau</Button>
      </ListFooter>}
      </div>
    </section>
    {openPanel === 'lookup' && <BookingLookup onClose={() => setOpenPanel(null)} />}
    {openPanel === 'sale' && <Modal title="Chuyến đang mở bán"
      onClose={() => setOpenPanel(null)} variant="drawer" quiet protectChanges={false}>
      <BookingSaleCatalogue inDrawer />
    </Modal>}
    </div>
  </RealBookingFrame>;
}

export function RealBookingDetail({ related }: { related?: (bookingId: string) => ReactNode }) {
    const { bookingId = '' } = useParams();
    const { search } = useLocation();
    const access = useSessionAccess();
    const [legacyCancelId, setLegacyCancelId] = useState('');
    const [feedback, setFeedback] = useState<{ id: string; message: string } | null>(null);
    const detail = useReadQuery('real-booking:' + access.userId + ':' + bookingId, useCallback(signal => realBookingApi.get(bookingId, signal), [bookingId]));
    const [readback, setReadback] = useState<{ source: BookingDetail; booking: BookingDetail } | null>(null);
    const booking = readback?.source === detail.data ? readback.booking : detail.data;
    const hasFare = booking?.passengers.some(person => person.farePackageOfferId);
    const actionCompleted = (message: string) => {
        setFeedback({ id: bookingId, message });
        detail.retry();
    };
    return <RealBookingFrame><div className={agentStyles.workspace}>
      <PageHeader title={booking?.bookingReference ?? 'Chi tiết đặt chỗ'} breadcrumb="Đặt chỗ / Chi tiết"
        description={booking?.cruiseName}
        actions={<ButtonLink tone="secondary" to={'/admin/bookings' + search}>Về danh sách đặt chỗ</ButtonLink>} />
      {booking && <div className={agentStyles.detailSummary}>
        <BookingStatusBadge status={booking.bookingStatus} />
        <nav aria-label="Các mục của hồ sơ đặt chỗ">
          <a href="#booking-contract">Hợp đồng</a>
          <a href="#booking-payment">Thanh toán</a>
          {(booking.bookingStatus !== 'Cancelled' || legacyCancelId !== bookingId || hasFare) && <a href="#booking-actions">Thao tác và hủy</a>}
        </nav>
      </div>}
      {feedback?.id === bookingId && <Notice title={feedback.message} tone="success">{null}</Notice>}
      <BookingReadState {...detail} publicResource="chi tiết đặt chỗ" />
      {booking && <div className={agentStyles.detail}>
        <BookingRecord booking={booking} summaryInHeader contractAction={
          <BookingContractAcceptance booking={booking} onRefresh={detail.retry} onChanged={() => actionCompleted('Đã ghi nhận hợp đồng')} />
        } />
        <aside id="booking-actions" aria-label="Xử lý đặt chỗ" className={agentStyles.sections}>
          <BookingOperations key={`ops:${bookingId}`} booking={booking} legacyCancelAllowed={legacyCancelId === bookingId} onChanged={actionCompleted}
            onRead={latest => { if (detail.data) setReadback({ source: detail.data, booking: latest }); }} />
          <StaffCancellation confirmRequest key={`cancel:${bookingId}`} bookingId={bookingId} bookingStatus={booking.bookingStatus} formatDate={bookingWhen}
            onChanged={detail.retry} onLegacyAvailable={setLegacyCancelId} />
          <CruisePackageBookingHistory booking={booking} />
          {hasFare && <CruisePackageEntitlements bookingId={bookingId} passengers={booking.passengers} />}
        </aside>
      </div>}
      {booking && related && !hasFare && <details className={styles.legacyPackages}>
        <summary>Gói dịch vụ của hành khách</summary>
        {related(bookingId)}
      </details>}
    </div></RealBookingFrame>;
}

export function BookingLookupPage() {
    const [params] = useSearchParams();
    const access = useSessionAccess();
    const bookingAgent = access.roles.length === 1 && access.roles[0] === 'BOOKING_AGENT';
    return <RealBookingFrame><div className={agentStyles.workspace}>
      <PageHeader title="Tra cứu đặt chỗ" breadcrumb="" actions={!bookingAgent && <ButtonLink tone="secondary" to="/admin/bookings">Về danh sách đặt chỗ</ButtonLink>} />
      <BookingLookup initialReference={params.get('reference') ?? ''} />
    </div></RealBookingFrame>;
}

function BookingLookup({ initialReference = '', onClose }: { initialReference?: string; onClose?: () => void }) {
    const formId = useId();
    const [reference, setReference] = useState(initialReference), [email, setEmail] = useState(''), [phone, setPhone] = useState(''), [data, setData] = useState<BookingDetail | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), lock = useRef(false);
    const formRef = useRef<HTMLFormElement>(null);
    const requestRef = useRef<AbortController | null>(null);
    const inDialog = Boolean(onClose);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [validation, setValidation] = useState(0);
    useEffect(() => {
      if (inDialog) formRef.current?.querySelector('input')?.focus();
    }, [inDialog]);
    useEffect(() => { if (validation) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [validation]);
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
                setError(value instanceof ApiError && [400, 404].includes(value.status)
                    ? 'Kiểm tra mã đặt chỗ và dùng email hoặc số điện thoại đã đăng ký của người đại diện.'
                    : value instanceof ApiError && [401, 403].includes(value.status)
                        ? 'Thông tin liên hệ chưa khớp hoặc tài khoản không có quyền tra cứu. Kiểm tra lại thông tin.'
                        : 'Hệ thống chưa trả về kết quả. Thử tra cứu lại.');
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    const fields = [
        { key: 'reference', label: 'Mã đặt chỗ', type: 'text', value: reference, set: setReference },
        { key: 'email', label: 'Email đại diện', type: 'email', value: email, set: setEmail },
        { key: 'phone', label: 'Số điện thoại đại diện', type: 'tel', value: phone, set: setPhone },
    ];
    const description = 'Dùng email hoặc số điện thoại đã đăng ký của người đại diện.';
    const submit = <Button type="submit" form={formId} autoWidth busy={busy}>Tra cứu</Button>;
    const form = <>
        <form id={formId} ref={formRef} noValidate onSubmit={event => { event.preventDefault(); void lookup(); }}>
          <fieldset disabled={busy} className={styles.draftFields + ' ' + agentStyles.lookup}>
            {fields.map(field => <Field key={field.key} htmlFor={formId + '-' + field.key} label={field.label} error={fieldErrors[field.key]}>
              <input type={field.type} value={field.value} required={field.key === 'reference'} onChange={event => {
                field.set(event.target.value);
                setData(null); setError('');
                setFieldErrors(current => ({ ...current, [field.key]: '' }));
              }} />
            </Field>)}
            {!onClose && <div className={agentStyles.lookupActions}>{submit}</div>}
          </fieldset>
        </form>
        {busy && <p role="status">Đang tra cứu đặt chỗ…</p>}
        {error && <Notice title="Không tra cứu được" tone="error">{error}</Notice>}
      </>;
    if (onClose) return <Modal title="Tra cứu nhanh" description={description} onClose={onClose} busy={busy} variant="drawer" quiet
      footer={<><Button tone="secondary" autoWidth data-overlay-dismiss onClick={onClose}>Đóng</Button>{submit}</>}>
      {form}
      {data && <div className={agentStyles.lookupMatch}>
        <Notice title={`Đã tìm thấy ${data.bookingReference}`} tone="success">{data.cruiseName}</Notice>
        <ButtonLink tone="secondary" autoWidth to={'/admin/bookings/' + encodeURIComponent(data.bookingId)}>Xem chi tiết đặt chỗ</ButtonLink>
      </div>}
    </Modal>;
    return <div className={agentStyles.lookupWorkspace}>
      <Panel title="Thông tin tra cứu" subtitle={description} className={agentStyles.lookupPanel}>{form}</Panel>
      {data && <section aria-label="Kết quả tra cứu"><p role="status">Đã tìm thấy đặt chỗ {data.bookingReference}. Kết quả chỉ dùng để tra cứu.</p><BookingRecord booking={data} /></section>}
    </div>;
}
