import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { brand, lightTheme } from '@/constants/ocevie';
import { MaterialIcon, type MaterialIconName } from './MaterialIcon';
import { PassengerButton } from './PassengerButton';

export function SectionHeading({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={ui.sectionHeading}><Text accessibilityRole="header" style={ui.sectionTitle}>{title}</Text>
    {action && onPress && <Pressable accessibilityRole="button" onPress={onPress} style={ui.textAction}><Text style={ui.link}>{action}</Text><MaterialIcon name="chevron_right" color={brand.teal} size={18} /></Pressable>}
  </View>;
}
export function EmptyState({ icon = 'explore', title, description, action, onPress }: { icon?: MaterialIconName; title: string; description: string; action?: string; onPress?: () => void }) {
  return <View style={ui.empty}><View style={ui.emptyIcon}><MaterialIcon name={icon} size={32} color={brand.teal} /></View>
    <Text accessibilityRole="header" style={ui.emptyTitle}>{title}</Text><Text style={ui.emptyCopy}>{description}</Text>
    {action && onPress && <PassengerButton label={action} onPress={onPress} variant="secondary" />}
  </View>;
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
  content: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap: 24 },
  card: { backgroundColor: lightTheme.surface, borderRadius: 20, borderWidth: 1, borderColor: lightTheme.divider, padding: 20, gap: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontSize: 19, lineHeight: 28, fontWeight: '700', color: brand.navy, flexShrink: 1 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '700', letterSpacing: -.7, color: brand.navy },
  body: { fontSize: 14, lineHeight: 22, color: lightTheme.textSecondary },
  caption: { fontSize: 12, lineHeight: 18, color: lightTheme.textSecondary },
  eyebrow: { fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 1.5, color: brand.teal },
  textAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  link: { fontSize: 13, lineHeight: 20, color: brand.teal, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20, gap: 14 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.tealSoft },
  emptyTitle: { fontSize: 20, lineHeight: 28, color: brand.navy, fontWeight: '600', textAlign: 'center' },
  emptyCopy: { fontSize: 14, lineHeight: 23, color: lightTheme.textSecondary, textAlign: 'center', maxWidth: 340 },
  search: { minHeight: 52, borderRadius: 14, backgroundColor: lightTheme.surface, borderWidth: 1, borderColor: lightTheme.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  searchInput: { outlineWidth: 0, flex: 1, minWidth: 0, paddingVertical: 14, fontSize: 14, color: brand.navy },
  clear: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: lightTheme.surface, borderWidth: 1, borderColor: lightTheme.divider, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { backgroundColor: brand.tealSoft, borderColor: brand.teal },
  chipText: { fontSize: 13, lineHeight: 20, color: lightTheme.textSecondary },
  chipTextSelected: { color: brand.tealDark, fontWeight: '600' },
});
