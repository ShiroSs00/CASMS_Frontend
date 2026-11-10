import { useMotionPreference } from '@/components/passenger/useMotionPreference';
import { Redirect, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle,  useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { passengerColors as colors } from '@/constants/passenger-theme';
import { voyage } from '@/constants/voyage';
import { OceVieBrand } from '@/components/passenger/OceVieBrand';
import { VoyageEntrance } from '@/components/passenger/VoyageEntrance';

import { LaunchIndicator } from './LaunchIndicator';
import { useAuth } from '@/features/auth/session-store';
import { posDestination } from '@/features/pos/pos-access';

/** Restore the session before opening the passenger workspace. */
export function PassengerLoadingScreen() {
  const user = useAuth(state => state.session?.user);
  if (posDestination(user)) return <Redirect href="/staff-pos" />;
  return <PassengerJourneyLoading />;
}
function PassengerJourneyLoading() {
  const auth = useAuth();
  const progress = useSharedValue(-60);
  const reduceMotion = useMotionPreference();
  useEffect(() => {
    function update(state: string | null | undefined) {
      cancelAnimation(progress);
      progress.set(-60);
      if (!reduceMotion && state === 'active') progress.set(withRepeat(withTiming(150, { duration: 1400, easing: Easing.bezier(.2, 0, 0, 1) }), -1));
    }
    update(AppState.currentState);
    const subscription = AppState.addEventListener('change', update);
    return () => { subscription.remove(); cancelAnimation(progress); };
  }, [progress, reduceMotion]);
  useEffect(() => {
    if (auth.status === 'restoring') return;
    if (auth.status !== 'authenticated') { router.replace({ pathname: '/login', params: { state: auth.status } }); return; }
    router.replace('/home');
  }, [auth.status]);
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: reduceMotion ? 35 : progress.get() }] }));
  return <SafeAreaView style={styles.screen} onLayout={() => { void SplashScreen.hideAsync().catch(console.warn); }}>
    <ScrollView contentContainerStyle={styles.content} bounces={false}>
      <View style={{ alignItems: 'center' }}><OceVieBrand variant="symbol" /></View>
      <View style={styles.center}>
        <VoyageEntrance><View style={styles.orbit} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.indicator}><LaunchIndicator /></View><View style={styles.dot} />
        </View></VoyageEntrance>
        <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel="Đang tải hành trình" accessibilityState={{ busy: true }}><Animated.View style={[styles.segment, moving]} /></View>
        <Text style={styles.caption} accessibilityLiveRegion="polite">Đang mở chuyến đi…</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, padding: 28 },
  kicker: { color: voyage.gold, fontSize: 12, lineHeight: 18, letterSpacing: 2, marginBottom: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  orbit: { width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: colors.outlineVariant, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  indicator: { transform: [{ scale: 1.8 }] },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: voyage.gold, position: 'absolute', top: 14, right: 18 },
  title: { fontFamily: voyage.heading, fontWeight: '600', fontSize: 38, lineHeight: 47, letterSpacing: -1, color: colors.onSurface, textAlign: 'center', marginBottom: 16 },
  description: { fontSize: 15, lineHeight: 24, color: colors.onSurfaceVariant, textAlign: 'center' },
  track: { width: 145, height: 3, backgroundColor: colors.surfaceContainerHigh, borderRadius: 4, overflow: 'hidden', marginTop: 32, marginBottom: 16 },
  segment: { width: 60, height: 3, borderRadius: 4, backgroundColor: colors.primary },
  caption: { fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant },
});
