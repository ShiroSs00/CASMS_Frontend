import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { ui } from '@/components/passenger/PassengerUI';
import { Choice, StatusBadge } from '@/features/passenger-actions/PassengerActionUI';
import { dateTime } from '@/features/passenger-actions/passenger-model';
import { ApiError } from '@/lib/api';
import { useNow } from '@/hooks/use-now';
import { usePos, usePosActivities, usePosRequests } from './PosLayout';
import { passengersFromRequests } from './pos-access';
import { uuid, type AttendanceAction, type PosActivity, type PosParticipation, type PosRegistration, type ActivityAction } from './pos-api';
import { activityActions } from './pos-lifecycle';
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

function attendanceActions(row: PosParticipation, activity: PosActivity['activity']): AttendanceAction[] {
  if (row.status === 'CHECKED_IN') return ['checkout'];
  if (row.status === 'IN_PROGRESS') return ['complete'];
  if (row.status !== 'REGISTERED') return [];
  const actions: AttendanceAction[] = [];
  if (activity.status === 'IN_PROGRESS') actions.push('check-in');
  if (Date.parse(activity.endTime) <= Date.now()) actions.push('no-show');
  return actions;
}

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
    <Text style={ui.body}>{dateTime(activity.startTime)} – {dateTime(activity.endTime)}</Text>
    {!!activity.location && <Text style={ui.body}>{activity.location}</Text>}
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
  const currentData = useCallback(<T,>(key: readonly unknown[]) => {
    const state = cache.getQueryState<T>(key);
    if (!state?.data || state.error || state.isInvalidated || state.fetchStatus !== 'idle') {
      throw new ApiError('Cần tải lại hoạt động.', 409, 'POS_REVERIFY');
    }
    return state.data;
  }, [cache]);
  const currentActivity = useCallback((permission: string) => {
    pos.assertReady();
    const current = currentData<PosActivity[]>([...pos.key, 'activities']).find(entry => entry.activity.id === activity.id);
    if (!current?.permissions.includes(permission)) throw new ApiError('Quyền hoạt động đã thay đổi.', 403);
    return current.activity;
  }, [pos, activity.id, currentData]);
  const currentRegistrations = useCallback(() => {
    return currentData<PosRegistration[]>([...pos.key, 'registrations', activity.id]);
  }, [pos.key, activity.id, currentData]);
  const changeRegistration = useCallback((id: string, action: 'confirm' | 'cancel') => {
    const current = currentActivity('ACTIVITY_REGISTRATION');
    const row = currentRegistrations().find(registration => registration.id === id);
    const allowed = action === 'cancel' ? row?.status === 'PENDING' || row?.status === 'CONFIRMED'
      : row?.status === 'PENDING' && ['OPEN', 'FULL'].includes(current.status) && Date.parse(current.endTime) > Date.now();
    if (!allowed) throw new ApiError('Trạng thái đăng ký đã thay đổi.', 409, 'POS_REVERIFY');
    return pos.client.registrationAction(id, action);
  }, [currentActivity, currentRegistrations, pos.client]);
  const changeActivity = useCallback((action: ActivityAction) => {
    const current = currentActivity('ACTIVITY_LIFECYCLE');
    if (!activityActions(current, Date.now()).includes(action)) throw new ApiError('Trạng thái hoạt động đã thay đổi.', 409, 'POS_REVERIFY');
    return pos.client.activityAction(activity.id, action);
  }, [currentActivity, pos.client, activity.id]);
  function changeAttendance(id: string, action: AttendanceAction) {
    const current = currentActivity('ACTIVITY_ATTENDANCE');
    const row = currentData<PosParticipation[]>([...pos.key, 'participations', activity.id]).find(entry => entry.id === id);
    if (!row || !attendanceActions(row, current).includes(action)) {
      throw new ApiError('Trạng thái điểm danh đã thay đổi.', 409, 'POS_REVERIFY');
    }
    return pos.client.attendance(id, action);
  }
  const duplicate = registrations.data?.some(row => row.bookingPassengerId.toLowerCase() === passenger.trim().toLowerCase()
    && ['PENDING', 'CONFIRMED'].includes(row.status));
  const valid = uuid.safeParse(passenger.trim()).success && /^\d+$/.test(seats)
    && Number.isInteger(quantity) && quantity > 0 && quantity <= 2147483647 && !duplicate;
  const passengerByRegistration = new Map(registrations.data?.map(row => [row.id, row.bookingPassengerId]));

  return <PosPage title="Chi tiết hoạt động" refresh={reload} refreshing={registrations.isRefetching || participation.isRefetching}>
    <PassengerButton label="Về danh sách hoạt động" variant="text" disabled={confirm.pending} onPress={onBack} />
    <View style={ui.card}><PosReveal><ActivitySummary item={item} /></PosReveal></View>
    {!!activitiesError && <Notice tone="error" retry={reload}>{posError(activitiesError)}</Notice>}
    {!!pos.sessionError && <Notice tone="error" retry={pos.refreshSession}>{posError(pos.sessionError)}</Notice>}
    {permissions.includes('ACTIVITY_LIFECYCLE') && activityActions(activity, now).map(action =>
      <PassengerButton key={action} label={activityLabels[action]} variant={action === 'cancel' ? 'text' : 'secondary'}
        disabled={!verified || confirm.pending} onPress={() => confirm.open({
          title: activityLabels[action], description: activity.name, run: () => changeActivity(action),
        })} />)}
    {canRegister && canCreate && <View style={ui.card}>
      <Text accessibilityRole="header" style={ui.sectionTitle}>Đăng ký hành khách</Text>
      {passengerOptions.length > 0 && <Choice label="Hành khách từ yêu cầu trong phiên" value={passenger}
        items={passengerOptions} onChange={setPassenger} disabled={!pos.verified || confirm.pending} />}
      <Field label="ID hành khách trong đặt chỗ" value={passenger} onChangeText={setPassenger} maxLength={36} />
      <Field label="Số chỗ" value={seats} onChangeText={setSeats} keyboardType="number-pad" maxLength={10} />
      {duplicate && <Notice tone="warning">Hành khách đã có đăng ký cho hoạt động này.</Notice>}
      <PassengerButton label="Xem lại đăng ký" disabled={!valid || !registrationReady} onPress={() => confirm.open({
        title: 'Đăng ký hoạt động',
        description: `${activity.name} · ${quantity} chỗ · Hành khách ${passenger.trim()}`,
        run: async () => {
          const current = currentActivity('ACTIVITY_REGISTRATION');
          if (current.status !== 'OPEN' || Date.parse(current.endTime) <= Date.now()
            || currentRegistrations().some(row => row.bookingPassengerId.toLowerCase() === passenger.trim().toLowerCase()
              && ['PENDING', 'CONFIRMED'].includes(row.status))) {
            throw new ApiError('Điều kiện đăng ký đã thay đổi.', 409, 'POS_REVERIFY');
          }
          await pos.client.register(activity.id, passenger.trim(), quantity);
          setPassenger('');
          setSeats('1');
        },
      })} />
    </View>}
    {(canRegister || canAttend) && <>
      <Text accessibilityRole="header" style={ui.sectionTitle}>Đăng ký</Text>
      <QueryState query={registrations} empty={registrations.data?.length === 0 ? 'Chưa có đăng ký.' : undefined} />
      {!registrations.error && registrations.data?.map(row => <View style={ui.card} key={row.id}>
        <Text selectable style={ui.body}>Hành khách {row.bookingPassengerId}</Text>
        <Text style={ui.caption}>Số chỗ {row.quantity}</Text>
        <StatusBadge status={row.status} />
        {canRegister && (row.status === 'PENDING' || row.status === 'CONFIRMED') && <>
          {row.status === 'PENDING' && ['OPEN', 'FULL'].includes(activity.status) && Date.parse(activity.endTime) > now &&
            <PassengerButton label="Duyệt đăng ký" disabled={!registrationReady} onPress={() => confirm.open({
              title: 'Duyệt đăng ký', description: `${activity.name} · Hành khách ${row.bookingPassengerId}`,
              run: () => changeRegistration(row.id, 'confirm'),
            })} />}
          <PassengerButton label="Hủy đăng ký" variant="text" disabled={!registrationReady} onPress={() => confirm.open({
            title: 'Hủy đăng ký', description: `${activity.name} · Hành khách ${row.bookingPassengerId}`,
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
          <Text style={ui.body}>{person ? `Hành khách ${person}` : `Đăng ký ${row.registrationId}`}</Text>
          <Text style={ui.body}>{attendanceStatus[row.status] ?? row.status}</Text>
          {!!row.checkInTime && <Text style={ui.caption}>Vào {dateTime(row.checkInTime)}</Text>}
          {!!row.checkOutTime && <Text style={ui.caption}>Rời {dateTime(row.checkOutTime)}</Text>}
          {attendanceActions(row, activity).map(action => <PassengerButton key={action} label={attendanceLabels[action]} variant="secondary"
            disabled={!attendanceReady} onPress={() => confirm.open({
              title: attendanceLabels[action], description: `${activity.name} · ${person ?? row.registrationId}`,
              run: () => changeAttendance(row.id, action),
            })} />)}
        </View>;
      })}
    </>}
    {confirm.ui}
  </PosPage>;
}
