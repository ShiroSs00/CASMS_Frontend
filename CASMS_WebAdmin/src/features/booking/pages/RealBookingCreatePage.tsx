import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome';
import { CruisePackageCabinSelection } from '../components/CruisePackageCabinSelection';
import { cruisePackageApi } from '@/domain/cruise-package';
import { bookingCruisePackageSelectionErrors } from '../api/real-booking-api';
import { businessCopy } from '@/shared/i18n/business-copy';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { PermissionLink as Link } from '@/shared/ui';
import { useSessionAccess } from '@/shared/auth';
import { useReadQuery } from '@/shared/api';
import { Badge, Button, ButtonLink, Empty, Field, Loading, Modal, Notice, PageHeader, Panel, RecordFacts } from '@/shared/ui';
import { bookingFieldErrors, bookingPackageErrors, realBookingApi } from '../api/real-booking-api';
import { createQuotedBooking, quoteSelection, recoverQuotedBooking, requestBookingQuote, type BookingQuoteIntent } from '../api/booking-quote-api';
import { CabinPassengerFields, PassengerDetailsFields } from '../components/LiveBookingFields';
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI';
import { bookingMutationFailure, bookingTransactionFailure } from '../model/booking-mutation';
import { blankBookingPerson, initialLiveBooking, useLiveBooking } from '../model/live-booking-context';
import { availableBookingStep } from '../model/booking-progress';
import { catalogReturn } from '../model/live-booking-navigation';
import { bookingBirthDate, bookingWhen } from '../model/real-booking-view';

import { ApiError } from '@/shared/api';
import { BookingRecord } from '../components/BookingRecord';
import { bookingMoney } from '../model/booking-presentation';
import styles from '../components/LiveBooking.module.css';
import agentStyles from '../components/BookingAgent.module.css';
import { BookingShipModel, type BookingModelRenderer } from '../components/BookingShipModel';
import { readBookingRecovery, writeBookingRecovery, type BookingRecovery } from '../model/booking-agent';
const labels = ['Chọn chuyến và cabin', 'Hành khách và thanh toán', 'Xem lại và xác nhận'];
const shortLabels = ['Chọn cabin', 'Hành khách', 'Xem lại'];
const descriptions = ['Chọn chuyến, phòng cho từng hành khách và gói dịch vụ nếu cần.', 'Điền thông tin hành khách và chọn kế hoạch thanh toán. Bước này chưa thu tiền.', 'Kiểm tra lựa chọn và thông tin liên hệ. Bạn có thể quay lại sửa trước khi gửi.'];
const plans: Record<string, string> = { STAGES: 'Thanh toán theo đợt', DEPOSIT: 'Đặt cọc & thanh toán phần còn lại', FULL: 'Thanh toán toàn bộ' };
export function RealBookingCreatePage({ step: routeStep, renderShipModel }: {
    step?: 1 | 2 | 3;
    renderShipModel?: BookingModelRenderer;
}) {
    return <ExistingBookingFlow step={routeStep} renderShipModel={renderShipModel}/>;
}
function ExistingBookingFlow({ step: routeStep, renderShipModel }: {
    step?: 1 | 2 | 3;
    renderShipModel?: BookingModelRenderer;
}) {
    const [params] = useSearchParams(), navigate = useNavigate();
    const step = routeStep ?? (params.get('step') === '2' ? 2 : params.get('step') === '3' ? 3 : 1);
    const { draft, setDraft, saved, setSaved, uncertain, setUncertain, busy, setBusy, submitError: error, setSubmitError: setError, errors, setErrors, submissionLockRef } = useLiveBooking();
    const access = useSessionAccess(), heading = useRef<HTMLHeadingElement>(null);
    const [pendingRecovery, setPendingRecovery] = useState<BookingRecovery | null>(() => access.userId ? readBookingRecovery(access.userId) : null);
    const [recoveryError, setRecoveryError] = useState('');
    const [review, setReview] = useState(false), [copied, setCopied] = useState('');
    const form = useRef<HTMLFormElement>(null);
    const [receivedQuote, setQuoteIntent] = useState<BookingQuoteIntent | null>(null), [quoteExpired, setQuoteExpired] = useState(false), [quoteUnknown, setQuoteUnknown] = useState(false);
    const quoteIntent = receivedQuote?.selection === quoteSelection(draft) ? receivedQuote : null;
    useEffect(() => {
        if (!quoteIntent?.quote.expiresAt)
            return;
        const remaining = Date.parse(quoteIntent.quote.expiresAt) - Date.now();
        const timer = setTimeout(() => setQuoteExpired(true), Math.max(0, remaining));
        return () => clearTimeout(timer);
    }, [quoteIntent]);
    const [validationAttempt, setValidationAttempt] = useState(0);
    const back = catalogReturn(params.get('from')), requestedCruise = params.get('cruiseId');
    useEffect(() => {
        if (requestedCruise && requestedCruise !== draft.cruiseId && !busy && !uncertain) {
            setDraft(current => ({ ...current, currency: 'USD', cruiseId: requestedCruise, passengers: current.passengers.map(person => ({ ...person, cabinId: '', tourPackageId: '', cabinSelectionMode: undefined, cabinGroupKey: undefined, farePackageOfferId: undefined, farePackagePriceRevisionId: undefined })) }));
            setSaved(null);
            setErrors({});
        }
    }, [requestedCruise, draft.cruiseId, busy, uncertain, setDraft, setSaved, setErrors]);
    useEffect(() => {
        const first = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (first)
            first.focus();
        else
            heading.current?.focus();
    }, [step, validationAttempt, saved]);
    const dirty = !saved && draft.passengers.some(person => person.fullName || person.email || person.documentNumber || person.phoneNumber);
    useEffect(() => {
        if (!dirty)
            return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);
    const cruises = useReadQuery('booking-published-cruises:' + access.userId, realBookingApi.cruises);
    const cabins = useReadQuery('booking-available-cabins:' + draft.cruiseId, useCallback(signal => draft.cruiseId ? realBookingApi.cabins(draft.cruiseId, signal) : Promise.resolve(null), [draft.cruiseId]));
    const packages = useReadQuery('booking-cruise-packages:' + draft.cruiseId, useCallback(signal => realBookingApi.packagesForCruise(draft.cruiseId, signal), [draft.cruiseId]));
    const fares = useReadQuery('booking-fares:' + draft.cruiseId, useCallback(signal => draft.cruiseId ? cruisePackageApi.available(draft.cruiseId, signal) : Promise.resolve(null), [draft.cruiseId]));
    const selected = cruises.data?.find(item => item.cruiseId === draft.cruiseId);
    useEffect(() => {
        const currency = selected?.saleCurrency === 'VND' ? 'VND' : 'USD';
        if (selected && !busy && !uncertain && !saved && draft.currency !== currency)
            setDraft(current => ({ ...current, currency }));
    }, [selected, busy, uncertain, saved, draft.currency, setDraft]);
    const lastAvailableStep = Object.keys(bookingCruisePackageSelectionErrors(draft, fares.data)).length ? 1 : availableBookingStep(draft, selected, cabins.data ?? null, packages.data);
    const choicesLoading = cruises.loading || cabins.loading || packages.loading || fares.loading;
    function stepPath(next: number, cruiseId = draft.cruiseId) {
        const query = new URLSearchParams({ from: back });
        if (cruiseId)
            query.set('cruiseId', cruiseId);
        query.set('step', String(next));
        return ('/admin/bookings/new') + '?' + query;
    }
    function validate(nextStep: number) {
        const invalid = bookingFieldErrors(draft, selected, cabins.data, undefined, nextStep);
        if (nextStep !== 1 && !access.userId && !draft.passengers[0]?.email.trim())
            invalid['person-0-email'] = 'Khách chưa đăng nhập cần email người đại diện để nhận hướng dẫn hợp đồng.';
        if (nextStep !== 2)
            Object.assign(invalid, bookingPackageErrors(draft, packages.data));
        if (nextStep !== 2)
            Object.assign(invalid, bookingCruisePackageSelectionErrors(draft, fares.data));
        setErrors(invalid);
        if (Object.keys(invalid).length)
            setValidationAttempt(value => value + 1);
        return invalid;
    }
    function showInvalid(invalid: Record<string, string>) {
        const first = Object.keys(invalid)[0];
        const target = first === 'real-booking-cruise' || first.endsWith('-cabinId') || first.endsWith('-tourPackageId') || first.endsWith('-farePackageOfferId') || first.endsWith('-cabinSelectionMode') || first.endsWith('-cabinGroupKey') ? 1 : 2;
        navigate(stepPath(target));
    }

    async function next(event: FormEvent) {
        event.preventDefault();
        if (busy || uncertain || quoteUnknown)
            return;
        const invalid = validate(step);
        if (Object.keys(invalid).length) {
            showInvalid(invalid);
            return;
        }
        setError('');
        if (step < 3) {
            setQuoteIntent(null);
            navigate(stepPath(step + 1));
        } else if (quoteIntent && !quoteExpired) {
            setReview(true);
        } else {
            if (submissionLockRef.current)
                return;
            submissionLockRef.current = true;
            setBusy(true);
            setQuoteIntent(null);
            try {
                const intent = await requestBookingQuote(draft);
                setQuoteIntent(intent);
                setQuoteExpired(false);
            }
            catch (value) {
                setError(bookingTransactionFailure(value));
                if (mutationOutcomeUnknown(value))
                    setQuoteUnknown(true);
            }
            finally {
                submissionLockRef.current = false;
                setBusy(false);
            }
        }
    }
    async function submit() {
        if (submissionLockRef.current || uncertain || !quoteIntent || quoteExpired)
            return;
        const invalid = validate(3);
        if (Object.keys(invalid).length) {
            setReview(false);
            showInvalid(invalid);
            return;
        }
        submissionLockRef.current = true;
        setBusy(true);
        setError('');
        try {
            if (!access.userId) throw new ApiError('Phiên nhân viên chưa sẵn sàng. Đăng nhập lại trước khi gửi.', 401);
            const pending = { idempotencyKey: quoteIntent.idempotencyKey, cruiseId: draft.cruiseId };
            writeBookingRecovery(access.userId, pending);
            setPendingRecovery(pending);
            const result = await createQuotedBooking(draft, quoteIntent);
            writeBookingRecovery(access.userId, null);
            setPendingRecovery(null);
            setSaved(result);
            setReview(false);
        }
        catch (value) {
            const failure = bookingMutationFailure(value);
            setError(failure.message);
            setUncertain(failure.uncertain);
            if (!failure.uncertain) {
                if (access.userId) writeBookingRecovery(access.userId, null);
                setPendingRecovery(null);
                setReview(false);
                cabins.retry();
                packages.retry();
                cruises.retry();
                fares.retry();
                if (failure.conflict || value instanceof ApiError && ['SALE_SUSPENDED', 'PACKAGE_NOT_AVAILABLE_FOR_CRUISE', 'PACKAGE_NOT_ACTIVE', 'INVALID_CRUISE_STATUS'].includes(value.code ?? ''))
                    navigate(stepPath(1));
            }
        }
        finally {
            submissionLockRef.current = false;
            setBusy(false);
        }
    }
    async function recover() {
        if (!pendingRecovery || submissionLockRef.current || busy) return;
        submissionLockRef.current = true; setBusy(true); setRecoveryError('');
        try {
            const result = await recoverQuotedBooking(pendingRecovery);
            if (access.userId) writeBookingRecovery(access.userId, null);
            setPendingRecovery(null); setReview(false); setUncertain(false); setSaved(result);
        } catch (value) {
            setRecoveryError(value instanceof ApiError && value.status === 404
                ? 'Chưa tìm thấy kết quả. Yêu cầu có thể chưa hoàn tất; không tạo lại đặt chỗ. Tải lại kết quả sau hoặc liên hệ bộ phận hỗ trợ.'
                : bookingTransactionFailure(value));
        } finally { submissionLockRef.current = false; setBusy(false); }
    }
    async function copyReference() {
        if (!saved)
            return;
        try {
            await navigator.clipboard.writeText(saved.bookingReference);
            setCopied('Đã sao chép mã đặt chỗ.');
        }
        catch {
            setCopied('Chưa sao chép được. Bạn có thể chọn và sao chép mã hiển thị bên trên.');
        }
    }
    if (pendingRecovery && !review) return <RealBookingFrame><PageHeader title="Kiểm tra kết quả đặt chỗ" breadcrumb="Đặt chỗ / Phục hồi" actions={<ButtonLink tone="secondary" to="/admin/bookings">Về danh sách đặt chỗ</ButtonLink>} /><Notice title="Đang giữ tham chiếu yêu cầu đã gửi" tone="warning">Không tạo lại đặt chỗ khi kết quả chưa xác định. Tham chiếu được giữ cho tài khoản này sau khi tải lại trang; kiểm tra kết quả không gửi thêm yêu cầu tạo đặt chỗ.</Notice>{busy && <Loading label="Đang xử lý yêu cầu đặt chỗ…" />}{recoveryError && <Notice title="Chưa phục hồi được kết quả" tone="error">{recoveryError}</Notice>}<Button busy={busy} onClick={() => void recover()}>Kiểm tra kết quả đã gửi</Button></RealBookingFrame>;
    if (saved)
        return <RealBookingFrame><PageHeader title="Đã tiếp nhận đặt chỗ" breadcrumb="ĐẶT CHỖ"/><p className={styles.reference}>{saved.bookingReference}</p><div className={styles.actions}><ButtonLink to={'/admin/bookings/' + encodeURIComponent(saved.bookingId)}>Mở chi tiết đặt chỗ</ButtonLink><Button tone="secondary" onClick={() => void copyReference()}>Sao chép mã đặt chỗ</Button><Button tone="secondary" onClick={() => { setDraft(initialLiveBooking()); setSaved(null); setErrors({}); navigate('/admin/bookings/new'); }}>Bắt đầu đặt chỗ khác</Button></div>{copied && <p role="status">{copied}</p>}<BookingRecord booking={saved}/></RealBookingFrame>;
    if (step > 1 && choicesLoading)
        return <RealBookingFrame><Loading label="Đang kiểm tra thông tin đặt chỗ…"/></RealBookingFrame>;
    if (step > 1 && (cruises.error || cabins.error || fares.error))
        return <RealBookingFrame>
    <PageHeader breadcrumb="ĐẶT CHỖ" title={labels[step - 1]}/>
    <BookingReadState {...cruises} publicResource={undefined}/>
    <BookingReadState {...cabins} publicResource={undefined}/>
    <BookingReadState {...fares} publicResource={undefined}/>
    <ButtonLink tone="secondary" to={stepPath(1)}>Về bước chọn phòng</ButtonLink>
  </RealBookingFrame>;
    if (!busy && !uncertain && !choicesLoading && !cruises.error && !cabins.error && !fares.error
        && (!requestedCruise || requestedCruise === draft.cruiseId) && step > lastAvailableStep) {
        return <Navigate to={stepPath(lastAvailableStep)} replace/>;
    }
    return <RealBookingFrame><div className={`${styles.stack} ${agentStyles.create}`}>
    
    <header className={styles.heading}><h1 ref={heading} tabIndex={-1}>Tạo đặt chỗ</h1><p>{descriptions[step - 1]}</p></header>
    <nav aria-label="Các bước đặt chỗ"><ol className={styles.steps + ' ' + agentStyles.wizardSteps}>{labels.map((label, index) => <li key={label}><Link to={stepPath(index + 1)} aria-label={`${index + 1}. ${label}`} aria-current={step === index + 1 ? 'step' : undefined} aria-disabled={busy || uncertain || index + 1 > lastAvailableStep || undefined} tabIndex={busy || uncertain || index + 1 > lastAvailableStep ? -1 : undefined} data-complete={index + 1 < step || undefined} onClick={event => { if (busy || uncertain || index + 1 > lastAvailableStep)
        event.preventDefault(); }}><span className={agentStyles.stepLabelFull}>{`${index + 1}. ${label}`}</span><span className={agentStyles.stepLabelShort}>{`${index + 1}. ${shortLabels[index]}`}</span></Link></li>)}</ol></nav>
    {uncertain && (<Notice title="Cần kiểm tra kết quả trước khi gửi lại" tone="warning">Thông tin được giữ nguyên; gửi lại đã khóa để tránh tạo trùng. Tra cứu bằng mã đã nhận hoặc liên hệ nhân viên hỗ trợ.<ButtonLink tone="secondary" to="/admin/bookings/lookup">Tra cứu đặt chỗ</ButtonLink></Notice>)}
    {error && !review && <Notice title="Chưa gửi được đặt chỗ" tone="error">{error}</Notice>}
    {quoteUnknown && <Notice title="Chưa nhận được kết quả báo giá">Chưa có mã báo giá để đối chiếu nên chưa thể gửi yêu cầu tiếp. Thông tin đã nhập vẫn được giữ. Vui lòng liên hệ bộ phận hỗ trợ; chưa có đặt chỗ được xác nhận từ bước báo giá này.</Notice>}<form ref={form} noValidate onSubmit={next}><div className={styles.layout + ' ' + agentStyles.wizardLayout}><div className={styles.main}>
      {Object.keys(errors).length > 0 && <Notice title="Vui lòng kiểm tra thông tin" tone="error"><ul>{Object.entries(errors).map(([id, message]) => <li key={id}>{message}</li>)}</ul></Notice>}
      <fieldset disabled={busy || uncertain} className={styles.draftFields}><div className={styles.stack}>
        {step === 1 && <><Panel title="Chuyến khởi hành"><BookingReadState {...cruises} publicResource={undefined}/>{cruises.data?.length === 0 && <Empty title="Chưa có chuyến đã công bố để đặt"></Empty>}<Field htmlFor="real-booking-cruise" label="Chuyến khởi hành *" error={errors['real-booking-cruise']}><select id="real-booking-cruise" value={draft.cruiseId} aria-invalid={Boolean(errors['real-booking-cruise'])} aria-describedby={errors['real-booking-cruise'] ? 'real-booking-cruise-hint' : undefined} onChange={event => { const id = event.target.value; setDraft(current => ({ ...current, currency: 'USD', cruiseId: id, passengers: current.passengers.map(person => ({ ...person, cabinId: '', tourPackageId: '', cabinSelectionMode: undefined, cabinGroupKey: undefined, farePackageOfferId: undefined, farePackagePriceRevisionId: undefined })) })); setErrors({}); navigate(stepPath(1, id), { replace: true }); }}><option value="">Chọn chuyến có thể đặt chỗ</option>{cruises.data?.map(item => <option key={item.cruiseId} value={item.cruiseId}>{item.cruiseCode} · {item.cruiseName}</option>)}</select></Field>
          {selected && <RecordFacts entries={[
            ['Mã chuyến', selected.cruiseCode],
            ['Tàu', selected.shipName ?? 'Chưa cung cấp'],
            ['Khởi hành', bookingWhen(selected.departureDatetime)],
            ['Kết thúc', bookingWhen(selected.returnDatetime)],
            ['Nhận đặt chỗ', <Badge label="Có thể đặt chỗ" tone="success" />],
          ]} />}
        </Panel>{draft.cruiseId && <BookingReadState {...cabins} publicResource={undefined}/>}{cabins.data?.length === 0 && <Empty title="Chưa có phòng trống cho chuyến này"></Empty>}{packages.loading && <p role="status">Đang tải gói dịch vụ tùy chọn…</p>}{packages.error && <Notice title="Chưa tải được gói dịch vụ" tone="warning">{<>{packages.error.message} Bạn có thể tiếp tục mà không chọn gói.<Button onClick={packages.retry}>Tải lại gói</Button></>}</Notice>}{!fares.data?.fareManaged && renderShipModel && selected?.shipId && cabins.data && <BookingShipModel key={draft.cruiseId} shipId={selected.shipId} cabins={cabins.data} render={renderShipModel}/>}<BookingReadState {...fares}/>{fares.data?.fareManaged && selected?.shipId && cabins.data ? <CruisePackageCabinSelection key={draft.cruiseId} catalog={fares.data} shipId={selected.shipId} cabins={cabins.data}/> : fares.data && !fares.loading && !fares.error ? <CabinPassengerFields cabins={cabins.data} packages={packages.data} publicJourney={false}/> : null}</>}
        {step === 2 && <><PassengerDetailsFields representativeEmailRequired={!access.userId}
          cabinSummary={person => {
            const cabin = person.cabinSelectionMode === 'CATEGORY_HOLD' ? 'Giữ chỗ theo hạng'
              : cabins.data?.find(item => item.cabinId === person.cabinId)?.cabinNumber ?? 'Chưa chọn cabin';
            const fare = fares.data?.offers.find(item => item.selection.offerId === person.farePackageOfferId)?.selection.templateName
              ?? packages.data?.find(item => item.id === person.tourPackageId)?.name;
            return fare ? cabin + ' · ' + fare : cabin;
          }}
          onAdd={() => {
            setDraft(current => ({ ...current, passengers: [...current.passengers, blankBookingPerson()] }));
            setErrors({});
            navigate(stepPath(1));
          }}
          onRemove={index => {
            setDraft(current => ({ ...current, passengers: current.passengers.filter((_, i) => i !== index) }));
            setErrors({});
          }} /><Panel title="Hình thức thanh toán"><p>Chọn kế hoạch thanh toán. Số tiền và ngày đến hạn từng đợt sẽ có trong thông tin đặt chỗ.</p><div className={styles.fields}><p>Tiền tệ đặt chỗ: {draft.currency}. Tổng tiền được xác nhận từ báo giá của hệ thống.</p><Field htmlFor="real-booking-plan" label="Hình thức thanh toán" error={errors['real-booking-plan']}><select id="real-booking-plan" aria-invalid={Boolean(errors['real-booking-plan'])} aria-describedby={errors['real-booking-plan'] ? 'real-booking-plan-hint' : undefined} value={draft.paymentPlan} onChange={event => setDraft(current => ({ ...current, paymentPlan: event.target.value as typeof draft.paymentPlan }))}>{Object.entries(plans).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>{draft.paymentPlan === 'STAGES' && <p className={styles.helper}>Ba đợt thanh toán: đặt cọc, thanh toán giữa kỳ và thanh toán phần còn lại theo hợp đồng.</p>}<Field htmlFor="real-booking-notes" label="Ghi chú (tối đa 500 ký tự)" error={errors['real-booking-notes']}><textarea aria-invalid={Boolean(errors['real-booking-notes'])} aria-describedby={errors['real-booking-notes'] ? 'real-booking-notes-hint' : undefined} id="real-booking-notes" maxLength={500} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))}/></Field></Panel></>}
        {step === 3 && <><BookingReadState {...cruises} publicResource={undefined}/><BookingReadState {...cabins} publicResource={undefined}/><Panel title="Kiểm tra toàn bộ đặt chỗ"><div className={styles.sectionHeading}><h2>{selected?.cruiseName ?? 'Chưa chọn chuyến'}</h2></div><p>{bookingWhen(selected?.departureDatetime)} → {bookingWhen(selected?.returnDatetime)} · Giờ Việt Nam</p><ol className={styles.review}>{draft.passengers.map((person, index) => <li key={index}><strong>{person.fullName || `Hành khách ${index + 1} · Chưa nhập tên`}</strong><p>Phòng: {person.cabinSelectionMode === 'CATEGORY_HOLD' ? 'Giữ nguyên nhóm theo hạng, chọn cabin sau' : cabins.data?.find(cabin => cabin.cabinId === person.cabinId)?.cabinNumber ?? 'Cần kiểm tra lại'}</p>{person.farePackageOfferId && <p>Gói vé: {fares.data?.offers.find(f => f.selection.offerId === person.farePackageOfferId)?.selection.templateName ?? 'Cần đối chiếu'} · Hạng {fares.data?.offers.find(f => f.selection.offerId === person.farePackageOfferId)?.selection.logicalCategory ?? 'Cần đối chiếu'} · Nhóm {person.cabinGroupKey || 'Theo lựa chọn cabin'}</p>}<p>Gói: {person.tourPackageId ? packages.data?.find(pack => pack.id === person.tourPackageId)?.name ?? 'Cần kiểm tra lại' : 'Không chọn'}</p><p>Ngày sinh: {bookingBirthDate(person.dateOfBirth)} · Quốc tịch: {person.nationality || 'Chưa cung cấp'}</p><p>Liên hệ: {person.email || 'Không có email'} · {person.phoneNumber || 'Không có số điện thoại'}</p>{person.documentNumber && <p>Giấy tờ: {person.documentType || 'Chưa chọn loại'} · ••••{person.documentNumber.slice(-4)}</p>}</li>)}</ol><p>Hình thức: {plans[draft.paymentPlan]} · Tiền tệ yêu cầu: {draft.currency}</p>{draft.notes && <p>Ghi chú: {draft.notes}</p>}<p>Sau khi đặt chỗ, bạn sẽ nhận tổng giá vé, lịch thanh toán từng đợt và hướng dẫn hợp đồng.</p></Panel></>}
        {step === 3 && quoteIntent && <Panel title="Báo giá từ hệ thống">
          <RecordFacts entries={[
            ['Tổng tiền', quoteIntent.quote.totalAmount != null && quoteIntent.quote.currency
              ? bookingMoney(quoteIntent.quote.totalAmount, quoteIntent.quote.currency) : 'Chưa cung cấp'],
            ['Hình thức thanh toán', plans[draft.paymentPlan]],
            ...(quoteIntent.quote.depositAmount != null ? [['Cọc theo báo giá', bookingMoney(quoteIntent.quote.depositAmount, draft.currency)] as const] : []),
            ...(quoteIntent.quote.remainingAmount != null ? [['Còn lại theo báo giá', bookingMoney(quoteIntent.quote.remainingAmount, draft.currency)] as const] : []),
            ['Hiệu lực đến', bookingWhen(quoteIntent.quote.expiresAt ?? undefined)],
          ]} />
          {quoteExpired && <Notice title={businessCopy('booking.quote.EXPIRED')} tone="warning">{businessCopy('booking.quote.expiredInstruction')}</Notice>}
        </Panel>}
        <div className={styles.actions + ' ' + agentStyles.wizardActions}>{step > 1 && <Button tone="secondary" onClick={() => navigate(stepPath(step - 1))}>Quay lại</Button>}<Button type="submit" busy={busy} disabled={busy || uncertain || quoteUnknown || (step !== 2 && (cruises.loading || cabins.loading || fares.loading || (packages.loading && draft.passengers.some(person => person.tourPackageId))))}>{step === 1 ? 'Tiếp tục nhập hành khách' : step === 2 ? 'Kiểm tra đặt chỗ' : quoteIntent && !quoteExpired ? 'Xác nhận gửi đặt chỗ' : quoteExpired ? 'Lấy báo giá mới' : 'Lấy báo giá'}</Button></div>
      </div></fieldset>
    </div><aside className={styles.rail}><Panel title="Tóm tắt đặt chỗ"><strong>{selected?.cruiseName ?? 'Chưa chọn chuyến'}</strong><p>{draft.passengers.length} hành khách</p><p className={agentStyles.helper}>Hệ thống giữ chỗ sau khi tiếp nhận đặt chỗ.</p><ButtonLink tone="secondary" to={back}>Về danh sách đặt chỗ</ButtonLink></Panel></aside></div></form>
  </div>{review && <Modal title="Xác nhận gửi đặt chỗ" busy={busy} onClose={() => setReview(false)} footer={<><Button tone="secondary" disabled={busy} onClick={() => setReview(false)}>Quay lại kiểm tra</Button><Button disabled={busy || uncertain || quoteExpired || !quoteIntent} onClick={() => void submit()}>Gửi đặt chỗ</Button></>}><p>{selected?.cruiseName} · {draft.passengers.length} hành khách · {plans[draft.paymentPlan]}</p>{quoteIntent && <><p>{businessCopy('booking.quote.total')}: {quoteIntent.quote.totalAmount != null && quoteIntent.quote.currency ? bookingMoney(quoteIntent.quote.totalAmount, quoteIntent.quote.currency) : 'Chưa cung cấp'}</p><p>{businessCopy('booking.quote.validUntil')}: {bookingWhen(quoteIntent.quote.expiresAt ?? undefined)} · Giờ Việt Nam</p></>}{quoteExpired && <Notice title={businessCopy('booking.quote.EXPIRED')}>{businessCopy('booking.quote.expiredInstruction')}</Notice>}<p>Kiểm tra thông tin và gửi yêu cầu để nhận mã đặt chỗ cùng lịch thanh toán.</p>{error && <Notice title="Chưa xác nhận được kết quả" tone="error">{error}</Notice>}{uncertain && <Notice title="Kiểm tra kết quả trước khi gửi lại" tone="warning">Đóng hộp thoại để kiểm tra kết quả của yêu cầu đã gửi.</Notice>}</Modal>}</RealBookingFrame>;
}
