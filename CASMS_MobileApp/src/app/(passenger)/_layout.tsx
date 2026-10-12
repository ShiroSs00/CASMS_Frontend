import { Tabs, useGlobalSearchParams, usePathname } from 'expo-router';
import { Easing } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { PassengerTabBar } from '@/components/passenger/PassengerNavigation';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';

export default function PassengerTabsLayout() {
  const reduceMotion = useReducedMotion();
  const { state } = useGlobalSearchParams<{ state?: string | string[] }>();
  const pathname = usePathname();
  const status = Array.isArray(state) ? state[0] : state;
  const locked = pathname === '/home' && ['expired', 'empty', 'error', 'loading'].includes(status ?? 'default');
  return (
    <Tabs initialRouteName="home" backBehavior="history" tabBar={props => <PassengerTabBar {...props} locked={locked} />}
      screenOptions={{
        headerShown: false,
        lazy: false,
        popToTopOnBlur: false,
        sceneStyle: { backgroundColor: colors.surface },
        animation: reduceMotion ? 'none' : 'fade',
        transitionSpec: { animation: 'timing', config: { duration: 200, easing: Easing.bezier(0.2, 0, 0, 1) } },
      }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="itinerary" />
      <Tabs.Screen name="passenger-qr" />
      <Tabs.Screen name="services" />
      <Tabs.Screen name="spending" />
    </Tabs>
  );
}
