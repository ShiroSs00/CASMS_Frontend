import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState, ui } from '@/components/passenger/PassengerUI';
import { ApiError, getApiUrl } from '@/lib/api';
import { Choice, ConfirmAction, ErrorNotice, Input, LivePage, Loading } from './PassengerActionUI';
import { passengerApi, usePassengerAction, usePassengerContext, usePassengerQuery } from './passenger-hooks';
import { dateTime } from './passenger-model';

const labels = {
  NotStarted: 'Chưa bắt đầu', InProgress: 'Đang chuẩn bị', NeedsReview: 'Cần kiểm tra tại quầy',
  Completed: 'Đã hoàn tất hồ sơ', BoardingReady: 'Đủ điều kiện lên tàu',
};

export function PassengerCheckInScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const requested = typeof bookingId === 'string' ? bookingId.toLowerCase() : '';
  const [choice, setChoice] = useState<{ requested: string; passengerId: string }>();
  const context = usePassengerContext();
  const voyages = usePassengerQuery(['voyages'], passengerApi.voyages, 'BOOKING_READ');
  const options = (voyages.error ? [] : voyages.data ?? []).filter(item => item.bookingStatus === 'Confirmed' && item.participationStatus === 'Active');
  const requestedRows = requested ? options.filter(item => item.bookingId === requested) : options;
  const chosen = choice && choice.requested === requested ? options.find(item => item.bookingPassengerId === choice.passengerId)
    : requestedRows.length === 1 ? requestedRows[0] : undefined;
  const bookings = usePassengerQuery(['bookings'], passengerApi.bookings, 'BOOKING_READ', !!chosen);
  const ownBookingId = bookings.data?.find(item => item.bookingId === chosen?.bookingId)?.bookingId ?? '';
  const booking = usePassengerQuery(['booking', ownBookingId], signal => passengerApi.booking(ownBookingId, signal),
    'BOOKING_READ', !!ownBookingId);
  const contractAccepted = booking.data && !booking.error ? booking.data.contractStatus === 'Accepted' : undefined;
  return <LivePage title="Check-in trước chuyến" permission="CHECKIN_READ">
    {!context.can('BOOKING_READ') ? <Text style={ui.body}>Tài khoản cần quyền xem chuyến đã đặt để chọn hồ sơ check-in.</Text> : <>
      <ErrorNotice error={voyages.error} retry={() => { void voyages.refetch(); }} />
      {voyages.isPending && <Loading text="Đang tải chuyến đi của bạn…" />}
      {voyages.isSuccess && options.length === 0 && <EmptyState title="Chưa có hồ sơ check-in của bạn"
        description="Check-in sẽ xuất hiện khi tài khoản có hồ sơ hành khách trong đặt chỗ đã xác nhận." />}
      {!!options.length && <Choice label="Chuyến cần check-in" value={chosen?.bookingPassengerId ?? ''}
        items={options.map(item => ({ id: item.bookingPassengerId, label: `${item.cruiseName} · ${item.bookingReference}` }))}
        onChange={passengerId => setChoice({ requested, passengerId })} />}
      {!!requested && requestedRows.length === 0 && !!options.length && !chosen &&
        <Text style={ui.body}>Đặt chỗ trong liên kết không khả dụng. Vui lòng chọn lại chuyến.</Text>}
      {chosen && <PassengerCheckIn key={chosen.bookingPassengerId} passengerId={chosen.bookingPassengerId} bookingId={chosen.bookingId}
        contractAccepted={contractAccepted} refreshingVoyages={voyages.isFetching}
        closedVoyage={['COMPLETED', 'CANCELLED'].includes(chosen.cruiseStatus)} />}
    </>}
  </LivePage>;
}

function missingCheckin(error: unknown, passengerId: string) {
  return error instanceof ApiError && error.status === 404 && error.code === 'RESOURCE_NOT_FOUND'
    && error.message === `Checkin record not found for passenger: ${passengerId}`;
}

type CheckInRecord = Awaited<ReturnType<typeof passengerApi.checkin>>;
function hasEmergencyContact(record: CheckInRecord | undefined) {
  return !!record?.emergencyContactName?.trim() && !!record.emergencyContactPhone?.trim();
}
function canStartCheckin(record: CheckInRecord | undefined, missing: boolean) {
  if (!record) return missing;
  if (record.completedAt || record.boardingReadyAt) return false;
  return record.checkinStatus === 'NotStarted'
    || (record.checkinStatus === 'InProgress' && !hasEmergencyContact(record));
}

function PassengerCheckIn({ passengerId, bookingId, contractAccepted, refreshingVoyages, closedVoyage }: {
  passengerId: string; bookingId: string; contractAccepted?: boolean; refreshingVoyages: boolean; closedVoyage: boolean;
}) {
  const context = usePassengerContext();
  const status = usePassengerQuery(['checkin', passengerId], signal => passengerApi.checkin(passengerId, signal), 'CHECKIN_READ');
  const action = usePassengerAction();
  const lock = useRef(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirm, setConfirm] = useState<'start' | 'complete'>();
  const [notice, setNotice] = useState<string>();
  const missing = missingCheckin(status.error, passengerId);
  const record = status.error ? undefined : status.data;
  const current = record?.checkinStatus;
  const contactSaved = hasEmergencyContact(record);
  const mayStart = canStartCheckin(record, missing);
  const mayComplete = (current === 'InProgress' || current === 'Completed') && contactSaved && contractAccepted !== false;
  const valid = name.trim().length >= 2 && /^\+?\d{8,15}$/.test(phone.trim());
  const ready = !closedVoyage && !refreshingVoyages && !status.isFetching && (!status.error || missing);

  async function submit() {
    if (!confirm || lock.current || !ready || (confirm === 'start' ? !valid || !mayStart || !context.can('CHECKIN_CREATE')
      : !mayComplete || !context.can('CHECKIN_UPDATE'))) return;
    lock.current = true;
    setNotice(undefined);
    try {
      const step = confirm;
      await action.mutateAsync(async assertCurrent => {
        let absent = false;
        const latest = await passengerApi.checkin(passengerId).catch(error => {
          if (!missingCheckin(error, passengerId)) throw error;
          absent = true;
          return undefined;
        });
        assertCurrent();
        const state = latest?.checkinStatus;
        if (step === 'start' && canStartCheckin(latest, absent)) {
          if (!__DEV__ && !getApiUrl().startsWith('https://')) throw new Error('Chưa thể gửi liên hệ khẩn cấp qua kết nối này.');
          return passengerApi.startCheckin(passengerId, name.trim(), phone.trim());
        }
        if (step === 'complete' && state === 'BoardingReady') return latest;
        if (step === 'complete' && hasEmergencyContact(latest) && (state === 'InProgress' || state === 'Completed')) {
          return passengerApi.completeCheckin(passengerId);
        }
        throw new Error('Trạng thái hồ sơ vừa thay đổi. Kiểm tra lại trước khi tiếp tục.');
      });
      setNotice(step === 'start' ? 'Đã lưu thông tin liên hệ khẩn cấp.' : 'Hệ thống đã xác nhận bạn đủ điều kiện lên tàu.');
      if (step === 'start') { setName(''); setPhone(''); }
      setConfirm(undefined);
    } catch { /* Leave the form open to display the server error. */ }
    finally { lock.current = false; }
  }

  return <>
    {status.isPending && <Loading text="Đang tải hồ sơ check-in…" />}
    {!missing && <ErrorNotice error={status.error} retry={() => { void status.refetch(); }} />}
    {notice && <Text accessibilityLiveRegion="polite" style={ui.body}>{notice}</Text>}
    {(record || missing) && <View style={ui.card}>
      <Text accessibilityRole="header" style={ui.sectionTitle}>{current ? labels[current] : labels.NotStarted}</Text>
      {record?.boardingReadyAt && <Text style={ui.body}>{dateTime(record.boardingReadyAt)}</Text>}
      {closedVoyage && <Text style={ui.body}>Chuyến đã kết thúc hoặc bị hủy. Hồ sơ chỉ có thể xem lại.</Text>}
      {!closedVoyage && current === 'BoardingReady' && <PassengerButton label="Thông tin thẻ lên tàu" variant="secondary"
        onPress={() => router.push({ pathname: '/passenger-qr', params: { bookingId } })} />}
      {current === 'NeedsReview' && <Text style={ui.body}>Vui lòng gặp quầy dịch vụ hành khách để kiểm tra hồ sơ.</Text>}
      {contractAccepted === false && current !== 'BoardingReady' && <Text style={ui.body}>Bạn có thể hoàn tất check-in sau khi hợp đồng được chấp thuận.</Text>}
      {mayStart && context.can('CHECKIN_CREATE') && <PassengerButton label="Khai báo liên hệ khẩn cấp"
        disabled={!ready} onPress={() => { action.reset(); setConfirm('start'); }} />}
      {mayComplete && context.can('CHECKIN_UPDATE') && <PassengerButton label="Hoàn tất check-in"
        disabled={!ready} onPress={() => { action.reset(); setConfirm('complete'); }} />}
    </View>}
    <ConfirmAction visible={!!confirm} title={confirm === 'start' ? 'Lưu liên hệ khẩn cấp' : 'Xác nhận hoàn tất check-in'}
      description={confirm === 'start'
        ? missing
          ? 'Hồ sơ mới bật theo dõi và chia sẻ vị trí theo thiết lập mặc định của hệ thống. Nếu bạn muốn trao đổi về thiết lập này, hãy làm thủ tục tại quầy.'
          : 'Cung cấp người có thể liên hệ khi cần trợ giúp khẩn cấp.'
        : 'OceVie sẽ kiểm tra lại đặt chỗ, hợp đồng và liên hệ khẩn cấp trước khi xác nhận.'}
      pending={action.isPending} error={action.error} disabled={!ready || (confirm === 'start' ? !valid || !mayStart : !mayComplete)}
      onClose={() => { if (!lock.current) setConfirm(undefined); }} onConfirm={() => { void submit(); }}>
      {confirm === 'start' && <>
        <Input label="Họ tên người liên hệ" value={name} onChange={setName} maxLength={100} disabled={action.isPending} />
        <Input label="Số điện thoại (8–15 chữ số)" value={phone} onChange={setPhone} maxLength={16} disabled={action.isPending} phone />
      </>}
    </ConfirmAction>
  </>;
}
