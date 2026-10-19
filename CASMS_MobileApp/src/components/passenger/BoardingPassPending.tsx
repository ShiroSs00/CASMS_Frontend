import { StyleSheet, Text, View } from 'react-native';
import { brand, darkTheme, lightTheme, statusColors } from '@/constants/ocevie';
import { MaterialIcon } from './MaterialIcon';

/** Never display a decorative QR that could be mistaken for an issued ticket. */
export function BoardingPassPending() {
  return <View style={styles.pass}>
    <View style={styles.heading}>
      <Text style={styles.brand}>OCEVIE CRUISES</Text>
      <MaterialIcon name="sailing" color={brand.gold} />
    </View>
    <Text style={styles.title}>Thẻ lên tàu</Text>
    <Text style={styles.caption}>DIGITAL BOARDING PASS</Text>
    <View style={styles.ticket}>
      <View style={styles.icon}><MaterialIcon name="qr_code_2" color={brand.teal} size={48} /></View>
      <Text style={styles.pending}>Chưa được cấp thẻ</Text>
      <Text style={styles.description}>Mã QR sẽ xuất hiện khi thông tin hành khách được xác nhận.</Text>
    </View>
    <View style={styles.status}><MaterialIcon name="support_agent" color={darkTheme.textSecondary} size={20} />
      <Text style={styles.statusText}>Vui lòng liên hệ đội ngũ OceVie nếu bạn cần hỗ trợ lên tàu.</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  pass: { padding: 20, borderRadius: 20, backgroundColor: brand.midnight, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { color: brand.gold, fontSize: 12, lineHeight: 18, letterSpacing: 1.6, fontWeight: '600' },
  title: { color: darkTheme.text, fontSize: 24, lineHeight: 32, fontWeight: '600' },
  caption: { color: darkTheme.textSecondary, fontSize: 12, lineHeight: 18, letterSpacing: 1 },
  ticket: { backgroundColor: lightTheme.surface, padding: 24, marginVertical: 8,
    borderRadius: 16, alignItems: 'center', gap: 12 },
  icon: { padding: 20, borderRadius: 16, backgroundColor: lightTheme.surfaceHover },
  pending: { color: statusColors.neutral.foreground, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  description: { color: lightTheme.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  status: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  statusText: { flex: 1, color: darkTheme.textSecondary, fontSize: 12, lineHeight: 18 },
});
