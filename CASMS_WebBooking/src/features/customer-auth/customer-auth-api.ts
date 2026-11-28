import { apiRequest, setApiAccessToken } from '@/shared/api'
import { decodeSessionAccess } from '@/shared/auth'

export type CustomerUser = {
  userId: string
  username: string
  email: string | null
  fullName: string | null
  roles: readonly string[]
  permissions: readonly string[]
}

const SESSION_KEY = 'ocevie.customer.token.v1'
const SESSION_META_KEY = 'ocevie.customer.session-meta.v1'
const VIETQR_ATTEMPT_PREFIX = 'ocevie.vietqr.attempt.v1:'
const DEFAULT_TOKEN_TTL_MS = 60 * 60 * 1000

export type StoredCustomerSessionMeta = {
  expiresAt: number
  refreshAt: number
}

export function readStoredCustomerToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function readStoredCustomerSessionMeta(): StoredCustomerSessionMeta | null {
  try {
    const raw = sessionStorage.getItem(SESSION_META_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredCustomerSessionMeta>
    if (typeof parsed.expiresAt === 'number' && typeof parsed.refreshAt === 'number'
      && Number.isFinite(parsed.expiresAt) && Number.isFinite(parsed.refreshAt)) {
      return { expiresAt: parsed.expiresAt, refreshAt: parsed.refreshAt }
    }
    return null
  } catch {
    return null
  }
}

export function writeStoredCustomerToken(token: string | null, expiresInSeconds?: number) {
  try {
    if (token) {
      sessionStorage.setItem(SESSION_KEY, token)
      const ttlMs = typeof expiresInSeconds === 'number' && expiresInSeconds > 60
        ? expiresInSeconds * 1000
        : DEFAULT_TOKEN_TTL_MS
      const now = Date.now()
      const meta: StoredCustomerSessionMeta = {
        expiresAt: now + ttlMs,
        refreshAt: now + Math.floor(ttlMs * 0.75),
      }
      sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta))
    } else {
      sessionStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(SESSION_META_KEY)
    }
  } catch {
    // Ignore storage quota/privacy mode failures; keep in-memory token active.
  }
}

export function clearCustomerSensitiveStorage() {
  writeStoredCustomerToken(null)
  try {
    const toRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith(VIETQR_ATTEMPT_PREFIX)) {
        toRemove.push(key)
      }
    }
    for (const key of toRemove) {
      sessionStorage.removeItem(key)
    }
  } catch {
    // Ignore storage access errors in privacy mode.
  }
}

function extractTokenAndTtl(res: Record<string, unknown>): { token: string; expiresInSeconds?: number } {
  const token =
    typeof res?.accessToken === 'string' && res.accessToken
      ? res.accessToken
      : typeof res?.token === 'string' && res.token
        ? res.token
        : ''
  const expiresInSeconds = typeof res?.expiresIn === 'number' && Number.isFinite(res.expiresIn)
    ? res.expiresIn
    : undefined
  return { token, expiresInSeconds }
}

export async function loginCustomer(username: string, password: string): Promise<{ token: string; user: CustomerUser }> {
  const loginRes = await apiRequest<Record<string, unknown>>('/auth/login', {
    method: 'POST',
    authenticated: false,
    body: { username: username.trim(), password },
  })
  const { token, expiresInSeconds } = extractTokenAndTtl(loginRes)
  if (!token) throw new Error('Không nhận được phiên đăng nhập từ hệ thống.')
  setApiAccessToken(token)
  try {
    const user = await fetchCustomerMe()
    if (!user.roles.includes('PASSENGER')) {
      setApiAccessToken(null)
      throw new Error('Tài khoản này thuộc hệ thống nhân viên. Vui lòng đăng nhập tại cổng nhân viên OceVie.')
    }
    writeStoredCustomerToken(token, expiresInSeconds)
    return { token, user }
  } catch (error) {
    setApiAccessToken(null)
    clearCustomerSensitiveStorage()
    throw error
  }
}

export async function refreshCustomerToken(): Promise<string> {
  const refreshRes = await apiRequest<Record<string, unknown>>('/auth/refresh', {
    method: 'POST',
  })
  const { token, expiresInSeconds } = extractTokenAndTtl(refreshRes)
  if (!token) throw new Error('Không thể gia hạn phiên đăng nhập.')
  setApiAccessToken(token, { silentRefresh: true })
  writeStoredCustomerToken(token, expiresInSeconds)
  return token
}

export async function fetchCustomerMe(signal?: AbortSignal): Promise<CustomerUser> {
  const raw = await apiRequest<Record<string, unknown>>('/auth/me', { signal })
  const access = decodeSessionAccess(raw)
  return {
    userId: access.userId ?? '',
    username: typeof raw.username === 'string' ? raw.username : '',
    email: typeof raw.email === 'string' ? raw.email : null,
    fullName: typeof raw.fullName === 'string' ? raw.fullName : null,
    roles: access.roles,
    permissions: access.permissions,
  }
}

export async function logoutCustomer(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' })
  } catch {
    // Best-effort BE revocation; local cleanup always proceeds.
  } finally {
    setApiAccessToken(null)
    clearCustomerSensitiveStorage()
  }
}
