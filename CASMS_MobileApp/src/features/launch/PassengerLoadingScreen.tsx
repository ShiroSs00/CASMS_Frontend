import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { passengerColors as colors } from '@/constants/passenger-theme';
import { voyage } from '@/constants/voyage';
import { VoyageEntrance } from '@/components/passenger/VoyageEntrance';

import { LaunchIndicator } from './LaunchIndicator';
import { useAuth } from '@/features/auth/session-store';
import { useItineraryCatalog } from '@/features/itinerary/itinerary-api';

/** Wait for the live catalog request; demo mode retains an explicit preview delay. */
export function PassengerLoadingScreen() {
  const auth = useAuth();
  const catalog = useItineraryCatalog();
  const progress = useSharedValue(-60);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!reduceMotion) progress.set(withRepeat(withTiming(150, { duration: 1400, easing: Easing.bezier(.2, 0, 0, 1) }), -1));
    return () => { cancelAnimation(progress); };
  }, [progress, reduceMotion]);
  useEffect(() => {
    if (auth.status === 'restoring') return;
    if (auth.status !== 'authenticated') { router.replace('/login'); return; }
    if (auth.mode === 'demo') { const timer = setTimeout(() => router.replace('/home'), 1200); return () => clearTimeout(timer); }
    if (catalog.isFetched) router.replace('/home');
  }, [auth.status, auth.mode, catalog.isFetched]);
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: reduceMotion ? 35 : progress.get() }] }));
  return <SafeAreaView style={styles.screen} onLayout={() => { void SplashScreen.hideAsync().catch(console.warn); }}>
    <ScrollView contentContainerStyle={styles.content} bounces={false}>
      <Text style={styles.brand}>aurora<Text style={styles.gold}>.</Text></Text>
      <View style={styles.center}>
        <VoyageEntrance><View style={styles.orbit} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.indicator}><LaunchIndicator /></View><View style={styles.dot} />
        </View></VoyageEntrance>
        <Text style={styles.kicker}>A NEW HORIZON AWAITS</Text>
        <Text style={styles.title} accessibilityRole="header">Chân trời mới{'\n'}đang mở ra.</Text>
        <Text style={styles.description}>Đồng bộ lịch trình, điểm dừng{'\n'}và thông tin chuyến đi.</Text>
        <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel="Đang tải hành trình" accessibilityState={{ busy: true }}><Animated.View style={[styles.segment, moving]} /></View>
        <Text style={styles.caption} accessibilityLiveRegion="polite">Đang tải thông tin chuyến đi…</Text>
      </View>
      <Text style={[styles.caption, { textAlign: 'center' }]}>{auth.mode === 'demo' ? 'Trải nghiệm với dữ liệu minh họa' : 'YOUR VOYAGE, BEAUTIFULLY CONNECTED'}</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, padding: 28 },
  brand: { fontSize: 30, fontWeight: '700', letterSpacing: -1, color: colors.onSurface },
  gold: { color: voyage.gold },
  kicker: { color: voyage.gold, fontSize: 11, lineHeight: 18, letterSpacing: 2, marginBottom: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  orbit: { width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: '#47616B', justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  indicator: { transform: [{ scale: 1.8 }] },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: voyage.gold, position: 'absolute', top: 14, right: 18 },
  title: { fontFamily: voyage.serif, fontSize: 38, lineHeight: 47, letterSpacing: -1, color: colors.onSurface, textAlign: 'center', marginBottom: 16 },
  description: { fontSize: 15, lineHeight: 24, color: colors.onSurfaceVariant, textAlign: 'center' },
  track: { width: 145, height: 3, backgroundColor: colors.surfaceContainerHigh, borderRadius: 4, overflow: 'hidden', marginTop: 32, marginBottom: 16 },
  segment: { width: 60, height: 3, borderRadius: 4, backgroundColor: voyage.gold },
  caption: { fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant },
});
