import * as SplashScreen from 'expo-splash-screen';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { passengerColors } from '@/constants/passenger-theme';

import { LaunchIndicator } from './LaunchIndicator';
import { useAuth } from '@/features/auth/session-store';
import { VoyageEntrance } from '@/components/passenger/VoyageEntrance';
import { MaterialIcon } from '@/components/passenger/MaterialIcon';
import { voyage } from '@/constants/voyage';

export function PassengerLaunchScreen() {
  const status = useAuth(state => state.status);
  useEffect(() => {
    if (status === 'restoring') return;
    const timer = setTimeout(() => router.replace(status === 'authenticated' ? '/loading' : '/login'), 900);
    return () => clearTimeout(timer);
  }, [status]);
  return (
    <SafeAreaView
      style={styles.screen}
      onLayout={() => {
        // Reveal P00 immediately after layout, with no simulated progress.
        void SplashScreen.hideAsync().catch(console.warn);
      }}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.center}>
          <VoyageEntrance><View style={styles.emblem}><MaterialIcon name="sailing" size={32} color={voyage.gold} /></View></VoyageEntrance>
          <View style={styles.brand}>
            <Text style={styles.wordmark} accessibilityRole="header">aurora<Text style={{ color: '#D4A84F' }}>.</Text></Text>
            <Text style={styles.kicker}>THE ART OF VOYAGING</Text>
            <Text style={styles.headline}>Mỗi chân trời,{'\n'}một khởi đầu.</Text>
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
        <View style={styles.horizon} /><Text style={styles.passenger}>YOUR VOYAGE, BEAUTIFULLY CONNECTED</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: passengerColors.primaryContainer },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 28, paddingVertical: 32 },
  emblem: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: '#547078', alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 11, lineHeight: 18, letterSpacing: 2.8, color: voyage.gold },
  headline: { fontFamily: voyage.serif, fontSize: 36, lineHeight: 46, textAlign: 'center', color: voyage.cream, marginTop: 18 },
  horizon: { height: 1, backgroundColor: '#365563', width: '75%', alignSelf: 'center', marginBottom: 20 },
  brand: { alignItems: 'center', gap: 12 },
  wordmark: { fontSize: 54, lineHeight: 68, letterSpacing: -3, fontWeight: '700', color: passengerColors.onSurface, textAlign: 'center' },
  description: { fontSize: 13, lineHeight: 22, fontWeight: '400', color: passengerColors.onSurfaceVariant, textAlign: 'center' },
  loading: { alignItems: 'center', gap: 16 },
  indicator: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  passenger: { fontSize: 11, lineHeight: 18, fontWeight: '500', letterSpacing: 1.6, color: passengerColors.onSurfaceVariant, textAlign: 'center' },
});
