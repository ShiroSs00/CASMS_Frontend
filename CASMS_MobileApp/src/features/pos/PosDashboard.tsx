import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { ActionRow, Disclosure, ui } from '@/components/passenger/PassengerUI';
import { brand, layout } from '@/constants/ocevie';
import { usePos, usePosActivities } from './PosLayout';
import { readAreaLabel, readCruiseLabel, readShipLabel } from './pos-api';
import { Notice, PosPage, QueryState, posError, usePosConfirmation } from './pos-ui';

export function PosDashboard() {
  const pos = usePos();
  const { scope } = pos;
  const { shipId, areaId } = scope.terminal;
  const cruise = useQuery({
    queryKey: [...pos.key, 'cruise-label'], queryFn: ({ signal }) => readCruiseLabel(scope.cruiseId, signal),
    enabled: pos.employeePermissions.includes('CRUISE_READ'), retry: false,
  });
  const cruiseLabel = !cruise.error && cruise.data?.cruiseId === scope.cruiseId && cruise.data.shipId === shipId
    ? cruise.data : undefined;
  const ship = useQuery({
    queryKey: [...pos.key, 'ship-label'], queryFn: ({ signal }) => readShipLabel(shipId, signal),
    enabled: !cruiseLabel?.shipName && pos.employeePermissions.includes('SHIP_READ'), retry: false,
  });
  const area = useQuery({
    queryKey: [...pos.key, 'area-label'], queryFn: ({ signal }) => readAreaLabel(shipId, areaId, signal),
    enabled: pos.employeePermissions.includes('SHIP_CONFIGURATION_READ'), retry: false,
  });
  const shipLabel = !ship.error && ship.data?.shipId === shipId ? ship.data.shipName : undefined;
  const activities = usePosActivities();
  const confirm = usePosConfirmation(() => {}, true, false);
  const can = (permission: string) => scope.services.some(service => service.permissions.includes(permission));
  const canActivities = scope.terminal.permissions.includes('ACTIVITY_READ');
  const hasActivities = canActivities && !activities.error && !!activities.data?.length;
  const hasUsage = can('SERVICE_SALE');
  const hasRegistration = hasActivities && activities.data?.some(item => item.permissions.includes('ACTIVITY_REGISTRATION'));
  function end(signOut: boolean) {
    confirm.open({
      title: signOut ? 'Đăng xuất nhân viên' : 'Kết thúc phiên POS',
      description: 'Bạn sẽ cần xác thực lại thiết bị để mở phiên mới.',
      run: () => pos.end(signOut),
    });
  }

  return <PosPage title="Ca làm việc" standalone refresh={pos.refreshSession} refreshing={!pos.verified && !pos.sessionError}>
    <View style={styles.context}>
      <Text style={styles.title}>{scope.terminal.name}</Text>
      <Text style={styles.detail}>{scope.terminal.code} · {pos.username}</Text>
      <Text style={styles.detail}>{cruiseLabel?.shipName ?? shipLabel ?? 'Tàu đã phân công'}</Text>
      {!!area.data && !area.error && <Text style={styles.detail}>{area.data}</Text>}
      {!!cruiseLabel?.cruiseName && <Text style={styles.detail}>{cruiseLabel.cruiseName}</Text>}
    </View>
    <Disclosure title="Chi tiết ca làm việc"><Text selectable style={ui.caption}>Tàu: {shipId}{'\n'}Khu vực: {areaId}{'\n'}Chuyến: {scope.cruiseId}</Text></Disclosure>
    {!!pos.sessionError && <Notice tone="error" retry={pos.refreshSession}>{posError(pos.sessionError)}</Notice>}
    <Text accessibilityRole="header" style={ui.sectionTitle}>Công việc</Text>
    {(can('SERVICE_READ') || can('SERVICE_REQUEST_READ') || hasActivities || hasUsage) && <View style={ui.actionList}>
    {can('SERVICE_READ') && <ActionRow title="Danh mục dịch vụ" icon="room_service" onPress={() => router.navigate('/staff-pos/services')} />}
    {can('SERVICE_REQUEST_READ') && <ActionRow title="Yêu cầu dịch vụ" icon="assignment_ind" onPress={() => router.navigate('/staff-pos/requests')} />}
    {hasActivities && <ActionRow title="Hoạt động trên tàu" icon="explore" onPress={() => router.navigate('/staff-pos/activities')} />}
    {hasUsage && <ActionRow title="Hạn mức và sao kê" icon="restaurant" onPress={() => router.navigate('/staff-pos/usage')} />}
    </View>}
    {canActivities && <QueryState query={activities} empty={activities.data?.length === 0 ? 'Chưa có hoạt động được phân công.' : undefined} />}
    {(hasUsage || hasRegistration) && <PassengerButton compact label="Quét QR" variant="text" onPress={() => router.navigate('/staff-pos/scanner')} />}
    {!scope.services.length && !hasActivities && (!canActivities || activities.data?.length === 0) &&
      <Notice tone="neutral">Chưa có công việc được phân công cho thiết bị và chuyến này.</Notice>}
    <View>
      <PassengerButton label="Kết thúc phiên POS" variant="text" onPress={() => end(false)} />
      <PassengerButton label="Đăng xuất nhân viên" variant="text" onPress={() => end(true)} />
    </View>
    {confirm.ui}
  </PosPage>;
}

const styles = StyleSheet.create({
  context: { backgroundColor: brand.midnight, borderRadius: layout.cardRadius, padding: layout.gutter, gap: 8 },
  kicker: { color: brand.gold, fontSize: 12, letterSpacing: 1.2, fontWeight: '700' },
  title: { color: brand.pearl, fontSize: 24, fontWeight: '700' },
  detail: { color: brand.pearl, fontSize: 14 },
});
