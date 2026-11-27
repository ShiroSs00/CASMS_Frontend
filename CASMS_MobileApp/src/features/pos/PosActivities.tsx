import { samePosScope, usePosScopeGuard } from './pos-scope';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { ui } from '@/components/passenger/PassengerUI';
import { Choice, StatusBadge } from '@/features/passenger-actions/PassengerActionUI';
import { dateTime } from '@/features/passenger-actions/passenger-model';
import { ApiError } from '@/lib/api';
import { useNow } from '@/hooks/use-now';
import { usePos, usePosActivities, usePosRequests } from './PosLayout';
import { passengerReference, passengersFromRequests } from './pos-access';
import { uuid, type AttendanceAction, type PosActivity, type ActivityAction } from './pos-api';
import { activityActions, attendanceActions, verifyAttendanceOutcome, verifyRegistrationOutcome } from './pos-lifecycle';
import { Field, Notice, PosPage, PosReveal, QueryState, posError, usePosConfirmation } from './pos-ui';

const attendanceLabels: Record<AttendanceAction, string> = {
  'check-in': 'Điểm danh vào', checkout: 'Ghi nhận rời hoạt động', complete: 'Hoàn tất tham gia', 'no-show': 'Ghi nhận vắng mặt',
};
const activityLabels: Record<ActivityAction, string> = {
  open: 'Mở đăng ký', start: 'Bắt đầu hoạt động', complete: 'Hoàn tất hoạt động', cancel: 'Hủy hoạt động',
};
const attendanceStatus: Record<string, string> = {
  REGISTERED: 'Chờ điểm danh', CHECKED_IN: 'Đã điểm danh', IN_PROGRESS: 'Đã ghi nhận rời hoạt động',
  COMPLETED: 'Hoàn tất', NO_SHOW: 'Vắng mặt', CANCELLED: 'Đã hủy',
};

export function PosActivities() {
  const pos = usePos();
  const query = usePosActivities();
  const [selected, setSelected] = useState('');
  const denied = query.error instanceof ApiError && [401, 403, 404].includes(query.error.status);
  const detail = !denied ? query.data?.find(item => item.activity.id === selected) : undefined;
  const reload = () => { pos.refreshSession(); void query.refetch(); };
  if (!pos.scope.terminal.permissions.includes('ACTIVITY_READ')) {
    return <PosPage title="Hoạt động trên tàu"><Notice tone="warning">Bạn chưa có quyền xem hoạt động trong phiên này.</Notice></PosPage>;
  }
  if (detail) return <ActivityDetail key={detail.activity.id} item={detail} onBack={() => setSelected('')} reloadActivities={reload}
    refreshing={query.isFetching} activitiesError={query.error} />;
  return <PosPage title="Hoạt động trên tàu" refresh={reload} refreshing={query.isRefetching}>
    <QueryState query={query} empty={query.data?.length === 0 ? 'Chưa có hoạt động được phân công.' : undefined} />
    {!denied && query.data?.map(item => <View key={item.activity.id} style={ui.card}>
      <ActivitySummary item={item} />
      <PassengerButton label={`Xem ${item.activity.name}`} variant="secondary" onPress={() => setSelected(item.activity.id)} />
    </View>)}
  </PosPage>;
}

function ActivitySummary({ item }: { item: PosActivity }) {
  const { activity } = item;
  return <>
    <Text style={ui.eyebrow}>{activity.code}</Text>
    <Text style={ui.sectionTitle}>{activity.name}</Text>
    <StatusBadge status={activity.status} />
    <Text style={ui.body}>{dateTime(activity.startTime, 'UTC')} – {dateTime(activity.endTime, 'UTC')}</Text>
    {!!activity.location && <Text style={ui.body}>{activity.location}</Text>}
    {!!activity.meetingPoint && <Text style={ui.body}>Điểm tập trung: {activity.meetingPoint}</Text>}
    {activity.capacity !== null && <Text style={ui.caption}>Sức chứa cấu hình: {activity.capacity}</Text>}
  </>;
}

function ActivityDetail({ item, onBack, reloadActivities, refreshing, activitiesError }: {
  item: PosActivity; onBack: () => void; reloadActivities: () => void; refreshing: boolean; activitiesError: unknown;
}) {
  const pos = usePos();
  const cache = useQueryClient();
  const { activity, permissions } = item;
  const canRegister = permissions.includes('ACTIVITY_REGISTRATION');
  const canAttend = permissions.includes('ACTIVITY_ATTENDANCE');
  const now = useNow();
  const canCreate = activity.status === 'OPEN' && Date.parse(activity.endTime) > now;
  const requests = usePosRequests(pos, canRegister && canCreate);
  const passengerOptions = requests.error ? [] : passengersFromRequests(pos.scope.services, requests.data ?? []);
  const [passenger, setPassenger] = useState('');
  const [seats, setSeats] = useState('1');
  const quantity = Number(seats);
  const registrations = useQuery({
    queryKey: [...pos.key, 'registrations', activity.id], queryFn: ({ signal }) => pos.client.registrations(activity.id, signal),
    enabled: canRegister || canAttend, retry: false,
  });
  const participation = useQuery({
    queryKey: [...pos.key, 'participations', activity.id], queryFn: ({ signal }) => pos.client.participations(activity.id, signal),
    enabled: canAttend, retry: false,
  });
  function reload() {
    reloadActivities();
    if (canRegister || canAttend) void registrations.refetch();
    if (canAttend) void participation.refetch();
  }
  const verified = pos.verified && !refreshing && !activitiesError;
  const registrationReady = verified && !!registrations.data && !registrations.error && !registrations.isFetching;
  const attendanceReady = verified && !!participation.data && !participation.error && !participation.isFetching;
  const confirm = usePosConfirmation(reload, verified);
  const assertScope = usePosScopeGuard();
  const changedSeats = useRef('');
  const currentActivity = useCallback(async (permission: string) => {
    assertScope();
    const scope = await pos.client.context(); assertScope();
    if (!samePosScope(scope, pos.scope)) throw new ApiError('Ngữ cảnh POS đã thay đổi.', 409, 'POS_REVERIFY');
    cache.setQueryData([...pos.key, 'context'], scope);
    const rows = await pos.client.activities(); assertScope();
    cache.setQueryData([...pos.key, 'activities'], rows);
    const current = rows.find(entry => entry.activity.id === activity.id);
    if (!current?.permissions.includes(permission) || current.activity.status === 'CANCELLED'
      || current.activity.cruiseId && current.activity.cruiseId !== pos.scope.cruiseId) throw new ApiError('Hoạt động hoặc quyền đã thay đổi.', 409, 'POS_REVERIFY');
    return current.activity;
  }, [assertScope, pos.client, pos.scope, pos.key, cache, activity.id]);
  const currentRegistrations = useCallback(async () => {
    const rows = await pos.client.registrations(activity.id); assertScope();
    if (rows.some(row => row.activityId !== activity.id || row.excursionId)) throw new ApiError('Đăng ký ngoài hoạt động.', 502, 'POS_INVALID_RESPONSE');
    cache.setQueryData([...pos.key, 'registrations', activity.id], rows); return rows;
  }, [pos.client, pos.key, cache, activity.id, assertScope]);
  const changeRegistration = useCallback(async (id: string, action: 'confirm' | 'cancel' | 'update') => {
    const current = await currentActivity('ACTIVITY_REGISTRATION');
    const row = (await currentRegistrations()).find(registration => registration.id === id);
    const before = registrations.data?.find(registration => registration.id === id);
    const allowed = action === 'cancel' ? row && ['PENDING','CONFIRMED'].includes(row.status) && Date.parse(current.startTime) > Date.now()
      : row?.status === 'PENDING' && (action === 'update' || ['OPEN','FULL'].includes(current.status) && Date.parse(current.endTime) > Date.now());
    if (!row || !before || row.bookingPassengerId !== before.bookingPassengerId || row.quantity !== before.quantity || row.activityId !== before.activityId || row.status !== before.status || !allowed)
      throw new ApiError('Đăng ký đã được cập nhật. Kiểm tra lại danh sách.', 409, 'POS_REVERIFY');
    const quantity = action === 'update' ? Number(changedSeats.current) : row.quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2147483647 || (action === 'update' && !/^\d+$/.test(changedSeats.current.trim())))
      throw new ApiError('Số chỗ không hợp lệ.', 422, 'POS_QUANTITY_INVALID');
    const result = action === 'update' ? await pos.client.updateRegistration(id, quantity, row.notes) : await pos.client.registrationAction(id, action);
    verifyRegistrationOutcome(row, result, action, quantity);
    await cache.invalidateQueries({ queryKey: pos.key });
    return result;
  }, [currentActivity, currentRegistrations, registrations.data, pos.client, pos.key, cache]);
  const changeActivity = useCallback(async (action: ActivityAction) => {
    const current = await currentActivity('ACTIVITY_LIFECYCLE');
    if (!activityActions(current, Date.now()).includes(action)) throw new ApiError('Trạng thái hoạt động đã thay đổi.', 409, 'POS_REVERIFY');
    const result = await pos.client.activityAction(activity.id, action);
    await cache.invalidateQueries({ queryKey: pos.key }); return result;
  }, [currentActivity, activity.id, pos.client, pos.key, cache]);
  const changeAttendance = useCallback(async (id: string, action: AttendanceAction) => {
    const current = await currentActivity('ACTIVITY_ATTENDANCE');
    const rows = await pos.client.participations(activity.id); assertScope();
    cache.setQueryData([...pos.key, 'participations', activity.id], rows);
    const row = rows.find(entry => entry.id === id), before = participation.data?.find(entry => entry.id === id);
    const registration = (await currentRegistrations()).find(entry => entry.id === row?.registrationId);
    if (!row || !before || row.registrationId !== before.registrationId || row.status !== before.status || !registration
      || (action === 'check-in' && registration.status !== 'CONFIRMED') || !attendanceActions(row, current, Date.now()).includes(action))
      throw new ApiError('Điểm danh hoặc đăng ký đã thay đổi.', 409, 'POS_REVERIFY');
    const result = await pos.client.attendance(id, action); verifyAttendanceOutcome(row, result, action);
    await cache.invalidateQueries({ queryKey: pos.key }); return result;
  }, [currentActivity, currentRegistrations, activity.id, pos.client, pos.key, cache, assertScope, participation.data]);
  const duplicate = registrations.data?.some(row => row.bookingPassengerId.toLowerCase() === passenger.trim().toLowerCase()
    && ['PENDING', 'CONFIRMED'].includes(row.status));
  const valid = uuid.safeParse(passenger.trim()).success && /^\d+$/.test(seats)
    && Number.isInteger(quantity) && quantity > 0 && quantity <= 2147483647 && !duplicate;
  const passengerByRegistration = new Map(registrations.data?.map(row => [row.id, row.bookingPassengerId]));

  return <PosPage title="Chi tiết hoạt động" refresh={reload} refreshing={registrations.isRefetching || participation.isRefetching}>
    <PassengerButton compact label="Danh sách hoạt động" variant="text" disabled={confirm.pending} onPress={onBack} />
    <View style={ui.card}><PosReveal><ActivitySummary item={item} /></PosReveal></View>
    {!!activitiesError && <Notice tone="error" retry={reload}>{posError(activitiesError)}</Notice>}
    {!!pos.sessionError && <Notice tone="error" retry={pos.refreshSession}>{posError(pos.sessionError)}</Notice>}
    {permissions.includes('ACTIVITY_LIFECYCLE') && activityActions(activity, now).map(action =>
      <PassengerButton compact key={action} label={activityLabels[action]} variant={action === 'cancel' ? 'text' : 'secondary'}
        disabled={!verified || confirm.pending} onPress={() => confirm.open({
          title: activityLabels[action], description: activity.name, run: () => changeActivity(action),
        })} />)}
    {canRegister && canCreate && <View style={ui.card}>
      <Text accessibilityRole="header" style={ui.sectionTitle}>Đăng ký hành khách</Text>
      {passengerOptions.length > 0 && <Choice label="Hành khách từ yêu cầu trong phiên" value={passenger}
        items={passengerOptions} onChange={setPassenger} disabled={!pos.verified || confirm.pending} />}
      <Field label="Mã hồ sơ hành khách" value={passenger} onChangeText={setPassenger} maxLength={36} />
      <Field label="Số chỗ" value={seats} onChangeText={setSeats} keyboardType="number-pad" maxLength={10} />
      {duplicate && <Notice tone="warning">Hành khách đã có đăng ký cho hoạt động này.</Notice>}
      <PassengerButton label="Xem lại đăng ký" disabled={!valid || !registrationReady} onPress={() => confirm.open({
        title: 'Đăng ký hoạt động',
        description: `${activity.name} · ${quantity} chỗ · ${passengerReference(passenger.trim(), passengerOptions)}`,
        run: async () => {
          const current = await currentActivity('ACTIVITY_REGISTRATION');
          if (current.status !== 'OPEN' || Date.parse(current.endTime) <= Date.now()
            || (await currentRegistrations()).some(row => row.bookingPassengerId.toLowerCase() === passenger.trim().toLowerCase()
              && ['PENDING', 'CONFIRMED'].includes(row.status))) {
            throw new ApiError('Điều kiện đăng ký đã thay đổi.', 409, 'POS_REVERIFY');
          }
          await pos.client.register(activity.id, passenger.trim(), quantity);
          await cache.invalidateQueries({ queryKey: pos.key });
          assertScope();
          setPassenger('');
          setSeats('1');
        },
      })} />
    </View>}
    {(canRegister || canAttend) && <>
      <Text accessibilityRole="header" style={ui.sectionTitle}>Đăng ký</Text>
      <QueryState query={registrations} empty={registrations.data?.length === 0 ? 'Chưa có đăng ký.' : undefined} />
      {!registrations.error && registrations.data?.map(row => <View style={ui.card} key={row.id}>
        <Text style={ui.body}>{passengerReference(row.bookingPassengerId, passengerOptions)}</Text>
        <Text style={ui.caption}>Số chỗ {row.quantity}</Text>
        <StatusBadge status={row.status} />
        {canRegister && activity.status !== 'CANCELLED' && (row.status === 'PENDING' || row.status === 'CONFIRMED') && <>
          {row.status === 'PENDING' && <PassengerButton label="Sửa số chỗ" variant="secondary" disabled={!registrationReady} onPress={() => { changedSeats.current = String(row.quantity); confirm.open({ title: 'Sửa số chỗ đăng ký', description: activity.name, content: pending => <RegistrationSeatsField initial={String(row.quantity)} disabled={pending} onChange={value => { changedSeats.current = value; }} />, run: () => changeRegistration(row.id, 'update') }); }} />}
          {row.status === 'PENDING' && ['OPEN', 'FULL'].includes(activity.status) && Date.parse(activity.endTime) > now &&
            <PassengerButton label="Duyệt đăng ký" disabled={!registrationReady} onPress={() => confirm.open({
              title: 'Duyệt đăng ký', description: `${activity.name} · ${passengerReference(row.bookingPassengerId, passengerOptions)}`,
              run: () => changeRegistration(row.id, 'confirm'),
            })} />}
          <PassengerButton label="Hủy đăng ký" variant="text" disabled={!registrationReady || Date.parse(activity.startTime) <= now} onPress={() => confirm.open({
            title: 'Hủy đăng ký', description: `${activity.name} · ${passengerReference(row.bookingPassengerId, passengerOptions)}`,
            run: () => changeRegistration(row.id, 'cancel'),
          })} />
        </>}
      </View>)}
    </>}
    {canAttend && <>
      <Text accessibilityRole="header" style={ui.sectionTitle}>Điểm danh và tham gia</Text>
      <QueryState query={participation} empty={participation.data?.length === 0 ? 'Chưa có người tham gia để điểm danh.' : undefined} />
      {!participation.error && participation.data?.map(row => {
        const person = passengerByRegistration.get(row.registrationId);
        return <View style={ui.card} key={row.id}>
          <Text style={ui.body}>{person ? passengerReference(person, passengerOptions) : 'Chưa có thông tin hồ sơ hành khách'}</Text>
          <Text style={ui.body}>{attendanceStatus[row.status] ?? row.status}</Text>
          {!!row.checkInTime && <Text style={ui.caption}>Vào {dateTime(row.checkInTime)}</Text>}
          {!!row.checkOutTime && <Text style={ui.caption}>Rời {dateTime(row.checkOutTime)}</Text>}
          {attendanceActions(row, activity, now).map(action => <PassengerButton compact key={action} label={attendanceLabels[action]} variant="secondary"
            disabled={!attendanceReady} onPress={() => confirm.open({
              title: attendanceLabels[action], description: `${activity.name} · ${person ? passengerReference(person, passengerOptions) : 'Chưa có thông tin hồ sơ hành khách'}`,
              run: () => changeAttendance(row.id, action),
            })} />)}
        </View>;
      })}
    </>}
    {confirm.ui}
  </PosPage>;
}

function RegistrationSeatsField({ initial, disabled, onChange }: { initial: string; disabled: boolean; onChange(value: string): void }) {
  const [value, setValue] = useState(initial);
  return <Field label="Số chỗ đăng ký" keyboardType="number-pad" maxLength={10} editable={!disabled} value={value} onChangeText={next => { setValue(next); onChange(next); }} />;
}
