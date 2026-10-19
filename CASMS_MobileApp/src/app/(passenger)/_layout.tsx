import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { PassengerTabBar } from '@/components/passenger/PassengerNavigation';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';
import { useAuth } from '@/features/auth/session-store';

export default function PassengerTabsLayout() {
  const auth = useAuth();
  if (auth.status === 'restoring') return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Đang khôi phục phiên" /></View>;
  if (auth.status !== 'authenticated') return <Redirect href={{ pathname: '/login', params: { state: auth.status === 'expired' ? 'expired' : 'default' } }} />;
  return (
    <Tabs initialRouteName="home" backBehavior="history" tabBar={props => <PassengerTabBar {...props} />}
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
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
