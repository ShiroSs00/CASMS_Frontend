import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { passengerColors } from '@/constants/passenger-theme';

void SplashScreen.preventAutoHideAsync().catch(console.warn);

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: passengerColors.primaryContainer },
        animation: 'fade',
      }} />
    </>
  );
}
