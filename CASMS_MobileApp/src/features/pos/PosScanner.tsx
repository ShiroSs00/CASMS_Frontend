import { claimCode, cardPreview } from '../passenger-actions/card-contracts';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { ui } from '@/components/passenger/PassengerUI';
import { brand, layout } from '@/constants/ocevie';
import { usePos } from './PosLayout';
import { Notice, PosPage, posError } from './pos-ui';
import { PosCardAction } from './PosCardAction';

export function PosScanner() {
  const pos = usePos();
  const [mode, setMode] = useState<'issue' | 'lookup'>('issue');

  const canUse = pos.employeePermissions.includes('POS_ACCESS') && pos.employeePermissions.includes('CHECKIN_BOARDING');

  return <PosPage title="Quét QR hành khách">
    {canUse ? <>
      {!!pos.sessionError && <Notice tone="error" retry={pos.refreshSession}>{posError(pos.sessionError)}</Notice>}

      <PassengerButton label="Cấp thẻ bằng QR" variant={mode === 'issue' ? 'secondary' : 'text'} onPress={() => setMode('issue')} />
      <PassengerButton label="Tra cứu thẻ NFC" variant={mode === 'lookup' ? 'secondary' : 'text'} onPress={() => setMode('lookup')} />
      {mode === 'issue' ? <ScannerCamera key={JSON.stringify([pos.key, pos.verified])} enabled={pos.verified} preview={code => { pos.assertReady(); return pos.client.previewCard(code); }} />
        : pos.verified ? <PosCardAction key={JSON.stringify(pos.key)} /> : <Notice>Cần xác minh phiên POS trước khi đọc thẻ.</Notice>}

    </> : <Notice tone="neutral">Phiên này chưa có nghiệp vụ cần dùng mã hành khách.</Notice>}
  </PosPage>;
}

function ScannerCamera({ enabled, preview }: { enabled: boolean; preview: (code: string) => Promise<unknown> }) {
  const [permission, requestPermission, getPermission] = useCameraPermissions({ get: false });
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [requested, setRequested] = useState(false);
  const [failure, setFailure] = useState<'permission' | 'camera'>();
  const [result, setResult] = useState<'pending' | 'verified' | 'empty' | 'error'>();
  const [name, setName] = useState<string>();
  const [claim, setClaim] = useState<{ code: string; bookingPassengerId: string; passengerName: string }>();
  const [error, setError] = useState<unknown>();
  const generation = useRef(0);
  const locked = useRef(false);
  const refreshPermission = useCallback(async () => {
    try { await getPermission(); setFailure(current => current === 'permission' ? undefined : current); }
    catch { setFailure('permission'); }
  }, [getPermission]);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    void refreshPermission();
    return () => { generation.current++; locked.current = false; setResult(undefined); setName(undefined); setClaim(undefined); setFocused(false); };
  }, [refreshPermission]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      generation.current++; locked.current = false; setResult(undefined); setName(undefined); setClaim(undefined);
      setActive(state === 'active');
      if (state === 'active' && focused) void refreshPermission();
    });
    return () => subscription.remove();
  }, [focused, refreshPermission]);


  function reset() {
    generation.current++; setName(undefined); setError(undefined); setClaim(undefined);
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
    {!permission.canAskAgain && Platform.OS !== 'web' && <PassengerButton label="Mở Cài đặt" onPress={() => {
      void Linking.openSettings().catch(() => setFailure('permission'));
    }} />}
  </View>;
  if (failure) return <Notice tone="error" retry={reset}>Không mở được camera. Kiểm tra quyền và thử lại.</Notice>;
  if (result) return <>
    <Notice tone={result === 'verified' ? 'success' : result === 'error' ? 'error' : 'info'}>
      {result === 'pending' ? 'Đang xác minh mã nhận thẻ…' : result === 'verified'
        ? 'Mã nhận thẻ đã được xác minh. Thẻ chưa được cấp.'
        : result === 'error' ? posError(error) : 'Mã này không phải mã nhận thẻ hợp lệ.'}
    </Notice>
    {name && <Text style={ui.sectionTitle}>{name}</Text>}
    {result === 'verified' && claim && <PosCardAction preview={claim} />}
    <PassengerButton label={result === 'pending' ? 'Hủy xác minh' : 'Quét mã khác'} onPress={reset} />
  </>;
  return <>
    <View style={styles.preview}>
      {focused && active && <CameraView style={StyleSheet.absoluteFill} facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onMountError={() => setFailure('camera')}
        onBarcodeScanned={async ({ data }) => {
          if (locked.current || !enabled || !focused || !active) return;
          locked.current = true;
          const parsed = claimCode.safeParse(data);
          if (!parsed.success) { setResult('empty'); return; }
          const version = ++generation.current;
          setResult('pending');
          try {
            const value = cardPreview.parse(await preview(parsed.data));
            if (version !== generation.current) return;
            setName(value.passengerName); setClaim({ ...value, code: parsed.data }); setResult('verified');
          } catch (failure) {
            if (version !== generation.current) return;
            setError(failure); setResult('error');
          }
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
