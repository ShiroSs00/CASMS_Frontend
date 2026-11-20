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

export function readStoredCustomerToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function writeStoredCustomerToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Ignore storage quota/privacy mode failures; keep in-memory token active.
  }
}

export async function loginCustomer(username: string, password: string): Promise<{ token: string; user: CustomerUser }> {
  const loginRes = await apiRequest<Record<string, unknown>>('/auth/login', {
    method: 'POST',
    authenticated: false,
    body: { username: username.trim(), password },
  })
  const token =
    typeof loginRes?.accessToken === 'string' && loginRes.accessToken
      ? loginRes.accessToken
      : typeof loginRes?.token === 'string' && loginRes.token
        ? loginRes.token
        : ''
  if (!token) throw new Error('Không nhận được phiên đăng nhập từ hệ thống.')
  setApiAccessToken(token)
  try {
    const user = await fetchCustomerMe()
    if (!user.roles.includes('PASSENGER')) {
      setApiAccessToken(null)
      throw new Error('Tài khoản này thuộc hệ thống nhân viên. Vui lòng đăng nhập tại cổng nhân viên OceVie.')
    }
    writeStoredCustomerToken(token)
    return { token, user }
  } catch (error) {
    setApiAccessToken(null)
    writeStoredCustomerToken(null)
    throw error
  }
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
    // Stateless JWT logout; local cleanup still proceeds.
  } finally {
    setApiAccessToken(null)
    writeStoredCustomerToken(null)
  }
}
