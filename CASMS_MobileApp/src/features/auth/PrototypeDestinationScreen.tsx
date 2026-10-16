import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';
import { voyage } from '@/constants/voyage';

export function PrototypeDestinationScreen({ title, description, home = false }: {
  title: string; description: string; home?: boolean;
}) {
  function back() {
    if (!home && router.canGoBack()) router.back();
    else router.replace('/login');
  }
  return (
    <SafeAreaView style={styles.screen} onLayout={() => { void SplashScreen.hideAsync().catch(console.warn); }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.back}>
          <PassengerButton label={home ? 'Về màn hình đăng nhập' : 'Quay lại'} icon="arrow_back" variant="text" onPress={back} />
        </View>
        <View style={styles.main}>
          <Text style={styles.brand}>Aurora</Text>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <View style={styles.note}><Text style={styles.noteText}>Bản xem trước giao diện · Chưa kết nối dịch vụ</Text></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, padding: 24, maxWidth: 460, width: '100%', alignSelf: 'center' },
  back: { alignItems: 'flex-start' },
  main: { flex: 1, justifyContent: 'center', gap: 16 },
  brand: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -1, color: colors.onSurface },
  title: { fontFamily: voyage.serif, fontSize: 36, lineHeight: 44, color: colors.onSurface },
  description: { fontSize: 16, lineHeight: 24, color: colors.onSurfaceVariant },
  note: { backgroundColor: colors.secondaryContainer, borderRadius: 20, padding: 16 },
  noteText: { fontSize: 14, lineHeight: 20, color: colors.onSecondaryContainer },
});
