import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState, ui } from '@/components/passenger/PassengerUI';
import { useAuth } from '@/features/auth/session-store';
import { useNow } from '@/hooks/use-now';
import { getApiUrl } from '@/lib/api';
import { Choice, ConfirmAction, ErrorNotice, Input, PageIntro, LivePage, Loading, StatusBadge } from './PassengerActionUI';
import { passengerApi, usePassengerAction, usePassengerContext, usePassengerQuery } from './passenger-hooks';
import { bookableCruises, buildBooking, dateTime, money, statusText } from './passenger-model';
import type { BookingCreate, PassengerDraft } from './passenger-types';
import { clearBookingIntent, newBookingIntent, readBookingIntent, saveBookingIntent,
  withBookingIntent, type BookingIntent } from './booking-recovery';

import { processBookingIntent } from './booking-workflow';

const paymentLabels = { Pending: 'Chờ xác nhận', Confirmed: 'Đã xác nhận', Failed: 'Thất bại', Cancelled: 'Đã hủy' };

export function PassengerBookingsScreen({ embedded = false }: { embedded?: boolean }) {
  const context = usePassengerContext();
  const bookings = usePassengerQuery(['bookings'], passengerApi.bookings, 'BOOKING_READ');
  return <LivePage title="Đặt chỗ của tôi" permission="BOOKING_READ" detail={!embedded} selected="bookings">
    <PageIntro title="Những chuyến đi của bạn" />
    <PassengerButton label={context.can('BOOKING_CREATE') ? 'Tạo hoặc khôi phục đặt chỗ' : 'Khôi phục đặt chỗ'}
      onPress={() => router.push('/passenger-bookings/new')} />
    <ErrorNotice error={bookings.error} retry={() => { void bookings.refetch(); }} />
    {bookings.isPending ? <Loading /> : !bookings.error && !bookings.data?.length ? <EmptyState title="Chưa có đặt chỗ" description="Đặt chỗ gắn với tài khoản sẽ xuất hiện tại đây." /> : null}
    {bookings.data?.map(booking => <View key={booking.bookingId} style={ui.card}>
      <Text style={ui.eyebrow}>{booking.bookingReference}</Text><StatusBadge status={booking.bookingStatus} />
      <Text style={ui.sectionTitle}>{booking.cruiseName}</Text><Text style={ui.body}>{dateTime(booking.departureDatetime)} · {booking.passengerCount} hành khách</Text>
      <Text style={ui.body}>{money(booking.agreedFareAmount, booking.currency)}</Text>
      <PassengerButton label="Xem đặt chỗ" variant="secondary" onPress={() => router.push({ pathname: '/passenger-bookings/[bookingId]', params: { bookingId: booking.bookingId } })} />
    </View>)}
    <PassengerButton label="Tải lại danh sách" variant="text" loading={bookings.isFetching} onPress={() => { void bookings.refetch(); }} />
  </LivePage>;
}

export function PassengerBookingDetailScreen() {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = typeof params.bookingId === 'string' ? params.bookingId : '';
  const context = usePassengerContext();
  const booking = usePassengerQuery(['booking', bookingId], signal => passengerApi.booking(bookingId, signal), 'BOOKING_READ', !!bookingId);
  const payments = usePassengerQuery(['booking-payments', bookingId], signal => passengerApi.payments(bookingId, signal), 'PAYMENT_READ', !!booking.data && !booking.error);
  const action = usePassengerAction(); const [cancel, setCancel] = useState(false); const [reason, setReason] = useState('');
  const cancelling = useRef(false);
  const data = booking.data;
  return <LivePage title="Chi tiết đặt chỗ" permission="BOOKING_READ">
    {!bookingId && <Text style={ui.body}>Liên kết đặt chỗ không hợp lệ.</Text>}
    <ErrorNotice error={booking.error} retry={() => { void booking.refetch(); }} />
    {bookingId && booking.isPending && <Loading />}
    {data && <>
      <Text style={ui.eyebrow}>{data.bookingReference} · {statusText(data.bookingStatus)}</Text>
      <Text style={ui.title}>{data.cruiseName}</Text><Text style={ui.body}>{data.shipName ?? 'Tàu chưa cập nhật'}</Text>
      <Text style={ui.body}>{dateTime(data.departureDatetime)} – {dateTime(data.returnDatetime)}</Text>
      <View style={ui.card}><Text style={ui.sectionTitle}>Thông tin chi phí</Text><Text style={ui.body}>Tổng giá đã ghi nhận: {money(data.agreedFareAmount, data.currency)}</Text>
        <Text style={ui.body}>Mức thanh toán ban đầu: {money(data.requiredDepositAmount, data.currency)}</Text>
        {data.installments?.map(part => <View key={part.sequenceNo}><Text style={ui.body}>Đợt {part.sequenceNo}: {money(part.requiredAmount, part.currency)} · {statusText(part.status)}</Text><Text style={ui.caption}>{dateTime(part.dueAt)}{part.description ? ` · ${part.description}` : ''}</Text></View>)}
      </View>
      {context.can('PAYMENT_READ') && <>
        <Text accessibilityRole="header" style={ui.sectionTitle}>Lịch sử thanh toán chuyến đi</Text>
        <ErrorNotice error={payments.error} retry={() => { void payments.refetch(); }} />
        {payments.isPending && !booking.error && <Loading text="Đang tải lịch sử thanh toán…" />}
        {payments.isSuccess && !payments.data?.length && <Text style={ui.body}>Chưa ghi nhận giao dịch thanh toán.</Text>}
        {payments.data?.map(payment => <View key={payment.paymentId} style={ui.card}>
          <Text style={ui.sectionTitle}>{payment.operationType === 'Void' ? 'Hủy khoản thanh toán' : 'Thanh toán chuyến đi'}</Text>
          <Text style={ui.body}>{paymentLabels[payment.status]}</Text>
          <Text selectable style={ui.body}>{money(payment.status === 'Confirmed' ? payment.confirmedAmount : payment.requestedAmount, payment.currency)}</Text>
          <Text style={ui.caption}>{dateTime(payment.confirmedAt ?? payment.requestedAt)}</Text>
        </View>)}
      </>}
      <Text style={ui.sectionTitle}>Hành khách và phòng</Text>
      {data.passengers.map(person => <View key={person.bookingPassengerId} style={ui.card}><Text style={ui.sectionTitle}>{person.fullName}</Text>
        <Text style={ui.body}>{person.cabinNumber ? `Phòng ${person.cabinNumber}` : 'Chưa có phòng'}{person.deckNumber != null ? ` · Tầng ${person.deckNumber}` : ''}</Text>
        {person.cabinType && <Text style={ui.caption}>{statusText(person.cabinType)}</Text>}
        <Text style={ui.body}>{person.tourPackageName ?? 'Chưa chọn gói dịch vụ'}</Text>
      </View>)}
      {data.contractSigningInstructions && <View style={ui.card}><Text style={ui.sectionTitle}>Hướng dẫn hợp đồng</Text><Text style={ui.body}>{data.contractSigningInstructions}</Text></View>}
      {data.bookingStatus === 'Draft' && context.can('TOUR_PACKAGE_ASSIGN') && <PassengerButton label="Chọn hoặc thay đổi gói dịch vụ" variant="secondary" onPress={() => router.push({ pathname: '/passenger-packages', params: { bookingId } })} />}
      {data.bookingStatus === 'Confirmed' && <>
        {context.can('CHECKIN_READ') && <PassengerButton label="Check-in trước chuyến" onPress={() => router.push({ pathname: '/check-in', params: { bookingId } })} />}
        {(context.can('ACTIVITY_READ') || context.can('EXCURSION_READ')) && <PassengerButton label="Hoạt động và tour của chuyến đi" variant="secondary" onPress={() => router.push({ pathname: '/passenger-activities', params: { bookingId } })} />}
        {context.can('SERVICE_READ') && <PassengerButton label="Yêu cầu dịch vụ trên tàu" variant="secondary" onPress={() => router.push({ pathname: '/passenger-services', params: { bookingId } })} />}
      </>}
      {data.cancellationReason && <Text style={ui.body}>Lý do hủy: {data.cancellationReason}</Text>}
      {data.bookingStatus !== 'Cancelled' && context.can('BOOKING_CANCEL') && <PassengerButton label="Hủy đặt chỗ" variant="text" onPress={() => { action.reset(); setCancel(true); }} />}
      <PassengerButton label="Cập nhật thông tin đặt chỗ" variant="text" loading={booking.isFetching || payments.isFetching}
        onPress={() => { void booking.refetch(); if (context.can('PAYMENT_READ')) void payments.refetch(); }} />
    </>}
    <ConfirmAction visible={cancel} title="Xác nhận hủy đặt chỗ" description="Các hành khách trong đơn sẽ bị hủy và phòng được giải phóng. Thao tác này không tự xử lý hoàn tiền." pending={action.isPending} disabled={!reason.trim()} error={action.error} onClose={() => setCancel(false)} onConfirm={() => {
      if (!reason.trim() || cancelling.current || booking.error || booking.isFetching || !data
        || data.bookingStatus === 'Cancelled' || !context.can('BOOKING_CANCEL')) return;
      cancelling.current = true;
      void action.mutateAsync(() => passengerApi.cancelBooking(bookingId, reason))
        .then(() => setCancel(false)).catch(() => {}).finally(() => { cancelling.current = false; });
    }}><Input label="Lý do hủy bắt buộc" value={reason} onChange={setReason} multiline maxLength={500} disabled={action.isPending} />{!reason.trim() && <Text style={ui.caption}>Nhập lý do để tiếp tục.</Text>}</ConfirmAction>
  </LivePage>;
}

export function PassengerNewBookingScreen() {
  const { auth, owner, ready, can } = usePassengerContext();
  const apiUrl = getApiUrl();
  return <LivePage title="Tạo hoặc khôi phục đặt chỗ">
    {ready && owner && (can('BOOKING_CREATE') || can('BOOKING_READ')) ?
      <PassengerBookingForm key={JSON.stringify([apiUrl, owner, auth.session?.signedInAt])} owner={owner} apiUrl={apiUrl} />
      : <Text style={ui.body}>Tài khoản chưa có quyền tạo hoặc xem đặt chỗ.</Text>}
  </LivePage>;
}

type Quote = Awaited<ReturnType<typeof passengerApi.bookingQuote>>;
type Recovery = Awaited<ReturnType<typeof passengerApi.recoverBooking>>;

function PassengerBookingForm({ owner, apiUrl }: { owner: string; apiUrl: string }) {
  const context = usePassengerContext();
  const canCreate = context.can('BOOKING_CREATE');
  const [intent, setIntent] = useState<BookingIntent | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const cruises = usePassengerQuery(['published-cruises'], passengerApi.cruises, 'CRUISE_READ', intent === null && canCreate);
  const [cruiseId, setCruiseId] = useState('');
  const cabins = usePassengerQuery(['cabins', cruiseId], signal => passengerApi.cabins(cruiseId, signal), 'BOOKING_CREATE', !!cruiseId);
  const [rows, setRows] = useState<PassengerDraft[]>([{ key: 'first', fullName: '', email: '', phoneNumber: '', cabinId: '' }]);
  const [notes, setNotes] = useState(''); const [plan, setPlan] = useState<BookingCreate['paymentPlan']>('DEPOSIT');
  const [review, setReview] = useState<{ body: BookingCreate; quote: Quote } | null>(null);
  const [validation, setValidation] = useState<unknown>(null);
  const quoteAction = usePassengerAction<Quote>();
  const action = usePassengerAction<Recovery | null>();
  const sending = useRef(false);
  const draftVersion = useRef(0);
  const mounted = useRef(false);
  const now = useNow();
  const expired = !!intent && Date.parse(intent.expiresAt) <= now;

  useEffect(() => {
    let current = true;
    readBookingIntent({ owner, apiUrl }).then(
      value => { if (current) setIntent(value); },
      error => { if (current) setLoadError(error); },
    );
    return () => { current = false; };
  }, [apiUrl, owner, loadAttempt]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function requireSecureApi() {
    if (!__DEV__ && !apiUrl.startsWith('https://')) throw new Error('Đặt chỗ cần kết nối HTTPS.');
  }
  function editDraft(edit: () => void) {
    draftVersion.current++;
    setReview(null);
    edit();
  }
  function change(key: string, field: keyof PassengerDraft, value: string) {
    editDraft(() => setRows(previous => previous.map(row => row.key === key ? { ...row, [field]: value } : row)));
  }
  async function prepare() {
    if (sending.current || intent !== null || !canCreate) return;
    sending.current = true;
    setValidation(null);
    try {
      requireSecureApi();
      const version = draftVersion.current;
      const body = buildBooking(cruiseId, rows, cabins.data ?? [], plan, notes);
      const { result: quote } = await quoteAction.mutateAsync(() => passengerApi.bookingQuote(body));
      if (version !== draftVersion.current) throw new Error('Lựa chọn đã thay đổi. Vui lòng lấy báo giá mới.');
      action.reset();
      setReview({ body, quote });
    } catch (error) { setValidation(error); }
    finally { sending.current = false; }
  }

  async function handleIntent(operation: 'create' | 'lookup' | 'retry' | 'discard') {
    if (sending.current || ((operation === 'create' || operation === 'retry') && !canCreate)) return;
    sending.current = true;
    setRecovery(null);
    try {
      const { result } = await action.mutateAsync(assertCurrent => withBookingIntent({ owner, apiUrl }, async () => {
        requireSecureApi();
        const currentReview = review;
        setReview(null);
        return processBookingIntent(operation, {
          read: () => readBookingIntent({ owner, apiUrl }),
          save: saveBookingIntent, clear: clearBookingIntent,
          current: assertCurrent, changed: setIntent,
          prepare: () => {
            if (!currentReview || Date.parse(currentReview.quote.expiresAt) <= Date.now()) {
              throw new Error('Báo giá đã hết hạn. Vui lòng lấy báo giá mới.');
            }
            return newBookingIntent({ owner, apiUrl }, currentReview.body, currentReview.quote);
          },
          recover: saved => passengerApi.recoverBooking(saved.idempotencyKey, owner, saved.body.cruiseId),
          create: saved => passengerApi.createBooking(saved.body, saved.idempotencyKey, owner),
        });
      }));
      setRecovery(result);
    } catch { /* Keep the persisted intent until the outcome can be verified. */ }
    finally { sending.current = false; }
  }

  async function finishBooking(bookingId: string) {
    if (sending.current || !intent) return;
    sending.current = true;
    try {
      await action.mutateAsync(assertCurrent => withBookingIntent({ owner, apiUrl }, async () => {
        const saved = await readBookingIntent({ owner, apiUrl });
        assertCurrent();
        if (saved?.idempotencyKey === intent.idempotencyKey) await clearBookingIntent(saved);
        return null;
      }));
      const { status, session } = useAuth.getState();
      if (mounted.current && status === 'authenticated' && session?.user.id === owner
        && session.signedInAt === context.auth.session?.signedInAt) {
        router.replace({ pathname: '/passenger-bookings/[bookingId]', params: { bookingId } });
      }
    } catch { /* Keep the confirmed result visible if local cleanup fails. */ }
    finally { sending.current = false; }
  }

  if (intent === undefined) return loadError ? <ErrorNotice error={loadError} retry={() => {
    setLoadError(null);
    setLoadAttempt(value => value + 1);
  }} /> : <Loading text="Đang kiểm tra đặt chỗ đã lưu…" />;
  if (recovery?.state === 'completed') return <View style={ui.card}>
    <Text accessibilityRole="header" style={ui.sectionTitle}>Đặt chỗ đã được ghi nhận</Text>
    <Text style={ui.body}>{recovery.booking.bookingReference} · {recovery.booking.cruiseName}</Text>
    <ErrorNotice error={action.error} />
    <PassengerButton label="Xem đặt chỗ" loading={action.isPending} onPress={() => { void finishBooking(recovery.booking.bookingId); }} />
  </View>;
  if (intent) return <View style={ui.card}>
    <Text accessibilityRole="header" style={ui.sectionTitle}>Khôi phục đặt chỗ</Text>
    <Text style={ui.body} accessibilityLiveRegion="polite">{recovery?.state === 'processing'
      ? 'Hệ thống đang xử lý yêu cầu. Hãy kiểm tra lại sau.'
      : recovery?.state === 'not-recorded'
        ? 'Hệ thống chưa tìm thấy bản ghi cho yêu cầu này.'
        : 'Yêu cầu đã được lưu trên thiết bị. Hãy kiểm tra kết quả trước khi tiếp tục.'}</Text>
    <ErrorNotice error={action.error} />
    <PassengerButton label="Kiểm tra kết quả" loading={action.isPending} onPress={() => { void handleIntent('lookup'); }} />
    {expired && !intent.rejected && <Text style={ui.caption}>Báo giá có thể đã hết hạn. Nếu gửi lại, hệ thống sẽ kiểm tra hiệu lực của báo giá gốc.</Text>}
    {recovery?.state === 'not-recorded' && (intent.rejected
      ? <PassengerButton label="Bỏ yêu cầu và quay lại" variant="secondary" disabled={action.isPending}
          onPress={() => { void handleIntent('discard'); }} />
      : canCreate && <PassengerButton label="Gửi lại yêu cầu đã lưu" variant="secondary" disabled={action.isPending}
          onPress={() => { void handleIntent('retry'); }} />)}
  </View>;
  if (!canCreate) return <EmptyState title="Chưa có giao dịch cần khôi phục" description="Giao dịch chờ trên thiết bị sẽ xuất hiện ở đây." />;

  return <>
    <PageIntro title="Chọn chuyến đi và phòng" />
    {!review && <ErrorNotice error={action.error} />}
    {!context.can('CRUISE_READ') ? <Text style={ui.body}>Tài khoản cần quyền xem chuyến đi để tạo đặt chỗ.</Text> : <>
      <ErrorNotice error={cruises.error} retry={() => { void cruises.refetch(); }} />
      {cruises.isPending ? <Loading /> : <Choice label="Chuyến đi đang mở bán" value={cruiseId} items={bookableCruises(cruises.data ?? []).map(c => ({ id: c.cruiseId, label: `${c.cruiseName} · ${dateTime(c.departureDatetime)}` }))} onChange={value => editDraft(() => { setCruiseId(value); setRows(previous => previous.map(r => ({ ...r, cabinId: '' }))); })} />}
      {!cruises.isPending && !cruises.error && !bookableCruises(cruises.data ?? []).length && <EmptyState title="Chưa có chuyến mở bán" description="Chỉ chuyến đã công bố và chưa khởi hành mới có thể đặt." />}
      {cruiseId && <><ErrorNotice error={cabins.error} retry={() => { void cabins.refetch(); }} />{cabins.isPending && <Loading text="Đang kiểm tra phòng trống…" />}
        {!cabins.isPending && !cabins.error && !cabins.data?.length && <EmptyState title="Chưa có phòng trống" description="Vui lòng chọn chuyến khác hoặc kiểm tra lại sau." />}
        {rows.map((row, index) => <View key={row.key} style={ui.card}><Text style={ui.sectionTitle}>Hành khách {index + 1}</Text>
          <Input label={`Họ tên hành khách ${index + 1}`} value={row.fullName} onChange={v => change(row.key, 'fullName', v)} maxLength={100} />
          <Input label={`Email hành khách ${index + 1} nếu có`} value={row.email} onChange={v => change(row.key, 'email', v)} email />
          <Input label={`Số điện thoại hành khách ${index + 1} nếu có`} value={row.phoneNumber} onChange={v => change(row.key, 'phoneNumber', v)} maxLength={16} />
          <Choice label={`Phòng cho hành khách ${index + 1}`} value={row.cabinId} items={(cabins.data ?? []).map(c => ({ id: c.cabinId, label: `${c.cabinNumber} · ${statusText(c.cabinType)} · Deck ${c.deckNumber} · còn ${c.remainingCapacity} chỗ` }))} onChange={v => change(row.key, 'cabinId', v)} />
          {rows.length > 1 && <PassengerButton label={`Bỏ hành khách ${index + 1}`} variant="text" onPress={() => editDraft(() => setRows(previous => previous.filter(r => r.key !== row.key)))} />}
        </View>)}
        <PassengerButton label="Thêm hành khách" variant="secondary" onPress={() => editDraft(() => setRows(previous => [...previous, { key: `p-${Date.now()}-${previous.length}`, fullName: '', email: '', phoneNumber: '', cabinId: '' }]))} />
        <Choice label="Phương án thanh toán" value={plan} items={[{ id: 'FULL', label: 'Toàn bộ' }, { id: 'DEPOSIT', label: 'Đặt cọc' }, { id: 'STAGES', label: 'Theo giai đoạn' }]} onChange={value => editDraft(() => setPlan(value as BookingCreate['paymentPlan']))} />
        <Input label="Ghi chú nếu có" value={notes} onChange={value => editDraft(() => setNotes(value))} multiline maxLength={500} />
        <Text style={ui.caption}>Bạn sẽ xem báo giá của hệ thống trước khi xác nhận tạo đơn nháp.</Text>
        <ErrorNotice error={validation} />
        <PassengerButton label="Xem báo giá" loading={quoteAction.isPending} disabled={!cabins.data?.length || !!cabins.error || cabins.isFetching || action.isPending} onPress={() => { void prepare(); }} />
      </>}
    </>}
    <ConfirmAction visible={!!review} title="Tạo đặt chỗ nháp"
      description="Hệ thống sẽ kiểm tra phòng và báo giá khi gửi. Bước này chưa thực hiện thanh toán."
      pending={action.isPending} error={action.error} onClose={() => setReview(null)} onConfirm={() => { void handleIntent('create'); }}>
      {!!review && <View style={ui.card}>
        <Text style={ui.sectionTitle}>{cruises.data?.find(c => c.cruiseId === review.body.cruiseId)?.cruiseName}</Text>
        {review.body.passengers.map((person, index) => <Text key={index} style={ui.body}>{index + 1}. {person.fullName} · Phòng {cabins.data?.find(c => c.cabinId === person.cabinId)?.cabinNumber}</Text>)}
        <Text style={ui.body}>Phương án: {review.body.paymentPlan === 'FULL' ? 'Toàn bộ' : review.body.paymentPlan === 'STAGES' ? 'Theo giai đoạn' : 'Đặt cọc'}</Text>
        <Text style={ui.body}>Tổng báo giá {money(review.quote.totalAmount, review.quote.currency)}</Text>
        <Text style={ui.caption}>Có hiệu lực đến {dateTime(review.quote.expiresAt)}</Text>
        {!!review.body.notes && <Text style={ui.body}>{review.body.notes}</Text>}
      </View>}
    </ConfirmAction>
  </>;
}
