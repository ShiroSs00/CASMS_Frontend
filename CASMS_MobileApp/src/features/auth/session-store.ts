import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { api, ApiError, getApiUrl } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { readSession, toSession, type LoginDto, type Session } from './session-model';
import { restoredVoyageSelection, scopedSelection, useVoyageSelection } from '../passenger-actions/voyage-selection';

type AuthState = { status: 'restoring' | 'anonymous' | 'authenticated' | 'expired' | 'signed-out'; mode: 'live'; session: Session | null };
export const useAuth = create<AuthState>(() => ({ status: 'restoring', mode: 'live', session: null }));
const KEY = 'aurora.auth.v1';
let generation = 0;
let lastSignedInAt = 0;
let restoring: Promise<void> | undefined;
let refreshing: Promise<void> | undefined;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let writes: Promise<unknown> = Promise.resolve();
const sessionCleanups = new Set<() => Promise<unknown>>();
/** Cleanup starts with the outgoing token, before local auth is cleared. */
export function registerSessionCleanup(cleanup: () => Promise<unknown>) {
  sessionCleanups.add(cleanup);
  return () => { sessionCleanups.delete(cleanup); };
}
function startSessionCleanup() {
  return Promise.allSettled([...sessionCleanups].map(cleanup => {
    try { return cleanup(); } catch (error) { return Promise.reject(error); }
  }));
}
function sessionScope(session: Session) {
  return { owner: session.user.id, signedInAt: session.signedInAt, apiUrl: getApiUrl() };
}
function save(session: Session | null) {
  // SecureStore has no web implementation; browser previews keep tokens only in memory.
  if (Platform.OS === 'web') return Promise.resolve();
  writes = writes.catch(() => {}).then(() => {
    if (!session) return SecureStore.deleteItemAsync(KEY);
    const scope = sessionScope(session);
    const selection = scopedSelection(scope, useVoyageSelection.getState().selection);
    return SecureStore.setItemAsync(KEY, JSON.stringify({
      backend: scope.apiUrl, session, voyage: selection && { bookingId: selection.bookingId, bookingPassengerId: selection.bookingPassengerId },
    }), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  });
  return writes;
}
function stopTimers() { clearTimeout(expiryTimer); clearTimeout(refreshTimer); }
function clear(status: 'anonymous' | 'expired' | 'signed-out') {
  const cleanup = startSessionCleanup();
  generation++; stopTimers(); api.setToken(null); queryClient.clear();
  useAuth.setState({ status, mode: 'live', session: null });
  useVoyageSelection.setState({ selection: null, handledRoutes: {} });
  void save(null).catch(() => {});
  return cleanup;
}
function publish(session: Session) {
  api.setToken(session.accessToken);
  useAuth.setState({ status: 'authenticated', mode: 'live', session });
  stopTimers();
  const remaining = session.expiresAt - Date.now();
  if (remaining <= 0) { clear('expired'); return; }
  expiryTimer = setTimeout(() => clear('expired'), Math.min(remaining, 2147483647));
  refreshTimer = setTimeout(() => { void authActions.refresh(); }, Math.min(Math.max(1000, remaining - Math.min(60000, remaining * .2)), 2147483647));
}
api.onUnauthorized(() => clear('expired'));
useVoyageSelection.subscribe((next, previous) => {
  const { status, session } = useAuth.getState();
  if (Platform.OS === 'web' || status !== 'authenticated' || !session || next.selection === previous.selection) return;
  const scope = sessionScope(session);
  writes = writes.catch(() => {}).then(async () => {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return;
    const stored = JSON.parse(raw);
    if (stored.backend !== scope.apiUrl || stored.session?.user?.id !== scope.owner || stored.session?.signedInAt !== scope.signedInAt) return;
    const selection = scopedSelection(scope, useVoyageSelection.getState().selection);
    stored.voyage = selection && { bookingId: selection.bookingId, bookingPassengerId: selection.bookingPassengerId };
    await SecureStore.setItemAsync(KEY, JSON.stringify(stored), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  });
  void writes.catch(() => {});
});
export const authActions = {
  restore() {
    if (restoring) return restoring;
    const version = generation;
    restoring = (async () => {
      try {
        const raw = Platform.OS === 'web' ? null : await SecureStore.getItemAsync(KEY);
        const stored = raw ? JSON.parse(raw) : null;
        const session = stored?.backend === getApiUrl() && stored.session
          ? readSession(JSON.stringify(stored.session), true) : null;
        if (version !== generation) return;
        if (session && session.expiresAt > Date.now()) {
          lastSignedInAt = session.signedInAt;
          useVoyageSelection.setState({ selection: restoredVoyageSelection(sessionScope(session), stored.voyage) });
          publish(session);
        }
        else clear(session ? 'expired' : 'anonymous');
      } catch { if (version === generation) clear('anonymous'); }
    })();
    return restoring;
  },
  async login(username: string, password: string) {
    void startSessionCleanup();
    const version = ++generation;
    stopTimers();
    api.setToken(null); queryClient.clear();
    useAuth.setState({ status: 'anonymous', mode: 'live', session: null });
    useVoyageSelection.setState({ selection: null, handledRoutes: {} });
    void save(null).catch(() => {});
    const requestedAt = Date.now();
    const dto = await api.request<LoginDto>('/auth/login', { method: 'POST', body: { username: username.trim(), password }, authenticated: false });
    if (version !== generation) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
    lastSignedInAt = Math.max(requestedAt, lastSignedInAt + 1);
    const session = toSession(dto, requestedAt, lastSignedInAt);
    try { await save(session); } catch { throw new Error('Không thể lưu phiên đăng nhập trên thiết bị. Vui lòng thử lại.'); }
    if (version !== generation) throw new Error('Phiên đăng nhập đã thay đổi.');
    queryClient.clear(); publish(session);
  },
  refresh() {
    if (refreshing) return refreshing;
    const version = generation;
    const session = useAuth.getState().session;
    if (!session) return Promise.resolve();
    clearTimeout(refreshTimer);
    refreshing = (async () => {
      try {
        const requestedAt = Date.now();
        const dto = await api.request<LoginDto>('/auth/refresh', { method: 'POST' });
        if (version !== generation) return;
        const next = toSession(dto, requestedAt, session.signedInAt);
        // A refresh may update grants, but must never switch the signed-in owner.
        if (next.user.id !== session.user.id) { clear('expired'); return; }
        await save(next);
        if (version === generation) publish(next);
      } catch (error) {
        if (version !== generation) return;
        if (Date.now() >= session.expiresAt || (error instanceof ApiError && error.status === 401)) clear('expired');
        else refreshTimer = setTimeout(() => { void authActions.refresh(); }, 15000);
      } finally { refreshing = undefined; }
    })();
    return refreshing;
  },
  resume() {
    const session = useAuth.getState().session;
    if (!session) return;
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) clear('expired');
    else if (remaining < 60000) void authActions.refresh();
  },
  async logout() {
    // The backend logout is stateless. Clear the token/caches locally immediately.
    const cleanup = clear('signed-out');
    await save(null).catch(() => {});
    await cleanup;
  },
};
