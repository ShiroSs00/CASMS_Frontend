import { type Href } from 'expo-router';
import { type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { passengerLightColors as colors } from '@/constants/passenger-light-theme';

import { MaterialIcon, type MaterialIconName } from './MaterialIcon';

export type PassengerTab = 'home' | 'itinerary' | 'qr' | 'services' | 'spending';
const destinations: { key: PassengerTab; route: string; label: string; icon: MaterialIconName; href: Href }[] = [
  { key: 'home', route: 'home', label: 'Trang chủ', icon: 'home', href: '/home' },
  { key: 'itinerary', route: 'itinerary', label: 'Hải trình', icon: 'explore', href: '/itinerary' },
  { key: 'qr', route: 'passenger-qr', label: 'Thẻ QR', icon: 'qr_code', href: '/passenger-qr' },
  { key: 'services', route: 'services', label: 'Dịch vụ', icon: 'room_service', href: '/services' },
  { key: 'spending', route: 'spending', label: 'Chi tiêu', icon: 'account_balance_wallet', href: '/spending' },
];

/** One persistent bar for the navigator; tab presses select an existing screen. */
export function PassengerTabBar({ state, navigation, locked = false }: BottomTabBarProps & { locked?: boolean }) {
  const route = state.routes[state.index];
  const selected = destinations.find(item => item.route === route.name)?.key ?? 'home';

  return <PassengerNavigation selected={selected} locked={locked} onSelect={key => {
    const destination = destinations.find(item => item.key === key)!;
    const target = state.routes.find(item => item.name === destination.route)!;
    const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
    if (target.key !== route.key && !event.defaultPrevented) navigation.navigate(target.name);
  }} />;
}

/** Detail screens can return to the existing tab navigator through the same bar. */
export function PassengerNavigation({ selected, locked = false, onSelect }: {
  selected: PassengerTab;
  locked?: boolean;
  onSelect: (key: PassengerTab, href: Href) => void;
}) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.nav, { paddingBottom: insets.bottom }]}>
    <View style={styles.navRow}>
      {destinations.map(item => {
        const active = selected === item.key;
        return <Pressable key={item.key} accessibilityRole="tab" aria-selected={active} aria-disabled={locked}
          accessibilityLabel={item.label} accessibilityState={{ selected: active, disabled: locked }}
          disabled={locked} onPress={() => onSelect(item.key, item.href)}
          android_ripple={{ color: colors.secondaryContainer }}
          style={({ pressed }) => [styles.destination, pressed && styles.pressed]}>
          <View style={[styles.indicator, active && styles.activeIndicator]}>
            <MaterialIcon name={active && item.key === 'home' ? 'home_filled' : item.icon}
              color={active ? colors.onSecondaryContainer : colors.onSurfaceVariant} />
          </View>
          <Text style={[styles.navLabel, active && styles.activeLabel]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  nav: { backgroundColor: colors.surfaceContainer, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  navRow: { minHeight: 80, flexDirection: 'row', alignItems: 'stretch' },
  destination: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 20 },
  indicator: { width: 64, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  activeIndicator: { backgroundColor: colors.secondaryContainer },
  navLabel: { fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.onSurfaceVariant, textAlign: 'center' },
  activeLabel: { color: colors.onSurface, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.96 }], backgroundColor: colors.secondaryContainer },
});
