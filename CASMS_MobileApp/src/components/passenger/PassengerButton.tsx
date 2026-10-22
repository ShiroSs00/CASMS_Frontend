import { useEffect } from 'react';
import { motion } from '@/constants/motion';
import { useMotionPreference } from './useMotionPreference';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

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
  const reduceMotion = useMotionPreference();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }], borderRadius: 14, overflow: 'hidden' as const }));
  const blocked = disabled || loading;
  useEffect(() => { if (blocked || reduceMotion) scale.set(1); }, [blocked, reduceMotion, scale]);
  const textColor = disabled ? colors.onSurfaceVariant : variant === 'text' ? colors.secondary : variant === 'premium' ? colors.onTertiaryContainer : colors.onPrimary;

  return (
    <Animated.View style={animatedStyle}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? `${label}, đang xử lý` : label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      onPressIn={() => { scale.set(withTiming(reduceMotion ? 1 : .985, { duration: reduceMotion ? 0 : motion.pressIn, easing: Easing.bezier(...motion.easeOut) })); }}
      onPressOut={() => { scale.set(withTiming(1, { duration: reduceMotion ? 0 : motion.pressOut, easing: Easing.bezier(...motion.easeOut) })); }}
      android_ripple={{ color: variant === 'text' ? colors.secondaryContainer : '#FFFFFF24' }}
      style={({ pressed }) => [
        styles.base,
        variant === 'text' ? styles.text : styles.filled,
        variant === 'secondary' && styles.secondary,
        variant === 'premium' && styles.premium,
        blocked && variant !== 'text' && styles.disabled,
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
