import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { ui } from '@/components/passenger/PassengerUI';
import { useMotionPreference } from '@/components/passenger/useMotionPreference';
import { brand, lightTheme } from '@/constants/ocevie';
import { authActions, useAuth } from '@/features/auth/session-store';
import { Loading } from '@/features/passenger-actions/PassengerActionUI';
import { ApiError, getApiUrl } from '@/lib/api';
import { useNow } from '@/hooks/use-now';
import { employeeRole, eligibleEmployee } from './pos-access';
import { deviceCredential, openPos, readEmployee, scopedPos, uuid, matchesPosSession, type PosContext, type PosSession } from './pos-api';
import { clearPosSession, restorePosSession, savePosSession } from './pos-storage';
import { Field, Notice, PosPage, QueryState, posError } from './pos-ui';

type Workspace = {
  owner: string;
  username: string;
  employeePermissions: string[];
  scope: PosContext;
  client: ReturnType<typeof scopedPos>;
  key: readonly unknown[];
  verified: boolean;
  sessionError: unknown;
  refreshSession: () => void;
  assertReady: () => PosContext;
  end: (signOut: boolean) => Promise<void>;
};
const WorkspaceContext = createContext<Workspace | null>(null);

export function usePos() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('POS chưa sẵn sàng.');
  return value;
}

export function usePosActivities() {
  const pos = usePos();
  return useQuery({
    queryKey: [...pos.key, 'activities'], queryFn: ({ signal }) => pos.client.activities(signal),
    enabled: pos.scope.terminal.permissions.includes('ACTIVITY_READ'), retry: false,
  });
}

export function usePosRequests(pos: Workspace, enabled: boolean) {
  return useQuery({
    queryKey: [...pos.key, 'requests'], queryFn: ({ signal }) => pos.client.requests(signal),
    enabled: enabled && pos.scope.services.some(service => service.permissions.includes('SERVICE_REQUEST_READ')),
    retry: false,
  });
}

export default function PosLayout() {
  const status = useAuth(state => state.status);
  const login = useAuth(state => state.session);
  const employee = login?.user;
  if (status === 'restoring') return <PosPage title="OceVie POS" standalone><Loading /></PosPage>;
  if (!login || !employee) return <Redirect href={status === 'expired' ? { pathname: '/login', params: { state: 'expired' } } : '/login'} />;
  if (!employeeRole(employee.roles) || Platform.OS === 'web') {
    return <PosPage title="OceVie POS" standalone>
      <Notice tone="warning">{employee.roles.includes('POS')
        ? 'Đây là tài khoản thiết bị. Hãy đăng xuất và đăng nhập bằng tài khoản nhân viên.'
        : Platform.OS === 'web' ? 'Mở POS trong ứng dụng OceVie.' : 'Tài khoản này chưa có quyền sử dụng POS.'}</Notice>
      {employee.roles.includes('PASSENGER') ? <Redirect href="/home" /> :
        <PassengerButton label="Đăng xuất" onPress={() => { void authActions.logout(); }} />}
    </PosPage>;
  }
  let backend: string;
  try {
    backend = getApiUrl();
    if (!__DEV__ && !backend.startsWith('https://')) throw new Error('POS requires HTTPS');
  } catch {
    return <PosPage title="OceVie POS" standalone>
      <Notice tone="error">Kết nối POS chưa an toàn. Liên hệ quản lý để kiểm tra thiết bị.</Notice>
      <PassengerButton label="Đăng xuất" variant="text" onPress={() => { void authActions.logout(); }} />
    </PosPage>;
  }
  return <EmployeeGate key={`${employee.id}:${login.signedInAt}`} owner={employee.id} signedInAt={login.signedInAt} backend={backend} />;
}

function EmployeeGate({ owner, signedInAt, backend }: { owner: string; signedInAt: number; backend: string }) {
  const me = useQuery({ queryKey: ['pos-employee', backend, owner, signedInAt], queryFn: ({ signal }) => readEmployee(signal), retry: false });
  if (!me.data || me.error) return <PosPage title="OceVie POS" standalone>
    <QueryState query={me} />
    <PassengerButton label="Đăng xuất" variant="text" onPress={() => { void authActions.logout(); }} />
  </PosPage>;
  const allowed = eligibleEmployee(owner, me.data);
  if (!allowed) return <PosPage title="Chưa có quyền POS" standalone>
    <Notice tone="warning">Liên hệ quản lý để xác nhận quyền POS và phân công trong chuyến.</Notice>
    <PassengerButton label="Kiểm tra lại quyền" onPress={() => { void me.refetch(); }} />
    <PassengerButton label="Đăng xuất" variant="text" onPress={() => { void authActions.logout(); }} />
  </PosPage>;
  return <SessionGate owner={owner} signedInAt={signedInAt} username={me.data.username} employeePermissions={me.data.effectivePermissions} />;
}

function SessionGate({ owner, signedInAt, username, employeePermissions }: {
  owner: string; signedInAt: number; username: string; employeePermissions: string[];
}) {
  const [session, setSession] = useState<PosSession | null>();
  const [restoreError, setRestoreError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    void restorePosSession(owner, signedInAt).then(value => {
      if (!active) return;
      if (value.expired) setMessage('Phiên POS đã hết hạn. Mở lại phiên để tiếp tục.');
      setSession(value.session);
    }).catch(error => { if (active) setRestoreError(error); });
    return () => { active = false; };
  }, [owner, signedInAt, attempt]);

  if (session === undefined) return <PosPage title="OceVie POS" standalone>
    {restoreError ? <Notice tone="error" retry={() => { setRestoreError(undefined); setAttempt(value => value + 1); }}>
      Không đọc được phiên POS trên thiết bị.
    </Notice> : <Loading text="Đang khôi phục phiên POS…" />}
    <PassengerButton label="Đăng xuất" variant="text" onPress={() => { void authActions.logout(); }} />
  </PosPage>;

  if (!session) return <PairTerminal owner={owner} signedInAt={signedInAt} username={username} message={message} onOpened={setSession} />;
  return <ActiveSession owner={owner} signedInAt={signedInAt} username={username} employeePermissions={employeePermissions} session={session}
    onEnd={note => { setMessage(note); setSession(null); }} />;
}

function PairTerminal({ owner, signedInAt, username, message, onOpened }: {
  owner: string; signedInAt: number; username: string; message?: string; onOpened: (session: PosSession) => void;
}) {
  const [terminal, setTerminal] = useState('');
  const [area, setArea] = useState('');
  const [cruise, setCruise] = useState('');
  const [legacy, setLegacy] = useState(false);
  const [deviceUser, setDeviceUser] = useState('');
  const [credential, setCredential] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [failure, setFailure] = useState<string>();
  const valid = uuid.safeParse(terminal.trim()).success && !!credential.trim()
    && (legacy || !!deviceUser.trim()) && (!area.trim() || uuid.safeParse(area.trim()).success)
    && (!cruise.trim() || uuid.safeParse(cruise.trim()).success);

  async function open() {
    if (!valid || lock.current) return;
    lock.current = true;
    setPending(true);
    setFailure(undefined);
    try {
      const proof = legacy ? { deviceSecret: credential.trim() } : await deviceCredential(deviceUser, credential);
      const session = await openPos(owner, signedInAt, terminal.trim(), {
        ...proof, areaId: area.trim() || undefined, cruiseId: cruise.trim() || undefined,
      });
      try { await savePosSession(owner, session, signedInAt); }
      catch (error) {
        await scopedPos(owner, signedInAt, session.sessionToken).close().catch(() => {});
        throw error;
      }
      onOpened(session);
    } catch (error) {
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
      <Field label="Mã thiết bị POS" value={terminal} onChangeText={setTerminal} maxLength={36} editable={!pending} />
      <Field label="Mã khu vực (tùy chọn)" value={area} onChangeText={setArea} maxLength={36} editable={!pending} />
      <Field label="Mã chuyến (tùy chọn)" value={cruise} onChangeText={setCruise} maxLength={36} editable={!pending} />
      {!legacy && <Field label="Tên tài khoản thiết bị" value={deviceUser} onChangeText={setDeviceUser} editable={!pending} />}
      <Field label={legacy ? 'Mã bí mật thiết bị' : 'Mật khẩu thiết bị'} value={credential} onChangeText={setCredential}
        secureTextEntry textContentType="password" autoComplete="off" editable={!pending} maxLength={legacy ? 128 : undefined} />
      <PassengerButton label="Mở phiên" onPress={() => { void open(); }} disabled={!valid} loading={pending} />
      <PassengerButton label={legacy ? 'Dùng tài khoản thiết bị' : 'Dùng mã thiết bị cũ'} variant="text" disabled={pending}
        onPress={() => { setCredential(''); setFailure(undefined); setLegacy(!legacy); }} />
    </View>
    {!!failure && <Notice tone="error">{failure}</Notice>}
    <PassengerButton label="Đăng xuất nhân viên" variant="text" disabled={pending} onPress={() => { void authActions.logout(); }} />
  </PosPage>;
}

function ActiveSession({ owner, signedInAt, username, employeePermissions, session, onEnd }: {
  owner: string; signedInAt: number; username: string; employeePermissions: string[]; session: PosSession; onEnd: (message?: string) => void;
}) {
  const queryClient = useQueryClient();
  const [active, setActive] = useState(AppState.currentState == null || AppState.currentState === 'active');
  const [ending, setEnding] = useState(false);
  const [closeError, setCloseError] = useState<unknown>();
  const closed = useRef(false);
  const now = useNow();
  const reduced = useMotionPreference();
  const client = useMemo(() => scopedPos(owner, signedInAt, session.sessionToken), [owner, signedInAt, session.sessionToken]);
  const key = useMemo(() => [
    'pos', getApiUrl(), owner, session.terminal.terminalId, session.terminal.areaId, session.cruiseId, signedInAt, session.expiresAt,
  ] as const, [owner, signedInAt, session.terminal.terminalId, session.terminal.areaId, session.cruiseId, session.expiresAt]);
  const query = useQuery({ queryKey: [...key, 'context'], queryFn: ({ signal }) => client.context(signal), retry: false });
  const { refetch, data, error } = query;
  const scopeChanged = !!data && !matchesPosSession(data, session);
  const denied = error instanceof ApiError && ([401, 403, 404].includes(error.status) || error.code === 'POS_CRUISE_SELECTION_REQUIRED');

  useEffect(() => () => { queryClient.removeQueries({ queryKey: key }); }, [key, queryClient]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state === 'active') void queryClient.invalidateQueries({ queryKey: key });
    });
    return () => subscription.remove();
  }, [key, queryClient]);

  useEffect(() => {
    function expire() {
      if (closed.current) return;
      closed.current = true;
      onEnd('Phiên POS đã hết hạn hoặc bị thu hồi. Mở lại phiên để tiếp tục.');
      void clearPosSession(owner, signedInAt, session.sessionToken).catch(() => {});
    }
    if (scopeChanged || denied) {
      expire();
      return;
    }
    const timer = setTimeout(expire, Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [denied, onEnd, owner, scopeChanged, session, signedInAt]);

  const assertReady = useCallback(() => {
    const employee = useAuth.getState().session;
    const state = queryClient.getQueryState<PosContext>([...key, 'context']);
    if (closed.current || (AppState.currentState != null && AppState.currentState !== 'active')
      || !state?.data || state.error || state.isInvalidated || state.fetchStatus !== 'idle'
      || !matchesPosSession(state.data, session) || Date.parse(session.expiresAt) <= Date.now()
      || employee?.user.id !== owner || employee.signedInAt !== signedInAt || employee.expiresAt <= Date.now()) {
      throw new ApiError('Cần xác minh lại phiên POS.', 409, 'POS_REVERIFY');
    }
    return state.data;
  }, [queryClient, key, owner, session, signedInAt]);

  async function end(signOut: boolean) {
    if (closed.current) throw new Error('POS session is closing');
    closed.current = true;
    setEnding(true);
    let note: string | undefined;
    try { await client.close(); }
    catch { note = 'Đã kết thúc phiên trên thiết bị. Chưa xác nhận được việc thu hồi phiên.'; }
    try { await clearPosSession(owner, signedInAt, session.sessionToken); }
    catch {
      closed.current = false;
      setEnding(false);
      if (signOut) await authActions.logout();
      else {
        void refetch();
        const failure = new ApiError('Không xóa được phiên lưu trên thiết bị.', 409, 'POS_STORAGE');
        setCloseError(failure);
        throw failure;
      }
      return;
    }
    onEnd(note);
    if (signOut) await authActions.logout();
  }

  if (!data || denied || scopeChanged) {
    return <PosPage title="Xác minh phiên POS" standalone>
      <QueryState query={query} />
      {!!closeError && <Notice tone="error">{posError(closeError)}</Notice>}
      {!denied && !scopeChanged && <PassengerButton label="Kết thúc phiên" variant="text" loading={ending}
        onPress={() => { void end(false).catch(() => {}); }} />}
      <PassengerButton label="Đăng xuất" variant="text" disabled={ending} onPress={() => {
        if (denied || scopeChanged) void authActions.logout();
        else void end(true).catch(() => {});
      }} />
    </PosPage>;
  }
  return <WorkspaceContext.Provider value={{
    owner, username, employeePermissions, scope: data, client, key, verified: active && !error && !query.isFetching && !ending
      && Date.parse(session.expiresAt) > now,
    sessionError: error, refreshSession: () => { void refetch(); }, assertReady, end,
  }}>
    <Stack screenOptions={{
      headerStyle: { backgroundColor: lightTheme.background }, headerTintColor: brand.navy,
      headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal',
      animation: reduced ? 'none' : 'slide_from_right',
    }}>
      <Stack.Screen name="index" options={{ title: 'OceVie POS', headerShown: false }} />
      <Stack.Screen name="services" options={{ title: 'Dịch vụ' }} />
      <Stack.Screen name="requests" options={{ title: 'Yêu cầu dịch vụ' }} />
      <Stack.Screen name="activities" options={{ title: 'Hoạt động trên tàu' }} />
      <Stack.Screen name="usage" options={{ title: 'Hạn mức nội bộ' }} />
      <Stack.Screen name="scanner" options={{ title: 'Quét QR' }} />
    </Stack>
  </WorkspaceContext.Provider>;
}
