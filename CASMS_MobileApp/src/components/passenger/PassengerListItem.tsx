import { Pressable, StyleSheet, Text, View } from 'react-native';

import { passengerLightColors as colors } from '@/constants/passenger-light-theme';

import { MaterialIcon, type MaterialIconName } from './MaterialIcon';

export function PassengerListItem({ title, supporting, icon, onPress, disabled = false, connected }: {
  title: string;
  supporting: string;
  icon: MaterialIconName;
  onPress?: () => void;
  disabled?: boolean;
  connected?: 'first' | 'last';
}) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}. ${supporting}`} accessibilityState={{ disabled }}
      disabled={disabled || !onPress} onPress={onPress}
      android_ripple={{ color: colors.secondaryContainer }}
      style={({ pressed }) => [styles.row, connected === 'first' && styles.first,
        connected === 'last' && styles.last, pressed && styles.pressed]}>
      <View style={[styles.icon, disabled && styles.disabledIcon]}>
        <MaterialIcon name={icon} color={disabled ? colors.onSurfaceVariant : colors.onPrimaryContainer} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.supporting}>{supporting}</Text>
      </View>
      {onPress && !disabled && <MaterialIcon name="chevron_right" color={colors.onSurfaceVariant} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 72, padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surfaceContainerLow, overflow: 'hidden' },
  first: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  last: { borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  pressed: { backgroundColor: colors.secondaryContainer, transform: [{ scale: 0.985 }] },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  disabledIcon: { backgroundColor: colors.surfaceContainerHigh },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.onSurface },
  supporting: { fontSize: 14, lineHeight: 20, color: colors.onSurfaceVariant },
});
