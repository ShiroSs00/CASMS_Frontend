import { MotionPreferenceProvider, useMotionPreference } from '@/components/passenger/useMotionPreference';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Platform, ScrollView } from 'react-native';

import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { EmptyState, ui } from '@/components/passenger/PassengerUI';
import { passengerColors } from '@/constants/passenger-theme';
import { passengerLightColors } from '@/constants/passenger-light-theme';
import { queryClient } from '@/lib/query-client';
import { syncAppQueryFocus } from '@/lib/app-query-focus';
import { authActions } from '@/features/auth/session-store';
import { apiConfiguration } from '@/lib/api';

void SplashScreen.preventAutoHideAsync().catch(console.warn);

export default function RootLayout() {
  if (apiConfiguration.error) {
    return <PassengerScaffold title="Kết nối OceVie">
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={ui.content}>
        <EmptyState title="Chưa thể kết nối" description="Địa chỉ máy chủ chưa được cấu hình đúng. Vui lòng liên hệ đội ngũ hỗ trợ để kiểm tra bản ứng dụng." />
      </ScrollView>
    </PassengerScaffold>;
  }
  return <MotionPreferenceProvider><RootContent /></MotionPreferenceProvider>;
}
function RootContent() {
  const reduced = useMotionPreference();
  useEffect(() => {
    void authActions.restore();
    syncAppQueryFocus(AppState.currentState, Platform.OS);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') authActions.resume();
      syncAppQueryFocus(state, Platform.OS);
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
