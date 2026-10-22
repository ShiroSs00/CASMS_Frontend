import { MotionPreferenceProvider, useMotionPreference } from '@/components/passenger/useMotionPreference';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { passengerColors } from '@/constants/passenger-theme';
import { passengerLightColors } from '@/constants/passenger-light-theme';
import { queryClient } from '@/lib/query-client';
import { authActions, useAuth } from '@/features/auth/session-store';

void SplashScreen.preventAutoHideAsync().catch(console.warn);

export default function RootLayout() {
  return <MotionPreferenceProvider><RootContent /></MotionPreferenceProvider>;
}
function RootContent() {
  const reduced = useMotionPreference();
  useEffect(() => {
    void authActions.restore();
    const subscription = AppState.addEventListener('change', state => {
      const session = useAuth.getState().session;
      if (state === 'active' && session && session.expiresAt - Date.now() < 60000) void authActions.refresh();
    });
    return () => subscription.remove();
  }, []);
  const pathname = usePathname();
  const splash = pathname === '/splash' || pathname === '/loading';
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={splash ? 'light' : 'dark'} />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: splash ? passengerColors.primaryContainer : passengerLightColors.surface },
        animation: reduced ? 'none' : 'slide_from_right',
      }}>
        <Stack.Screen name="(passenger)" options={{ animation: reduced ? 'none' : 'fade' }} />
      </Stack>
    </QueryClientProvider>
  );
}
