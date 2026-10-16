import { type Href } from 'expo-router';
import { type BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { passengerLightColors as colors } from '@/constants/passenger-light-theme';

import { MaterialIcon, type MaterialIconName } from './MaterialIcon';

export type PassengerTab = 'home' | 'itinerary' | 'qr' | 'services' | 'spending';
const destinations: { key: PassengerTab; route: string; label: string; icon: MaterialIconName; href: Href }[] = [
  { key: 'home', route: 'home', label: 'Hôm nay', icon: 'home', href: '/home' },
  { key: 'itinerary', route: 'itinerary', label: 'Hải trình', icon: 'sailing', href: '/itinerary' },
  { key: 'services', route: 'services', label: 'Khám phá', icon: 'explore', href: '/services' },
  { key: 'qr', route: 'passenger-qr', label: 'Thẻ', icon: 'qr_code', href: '/passenger-qr' },
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
  const reduceMotion = useReducedMotion();
  const selectedIndex = destinations.findIndex(item => item.key === selected);
  const position = useSharedValue(selectedIndex);
  const slot = useSharedValue(0);
  const height = useSharedValue(74);
  useEffect(() => {
    position.set(reduceMotion ? selectedIndex : withSpring(selectedIndex, { stiffness: 320, damping: 30, mass: .8, overshootClamping: true }));
  }, [position, reduceMotion, selectedIndex]);
  const movingPill = useAnimatedStyle(() => ({
    opacity: slot.get() > 0 ? 1 : 0,
    width: Math.max(0, slot.get() - 8),
    height: height.get() - 12,
    transform: [{ translateX: position.get() * slot.get() + 4 }],
  }));
  return <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
    <View style={[styles.dock, locked && styles.locked]}>
    <View accessibilityRole="tablist" accessibilityLabel="Điều hướng chính" style={styles.navRow} onLayout={event => {
      slot.set(event.nativeEvent.layout.width / destinations.length);
      height.set(event.nativeEvent.layout.height);
    }}>
      <Animated.View pointerEvents="none" style={[styles.activePill, movingPill]} />
      {destinations.map(item => <NavigationDestination key={item.key} item={item} active={selected === item.key} locked={locked} onSelect={onSelect} />)}
    </View>
    </View>
  </View>;
}

function NavigationDestination({ item, active, locked, onSelect }: {
  item: typeof destinations[number]; active: boolean; locked: boolean;
  onSelect: (key: PassengerTab, href: Href) => void;
}) {
  const reduceMotion = useReducedMotion();
  const selection = useSharedValue(active ? 1 : 0);
  const press = useSharedValue(0);
  useEffect(() => {
    selection.set(reduceMotion ? Number(active) : withSpring(Number(active), { stiffness: 500, damping: 38, mass: 1, overshootClamping: true }));
  }, [active, reduceMotion, selection]);
  useEffect(() => { if (locked) press.set(0); }, [locked, press]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - .12 * press.get() }, { translateY: -selection.get() }] }));
  const labelStyle = useAnimatedStyle(() => ({ color: interpolateColor(selection.get(), [0, 1], ['#CBD5D8', colors.onSurface]) }));
  const outlineIconStyle = useAnimatedStyle(() => ({ opacity: 1 - selection.get() }));
  const selectedIconStyle = useAnimatedStyle(() => ({ opacity: selection.get() }));
  const stateLayerStyle = useAnimatedStyle(() => ({ opacity: press.get() * .1 }));
  return <Pressable accessibilityRole="tab" aria-selected={active} aria-disabled={locked}
    accessibilityLabel={item.key === 'qr' ? 'Thẻ của tôi' : item.label} accessibilityState={{ selected: active, disabled: locked }}
    disabled={locked} onPress={() => onSelect(item.key, item.href)}
    onPressIn={() => press.set(withTiming(1, { duration: reduceMotion ? 0 : 90 }))}
    onPressOut={() => press.set(withTiming(0, { duration: reduceMotion ? 0 : 180 }))}
    style={styles.destination}>
    <Animated.View pointerEvents="none" style={[styles.stateLayer, stateLayerStyle]} />
    <Animated.View style={[styles.icon, iconStyle]}>
      <Animated.View style={[styles.iconLayer, outlineIconStyle]}><MaterialIcon name={item.icon} color="#CBD5D8" size={23} /></Animated.View>
      <Animated.View style={[styles.iconLayer, selectedIconStyle]}><MaterialIcon name={item.key === 'home' ? 'home_filled' : item.icon} color={colors.onSurface} size={23} /></Animated.View>
    </Animated.View>
    <Animated.Text maxFontSizeMultiplier={1.3} style={[styles.navLabel, labelStyle]}>{item.label}</Animated.Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  nav: { backgroundColor: colors.surface, paddingHorizontal: 14, paddingTop: 8 },
  dock: { backgroundColor: colors.primaryContainer, borderRadius: 30, paddingHorizontal: 5, width: '100%', maxWidth: 520, alignSelf: 'center', boxShadow: '0px 6px 18px rgba(18, 48, 66, 0.14)' },
  locked: { opacity: .55 },
  navRow: { minHeight: 74, flexDirection: 'row', alignItems: 'stretch' },
  activePill: { position: 'absolute', top: 6, left: 0, borderRadius: 23, backgroundColor: colors.surface },
  destination: { flex: 1, minWidth: 44, minHeight: 74, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 3, borderRadius: 24, overflow: 'hidden' },
  icon: { width: 26, height: 26 },
  iconLayer: { position: 'absolute', top: 1, left: 1 },
  stateLayer: { position: 'absolute', top: 6, bottom: 6, left: 4, right: 4, borderRadius: 23, backgroundColor: colors.surface },
  navLabel: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: '#CBD5D8', textAlign: 'center' },
});
