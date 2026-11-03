import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { ApiError } from '@/shared/api';
import { Button, Field, Notice, PageHeader, Panel } from '@/shared/ui';
import { realBookingApi, type BookingDetail } from '../api/real-booking-api';
import { RealBookingFrame } from '../components/RealBookingUI';
import { BookingPhotoNote } from '../components/BookingExperience';
import { PublicBookingRecord } from '../components/PublicBookingRecord';
import { bookingLookupFailure } from '../model/booking-feedback';
import styles from '../components/LiveBooking.module.css';
export { PublicBookingRecord as BookingRecord } from '../components/PublicBookingRecord';
export function BookingLookupPage() {
    const [params] = useSearchParams();
    const [reference, setReference] = useState(() => params.get('reference') ?? ''), [email, setEmail] = useState(''), [phone, setPhone] = useState(''), [data, setData] = useState<BookingDetail | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), lock = useRef(false);
    const requestRef = useRef<AbortController | null>(null);
    const [missing, setMissing] = useState<Record<string, string>>({});
    const resultHeading = useRef<HTMLHeadingElement>(null);
    const errorSummary = useRef<HTMLDivElement>(null);
    useEffect(() => { if (error && !Object.values(missing).some(Boolean))
        errorSummary.current?.focus(); }, [error, missing, busy]);
    useEffect(() => { if (data)
        resultHeading.current?.focus(); }, [data]);
    useEffect(() => () => requestRef.current?.abort(), []);
    async function lookup() {
        if (lock.current)
            return;
        setData(null);
        setError('');
        if (!reference.trim() || (!email.trim() && !phone.trim())) {
            const fields: Record<string, string> = {};
            if (!reference.trim())
                fields.reference = 'Nhập mã đặt chỗ đã nhận.';
            if (!email.trim() && !phone.trim())
                fields.email = 'Nhập email hoặc số điện thoại đại diện.';
            setMissing(fields);
            document.getElementById('lookup-' + Object.keys(fields)[0])?.focus();
            setError('Nhập mã đặt chỗ và email hoặc số điện thoại đại diện.');
            return;
        }
        setMissing({});
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
                setError(bookingLookupFailure(value instanceof ApiError ? value.status : undefined));
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return <RealBookingFrame><div className={styles.stack}>
    <div className={styles.journeyTopline}><Link to="/cruises">← Khám phá hành trình</Link><p className={styles.helper}>Không cần đăng nhập</p></div>
    <PageHeader title="Tra cứu đặt chỗ" breadcrumb="HÀNH TRÌNH / ĐẶT CHỖ"/>
    <div className={styles.lookupGrid}><Panel title="Thông tin tra cứu"><form aria-busy={busy} onSubmit={event => { event.preventDefault(); void lookup(); }}><fieldset disabled={busy} className={styles.draftFields}>
      <Field htmlFor="lookup-reference" label="Mã đặt chỗ" hint="Mã được hiển thị sau khi hệ thống tiếp nhận đặt chỗ." error={missing.reference}><input id="lookup-reference" value={reference} autoComplete="off" spellCheck={false} aria-required="true" aria-invalid={Boolean(missing.reference)} aria-describedby="lookup-reference-hint" onChange={event => { setReference(event.target.value); setMissing(current => ({ ...current, reference: '' })); setData(null); setError(''); }}/></Field>
      <p className={styles.helper} id="lookup-contact-help">Nhập email <strong>hoặc</strong> số điện thoại của người đại diện. Không cần nhập cả hai.</p>
      <div className={styles.lookupContact}>
        <Field htmlFor="lookup-email" label="Email đại diện" error={missing.email}><input id="lookup-email" type="email" autoComplete="email" value={email} aria-invalid={Boolean(missing.email)} aria-describedby={missing.email ? 'lookup-contact-help lookup-email-hint' : 'lookup-contact-help'} onChange={event => { setEmail(event.target.value); setMissing(current => ({ ...current, email: '' })); setData(null); setError(''); }}/></Field>
        <Field htmlFor="lookup-phone" label="Số điện thoại đại diện"><input id="lookup-phone" type="tel" autoComplete="tel" value={phone} aria-describedby="lookup-contact-help" onChange={event => { setPhone(event.target.value); setMissing(current => ({ ...current, email: '' })); setData(null); setError(''); }}/></Field>
      </div><Button type="submit" disabled={busy}>{busy ? 'Đang tra cứu…' : 'Tra cứu'}</Button>
    </fieldset></form>{error && <div id="lookup-error-summary" ref={errorSummary} tabIndex={-1} role="region" aria-label="Không tra cứu được"><Notice title="Không tra cứu được" tone="error">{error}</Notice></div>}</Panel>
    <aside className={styles.lookupHelp}><BookingPhotoNote /><h2>Bạn cần chuẩn bị gì?</h2><p>Mã đặt chỗ và thông tin liên hệ đã dùng khi đặt. Kiểm tra lại ký tự và thông tin người đại diện nếu chưa tìm thấy.</p><p className={styles.helper}>Tra cứu chỉ hiển thị dữ liệu được hệ thống trả về; không tự xác nhận đặt chỗ hoặc thanh toán.</p></aside></div>
    {data && <section className={styles.stack} aria-label="Kết quả tra cứu"><h2 ref={resultHeading} tabIndex={-1}>Kết quả tra cứu · {data.bookingReference}</h2><PublicBookingRecord booking={data}/></section>}
  </div></RealBookingFrame>;
}
