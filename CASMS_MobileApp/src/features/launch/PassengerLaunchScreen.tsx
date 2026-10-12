import * as SplashScreen from 'expo-splash-screen';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { passengerColors } from '@/constants/passenger-theme';

import { LaunchIndicator } from './LaunchIndicator';

export function PassengerLaunchScreen() {
  return (
    <SafeAreaView
      style={styles.screen}
      onLayout={() => {
        // Reveal P00 immediately after layout, with no simulated progress.
        void SplashScreen.hideAsync().catch(console.warn);
      }}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.center}>
          <View style={styles.brand}>
            <Text style={styles.wordmark} accessibilityRole="header">CASMS</Text>
            <Text style={styles.description}>Khởi đầu hành trình trên biển</Text>
          </View>
          <View style={styles.loading}>
            <View
              style={styles.indicator}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <LaunchIndicator />
            </View>
            <Text
              style={styles.description}
              accessibilityRole="progressbar"
              accessibilityLiveRegion="polite">
              Đang chuẩn bị hành trình…
            </Text>
          </View>
        </View>
        <Text style={styles.passenger}>PASSENGER</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: passengerColors.primaryContainer },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 32, paddingVertical: 32 },
  brand: { alignItems: 'center', gap: 12 },
  wordmark: { fontSize: 56, lineHeight: 73, fontWeight: '700', color: passengerColors.onSurface, textAlign: 'center' },
  description: { fontSize: 16, lineHeight: 24, fontWeight: '400', color: passengerColors.onSurfaceVariant, textAlign: 'center' },
  loading: { alignItems: 'center', gap: 16 },
  indicator: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  passenger: { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 2, color: passengerColors.onSurfaceVariant, textAlign: 'center' },
});
