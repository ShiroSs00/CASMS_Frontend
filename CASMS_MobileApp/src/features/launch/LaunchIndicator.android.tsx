import { Host, LoadingIndicator } from '@expo/ui/jetpack-compose';
import { StyleSheet } from 'react-native';

import { passengerColors } from '@/constants/passenger-theme';

export function LaunchIndicator() {
  return (
    <Host colorScheme="light" matchContents style={styles.host} pointerEvents="none">
      <LoadingIndicator color={passengerColors.primary} />
    </Host>
  );
}

const styles = StyleSheet.create({ host: { width: 48, height: 48 } });
