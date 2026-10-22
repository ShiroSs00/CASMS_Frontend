import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState, ui } from '@/components/passenger/PassengerUI';
import { Choice, ConfirmAction, ErrorNotice, Input, PageIntro, LivePage, Loading, StatusBadge } from './PassengerActionUI';
import { passengerApi, usePassengerAction, usePassengerContext, usePassengerQuery } from './passenger-hooks';
import { bookableCruises, buildBooking, dateTime, money, statusText } from './passenger-model';
import type { BookingCreate, PassengerDraft } from './passenger-types';

export function PassengerBookingsScreen({ embedded = false }: { embedded?: boolean }) {
  const context = usePassengerContext();
  const bookings = usePassengerQuery(['bookings'], passengerApi.bookings, 'BOOKING_READ');
  return <LivePage title="Đặt chỗ của tôi" permission="BOOKING_READ" detail={!embedded} selected="bookings">
    <PageIntro title="Những chuyến đi của bạn" />
    {context.can('BOOKING_CREATE') && <PassengerButton label="Tạo đặt chỗ mới" onPress={() => router.push('/passenger-bookings/new')} />}
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
  const action = usePassengerAction(); const [cancel, setCancel] = useState(false); const [reason, setReason] = useState('');
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
        <Text style={ui.caption}>Trạng thái đặt chỗ không phải biên nhận thanh toán.</Text>
        {data.installments?.map(part => <View key={part.sequenceNo}><Text style={ui.body}>Đợt {part.sequenceNo}: {money(part.requiredAmount, part.currency)} · {statusText(part.status)}</Text><Text style={ui.caption}>{dateTime(part.dueAt)}{part.description ? ` · ${part.description}` : ''}</Text></View>)}
      </View>
      <Text style={ui.sectionTitle}>Hành khách và phòng</Text>
      {data.passengers.map(person => <View key={person.bookingPassengerId} style={ui.card}><Text style={ui.sectionTitle}>{person.fullName}</Text>
        <Text style={ui.body}>{person.cabinNumber ? `Phòng ${person.cabinNumber}` : 'Chưa có phòng'}{person.deckNumber !== null ? ` · Deck ${person.deckNumber}` : ''}</Text>
        {person.cabinType && <Text style={ui.caption}>{statusText(person.cabinType)}</Text>}
        <Text style={ui.body}>{person.tourPackageName ?? 'Chưa chọn gói dịch vụ'}</Text>
      </View>)}
      {data.contractSigningInstructions && <View style={ui.card}><Text style={ui.sectionTitle}>Hướng dẫn hợp đồng</Text><Text style={ui.body}>{data.contractSigningInstructions}</Text></View>}
      {data.bookingStatus === 'Draft' && context.can('TOUR_PACKAGE_ASSIGN') && <PassengerButton label="Chọn hoặc thay đổi gói dịch vụ" variant="secondary" onPress={() => router.push({ pathname: '/passenger-packages', params: { bookingId } })} />}
      {data.bookingStatus === 'Confirmed' && <>
        <PassengerButton label="Hoạt động và tour của chuyến đi" variant="secondary" onPress={() => router.push({ pathname: '/passenger-activities', params: { bookingId } })} />
        <PassengerButton label="Yêu cầu dịch vụ trên tàu" variant="secondary" onPress={() => router.push({ pathname: '/passenger-services', params: { bookingId } })} />
      </>}
      {data.cancellationReason && <Text style={ui.body}>Lý do hủy: {data.cancellationReason}</Text>}
      {data.bookingStatus !== 'Cancelled' && context.can('BOOKING_CANCEL') && <PassengerButton label="Hủy đặt chỗ" variant="text" onPress={() => { action.reset(); setCancel(true); }} />}
      <PassengerButton label="Cập nhật thông tin đặt chỗ" variant="text" loading={booking.isFetching} onPress={() => { void booking.refetch(); }} />
    </>}
    <ConfirmAction visible={cancel} title="Xác nhận hủy đặt chỗ" description="Các hành khách trong đơn sẽ bị hủy và phòng được giải phóng. Thao tác này không tự xử lý hoàn tiền." pending={action.isPending} disabled={!reason.trim()} error={action.error} onClose={() => setCancel(false)} onConfirm={() => {
      if (!reason.trim() || action.isPending) return;
      action.mutate(() => passengerApi.cancelBooking(bookingId, reason), { onSuccess: () => setCancel(false) });
    }}><Input label="Lý do hủy bắt buộc" value={reason} onChange={setReason} multiline disabled={action.isPending} />{!reason.trim() && <Text style={ui.caption}>Nhập lý do để tiếp tục.</Text>}</ConfirmAction>
  </LivePage>;
}

export function PassengerNewBookingScreen() {
  const context = usePassengerContext();
  const cruises = usePassengerQuery(['published-cruises'], passengerApi.cruises, 'CRUISE_READ');
  const [cruiseId, setCruiseId] = useState('');
  const cabins = usePassengerQuery(['cabins', cruiseId], signal => passengerApi.cabins(cruiseId, signal), 'BOOKING_CREATE', !!cruiseId);
  const [rows, setRows] = useState<PassengerDraft[]>([{ key: 'first', fullName: '', email: '', phoneNumber: '', cabinId: '' }]);
  const [notes, setNotes] = useState(''); const [plan, setPlan] = useState<BookingCreate['paymentPlan']>('DEPOSIT');
  const [review, setReview] = useState<BookingCreate | null>(null); const [validation, setValidation] = useState<unknown>(null);
  const action = usePassengerAction();
  function change(key: string, field: keyof PassengerDraft, value: string) { setRows(previous => previous.map(row => row.key === key ? { ...row, [field]: value } : row)); }
  function prepare() {
    try { setReview(buildBooking(cruiseId, rows, cabins.data ?? [], plan, notes)); setValidation(null); action.reset(); }
    catch (error) { setValidation(error); }
  }
  return <LivePage title="Tạo đặt chỗ" permission="BOOKING_CREATE">
    <PageIntro title="Chọn chuyến đi và phòng" />
    {!context.can('CRUISE_READ') ? <Text style={ui.body}>Tài khoản cần quyền xem chuyến đi để tạo đặt chỗ.</Text> : <>
      <ErrorNotice error={cruises.error} retry={() => { void cruises.refetch(); }} />
      {cruises.isPending ? <Loading /> : <Choice label="Chuyến đi đang mở bán" value={cruiseId} items={bookableCruises(cruises.data ?? []).map(c => ({ id: c.cruiseId, label: `${c.cruiseName} · ${dateTime(c.departureDatetime)}` }))} onChange={value => { setCruiseId(value); setRows(previous => previous.map(r => ({ ...r, cabinId: '' }))); setReview(null); }} />}
      {!cruises.isPending && !cruises.error && !bookableCruises(cruises.data ?? []).length && <EmptyState title="Chưa có chuyến mở bán" description="Chỉ chuyến đã công bố và chưa khởi hành mới có thể đặt." />}
      {cruiseId && <><ErrorNotice error={cabins.error} retry={() => { void cabins.refetch(); }} />{cabins.isPending && <Loading text="Đang kiểm tra phòng trống…" />}
        {!cabins.isPending && !cabins.error && !cabins.data?.length && <EmptyState title="Chưa có phòng trống" description="Vui lòng chọn chuyến khác hoặc kiểm tra lại sau." />}
        {rows.map((row, index) => <View key={row.key} style={ui.card}><Text style={ui.sectionTitle}>Hành khách {index + 1}</Text>
          <Input label={`Họ tên hành khách ${index + 1}`} value={row.fullName} onChange={v => change(row.key, 'fullName', v)} maxLength={100} />
          <Input label={`Email hành khách ${index + 1} nếu có`} value={row.email} onChange={v => change(row.key, 'email', v)} email />
          <Input label={`Số điện thoại hành khách ${index + 1} nếu có`} value={row.phoneNumber} onChange={v => change(row.key, 'phoneNumber', v)} maxLength={16} />
          <Choice label={`Phòng cho hành khách ${index + 1}`} value={row.cabinId} items={(cabins.data ?? []).map(c => ({ id: c.cabinId, label: `${c.cabinNumber} · ${statusText(c.cabinType)} · Deck ${c.deckNumber} · còn ${c.remainingCapacity} chỗ` }))} onChange={v => change(row.key, 'cabinId', v)} />
          {rows.length > 1 && <PassengerButton label={`Bỏ hành khách ${index + 1}`} variant="text" onPress={() => setRows(previous => previous.filter(r => r.key !== row.key))} />}
        </View>)}
        <PassengerButton label="Thêm hành khách" variant="secondary" onPress={() => setRows(previous => [...previous, { key: `p-${Date.now()}-${previous.length}`, fullName: '', email: '', phoneNumber: '', cabinId: '' }])} />
        <Choice label="Phương án thanh toán" value={plan} items={[{ id: 'FULL', label: 'Toàn bộ' }, { id: 'DEPOSIT', label: 'Đặt cọc' }, { id: 'STAGES', label: 'Theo giai đoạn' }]} onChange={value => setPlan(value as BookingCreate['paymentPlan'])} />
        <Input label="Ghi chú nếu có" value={notes} onChange={setNotes} multiline maxLength={500} />
        <Text style={ui.caption}>Giá phòng và mức thanh toán sẽ được hệ thống tính khi tạo đơn nháp. Bạn có thể xem chi tiết và liên hệ nhân sự để hoàn tất hợp đồng.</Text>
        <ErrorNotice error={validation} />
        <PassengerButton label="Kiểm tra đặt chỗ" disabled={!cabins.data?.length || !!cabins.error || cabins.isFetching} onPress={prepare} />
      </>}
    </>}
    <ConfirmAction visible={!!review} title="Tạo đặt chỗ nháp" description={`Tạo đơn nháp cho ${review?.passengers.length ?? 0} hành khách. Phòng còn trống sẽ được kiểm tra lại khi gửi. Chưa có giao dịch thanh toán trong ứng dụng.`} pending={action.isPending} error={action.error} onClose={() => setReview(null)} onConfirm={() => {
      if (!review || action.isPending) return;
      action.mutate(() => passengerApi.createBooking(review), { onSuccess: ({ result }) => {
        const saved = result as { bookingId: string }; setReview(null); router.replace({ pathname: '/passenger-bookings/[bookingId]', params: { bookingId: saved.bookingId } });
      } });
    }}>
      {!!review && <View style={ui.card}>
        <Text style={ui.sectionTitle}>{cruises.data?.find(c => c.cruiseId === review.cruiseId)?.cruiseName}</Text>
        {review.passengers.map((person, index) => <Text key={index} style={ui.body}>{index + 1}. {person.fullName} · Phòng {cabins.data?.find(c => c.cabinId === person.cabinId)?.cabinNumber}</Text>)}
        <Text style={ui.body}>Phương án: {review.paymentPlan === 'FULL' ? 'Toàn bộ' : review.paymentPlan === 'STAGES' ? 'Theo giai đoạn' : 'Đặt cọc'}</Text>
        {!!review.notes && <Text style={ui.body}>{review.notes}</Text>}
      </View>}
    </ConfirmAction>
  </LivePage>;
}
