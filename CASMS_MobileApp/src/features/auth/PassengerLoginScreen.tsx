import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OutlinedField } from '@/components/passenger/OutlinedField';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';

import { prototypeSignIn, validateLogin, type LoginCredentials, type LoginResult, type LoginStatus } from './login-model';

export function PassengerLoginScreen({ initialStatus = 'default', signIn = prototypeSignIn }: {
  initialStatus?: LoginStatus;
  signIn?: (credentials: LoginCredentials) => Promise<LoginResult>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [status, setStatus] = useState<LoginStatus>(initialStatus);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const submitting = useRef(false);
  const errors = validateLogin({ email, password });
  const valid = !errors.email && !errors.password;
  const busy = status === 'loading';

  async function submit() {
    if (submitting.current || busy) return;
    setTouched({ email: true, password: true });
    if (!valid) {
      (errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    submitting.current = true;
    setStatus('loading');
    Keyboard.dismiss();
    try {
      const result = await signIn({ email: email.trim(), password });
      if (result === 'success') {
        setPassword('');
        router.replace('/home');
      } else {
        setStatus(result === 'offline' ? 'offline' : 'error');
      }
    } catch {
      setStatus('error');
    } finally {
      submitting.current = false;
    }
  }

  const message = status === 'expired' ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    : status === 'offline' ? 'Không thể kết nối. Kiểm tra mạng rồi thử lại.'
      : status === 'error' ? 'Đăng nhập chưa thành công. Kiểm tra thông tin rồi thử lại.' : undefined;

  return (
    <SafeAreaView style={styles.screen} onLayout={() => { void SplashScreen.hideAsync().catch(console.warn); }}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" bounces={false}>
          <View style={styles.brand}>
            <View style={styles.accent} />
            <Text style={styles.wordmark}>CASMS</Text>
            <Text style={styles.tagline}>HÀNH TRÌNH TRÊN BIỂN</Text>
          </View>

          <View style={styles.middle}>
            <View style={styles.intro}>
              <Text style={styles.title} accessibilityRole="header">Chào mừng trở lại</Text>
              <Text style={styles.description}>Đăng nhập để khám phá hành trình của bạn.</Text>
            </View>
            {message && <View style={[styles.notice, status === 'error' && styles.errorNotice]}>
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.noticeText, status === 'error' && styles.errorText]}>{message}</Text>
            </View>}
            <View style={styles.form}>
              <OutlinedField label="Email" value={email} onChangeText={setEmail} helper="Nhập email đã đăng ký"
                error={touched.email ? errors.email : undefined} disabled={busy} inputRef={emailRef}
                onBlur={() => setTouched(value => ({ ...value, email: true }))}
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
            </View>
          </View>

          <View style={styles.footer}>
            <PassengerButton label="Cần hỗ trợ? Liên hệ CASMS" icon="support_agent" variant="text" disabled={busy} onPress={() => router.push('/support')} />
            <Text style={styles.passenger}>PASSENGER APP</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, gap: 24, maxWidth: 460, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'flex-start', gap: 8 },
  accent: { width: 52, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginBottom: 4 },
  wordmark: { fontSize: 40, lineHeight: 52, fontWeight: '700', color: colors.onSurface },
  tagline: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 1.5, color: colors.onSurfaceVariant },
  middle: { flexGrow: 1, justifyContent: 'center', gap: 24, paddingVertical: 16 },
  intro: { alignItems: 'center', gap: 12 },
  title: { fontSize: 30, lineHeight: 40, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  description: { fontSize: 16, lineHeight: 24, color: colors.onSurfaceVariant, textAlign: 'center' },
  form: { gap: 16 },
  forgot: { alignItems: 'flex-end', marginTop: -8, marginBottom: -4 },
  footer: { alignItems: 'center', gap: 12 },
  passenger: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 2, color: colors.onSurfaceVariant },
  notice: { padding: 16, borderRadius: 20, backgroundColor: colors.secondaryContainer },
  noticeText: { fontSize: 14, lineHeight: 20, color: colors.onSecondaryContainer },
  errorNotice: { backgroundColor: colors.errorContainer },
  errorText: { color: colors.onErrorContainer },
});
