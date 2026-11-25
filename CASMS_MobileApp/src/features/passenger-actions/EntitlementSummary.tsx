import { Text, View } from 'react-native';
import { spacing } from '@/constants/ocevie';
import { ui } from '@/components/passenger/PassengerUI';
import { dateTime } from './passenger-model';
import type { Entitlement } from './onboard-contracts';

const inclusions: Record<string, string> = { INCLUDED: 'Đã bao gồm', UNLIMITED_INCLUDED: 'Đã bao gồm, không giới hạn theo gói', LIMITED_INCLUDED: 'Đã bao gồm theo định mức', OPTIONAL: 'Cần xác nhận mua thêm', NOT_INCLUDED: 'Không bao gồm trong gói' };
export function EntitlementSummary({ rows }: { rows: Entitlement[] }) {
  return <>{rows.map(row => <View key={row.grantId} style={{ gap: spacing.sm }}>
    <Text style={ui.sectionTitle}>{row.benefitName}</Text>
    {!!row.sourcePackageName && <Text style={ui.body}>{row.sourcePackageName}</Text>}
    <Text style={ui.body}>{inclusions[row.inclusion] ?? 'Quyền lợi cần được kiểm tra tại quầy'}</Text>
    <Text style={ui.body}>Được cấp: {row.grantedQuantity ?? 'Chưa có số liệu'} · Đã dùng: {row.usedQuantity ?? 'Chưa có số liệu'} · Còn lại: {row.remainingQuantity ?? 'Chưa có số liệu'}</Text>
    {!!(row.serviceUnitCode || row.usageUnit) && <Text style={ui.caption}>Đơn vị: {row.serviceUnitCode ?? row.usageUnit}</Text>}
    {(row.usageStartsAt || row.usageEndsAt) && <Text style={ui.caption}>Thời hạn: {dateTime(row.usageStartsAt)} – {dateTime(row.usageEndsAt)}</Text>}
    <Text style={ui.caption}>{row.canRegister ? 'Hệ thống xác nhận quyền lợi đang đủ điều kiện đăng ký.' : 'Quyền lợi hiện chưa đủ điều kiện đăng ký.'}</Text>
    {row.blockers.map((blocker, index) => <Text key={blocker.code + index} style={ui.body}>{blocker.message}</Text>)}
  </View>)}</>;
}
