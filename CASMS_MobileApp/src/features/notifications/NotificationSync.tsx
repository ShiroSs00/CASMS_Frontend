import { notificationQueryAllowed } from './notification-queries';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { create } from 'zustand';
import { useQueryClient } from '@tanstack/react-query';
import { usePassengerContext } from '../passenger-actions/passenger-hooks';
import { useAuth } from '../auth/session-store';
import { getApiUrl } from '@/lib/api';
import { startNotificationStream, type SyncStatus } from './notification-stream';
const sync = create<{ scope: string; status: SyncStatus }>(() => ({ scope: '', status: 'paused' }));
const scopeOf = (backend: string, owner?: string, epoch?: number) => JSON.stringify([backend,owner,epoch]);
export function useNotificationSyncStatus() {
  const session = useAuth(state => state.session), value = sync();
  return value.scope === scopeOf(getApiUrl(), session?.user.id, session?.signedInAt) ? value.status : 'paused';
}
export function NotificationSync() {
  const context = usePassengerContext(), cache = useQueryClient();
  const [foreground, setForeground] = useState(AppState.currentState == null || AppState.currentState === 'active');
  useEffect(() => {
    const update = () => setForeground((AppState.currentState == null || AppState.currentState === 'active')
      && (typeof document === 'undefined' || document.visibilityState !== 'hidden'));
    update(); const listener = AppState.addEventListener('change', update);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', update);
    return () => { listener.remove(); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', update); };
  }, []);
  const session = context.auth.session, backend = getApiUrl();
  const owner = session?.user.id, epoch = session?.signedInAt, token = session?.accessToken;
  const permissions = context.ready ? context.me.data?.effectivePermissions.join('|') ?? '' : '';
  const ready = context.ready && context.can('NOTIFICATION_READ');
  useEffect(() => {
    const scope = scopeOf(backend,owner,epoch);
    if (!ready || !foreground || !owner || epoch === undefined || !token) { sync.setState({ scope, status: 'paused' }); return; }
    function current() {
      const state = useAuth.getState(), now = state.session;
      return state.status === 'authenticated' && !!now && now.user.id === owner && now.signedInAt === epoch && now.accessToken === token
        && now.expiresAt > Date.now() && getApiUrl() === backend
        && (AppState.currentState == null || AppState.currentState === 'active')
        && (typeof document === 'undefined' || document.visibilityState !== 'hidden');
    }
    const stop = startNotificationStream({ baseUrl: backend, token, current,
      fetch: (url, init) => expoFetch(url, init) as unknown as Promise<Response>,
      status: status => sync.setState({ scope, status }),
      invalidate(kind) {
        if (!current()) return;
        void cache.invalidateQueries({ predicate: query => {
          return notificationQueryAllowed(query.queryKey, { backend, owner, epoch }, permissions.split('|'), kind);
        } });
      },
    });
    return () => { stop(); sync.setState({ scope, status: 'paused' }); };
  }, [ready, foreground, owner, epoch, token, backend, permissions, cache]);
  return null;
}
export const syncStatusText: Record<SyncStatus, string> = {
  connecting: 'Đang kết nối cập nhật', live: 'Đã kết nối cập nhật khi ứng dụng mở', retrying: 'Đang kết nối lại; dữ liệu được tải lại định kỳ',
  fallback: 'Đang đồng bộ định kỳ khi ứng dụng mở', denied: 'Kết nối cập nhật cần được xác minh lại; hãy tải lại', paused: 'Cập nhật trực tiếp đang tạm dừng',
};
