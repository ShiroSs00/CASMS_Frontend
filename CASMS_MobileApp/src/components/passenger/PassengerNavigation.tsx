import { type BottomTabBarProps } from 'expo-router/js-tabs';
import { type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand, lightTheme } from '@/constants/ocevie';
import { MaterialIcon, type MaterialIconName } from './MaterialIcon';

export type PassengerTab = 'home' | 'itinerary' | 'services' | 'notifications' | 'account';
export const passengerDestinations: { key: PassengerTab; route: string; label: string; icon: MaterialIconName; href: Href }[] = [
  { key: 'home', route: 'home', label: 'Trang chủ', icon: 'home', href: '/home' },
  { key: 'itinerary', route: 'itinerary', label: 'Lịch trình', icon: 'sailing', href: '/itinerary' },
  { key: 'services', route: 'services', label: 'Dịch vụ', icon: 'room_service', href: '/services' },
  { key: 'notifications', route: 'notifications', label: 'Thông báo', icon: 'notifications', href: '/notifications' },
  { key: 'account', route: 'account', label: 'Tài khoản', icon: 'person', href: '/account' },
];

export function PassengerTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const current = state.routes[state.index];
  const selected = passengerDestinations.find(item => item.route === current.name)?.key ?? 'home';
  return <PassengerNavigation selected={selected} onSelect={key => {
    const destination = passengerDestinations.find(item => item.key === key);
    const target = state.routes.find(item => item.name === destination?.route);
    if (!target) return;
    const event = emitter.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
    if (!event.defaultPrevented && current.key !== target.key) navigateToTab(target.key);
  }} />;
}

export function PassengerNavigation({ selected, onSelect }: {
  selected: PassengerTab; onSelect: (key: PassengerTab, href: Href) => void;
}) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
    <View accessibilityRole="tablist" accessibilityLabel="Điều hướng chính" style={styles.row}>
      {passengerDestinations.map(item => {
        const active = selected === item.key;
        return <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.label}
          aria-selected={active} accessibilityState={{ selected: active }}
          onPress={() => onSelect(item.key, item.href)}
          style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
          <View style={[styles.icon, active && styles.selectedIcon]}>
            <MaterialIcon name={active && item.key === 'home' ? 'home_filled' : item.icon}
              color={active ? brand.teal : lightTheme.textSecondary} size={23} />
          </View>
          <Text style={[styles.label, active && styles.activeLabel]}>{item.label}</Text>
          {active && <View style={styles.indicator} />}
        </Pressable>;
      })}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  bar: { backgroundColor: lightTheme.surface, borderTopWidth: 1, borderTopColor: lightTheme.divider, paddingHorizontal: 8 },
  row: { width: '100%', maxWidth: 600, alignSelf: 'center', flexDirection: 'row', alignItems: 'stretch' },
  tab: { flex: 1, minWidth: 48, minHeight: 64, paddingTop: 8, paddingBottom: 6, alignItems: 'center', justifyContent: 'center', gap: 4 },
  icon: { width: 44, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  selectedIcon: { backgroundColor: brand.tealSoft },
  label: { fontSize: 12, lineHeight: 16, color: lightTheme.textSecondary, fontWeight: '500', textAlign: 'center' },
  activeLabel: { color: brand.teal, fontWeight: '700' },
  indicator: { position: 'absolute', bottom: 1, width: 16, height: 3, borderRadius: 2, backgroundColor: brand.teal },
  pressed: { opacity: .65 },
});
