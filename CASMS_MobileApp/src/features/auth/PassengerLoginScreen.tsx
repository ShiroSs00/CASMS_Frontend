import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OutlinedField } from '@/components/passenger/OutlinedField';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';

import { validateLogin, type LoginCredentials, type LoginStatus } from './login-model';
import { authActions } from './session-store';
import { brand, darkTheme, lightTheme } from '@/constants/ocevie';
import { VoyageEntrance } from '@/components/passenger/VoyageEntrance';
import { OceVieBrand } from '@/components/passenger/OceVieBrand';
import { voyage } from '@/constants/voyage';

export function PassengerLoginScreen({ initialStatus = 'default', signIn = ({ username, password }) => authActions.login(username, password) }: {
  initialStatus?: LoginStatus;
  signIn?: (credentials: LoginCredentials) => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ username: false, password: false });
  const [apiMessage, setApiMessage] = useState<string>();
  const [status, setStatus] = useState<LoginStatus>(initialStatus);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const submitting = useRef(false);
  const errors = validateLogin({ username, password });
  const valid = !errors.username && !errors.password;
  const busy = status === 'loading';

  async function submit() {
    if (submitting.current || busy) return;
    setTouched({ username: true, password: true });
    if (!valid) {
      (errors.username ? emailRef : passwordRef).current?.focus();
      return;
    }
    submitting.current = true;
    setStatus('loading');
    setApiMessage(undefined);
    Keyboard.dismiss();
    try {
      await signIn({ username: username.trim(), password });
      setPassword('');
      router.replace('/loading');
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : 'Đăng nhập thất bại. Vui lòng thử lại.');
      setStatus('error');
    } finally {
      submitting.current = false;
    }
  }

  const message = apiMessage ?? (status === 'expired' ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    : status === 'offline' ? 'Không thể kết nối. Kiểm tra mạng rồi thử lại.'
      : status === 'error' ? 'Đăng nhập chưa thành công. Kiểm tra thông tin rồi thử lại.' : undefined);

  return (
    <SafeAreaView style={styles.screen} onLayout={() => { void SplashScreen.hideAsync().catch(console.warn); }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" bounces={false}>
          <View style={styles.hero}>
            <View style={styles.brand}><OceVieBrand dark /></View>
            <Text style={styles.heroTitle}>Biển mở lối.{'\n'}Hành trình bắt đầu.</Text>
            <Text style={styles.heroDescription}>Bản sắc Việt. Những trải nghiệm vượt đường chân trời.</Text>
          </View>
          <View style={styles.middle}>
            <VoyageEntrance delay={60}><View style={styles.intro}>
              <Text style={styles.tagline}>CHÀO MỪNG ĐẾN VỚI OCEVIE</Text>
              <Text style={styles.title} accessibilityRole="header">Đăng nhập</Text>
              <Text style={styles.description}>Truy cập thẻ lên tàu, lịch trình và trải nghiệm của bạn.</Text>
            </View></VoyageEntrance>
            {message && <View style={[styles.notice, status === 'error' && styles.errorNotice]}>
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.noticeText, status === 'error' && styles.errorText]}>{message}</Text>
            </View>}
            <View style={styles.form}>
              <OutlinedField label="Tên đăng nhập" value={username} onChangeText={setUsername} helper="Tên đăng nhập được OceVie cấp" username
                error={touched.username ? errors.username : undefined} disabled={busy} inputRef={emailRef}
                onBlur={() => setTouched(value => ({ ...value, username: true }))}
                onSubmitEditing={() => passwordRef.current?.focus()} />
              <OutlinedField label="Mật khẩu" value={password} onChangeText={setPassword} helper="Nhập mật khẩu của bạn" password
                error={touched.password ? errors.password : undefined} disabled={busy} inputRef={passwordRef}
                onBlur={() => setTouched(value => ({ ...value, password: true }))}
                onSubmitEditing={() => { void submit(); }} />
              <View style={styles.forgot}>
                <PassengerButton label="Quên mật khẩu?" variant="text" disabled={busy} onPress={() => router.push('/forgot-password')} />
              </View>
              <PassengerButton label={status === 'offline' ? 'Thử lại' : 'Đăng nhập'} icon="arrow_forward"
                disabled={!valid && !busy} loading={busy} onPress={() => { void submit(); }} />
              {__DEV__ && <PassengerButton label="Xem riêng giao diện mẫu" variant="text" disabled={busy} onPress={() => { authActions.demo(); router.replace('/loading'); }} />}
            </View>
          <View style={styles.footer}>
            <PassengerButton label="Cần hỗ trợ? Liên hệ OceVie" icon="support_agent" variant="text" disabled={busy} onPress={() => router.push('/support')} />
            <Text style={styles.passenger}>VIETNAMESE HERITAGE · OCEAN LUXURY</Text>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: brand.midnight },
  content: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  hero: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32, gap: 16 },
  brand: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 },
  heroTitle: { color: brand.pearl, fontFamily: voyage.heading, fontSize: 32, lineHeight: 40, fontWeight: '600', letterSpacing: -.5 },
  heroDescription: { color: darkTheme.textSecondary, fontSize: 13, lineHeight: 22, maxWidth: 300 },
  middle: { flexGrow: 1, backgroundColor: lightTheme.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 24 },
  intro: { gap: 8 }, tagline: { fontSize: 12, lineHeight: 18, letterSpacing: 1.3, color: brand.teal, fontWeight: '600' },
  title: { color: brand.navy, fontSize: 26, lineHeight: 34, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 22, color: lightTheme.textSecondary },
  form: { gap: 16 }, forgot: { alignItems: 'flex-end', marginTop: -8, marginBottom: -4 },
  footer: { alignItems: 'center', gap: 12, marginTop: 4 },
  passenger: { fontSize: 12, lineHeight: 16, letterSpacing: 1.2, color: lightTheme.textSecondary, textAlign: 'center' },
  notice: { padding: 16, borderRadius: 14, backgroundColor: colors.secondaryContainer },
  noticeText: { fontSize: 14, lineHeight: 22, color: colors.onSecondaryContainer },
  errorNotice: { backgroundColor: colors.errorContainer }, errorText: { color: colors.onErrorContainer },
});
