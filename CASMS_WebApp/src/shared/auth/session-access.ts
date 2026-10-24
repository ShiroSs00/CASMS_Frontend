import { useSyncExternalStore } from 'react'
import { hasPermissions, type PermissionRequirement } from './permission-policy'

type Access = { status: 'anonymous' | 'loading' | 'ready' | 'error'; userId: string | null; permissions: readonly string[]; error: string }
let state: Access = { status: 'anonymous', userId: null, permissions: [], error: '' }
const listeners = new Set<() => void>()
const retryListeners = new Set<() => void>()
export function subscribeAccessRetry(listener: () => void) { retryListeners.add(listener); return () => { retryListeners.delete(listener) } }
export function retrySessionAccess() { retryListeners.forEach(listener => listener()) }
export function getSessionAccess() { return state }
export function setSessionAccess(value: Access) { state = value; listeners.forEach(listener => listener()) }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function useSessionAccess() {
  const access = useSyncExternalStore(subscribe, () => state, () => state)
  return { ...access, has: (permission: string) => hasPermissions(access, { mode: 'ANY', permissions: [permission] }), can: (requirement: PermissionRequirement) => hasPermissions(access, requirement), retry: retrySessionAccess }
}

export function decodeSessionAccess(value: unknown): Access {
  if (!value || typeof value !== 'object') throw new Error('Không đọc được quyền của phiên đăng nhập.')
  const me = value as Record<string, unknown>
  if (typeof me.userId !== 'string' || !me.userId || !Array.isArray(me.effectivePermissions) || !me.effectivePermissions.every(permission => typeof permission === 'string')) throw new Error('Thông tin tài khoản hoặc quyền không đầy đủ.')
  return { status: 'ready', userId: me.userId, permissions: me.effectivePermissions, error: '' }
}
