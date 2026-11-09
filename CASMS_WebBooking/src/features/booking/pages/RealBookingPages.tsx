import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { ApiError } from '@/shared/api';
import { Button, Field, Notice, PageHeader, Panel } from '@/shared/ui';
import { realBookingApi, type BookingDetail } from '../api/real-booking-api';
import { RealBookingFrame } from '../components/RealBookingUI';
import { BookingPhotoNote } from '../components/BookingExperience';
import { PublicBookingRecord } from '../components/PublicBookingRecord';
import { bookingLookupFailure, isBookingLookupMismatch } from '../model/booking-feedback';
import styles from '../components/LiveBooking.module.css';
export { PublicBookingRecord as BookingRecord } from '../components/PublicBookingRecord';
export function BookingLookupPage() {
    const [params] = useSearchParams();
    const [reference, setReference] = useState(() => params.get('reference') ?? ''), [email, setEmail] = useState(''), [phone, setPhone] = useState(''), [data, setData] = useState<BookingDetail | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), lock = useRef(false);
    const requestRef = useRef<AbortController | null>(null);
    const [fields, setFields] = useState<{ reference?: string; contact?: string; email?: string }>({});
    const [mismatch, setMismatch] = useState('');
    const referenceInput = useRef<HTMLInputElement>(null);
    const emailInput = useRef<HTMLInputElement>(null);
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
        const errors = {
            reference: reference.trim() ? undefined : 'Nhập mã đặt chỗ đã nhận.',
            contact: email.trim() || phone.trim() ? undefined : 'Nhập email hoặc số điện thoại đại diện.',
            email: emailInput.current?.validity.typeMismatch ? 'Kiểm tra định dạng email.' : undefined,
        };
        setFields(errors);
        if (errors.reference || errors.contact || errors.email) {
            (errors.reference ? referenceInput : emailInput).current?.focus();
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
    return <RealBookingFrame><div className={styles.stack}>
    <div className={styles.journeyTopline}><Link to="/cruises">← Khám phá hành trình</Link><p className={styles.helper}>Không cần đăng nhập</p></div>
    <PageHeader title="Tra cứu đặt chỗ" breadcrumb="HÀNH TRÌNH / ĐẶT CHỖ"/>
    <div className={styles.lookupGrid}><Panel title="Thông tin tra cứu"><form noValidate aria-busy={busy} onSubmit={event => { event.preventDefault(); void lookup(); }}><fieldset disabled={busy} className={styles.draftFields}>
      <Field htmlFor="lookup-reference" label="Mã đặt chỗ" hint="Mã được hiển thị sau khi hệ thống tiếp nhận đặt chỗ." error={fields.reference}><input ref={referenceInput} id="lookup-reference" value={reference} autoComplete="off" spellCheck={false} aria-required="true" aria-invalid={Boolean(mismatch)} aria-describedby={mismatch ? 'lookup-mismatch' : undefined} onChange={event => { setReference(event.target.value); setFields(current => ({ ...current, reference: undefined })); clearResult(); }}/></Field>
      <p className={styles.helper} id="lookup-contact-help">Nhập email <strong>hoặc</strong> số điện thoại của người đại diện. Không cần nhập cả hai.</p>
      <div className={styles.lookupContact} role="group" aria-label="Thông tin liên hệ">
        <Field htmlFor="lookup-email" label="Email đại diện" error={fields.email}><input ref={emailInput} id="lookup-email" type="email" autoComplete="email" value={email} aria-invalid={Boolean(fields.contact || mismatch)} aria-describedby={contactDescription} onChange={event => { setEmail(event.target.value); setFields(current => ({ ...current, contact: undefined, email: undefined })); clearResult(); }}/></Field>
        <Field htmlFor="lookup-phone" label="Số điện thoại đại diện"><input id="lookup-phone" type="tel" autoComplete="tel" value={phone} aria-invalid={Boolean(fields.contact || mismatch)} aria-describedby={contactDescription} onChange={event => { setPhone(event.target.value); setFields(current => ({ ...current, contact: undefined })); clearResult(); }}/></Field>
      </div>
      {fields.contact && <div id="lookup-contact-error"><Notice title={fields.contact} tone="error">{null}</Notice></div>}
      {mismatch && <div id="lookup-mismatch"><Notice title="Kiểm tra thông tin tra cứu" tone="error">{mismatch}</Notice></div>}
      <Button type="submit" disabled={busy}>{busy ? 'Đang tra cứu…' : 'Tra cứu'}</Button>
    </fieldset></form>{error && <div id="lookup-error-summary" ref={errorSummary} tabIndex={-1} role="region" aria-label="Không tra cứu được"><Notice title="Không tra cứu được" tone="error">{error}</Notice></div>}</Panel>
    <aside className={styles.lookupHelp}><BookingPhotoNote /><h2>Bạn cần chuẩn bị gì?</h2><p>Mã đặt chỗ và thông tin liên hệ đã dùng khi đặt. Kiểm tra lại ký tự và thông tin người đại diện nếu chưa tìm thấy.</p><p className={styles.helper}>Tra cứu chỉ hiển thị dữ liệu được hệ thống trả về; không tự xác nhận đặt chỗ hoặc thanh toán.</p></aside></div>
    {data && <section className={styles.stack} aria-label="Kết quả tra cứu"><h2 ref={resultHeading} tabIndex={-1}>Kết quả tra cứu · {data.bookingReference}</h2><PublicBookingRecord booking={data}/></section>}
  </div></RealBookingFrame>;
}
