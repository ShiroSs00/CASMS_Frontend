import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { api, ApiError } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { readSession, toSession, type LoginDto, type Session } from './session-model';

type AuthState = { status: 'restoring' | 'anonymous' | 'authenticated' | 'expired'; mode: 'live' | 'demo'; session: Session | null };
export const useAuth = create<AuthState>(() => ({ status: 'restoring', mode: 'live', session: null }));
const KEY = 'aurora.auth.v1';
let generation = 0;
let restoring: Promise<void> | undefined;
let refreshing: Promise<void> | undefined;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let writes: Promise<unknown> = Promise.resolve();
function save(session: Session | null) {
  // SecureStore has no web implementation; browser previews keep tokens only in memory.
  if (Platform.OS === 'web') return Promise.resolve();
  writes = writes.catch(() => {}).then(() => session
    ? SecureStore.setItemAsync(KEY, JSON.stringify(session), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
    : SecureStore.deleteItemAsync(KEY));
  return writes;
}
function stopTimers() { clearTimeout(expiryTimer); clearTimeout(refreshTimer); }
function clear(status: 'anonymous' | 'expired') {
  generation++; stopTimers(); api.setToken(null); queryClient.clear();
  useAuth.setState({ status, mode: 'live', session: null });
  void save(null).catch(() => {});
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
export const authActions = {
  restore() {
    if (restoring) return restoring;
    const version = generation;
    restoring = (async () => {
      try {
        const session = Platform.OS === 'web' ? null : readSession(await SecureStore.getItemAsync(KEY));
        if (version !== generation) return;
        if (session) publish(session); else clear('anonymous');
      } catch { if (version === generation) clear('anonymous'); }
    })();
    return restoring;
  },
  async login(username: string, password: string) {
    const version = ++generation;
    stopTimers();
    api.setToken(null); queryClient.clear();
    useAuth.setState({ status: 'anonymous', mode: 'live', session: null });
    void save(null).catch(() => {});
    const requestedAt = Date.now();
    const dto = await api.request<LoginDto>('/auth/login', { method: 'POST', body: { username: username.trim(), password }, authenticated: false });
    if (version !== generation) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
    const session = toSession(dto, requestedAt);
    try { await save(session); } catch { throw new Error('Không thể lưu phiên đăng nhập trên thiết bị. Vui lòng thử lại.'); }
    if (version !== generation) throw new Error('Phiên đăng nhập đã thay đổi.');
    queryClient.clear(); publish(session);
  },
  refresh() {
    if (refreshing) return refreshing;
    const version = generation;
    const session = useAuth.getState().session;
    if (!session) return Promise.resolve();
    refreshing = (async () => {
      try {
        const requestedAt = Date.now();
        const dto = await api.request<LoginDto>('/auth/refresh', { method: 'POST' });
        if (version !== generation) return;
        const next = toSession(dto, requestedAt); await save(next);
        if (version === generation) publish(next);
      } catch (error) {
        if (version !== generation) return;
        if (Date.now() >= session.expiresAt || (error instanceof ApiError && [401, 403].includes(error.status))) clear('expired');
        else refreshTimer = setTimeout(() => { void authActions.refresh(); }, 15000);
      } finally { refreshing = undefined; }
    })();
    return refreshing;
  },
  async logout() {
    // The backend logout is stateless. Clear the token/caches locally immediately.
    clear('anonymous');
    await save(null).catch(() => {});
  },
  demo() { clear('anonymous'); useAuth.setState({ status: 'authenticated', mode: 'demo', session: null }); },
};
