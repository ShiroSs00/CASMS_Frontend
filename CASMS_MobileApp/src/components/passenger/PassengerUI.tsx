import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { brand, controls, lightTheme, spacing, typeScale } from '@/constants/ocevie';
import { MaterialIcon, type MaterialIconName } from './MaterialIcon';
import { PassengerButton } from './PassengerButton';

export function SectionHeading({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={ui.sectionHeading}><Text accessibilityRole="header" style={ui.sectionTitle}>{title}</Text>
    {action && onPress && <Pressable accessibilityRole="button" onPress={onPress} style={ui.textAction}><Text style={ui.link}>{action}</Text><MaterialIcon name="chevron_right" color={brand.teal} size={18} /></Pressable>}
  </View>;
}
export function EmptyState({ icon = 'explore', title, description, action, onPress }: { icon?: MaterialIconName; title: string; description?: string; action?: string; onPress?: () => void }) {
  return <View style={ui.empty}><View style={ui.emptyIcon}><MaterialIcon name={icon} size={32} color={brand.teal} /></View>
    <Text accessibilityRole="header" style={ui.emptyTitle}>{title}</Text>{!!description && <Text style={ui.emptyCopy}>{description}</Text>}
    {action && onPress && <PassengerButton label={action} onPress={onPress} variant="secondary" />}
  </View>;
}
export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: open ? spacing.md : 0 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={ui.disclosure}>
      <Text style={[ui.body, { color: brand.navy, flex: 1 }]}>{title}</Text><MaterialIcon name={open ? 'expand_less' : 'expand_more'} color={brand.teal} size={20} />
    </Pressable>{open ? children : null}
  </View>;
}
export function AmountRow({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return <View style={ui.amountRow}><Text style={ui.body}>{label}</Text><Text selectable style={prominent ? ui.amount : ui.amountValue}>{value}</Text></View>;
}
export function ActionRow({ title, icon, onPress }: { title: string; icon: MaterialIconName; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [ui.actionRow, pressed && { backgroundColor: lightTheme.selected }]}>
    <MaterialIcon name={icon} color={brand.teal} size={22} /><Text style={[ui.body, { flex: 1, color: brand.navy, fontWeight: '600' }]}>{title}</Text><MaterialIcon name="chevron_right" color={lightTheme.textSecondary} size={20} />
  </Pressable>;
}
export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={[ui.search, focused && { borderColor: brand.teal }]}><MaterialIcon name="search" color={lightTheme.textSecondary} size={22} />
    <TextInput accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={lightTheme.placeholder}
      value={value} onChangeText={onChangeText} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={ui.searchInput} returnKeyType="search" autoCorrect={false} />
    {!!value && <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" onPress={() => onChangeText('')} style={ui.clear}><Text style={ui.link}>Xóa</Text></Pressable>}
  </View>;
}
export function FilterChips<T extends string>({ items, selected, onSelect }: { items: readonly { key: T; label: string }[]; selected: T; onSelect: (key: T) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={ui.chips}>
    {items.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: item.key === selected }}
      onPress={() => onSelect(item.key)} style={[ui.chip, item.key === selected && ui.chipSelected]}>
      <Text style={[ui.chipText, item.key === selected && ui.chipTextSelected]}>{item.label}</Text>
    </Pressable>)}
  </ScrollView>;
}
export { PassengerSheet } from './PassengerSheet';
export const ui = StyleSheet.create({
  content: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  card: { backgroundColor: lightTheme.surface, borderRadius: controls.cardRadius, borderWidth: 1, borderColor: lightTheme.divider, padding: spacing.lg, gap: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { ...typeScale.section, color: brand.navy, flexShrink: 1 },
  title: { ...typeScale.title, color: brand.navy },
  body: { ...typeScale.body, color: lightTheme.textSecondary },
  caption: { ...typeScale.caption, color: lightTheme.textSecondary },
  amount: { ...typeScale.amount, color: brand.navy },
  amountValue: { ...typeScale.body, fontWeight: '600', color: brand.navy, fontVariant: ['tabular-nums'] },
  amountRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  disclosure: { minHeight: controls.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actionRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: lightTheme.divider },
  actionList: { backgroundColor: lightTheme.surface, borderRadius: controls.cardRadius, borderWidth: 1, borderColor: lightTheme.divider, overflow: 'hidden' },
  eyebrow: { fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 1.5, color: brand.teal },
  textAction: { minHeight: controls.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  link: { fontSize: 13, lineHeight: 20, color: brand.teal, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.md },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: lightTheme.surfaceHover },
  emptyTitle: { fontSize: 20, lineHeight: 28, color: brand.navy, fontWeight: '600', textAlign: 'center' },
  emptyCopy: { fontSize: 14, lineHeight: 23, color: lightTheme.textSecondary, textAlign: 'center', maxWidth: 340 },
  search: { minHeight: 52, borderRadius: 14, backgroundColor: lightTheme.surface, borderWidth: 1, borderColor: lightTheme.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  searchInput: { outlineWidth: 0, flex: 1, minWidth: 0, paddingVertical: 14, fontSize: 14, color: brand.navy },
  clear: { minHeight: controls.touch, minWidth: controls.touch, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { minHeight: controls.touch, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: lightTheme.surface, borderWidth: 1, borderColor: lightTheme.divider, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { backgroundColor: brand.tealSoft, borderColor: brand.teal },
  chipText: { fontSize: 13, lineHeight: 20, color: lightTheme.textSecondary },
  chipTextSelected: { color: brand.tealDark, fontWeight: '600' },
});
