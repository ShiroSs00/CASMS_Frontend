import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { ui } from '@/components/passenger/PassengerUI';
import { authActions } from '@/features/auth/session-store';
import { validateLogin } from '../auth/login-model';
import { Choice } from '@/features/passenger-actions/PassengerActionUI';
import { ApiError, getApiUrl } from '@/lib/api';
import { deviceCredential, openPos, readTerminals, scopedPos, type PosSession } from './pos-api';
import { savePosSession } from './pos-storage';
import { selectedTerminalChoice, terminalChoiceItems, terminalChoiceKey } from './terminal-choice';
import { Field, Notice, PosPage, QueryState, posError } from './pos-ui';

export function PairTerminal({ owner, signedInAt, username, employeePermissions, message, onOpened }: {
  owner: string; signedInAt: number; username: string; employeePermissions: string[]; message?: string; onOpened: (session: PosSession) => void;
}) {
  const [selection, setSelection] = useState('');
  const terminals = useQuery({ queryKey: ['pos-terminals', getApiUrl(), owner, signedInAt],
    queryFn: ({ signal }) => readTerminals(signal, employeePermissions), retry: false, staleTime: 0 });
  const selected = !terminals.error ? selectedTerminalChoice(terminals.data ?? [], selection) : undefined;
  const [legacy, setLegacy] = useState(false);
  const [deviceUser, setDeviceUser] = useState('');
  const [credential, setCredential] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [failure, setFailure] = useState<string>();
  // Reset only this component's invalid selection before its children can use it.
  if (!terminals.isFetching && !terminals.error && terminals.data && selection && !selected) {
    setSelection('');
    setFailure('Khu vực hoặc chuyến đã chọn không còn khả dụng. Vui lòng chọn lại.');
  }
  const credentialErrors = validateLogin({ username: deviceUser, password: credential });
  const valid = !!selected && !terminals.isFetching && (legacy ? !!credential.trim() : !credentialErrors.username && !credentialErrors.password);

  async function open() {
    if (!valid || !selected || lock.current) return;
    lock.current = true;
    setPending(true);
    setFailure(undefined);
    try {
      const chosenKey = terminalChoiceKey(selected);
      const proof = legacy ? { deviceSecret: credential.trim() } : await deviceCredential(deviceUser, credential);
      const available = await readTerminals(undefined, employeePermissions);
      if (!selectedTerminalChoice(available, chosenKey)) {
        setSelection('');
        throw new ApiError('Khu vực đã chọn không còn khả dụng. Vui lòng cập nhật và chọn lại.', 403, 'POS_CHOICE_REVOKED');
      }
      const session = await openPos(owner, signedInAt, selected.terminalId, {
        ...proof, shipId: selected.shipId, areaId: selected.areaId, cruiseId: selected.cruiseId,
      });
      try { await savePosSession(owner, session, signedInAt); }
      catch (error) {
        await scopedPos(owner, signedInAt, session.sessionToken).close().catch(() => {});
        throw error;
      }
      onOpened(session);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) { setSelection(''); void terminals.refetch(); }
      setFailure(error instanceof ApiError && error.status === 403
        ? 'Không mở được phiên. Kiểm tra tài khoản thiết bị, mã POS và phân công khu vực hoặc chuyến.'
        : posError(error));
    } finally {
      setCredential('');
      lock.current = false;
      setPending(false);
    }
  }

  return <PosPage title="Mở phiên POS" standalone>
    <Text style={ui.body}>{username}</Text>
    {!!message && <Notice tone="warning">{message}</Notice>}
    <View style={ui.card}>
      <QueryState query={terminals} empty={terminals.data?.length === 0 ? 'Chưa có thiết bị POS được phân công cho bạn.' : undefined} />
      <Choice label="Thiết bị POS, khu vực và chuyến" value={selected ? selection : ''} onChange={setSelection} disabled={pending || terminals.isFetching || !!terminals.error}
        items={terminalChoiceItems(terminals.error ? [] : terminals.data ?? [])} />
      <PassengerButton label="Cập nhật thiết bị" variant="text" disabled={pending} onPress={() => { void terminals.refetch(); }} />
      {!legacy && <Field label="Tên tài khoản thiết bị" value={deviceUser} onChangeText={setDeviceUser} editable={!pending}
        error={deviceUser ? credentialErrors.username : undefined} />}
      <Field label={legacy ? 'Mã bí mật thiết bị' : 'Mật khẩu thiết bị'} value={credential} onChangeText={setCredential}
        secureTextEntry textContentType="password" autoComplete="off" editable={!pending} maxLength={legacy ? 128 : undefined}
        error={!legacy && credential ? credentialErrors.password : undefined} />
      <PassengerButton label="Mở phiên" onPress={() => { void open(); }} disabled={!valid} loading={pending} />
      <PassengerButton label={legacy ? 'Dùng tài khoản thiết bị' : 'Dùng mã thiết bị cũ'} variant="text" disabled={pending}
        onPress={() => { setCredential(''); setFailure(undefined); setLegacy(!legacy); }} />
    </View>
    {!!failure && <Notice tone="error">{failure}</Notice>}
    <PassengerButton label="Đăng xuất nhân viên" variant="text" disabled={pending} onPress={() => { void authActions.logout(); }} />
  </PosPage>;
}
