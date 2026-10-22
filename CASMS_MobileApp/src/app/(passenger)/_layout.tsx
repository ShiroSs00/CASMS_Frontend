import { motion } from '@/constants/motion';
import { useMotionPreference } from '@/components/passenger/useMotionPreference';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Easing, View } from 'react-native';

import { PassengerTabBar } from '@/components/passenger/PassengerNavigation';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';
import { useAuth } from '@/features/auth/session-store';
import { isOnboardStaff } from '@/features/staff-pos/staff-model';

export default function PassengerTabsLayout() {
  const auth = useAuth();
  const reduced = useMotionPreference();
  if (auth.status === 'restoring') return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Đang khôi phục phiên" /></View>;
  if (auth.status !== 'authenticated' || !auth.session) return <Redirect href={{ pathname: '/login', params: { state: auth.status === 'expired' ? 'expired' : 'default' } }} />;
  if (isOnboardStaff(auth.session.user.roles)) return <Redirect href="/staff-pos" />;
  return (
    <Tabs initialRouteName="home" backBehavior="history" tabBar={props => <PassengerTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: false,
        popToTopOnBlur: false,
        sceneStyle: { backgroundColor: colors.surface },
        animation: reduced ? 'none' : 'fade',
        transitionSpec: { animation: 'timing', config: { duration: reduced ? 0 : motion.tab, easing: Easing.bezier(...motion.easeOut) } },
      }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="itinerary" />
      <Tabs.Screen name="bookings" />
      <Tabs.Screen name="services" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
