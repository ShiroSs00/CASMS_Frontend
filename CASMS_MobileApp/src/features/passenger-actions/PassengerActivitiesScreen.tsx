import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState, FilterChips, ui } from '@/components/passenger/PassengerUI';
import { BookingSelection, ConfirmAction, ErrorNotice, Input, PageIntro, LivePage, Loading, StatusBadge } from './PassengerActionUI';
import { passengerApi, useBookingSelection, usePassengerAction, usePassengerContext, usePassengerQuery } from './passenger-hooks';
import { canRegister, dateTime, money, positiveQuantity, registrationActions, statusText } from './passenger-model';
import type { Registration } from './passenger-types';

type Target = { id: string; name: string; kind: 'activity' | 'excursion'; endTime: string; status: string; available: number | null };
type Operation = { kind: 'register'; target: Target } | { kind: 'confirm' | 'edit' | 'cancel'; registration: Registration };
export function PassengerActivitiesScreen() {
  const params = useLocalSearchParams<{ bookingId?: string; view?: string }>();
  const selection = useBookingSelection('confirmed', typeof params.bookingId === 'string' ? params.bookingId : '');
  const context = usePassengerContext(); const cruiseId = selection.booking.data?.cruiseId ?? '';
  const activities = usePassengerQuery(['activities'], passengerApi.activities, 'ACTIVITY_READ');
  const excursions = usePassengerQuery(['excursions', cruiseId], signal => passengerApi.excursions(cruiseId, signal), 'EXCURSION_READ', !!cruiseId && context.can('ITINERARY_READ') && context.can('CRUISE_STOP_READ'));
  const registrations = usePassengerQuery(['registrations'], passengerApi.registrations, 'ACTIVITY_REGISTRATION');
  const [tab, setTab] = useState<'activities' | 'excursions' | 'registrations'>(params.view === 'excursions' ? 'excursions' : 'activities');
  const [operation, setOperation] = useState<Operation | null>(null); const [quantity, setQuantity] = useState('1'); const [reason, setReason] = useState(''); const [validation, setValidation] = useState<unknown>(null);
  const action = usePassengerAction();
  const activeActivities = (activities.data ?? []).filter(a => a.cruiseId === cruiseId);
  const hasBooking = !!selection.bookingPassengerId && !selection.booking.error && !selection.bookings.error;
  function open(value: Operation) { action.reset(); setValidation(null); setQuantity(value.kind === 'register' ? '1' : String(value.registration.quantity)); setReason(''); setOperation(value); }
  function duplicate(target: Target) { return (registrations.data ?? []).some(r => r.bookingPassengerId === selection.bookingPassengerId && ['PENDING', 'CONFIRMED'].includes(r.status) && (target.kind === 'activity' ? r.activityId === target.id : r.excursionId === target.id)); }
  function submit() {
    if (!operation || action.isPending) return;
    let amount = 1;
    try { if (operation.kind === 'register' || operation.kind === 'edit') amount = positiveQuantity(quantity); }
    catch (error) { setValidation(error); return; }
    const captured = operation; const person = selection.bookingPassengerId;
    action.mutate(async () => {
      if (captured.kind === 'register') {
        if (!hasBooking || !person) throw new Error('Chọn hồ sơ trong đặt chỗ đã xác nhận.');
        let available = captured.target.available; let status = captured.target.status;
        if (captured.target.kind === 'activity') {
          const latest = await passengerApi.activityAvailability(captured.target.id);
          available = latest.availableSeats; status = latest.status;
        }
        if (!canRegister(status, captured.target.endTime, available, amount)) throw new Error('Hoạt động hoặc tour không còn mở hoặc không đủ chỗ cho số lượng này.');
        return passengerApi.register(captured.target.kind, captured.target.id, person, amount);
      }
      if (captured.kind === 'confirm') return passengerApi.confirmRegistration(captured.registration.id);
      if (captured.kind === 'edit') return passengerApi.updateRegistration(captured.registration.id, amount);
      return passengerApi.cancelRegistration(captured.registration.id, reason);
    }, { onSuccess: () => { setOperation(null); setTab('registrations'); } });
  }
  return <LivePage title="Hoạt động và tour" permission="ACTIVITY_READ">
    <PageIntro title="Hoạt động và tour" icon="explore" /><Text style={ui.caption}>Thời gian hiển thị theo múi giờ thiết bị.</Text>
    <FilterChips items={[{ key: 'activities', label: 'Trên tàu' }, { key: 'excursions', label: 'Tour trên bờ' }, { key: 'registrations', label: 'Đăng ký của tôi' }]} selected={tab} onSelect={setTab} />
    {tab !== 'registrations' && <BookingSelection selection={selection} />}
    {tab === 'activities' && <>
      <ErrorNotice error={activities.error} retry={() => { void activities.refetch(); }} />
      {activities.isPending && <Loading />}
      {cruiseId && !activities.isPending && !activities.error && !activeActivities.length && <EmptyState title="Chưa có hoạt động" description="Chưa có hoạt động được cung cấp cho chuyến đi đã chọn." />}
      {activeActivities.map(item => {
        const target: Target = { id: item.id, name: item.name, kind: 'activity', endTime: item.endTime, status: item.status, available: null };
        return <View key={item.id} style={ui.card}><StatusBadge status={item.status} /><Text style={ui.sectionTitle}>{item.name}</Text>
          <Text style={ui.body}>{dateTime(item.startTime)} – {dateTime(item.endTime)}</Text><Text style={ui.body}>{item.location ?? 'Địa điểm chưa cập nhật'}</Text>
          {!!item.description && <Text style={ui.body}>{item.description}</Text>}<Text style={ui.body}>{money(item.price, item.currencyCode)}</Text>
          {context.can('ACTIVITY_REGISTRATION') && <PassengerButton label={duplicate(target) ? 'Đã có đăng ký' : 'Đăng ký hoạt động'} disabled={!hasBooking || duplicate(target) || !canRegister(item.status, item.endTime, null, 1) || !!registrations.error} onPress={() => open({ kind: 'register', target })} />}
        </View>;
      })}
      <PassengerButton label="Cập nhật hoạt động" variant="text" loading={activities.isFetching} onPress={() => { void activities.refetch(); }} />
    </>}
    {tab === 'excursions' && <>
      {!context.can('EXCURSION_READ') || !context.can('ITINERARY_READ') || !context.can('CRUISE_STOP_READ') ? <Text style={ui.body}>Tài khoản chưa có đủ quyền xem tour theo hải trình.</Text> : <>
        <ErrorNotice error={excursions.error} retry={() => { void excursions.refetch(); }} />
        {cruiseId && excursions.isPending && <Loading />}
        {cruiseId && !excursions.isPending && !excursions.error && !excursions.data?.length && <EmptyState title="Chưa có tour" description="Chuyến đi đã chọn chưa có tour trên bờ được cung cấp." />}
        {excursions.data?.map(item => {
          const target: Target = { id: item.shoreExcursionId, name: item.excursionName, kind: 'excursion', endTime: item.plannedReturnTime, status: item.status, available: item.availableCapacity };
          return <View key={item.shoreExcursionId} style={ui.card}><StatusBadge status={item.status} /><Text style={ui.sectionTitle}>{item.excursionName}</Text>
            <Text style={ui.body}>{dateTime(item.startTime)} – {dateTime(item.plannedReturnTime)}</Text><Text style={ui.body}>{item.meetingPoint ?? 'Điểm tập trung chưa cập nhật'}</Text>
            <Text style={ui.body}>{money(item.price, item.currencyCode)}</Text>{item.availableCapacity !== null && <Text style={ui.caption}>Còn {item.availableCapacity} chỗ</Text>}
            {context.can('EXCURSION_BOOKING') && <PassengerButton label={duplicate(target) ? 'Đã có đăng ký' : 'Đăng ký tour'} disabled={!hasBooking || duplicate(target) || !canRegister(item.status, item.plannedReturnTime, item.availableCapacity, 1) || !!registrations.error} onPress={() => open({ kind: 'register', target })} />}
          </View>;
        })}
        {!!cruiseId && <PassengerButton label="Cập nhật tour" variant="text" loading={excursions.isFetching} onPress={() => { void excursions.refetch(); }} />}
      </>}
    </>}
    {tab === 'registrations' && (!context.can('ACTIVITY_REGISTRATION') ? <Text style={ui.body}>Tài khoản chưa có quyền xem đăng ký.</Text> : <>
      <ErrorNotice error={registrations.error} retry={() => { void registrations.refetch(); }} />{registrations.isPending && <Loading />}
      {!registrations.isPending && !registrations.error && !registrations.data?.length && <EmptyState title="Chưa có đăng ký" description="Hoạt động và tour đã đăng ký bằng tài khoản sẽ xuất hiện tại đây." />}
      {registrations.data?.map(row => <View key={row.id} style={ui.card}>
        <Text style={ui.sectionTitle}>{row.activityId ? activities.data?.find(a => a.id === row.activityId)?.name ?? 'Hoạt động trên tàu' : excursions.data?.find(e => e.shoreExcursionId === row.excursionId)?.excursionName ?? 'Tour trên bờ'}</Text>
        <Text style={ui.body}>{statusText(row.status)} · {row.quantity} chỗ</Text><Text style={ui.caption}>{dateTime(row.registeredAt)}</Text>
        {registrationActions(row).includes('confirm') && <PassengerButton label="Xác nhận tham gia" onPress={() => open({ kind: 'confirm', registration: row })} />}
        {registrationActions(row).includes('edit') && <PassengerButton label="Sửa số lượng" variant="secondary" onPress={() => open({ kind: 'edit', registration: row })} />}
        {registrationActions(row).includes('cancel') && <PassengerButton label="Hủy đăng ký" variant="text" onPress={() => open({ kind: 'cancel', registration: row })} />}
      </View>)}
      <PassengerButton label="Cập nhật đăng ký" variant="text" loading={registrations.isFetching} onPress={() => { void registrations.refetch(); }} />
    </>)}
    <ConfirmAction visible={!!operation} title={operation?.kind === 'register' ? 'Gửi đăng ký' : operation?.kind === 'confirm' ? 'Xác nhận tham gia' : operation?.kind === 'edit' ? 'Lưu số lượng' : 'Xác nhận hủy đăng ký'} description={operation?.kind === 'register' ? `${operation.target.name}. Hệ thống kiểm tra chỗ trống khi gửi; đăng ký mới cần được xác nhận tham gia.` : operation?.kind === 'cancel' ? 'Đăng ký sẽ được hủy theo điều kiện của hoạt động hoặc tour.' : 'Hệ thống sẽ kiểm tra trạng thái và số chỗ hiện tại trước khi lưu.'} onClose={() => setOperation(null)} onConfirm={submit} pending={action.isPending} error={action.error}>
      {(operation?.kind === 'register' || operation?.kind === 'edit') && <Input label="Số chỗ đăng ký" value={quantity} onChange={setQuantity} numeric maxLength={10} disabled={action.isPending} />}
      {operation?.kind === 'cancel' && <Input label="Lý do hủy nếu có" value={reason} onChange={setReason} multiline maxLength={500} disabled={action.isPending} />}
      <ErrorNotice error={validation} />
    </ConfirmAction>
  </LivePage>;
}
