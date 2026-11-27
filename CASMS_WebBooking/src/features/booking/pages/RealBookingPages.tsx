import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { ApiError } from '@/shared/api';
import { useSessionAccess } from '@/shared/auth';
import { Button, ButtonLink, Field, Notice, PageHeader, Panel } from '@/shared/ui';
import { realBookingApi, type BookingDetail } from '../api/real-booking-api';
import { RealBookingFrame } from '../components/RealBookingUI';
import { BookingPhotoNote } from '../components/BookingExperience';
import { BookingPaymentActionCard } from '../components/BookingPaymentActionCard';
import { CustomerCancellation } from '../components/CustomerCancellation';
import { PublicBookingRecord } from '../components/PublicBookingRecord';
import { bookingLookupFailure, isBookingLookupMismatch } from '../model/booking-feedback';
import styles from '../components/LiveBooking.module.css';
export { PublicBookingRecord as BookingRecord } from '../components/PublicBookingRecord';
export function BookingLookupPage() {
    const [params] = useSearchParams();
    const access = useSessionAccess();
    const isPassenger = access.status === 'ready' && access.roles.includes('PASSENGER');
    const noticeParam = params.get('notice');
    const [reference, setReference] = useState(() => params.get('reference') ?? params.get('bookingId') ?? ''), [email, setEmail] = useState(''), [phone, setPhone] = useState(''), [data, setData] = useState<BookingDetail | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), lock = useRef(false);
    const requestRef = useRef<AbortController | null>(null);
    const [fields, setFields] = useState<{ reference?: string; contact?: string; email?: string; phone?: string }>({});
    const [mismatch, setMismatch] = useState('');
    const referenceInput = useRef<HTMLInputElement>(null);
    const emailInput = useRef<HTMLInputElement>(null);
    const phoneInput = useRef<HTMLInputElement>(null);
    const resultHeading = useRef<HTMLHeadingElement>(null);
    const errorSummary = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!busy && mismatch) referenceInput.current?.focus();
        else if (!busy && error) errorSummary.current?.focus();
    }, [busy, mismatch, error]);
    useEffect(() => { if (data)
        resultHeading.current?.focus(); }, [data]);
    useEffect(() => () => requestRef.current?.abort(), []);
    async function lookup() {
        if (lock.current)
            return;
        setData(null);
        setError('');
        setMismatch('');
        const trimmedPhone = phone.trim();
        const phoneDigits = trimmedPhone.replace(/\D/g, '');
        const invalidPhone = Boolean(trimmedPhone) && (!/^[+]?[0-9\s().-]{8,20}$/.test(trimmedPhone) || phoneDigits.length < 8 || phoneDigits.length > 15);
        const errors = {
            reference: reference.trim() ? undefined : 'Nhập mã đặt chỗ đã nhận.',
            contact: email.trim() || trimmedPhone ? undefined : 'Nhập email hoặc số điện thoại đại diện.',
            email: emailInput.current?.validity.typeMismatch ? 'Kiểm tra định dạng email.' : undefined,
            phone: invalidPhone ? 'Kiểm tra định dạng số điện thoại (8–15 chữ số).' : undefined,
        };
        setFields(errors);
        if (errors.reference || errors.contact || errors.email || errors.phone) {
            (errors.reference ? referenceInput : errors.email || errors.contact ? emailInput : phoneInput).current?.focus();
            return;
        }
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
            if (!controller.signal.aborted) {
                const status = value instanceof ApiError ? value.status : undefined;
                const message = bookingLookupFailure(status);
                if (isBookingLookupMismatch(status)) setMismatch(message);
                else setError(message);
            }
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    function clearResult() {
        setData(null);
        setError('');
        setMismatch('');
    }
    const contactDescription = ['lookup-contact-help', fields.contact && 'lookup-contact-error', mismatch && 'lookup-mismatch'].filter(Boolean).join(' ');
    const canShowGuestPayPrompt =
        !isPassenger
        && data != null
        && data.bookingStatus !== 'Cancelled'
        && data.currency === 'VND'
        && (data.outstandingBalance == null || data.outstandingBalance > 0);
    return <RealBookingFrame><div className={styles.stack}>
    <div className={styles.journeyTopline}><Link to="/cruises">← Khám phá hành trình</Link></div>
    <PageHeader title="Tra cứu đặt chỗ" breadcrumb="HÀNH TRÌNH / ĐẶT CHỖ"/>
    {noticeParam === 'register' && <Notice title="Tài khoản được cấp tự động khi đặt chỗ" tone="info">Bạn không cần đăng ký trước. Khi đặt chỗ thành công, OceVie sẽ gửi tên đăng nhập và mật khẩu tạm qua email người đại diện. Nếu đã có mã đặt chỗ, bạn có thể tra cứu ngay bên dưới.</Notice>}
    {noticeParam === 'password-reset' && <Notice title="Hỗ trợ mật khẩu tài khoản hành khách" tone="info">Hệ thống chưa hỗ trợ tự đặt lại mật khẩu trực tuyến. Vui lòng kiểm tra email xác nhận đặt chỗ để lấy mật khẩu tạm hoặc liên hệ bộ phận hỗ trợ; bạn vẫn có thể tra cứu thông tin đặt chỗ công khai bên dưới.</Notice>}
    <div className={styles.lookupGrid}><Panel title="Thông tin tra cứu"><form noValidate aria-busy={busy} onSubmit={event => { event.preventDefault(); void lookup(); }}><fieldset disabled={busy} className={styles.draftFields}>
      <Field htmlFor="lookup-reference" label="Mã đặt chỗ *" error={fields.reference}><input ref={referenceInput} id="lookup-reference" value={reference} autoComplete="off" spellCheck={false} aria-required="true" aria-invalid={Boolean(fields.reference || mismatch)} aria-describedby={mismatch ? 'lookup-mismatch' : undefined} onChange={event => { setReference(event.target.value); setFields(current => ({ ...current, reference: undefined })); clearResult(); }}/></Field>
      <p className={styles.helper} id="lookup-contact-help">Nhập email <strong>hoặc</strong> số điện thoại của người đại diện. Không cần nhập cả hai.</p>
      <div className={styles.lookupContact} role="group" aria-label="Thông tin liên hệ">
        <Field htmlFor="lookup-email" label="Email đại diện" error={fields.email}><input ref={emailInput} id="lookup-email" type="email" autoComplete="email" value={email} aria-invalid={Boolean(fields.contact || fields.email || mismatch)} aria-describedby={contactDescription} onChange={event => { setEmail(event.target.value); setFields(current => ({ ...current, contact: undefined, email: undefined })); clearResult(); }}/></Field>
        <Field htmlFor="lookup-phone" label="Số điện thoại đại diện" error={fields.phone}><input ref={phoneInput} id="lookup-phone" type="tel" autoComplete="tel" value={phone} aria-invalid={Boolean(fields.contact || fields.phone || mismatch)} aria-describedby={contactDescription} onChange={event => { setPhone(event.target.value); setFields(current => ({ ...current, contact: undefined, phone: undefined })); clearResult(); }}/></Field>
      </div>
      {fields.contact && <div id="lookup-contact-error"><Notice title={fields.contact} tone="error">{null}</Notice></div>}
      {mismatch && <div id="lookup-mismatch"><Notice title="Kiểm tra thông tin tra cứu" tone="error">{mismatch}</Notice></div>}
      <Button type="submit" disabled={busy}>{busy ? 'Đang tra cứu…' : 'Tra cứu'}</Button>
    </fieldset></form>{error && <div id="lookup-error-summary" ref={errorSummary} tabIndex={-1} role="region" aria-label="Không tra cứu được"><Notice title="Không tra cứu được" tone="error">{error}</Notice></div>}</Panel>
    <aside className={styles.lookupHelp}><BookingPhotoNote /><h2>Bạn cần chuẩn bị gì?</h2><p>Mã đặt chỗ cùng email hoặc số điện thoại của người đại diện.</p><p className={styles.helper}>Để tạo mã VietQR thanh toán trực tuyến, vui lòng đăng nhập tài khoản hành khách.</p></aside></div>
    {data && <section className={styles.stack} aria-label="Kết quả tra cứu"><h2 ref={resultHeading} tabIndex={-1}>Kết quả tra cứu · {data.bookingReference}</h2><PublicBookingRecord booking={data} paymentAction={
      isPassenger
        ? <BookingPaymentActionCard booking={data} onBookingReload={() => void lookup()} />
        : canShowGuestPayPrompt
          ? <Notice title="Đăng nhập để thanh toán trực tuyến qua VietQR" tone="info">
              <p>Để đảm bảo an toàn tài khoản, chức năng tạo mã VietQR và theo dõi trạng thái chuyển khoản chỉ mở sau khi đăng nhập tài khoản hành khách của đặt chỗ này.</p>
              <div className={styles.actions}>
                <ButtonLink autoWidth to={`/login?next=${encodeURIComponent(`/my-bookings/${data.bookingId}`)}&reference=${encodeURIComponent(data.bookingReference)}`}>Đăng nhập để thanh toán VietQR</ButtonLink>
              </div>
            </Notice>
          : null
    }/><CustomerCancellation key={data.bookingId} bookingId={data.bookingId} bookingStatus={data.bookingStatus} departureDatetime={data.departureDatetime}/></section>}
  </div></RealBookingFrame>;
}
