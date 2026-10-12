import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { passengerColors } from '@/constants/passenger-theme';
import { passengerLightColors } from '@/constants/passenger-light-theme';

void SplashScreen.preventAutoHideAsync().catch(console.warn);

export default function RootLayout() {
  const splash = usePathname() === '/splash';
  return (
    <>
      <StatusBar style={splash ? 'light' : 'dark'} />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: splash ? passengerColors.primaryContainer : passengerLightColors.surface },
        animation: 'slide_from_right',
      }}>
        <Stack.Screen name="(passenger)" options={{ animation: 'fade' }} />
      </Stack>
    </>
  );
}
