import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { passengerLightColors as colors } from '@/constants/passenger-light-theme';

import { MaterialIcon, type MaterialIconName } from './MaterialIcon';

export function PassengerButton({ label, onPress, icon, variant = 'filled', disabled = false, loading = false }: {
  label: string;
  onPress: () => void;
  icon?: MaterialIconName;
  variant?: 'filled' | 'text' | 'secondary' | 'premium';
  disabled?: boolean;
  loading?: boolean;
}) {
  const scale = useSharedValue(1);
  const radius = useSharedValue(14);
  const reduceMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }], borderRadius: radius.get(), overflow: 'hidden' as const }));
  const blocked = disabled || loading;
  const textColor = disabled ? colors.onSurfaceVariant : variant === 'text' ? colors.secondary : variant === 'premium' ? colors.onTertiaryContainer : colors.onPrimary;

  return (
    <Animated.View style={animatedStyle}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? `${label}, đang xử lý` : label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      onPressIn={() => { scale.set(withTiming(reduceMotion ? 1 : .97, { duration: 100 })); radius.set(withTiming(12, { duration: reduceMotion ? 0 : 180, easing: Easing.bezier(.2, 0, 0, 1) })); }}
      onPressOut={() => { scale.set(withTiming(1, { duration: 160 })); radius.set(withTiming(14, { duration: reduceMotion ? 0 : 220 })); }}
      android_ripple={{ color: colors.secondaryContainer }}
      style={({ pressed }) => [
        styles.base,
        variant === 'text' ? styles.text : styles.filled,
        variant === 'secondary' && styles.secondary,
        variant === 'premium' && styles.premium,
        disabled && variant !== 'text' && styles.disabled,
        pressed && variant === 'text' && styles.pressed,
      ]}>
      {loading && <ActivityIndicator color={textColor} />}
      {icon && variant === 'text' && !loading && <MaterialIcon name={icon} color={textColor} size={20} />}
      <Text style={[styles.label, { color: textColor }]}>{loading ? 'Đang xử lý…' : label}</Text>
      {icon && variant !== 'text' && !loading && <MaterialIcon name={icon} color={textColor} />}
    </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden' },
  filled: { minHeight: 56, paddingVertical: 14, backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  premium: { backgroundColor: colors.tertiaryContainer },
  text: { minHeight: 44, paddingVertical: 8 },
  disabled: { backgroundColor: colors.surfaceContainerHighest },
  pressed: { backgroundColor: colors.secondaryContainer },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
});
