import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { brand, lightTheme } from '@/constants/ocevie';
import { useAuth } from '@/features/auth/session-store';
import { OceVieBrand } from './OceVieBrand';
import { MaterialIcon } from './MaterialIcon';
import { type PassengerTab } from './PassengerNavigation';
export type { PassengerTab } from './PassengerNavigation';

const titles: Record<PassengerTab, string> = { home: 'OceVie', itinerary: 'Hải trình', bookings: 'Đặt chỗ', services: 'Khám phá', account: 'Cá nhân' };
export function PassengerScaffold({ children, selected = 'home', title, detail = false }: {
  children: ReactNode; selected?: PassengerTab; title?: string; detail?: boolean;
}) {
  const authenticated = useAuth(state => state.status === 'authenticated');
  const heading = title && title !== 'OceVie' ? title : titles[selected];
  return <SafeAreaView edges={detail ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}
    style={styles.screen} onLayout={() => { void SplashScreen.hideAsync().catch(console.warn); }}>
    <View style={styles.header}>
      {detail ? <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => {
        if (router.canGoBack()) router.back(); else router.replace(authenticated ? '/home' : '/login');
      }} style={styles.iconButton}><MaterialIcon name="arrow_back" color={brand.navy} /></Pressable> : null}
      <View style={styles.heading}>
        {!detail && selected === 'home' ? <OceVieBrand /> : <>
          {!detail && <Text style={styles.kicker}>OCEVIE CRUISES</Text>}
          <Text accessibilityRole="header" style={[styles.title, detail && styles.detailTitle]}>{heading}</Text>
        </>}
      </View>
      {!detail && <Pressable accessibilityRole="button" accessibilityLabel="Thông báo"
        onPress={() => router.push('/notifications')} style={styles.iconButton}>
        <MaterialIcon name="notifications" color={brand.navy} />
      </Pressable>}
      {!detail && selected === 'home' && <Pressable accessibilityRole="button" accessibilityLabel="Mở trang cá nhân"
        onPress={() => router.navigate('/account')} style={styles.avatar}>
        <MaterialIcon name="person" color={brand.teal} size={22} />
      </Pressable>}
    </View>
    <View style={styles.body}>{children}</View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightTheme.background },
  header: { minHeight: 76, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', maxWidth: 600, alignSelf: 'center' },
  heading: { flex: 1, gap: 2 },
  kicker: { fontSize: 12, lineHeight: 16, letterSpacing: 1.8, fontWeight: '600', color: brand.teal },
  title: { fontSize: 23, lineHeight: 32, fontWeight: '700', color: brand.navy },
  detailTitle: { fontSize: 18, lineHeight: 26 },
  iconButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: brand.tealSoft, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
});
