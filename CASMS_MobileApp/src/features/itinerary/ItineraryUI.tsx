import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcon, type MaterialIconName } from '@/components/passenger/MaterialIcon';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';
import { voyage } from '@/constants/voyage';

export function InfoRow({ title, subtitle, icon, onPress }: { title: string; subtitle: string; icon: MaterialIconName; onPress?: () => void }) {
  const content = <><MaterialIcon name={icon} color={colors.onSurface} size={22} /><View style={styles.grow}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.small}>{subtitle}</Text></View>{onPress && <MaterialIcon name="chevron_right" color={colors.onSurfaceVariant} size={20} />}</>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} android_ripple={{ color: colors.secondaryContainer }} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>{content}</Pressable> : <View style={styles.row}>{content}</View>;
}
export function SmallButton({ label, icon, onPress }: { label: string; icon: MaterialIconName; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tool, pressed && styles.pressed]}><MaterialIcon name={icon} color={colors.onSurface} size={18} /><Text style={styles.small}>{label}</Text></Pressable>;
}
export function Facts({ items }: { items: [string, string][] }) { return <View style={styles.facts}>{items.map(([label, value]) => <View key={label} style={styles.fact}><Text style={styles.small}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}</View>; }
export function SheetHeading({ title, subtitle }: { title: string; subtitle: string }) { return <View style={styles.panel}><Text style={styles.sheetTitle} accessibilityRole="header">{title}</Text><Text style={styles.small}>{subtitle}</Text></View>; }
export function Notice({ text }: { text: string }) { return <View style={styles.notice}><Text style={styles.bodyText} accessibilityLiveRegion="polite">{text}</Text></View>; }

export const styles = StyleSheet.create({
  content: { padding: 22, gap: 22, maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 32 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontFamily: voyage.serif, fontSize: 38, lineHeight: 46, letterSpacing: -1.3, color: colors.onSurface },
  chip: { alignSelf: 'flex-start', backgroundColor: colors.surfaceContainerHigh, color: colors.onSurfaceVariant, fontSize: 11, lineHeight: 18, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, overflow: 'hidden' },
  errorChip: { backgroundColor: colors.errorContainer, color: colors.onErrorContainer },
  cruise: { backgroundColor: colors.primaryContainer, borderRadius: 26, padding: 24, gap: 10 },
  ship: { fontFamily: voyage.serif, fontSize: 29, lineHeight: 37, color: colors.onPrimaryContainer },
  cruiseText: { fontSize: 13, lineHeight: 20, color: colors.onPrimaryContainer },
  route: { fontSize: 13, lineHeight: 20, color: colors.tertiaryContainer, marginTop: 8 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tool: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surfaceContainerLow },
  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceContainerHigh, borderRadius: 24, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  selectedSegment: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  days: { flexDirection: 'row', gap: 7 },
  day: { flex: 1, overflow: 'hidden' },
  dayInner: { minHeight: 86, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayNumber: { fontSize: 23, lineHeight: 30, fontWeight: '700', color: colors.onSurface },
  panel: { gap: 14 },
  sectionTitle: { fontFamily: voyage.serif, fontSize: 26, lineHeight: 34, letterSpacing: -.5, color: colors.onSurface, flexShrink: 1 },
  tourCard: { backgroundColor: colors.surfaceContainerLow, borderRadius: 24, padding: 20, gap: 14 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.onSurface },
  tourBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  grow: { flex: 1, minWidth: 100, gap: 4 },
  row: { backgroundColor: colors.surfaceContainerLow, borderRadius: 18, minHeight: 80, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  rowTitle: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: colors.onSurface },
  small: { fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant, flexShrink: 1 },
  bodyText: { fontSize: 14, lineHeight: 23, color: colors.onSurfaceVariant },
  centerText: { fontSize: 14, lineHeight: 23, color: colors.onSurfaceVariant, textAlign: 'center' },
  notice: { backgroundColor: colors.surfaceContainerHigh, borderRadius: 20, padding: 16 },
  pressed: { opacity: .8, transform: [{ scale: .97 }], borderRadius: 16 },
  ports: { gap: 4 },
  empty: { paddingVertical: 50, alignItems: 'center', gap: 20 },
  demo: { borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: 12, gap: 12 },
  demoChip: { borderRadius: 18, backgroundColor: colors.surfaceContainerHigh, padding: 12, minHeight: 44, justifyContent: 'center' },
  modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,48,66,.46)' },
  sheet: { maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 10, paddingHorizontal: 20 },
  handle: { height: 4, width: 32, borderRadius: 4, backgroundColor: colors.outlineVariant, alignSelf: 'center', marginBottom: 6 },
  sheetBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  sheetContent: { gap: 16, paddingBottom: 10 },
  sheetTitle: { fontFamily: voyage.serif, fontSize: 32, lineHeight: 40, letterSpacing: -.7, color: colors.onSurface },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, padding: 20, borderRadius: 20, backgroundColor: colors.surfaceContainerHigh },
  fact: { flex: 1, minWidth: 110, gap: 5 },
  value: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: colors.onSurface },
  change: { gap: 7, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
});
