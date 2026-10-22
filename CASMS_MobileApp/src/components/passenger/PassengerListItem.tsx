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
        <MaterialIcon name={icon} color={disabled ? colors.onSurfaceVariant : colors.onSecondaryContainer} />
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
  row: { minHeight: 72, padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.divider, overflow: 'hidden' },
  first: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  last: { borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  pressed: { backgroundColor: colors.secondaryContainer },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  disabledIcon: { backgroundColor: colors.surfaceContainerHigh },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 15, lineHeight: 23, fontWeight: '600', color: colors.onSurface },
  supporting: { fontSize: 12, lineHeight: 20, color: colors.onSurfaceVariant },
});
