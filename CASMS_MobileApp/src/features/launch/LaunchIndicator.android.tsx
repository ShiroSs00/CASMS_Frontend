import { Host, LoadingIndicator } from '@expo/ui/jetpack-compose';
import { StyleSheet } from 'react-native';

import { passengerColors } from '@/constants/passenger-theme';
import { useMotionPreference } from '@/components/passenger/useMotionPreference';
import { MaterialIcon } from '@/components/passenger/MaterialIcon';

export function LaunchIndicator() {
  const reduced = useMotionPreference();
  if (reduced) return <MaterialIcon name="sailing" color={passengerColors.primary} size={48} />;
  return (
    <Host colorScheme="light" matchContents style={styles.host} pointerEvents="none">
      <LoadingIndicator color={passengerColors.primary} />
    </Host>
  );
}

const styles = StyleSheet.create({ host: { width: 48, height: 48 } });
