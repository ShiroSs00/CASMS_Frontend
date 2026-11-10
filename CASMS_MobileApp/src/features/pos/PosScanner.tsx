import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { ui } from '@/components/passenger/PassengerUI';
import { brand, layout } from '@/constants/ocevie';
import { usePos, usePosActivities } from './PosLayout';
import { Notice, PosPage, posError } from './pos-ui';

export function PosScanner() {
  const pos = usePos();
  const activities = usePosActivities();
  const canUse = pos.scope.services.some(service => service.permissions.includes('SERVICE_SALE'));
  const canRegister = !activities.error && activities.data?.some(item => item.permissions.includes('ACTIVITY_REGISTRATION'));
  return <PosPage title="Quét QR hành khách">
    {canUse || canRegister ? <>
      {!!pos.sessionError && <Notice tone="error" retry={pos.refreshSession}>{posError(pos.sessionError)}</Notice>}
      <Notice tone="warning">Chưa thể xác minh hành khách bằng QR. Chọn hồ sơ để tiếp tục.</Notice>
      <ScannerCamera enabled={pos.verified} />
      {canUse && <PassengerButton label="Chọn hồ sơ và tra sao kê" variant="secondary" onPress={() => router.navigate('/staff-pos/usage')} />}
      {canRegister && <PassengerButton label="Mở đăng ký hoạt động" variant="text" onPress={() => router.navigate('/staff-pos/activities')} />}
    </> : <Notice tone="neutral">Phiên này chưa có nghiệp vụ cần dùng mã hành khách.</Notice>}
  </PosPage>;
}

function ScannerCamera({ enabled }: { enabled: boolean }) {
  const [permission, requestPermission, getPermission] = useCameraPermissions({ get: false });
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [requested, setRequested] = useState(false);
  const [failure, setFailure] = useState<'permission' | 'camera'>();
  const [result, setResult] = useState<'unverified' | 'empty'>();
  const locked = useRef(false);
  const refreshPermission = useCallback(async () => {
    try { await getPermission(); setFailure(current => current === 'permission' ? undefined : current); }
    catch { setFailure('permission'); }
  }, [getPermission]);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    void refreshPermission();
    return () => setFocused(false);
  }, [refreshPermission]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state === 'active' && focused) void refreshPermission();
    });
    return () => subscription.remove();
  }, [focused, refreshPermission]);

  function reset() {
    locked.current = false;
    setFailure(undefined);
    setResult(undefined);
  }

  if (!enabled) return <Notice tone="neutral">Camera tạm dừng trong khi xác minh phiên POS.</Notice>;
  if (failure === 'permission') return <Notice tone="error" retry={() => { void refreshPermission(); }}>
    Không kiểm tra được quyền camera. Vui lòng thử lại.
  </Notice>;
  if (!permission) return <Notice>Đang kiểm tra quyền camera…</Notice>;
  if (!permission.granted) return <View style={ui.card}>
    <Text style={ui.sectionTitle}>Quyền truy cập camera</Text>
    <Text style={ui.body}>{permission.canAskAgain
      ? 'Cho phép camera để đọc mã QR tại quầy.'
      : 'Mở Cài đặt để cấp quyền camera cho OceVie.'}</Text>
    {permission.canAskAgain && <PassengerButton label="Cho phép camera" loading={requested} onPress={async () => {
      setRequested(true);
      try { await requestPermission(); setFailure(undefined); }
      catch { setFailure('permission'); }
      finally { setRequested(false); }
    }} />}
  </View>;
  if (failure) return <Notice tone="error" retry={reset}>Không mở được camera. Kiểm tra quyền và thử lại.</Notice>;
  if (result) return <>
    <Notice tone={result === 'unverified' ? 'warning' : 'error'}>{result === 'unverified'
      ? 'Đã đọc mã QR. Chưa xác minh được hành khách.'
      : 'Mã QR không có nội dung. Hãy thử quét lại.'}</Notice>
    <PassengerButton label="Quét mã khác" onPress={reset} />
  </>;
  return <>
    <View style={styles.preview}>
      {focused && active && <CameraView style={StyleSheet.absoluteFill} facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onMountError={() => setFailure('camera')}
        onBarcodeScanned={({ data }) => {
          if (locked.current) return;
          locked.current = true;
          setResult(data.trim() ? 'unverified' : 'empty');
        }} />}
      <View pointerEvents="none" accessible={false} style={styles.frame} />
    </View>
    <Text style={ui.body}>Giữ mã QR trong khung.</Text>
  </>;
}

const styles = StyleSheet.create({
  preview: {
    aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: brand.midnight, borderRadius: layout.cardRadius, overflow: 'hidden',
  },
  frame: { width: '66%', aspectRatio: 1, borderWidth: 2, borderColor: brand.gold, borderRadius: 18 },
});
