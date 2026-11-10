import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { AmountRow, EmptyState, ui } from '@/components/passenger/PassengerUI';
import { ConfirmAction, ErrorNotice, Input, LivePage, Loading, StatusBadge } from './PassengerActionUI';
import { passengerApi, usePassengerAction, usePassengerContext, usePassengerQuery } from './passenger-hooks';
import { dateTime, money, statusText } from './passenger-model';
const paymentLabels = { Pending: 'Chờ xác nhận', Confirmed: 'Đã xác nhận', Failed: 'Thất bại', Cancelled: 'Đã hủy' };

export function PassengerBookingsScreen() {
  const bookings = usePassengerQuery(['bookings'], passengerApi.bookings, 'BOOKING_READ');
  return <LivePage title="Chuyến đi của tôi" permission="BOOKING_READ">
    <ErrorNotice error={bookings.error} retry={() => { void bookings.refetch(); }} />
    {bookings.isPending ? <Loading /> : !bookings.error && !bookings.data?.length ? <EmptyState title="Chưa có chuyến đi" action="Liên hệ hỗ trợ" onPress={() => router.push('/support')} /> : null}
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
  return <LivePage title="Chi tiết chuyến đi" permission="BOOKING_READ">
    {!bookingId && <Text style={ui.body}>Liên kết đặt chỗ không hợp lệ.</Text>}
    <ErrorNotice error={booking.error} retry={() => { void booking.refetch(); }} />
    {!!bookingId && booking.isPending && <Loading />}
    {data && <>
      <Text style={ui.eyebrow}>{data.bookingReference} · {statusText(data.bookingStatus)}</Text>
      <Text style={ui.title}>{data.cruiseName}</Text><Text style={ui.body}>{data.shipName ?? 'Tàu chưa cập nhật'}</Text>
      <Text style={ui.body}>{dateTime(data.departureDatetime)} – {dateTime(data.returnDatetime)}</Text>
      <View style={ui.card}><Text style={ui.sectionTitle}>Thông tin chi phí</Text><AmountRow label="Tổng giá" value={money(data.agreedFareAmount, data.currency)} prominent />
        <AmountRow label="Thanh toán ban đầu" value={money(data.requiredDepositAmount, data.currency)} />
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
