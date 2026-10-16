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
import { VoyageArt } from '@/components/passenger/VoyageArt';
import { VoyageEntrance } from '@/components/passenger/VoyageEntrance';
import { MaterialIcon } from '@/components/passenger/MaterialIcon';
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
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" bounces={false}>
          <View style={styles.brand}>
            <MaterialIcon name="sailing" color={colors.onSurface} size={24} />
            <Text style={styles.wordmark}>aurora<Text style={{ color: colors.tertiaryContainer }}>.</Text></Text>
          </View>
          <VoyageEntrance><VoyageArt compact scene="login" /></VoyageEntrance>
          <View style={styles.middle}>
            <VoyageEntrance delay={60}><View style={styles.intro}>
              <Text style={styles.tagline}>YOUR NEXT CHAPTER</Text>
              <Text style={styles.title} accessibilityRole="header">Biển gọi.{'\n'}Hành trình chờ bạn.</Text>
              <Text style={styles.description}>Đăng nhập và tiếp tục câu chuyện của bạn cùng Aurora.</Text>
            </View></VoyageEntrance>
            {message && <View style={[styles.notice, status === 'error' && styles.errorNotice]}>
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.noticeText, status === 'error' && styles.errorText]}>{message}</Text>
            </View>}
            <View style={styles.form}>
              <OutlinedField label="Tên đăng nhập" value={username} onChangeText={setUsername} helper="Tên đăng nhập được Aurora cấp" username
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
          </View>

          <View style={styles.footer}>
            <PassengerButton label="Cần hỗ trợ? Liên hệ Aurora" icon="support_agent" variant="text" disabled={busy} onPress={() => router.push('/support')} />
            <Text style={styles.passenger}>ĐĂNG NHẬP TÀI KHOẢN AURORA</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20, gap: 24, maxWidth: 460, width: '100%', alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontSize: 30, lineHeight: 40, letterSpacing: -1.5, fontWeight: '700', color: colors.onSurface },
  tagline: { fontSize: 11, lineHeight: 18, fontWeight: '600', letterSpacing: 2, color: colors.onSurfaceVariant },
  middle: { flexGrow: 1, justifyContent: 'center', gap: 24, paddingVertical: 4 },
  intro: { alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: voyage.serif, fontSize: 38, lineHeight: 46, letterSpacing: -1.5, color: colors.onSurface },
  description: { fontSize: 14, lineHeight: 23, color: colors.onSurfaceVariant },
  form: { gap: 16 },
  forgot: { alignItems: 'flex-end', marginTop: -8, marginBottom: -4 },
  footer: { alignItems: 'center', gap: 12 },
  passenger: { fontSize: 11, lineHeight: 18, fontWeight: '500', letterSpacing: 1.5, color: colors.onSurfaceVariant },
  notice: { padding: 16, borderRadius: 20, backgroundColor: colors.secondaryContainer },
  noticeText: { fontSize: 14, lineHeight: 20, color: colors.onSecondaryContainer },
  errorNotice: { backgroundColor: colors.errorContainer },
  errorText: { color: colors.onErrorContainer },
});
