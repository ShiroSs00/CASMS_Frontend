import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { ui } from '@/components/passenger/PassengerUI';
import { ApiError } from '@/lib/api';
import { ConfirmAction } from '@/features/passenger-actions/PassengerActionUI';
import { usePos } from './PosLayout';
import { Notice, posError } from './pos-ui';
import { cardReader, cardReadMessage } from './nfc-reader';

type Preview = { code: string; bookingPassengerId: string; passengerName: string };
export function PosCardAction({ preview, onIdentified }: { preview?: Preview; onIdentified?: (result: { bookingPassengerId: string; passengerName: string }) => void }) {
  const pos = usePos();
  const [identifier, setIdentifier] = useState<string>();
  const [phase, setPhase] = useState<'idle' | 'reading' | 'confirming' | 'uncertain' | 'looking' | 'done'>('idle');
  const [message, setMessage] = useState<string>();
  const [name, setName] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const generation = useRef(0), lock = useRef(false);
  const uncertain = useRef(false);
  const clearNative = useCallback(() => {
    generation.current++; setIdentifier(undefined); setConfirm(false);
    setPhase(uncertain.current ? 'uncertain' : 'idle');
    void cardReader.cancel().catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => () => clearNative(), [clearNative]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') clearNative();
    });
    return () => subscription.remove();
  }, [clearNative]);
  async function read() {
    if (lock.current || uncertain.current) return;
    lock.current = true; const version = ++generation.current;
    setPhase('reading'); setMessage(undefined); setIdentifier(undefined); setName(undefined);
    try {
      pos.assertReady();
      const uid = await cardReader.read();
      if (version !== generation.current) return;
      pos.assertReady();
      if (preview) { setIdentifier(uid); setPhase('idle'); }
      else {
        setPhase('looking');
        const result = await pos.client.lookupCard(uid);
        if (version !== generation.current) return;
        pos.assertReady(); setName(result.passengerName); setPhase('done'); onIdentified?.(result);
      }
    } catch (error) {
      if (version === generation.current) { setPhase('idle'); setMessage(error instanceof ApiError ? posError(error) : cardReadMessage(error)); }
    } finally { lock.current = false; }
  }
  async function issue() {
    if (!preview || !identifier || lock.current || uncertain.current) return;
    lock.current = true; const version = ++generation.current;
    setPhase('confirming'); setMessage(undefined);
    let sent = false;
    try {
      pos.assertReady();
      const latest = await pos.client.previewCard(preview.code);
      if (version !== generation.current) return;
      pos.assertReady();
      if (latest.bookingPassengerId !== preview.bookingPassengerId) throw new Error('identity changed');
      // From this point the server may commit even if the connection is lost.
      sent = true; uncertain.current = true;
      const result = await pos.client.confirmCard(preview.code, identifier);
      if (version !== generation.current) return;
      pos.assertReady();
      if (result.bookingPassengerId !== preview.bookingPassengerId) throw new Error('identity mismatch');
      uncertain.current = false; setIdentifier(undefined); setName(result.passengerName); setPhase('done'); setConfirm(false);
    } catch (error) {
      if (version !== generation.current) return;
      setPhase(sent ? 'uncertain' : 'idle'); setConfirm(false);
      setMessage(sent ? 'Chưa xác định được kết quả cấp thẻ. Không gửi lại. Tra cứu thẻ hoặc liên hệ quản lý để đối soát.' : posError(error));
    } finally { lock.current = false; }
  }
  async function reconcile() {
    if (!identifier || !preview || lock.current) return;
    lock.current = true; const version = ++generation.current; setPhase('looking');
    try {
      pos.assertReady(); const result = await pos.client.lookupCard(identifier);
      if (version !== generation.current) return;
      pos.assertReady();
      if (result.bookingPassengerId !== preview.bookingPassengerId) throw new Error('identity mismatch');
      uncertain.current = false; setName(result.passengerName); setPhase('done'); setIdentifier(undefined); setMessage(undefined);
    } catch {
      if (version === generation.current) { setPhase('uncertain'); setMessage('Chưa đối soát được thẻ cho hồ sơ này. Liên hệ quản lý; không gửi lại lệnh cấp thẻ.'); }
    } finally { lock.current = false; }
  }
  return <>
    {!!message && <Notice tone="warning">{message}</Notice>}
    {phase === 'done' ? <><Notice tone="success">{preview ? 'Hệ thống đã xác nhận thẻ được gán cho hành khách.' : 'Hệ thống đã tìm thấy thẻ trong chuyến của POS.'}</Notice>{name && <Text style={ui.sectionTitle}>{name}</Text>}</>
      : phase === 'uncertain' ? <>{identifier && <PassengerButton label="Đối soát bằng tra cứu thẻ" onPress={() => { void reconcile(); }} />}</>
        : <>
          <Text style={ui.body}>{phase === 'reading' ? 'Giữ một thẻ gần vùng đọc NFC.' : identifier ? 'Đã đọc thẻ. Xác nhận đúng người nhận trước khi cấp.' : preview ? 'Mã đã xác minh. Thẻ chưa được cấp.' : 'Đọc thẻ để tra cứu hành khách trong phạm vi chuyến. Kết quả này không cho phép tự ghi nhận giao dịch.'}</Text>
          <PassengerButton label={preview ? identifier ? 'Đọc lại thẻ NFC' : 'Đọc thẻ NFC' : 'Đọc thẻ và tra cứu'} variant={identifier ? 'secondary' : 'filled'}
            loading={phase === 'reading' || phase === 'looking'} disabled={!pos.verified || phase === 'confirming'} onPress={() => { void read(); }} />
          {phase === 'reading' && <PassengerButton label="Hủy đọc thẻ" variant="text" onPress={clearNative} />}
          {identifier && preview && <PassengerButton label="Xác nhận người nhận thẻ" disabled={!pos.verified || phase === 'confirming'} onPress={() => setConfirm(true)} />}
        </>}
    <ConfirmAction visible={confirm} title="Xác nhận cấp thẻ" description={'Cấp thẻ vừa đọc cho ' + (preview?.passengerName ?? '') + '. Chỉ tiếp tục sau khi đã xác nhận đúng người nhận.'}
      pending={phase === 'confirming'} error={null} disabled={!pos.verified || !identifier || phase === 'uncertain'}
      onClose={() => setConfirm(false)} onConfirm={() => { void issue(); }} />
  </>;
}
