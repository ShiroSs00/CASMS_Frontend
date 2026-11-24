import { motion } from '@/constants/motion';
import { useMotionPreference } from '@/components/passenger/useMotionPreference';
import { Redirect, Tabs, usePathname } from 'expo-router';
import { ActivityIndicator, Easing, View } from 'react-native';

import { PassengerTabBar } from '@/components/passenger/PassengerNavigation';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';
import { useAuth } from '@/features/auth/session-store';
import { loginLink, workspaceDestination } from '@/features/auth/workspace-navigation';

export const unstable_settings = { anchor: 'home' };

export default function PassengerTabsLayout() {
  const auth = useAuth();
  const reduced = useMotionPreference();
  const path = usePathname();
  if (auth.status === 'restoring') return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Đang khôi phục phiên" /></View>;
  if (auth.status !== 'authenticated' || !auth.session) return <Redirect href={loginLink(auth.status, path)} />;
  const workspace = workspaceDestination(auth.session.user);
  if (workspace !== '/home') return <Redirect href={workspace ?? '/loading'} />;
  return (
    <Tabs backBehavior="history" tabBar={props => <PassengerTabBar {...props} />}
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
      <Tabs.Screen name="services" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
