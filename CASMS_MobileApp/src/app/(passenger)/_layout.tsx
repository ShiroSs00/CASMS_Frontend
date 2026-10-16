import { Redirect, Tabs, useGlobalSearchParams, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { PassengerTabBar } from '@/components/passenger/PassengerNavigation';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';
import { useAuth } from '@/features/auth/session-store';

export default function PassengerTabsLayout() {
  const auth = useAuth();
  const { state } = useGlobalSearchParams<{ state?: string | string[] }>();
  const pathname = usePathname();
  const status = Array.isArray(state) ? state[0] : state;
  const locked = auth.mode === 'demo' && pathname === '/home' && ['expired', 'empty', 'error', 'loading'].includes(status ?? 'default');
  if (auth.status === 'restoring') return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Đang khôi phục phiên" /></View>;
  if (auth.status !== 'authenticated') return <Redirect href={{ pathname: '/login', params: { state: auth.status === 'expired' ? 'expired' : 'default' } }} />;
  return (
    <Tabs initialRouteName="home" backBehavior="history" tabBar={props => <PassengerTabBar {...props} locked={locked} />}
      screenOptions={{
        headerShown: false,
        lazy: false,
        popToTopOnBlur: false,
        sceneStyle: { backgroundColor: colors.surface },
        animation: 'none',
      }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="itinerary" />
      <Tabs.Screen name="passenger-qr" />
      <Tabs.Screen name="services" />
      <Tabs.Screen name="spending" />
    </Tabs>
  );
}
