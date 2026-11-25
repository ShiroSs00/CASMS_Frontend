import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { EmptyState, ui } from '@/components/passenger/PassengerUI';
import { BookingSelection, ErrorNotice, LivePage, Loading } from './PassengerActionUI';
import { useOnboardKey, useOnboardSelection, useOnboardEntitlements } from './onboard-context';
import { EntitlementSummary } from './EntitlementSummary';

export function PassengerPackagesScreen() { return <PackageWorkspace key={useOnboardKey()} />; }
function PackageWorkspace() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const selection = useOnboardSelection(typeof bookingId === 'string' ? bookingId : '');
  const entitlements = useOnboardEntitlements(selection);
  const rows = (entitlements.data ?? []).filter(row => row.bookingPassengerId === selection.bookingPassengerId);
  return <LivePage title="Quyền lợi đã mua" permission="BOOKING_READ" onRefresh={() => { void entitlements.refetch(); void selection.source.refetch(); }} refreshing={entitlements.isFetching}>
    <BookingSelection selection={selection} />
    <ErrorNotice error={selection.booking.error ?? entitlements.error} retry={() => { void selection.booking.refetch(); void entitlements.refetch(); }} />
    {entitlements.isLoading && <Loading text="Đang tải quyền lợi đã mua…" />}
    {entitlements.fetchStatus === 'paused' && <Text style={ui.body}>Đang chờ kết nối để cập nhật quyền lợi. Hãy kiểm tra mạng.</Text>}
    {!!selection.bookingPassengerId && entitlements.isSuccess && !rows.length && <EmptyState title="Chưa có quyền lợi được cấp" description="Hệ thống chưa trả về quyền lợi đã mua cho hồ sơ trong chuyến này. Liên hệ quầy nếu bạn cần kiểm tra." />}
    {rows.map(row => <View key={row.grantId} style={ui.card}><EntitlementSummary rows={[row]} /></View>)}
    <Text style={ui.caption}>Quyền lợi và định mức do hệ thống xác nhận. Thay đổi gói sau đặt chỗ cần được kiểm tra với nhân viên.</Text>
  </LivePage>;
}
