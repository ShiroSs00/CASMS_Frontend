import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { setApiAccessToken, subscribeApiUnauthorized } from '@/shared/api'
import { setSessionAccess } from '@/shared/auth'
import {
  clearCustomerSensitiveStorage,
  fetchCustomerMe,
  loginCustomer,
  logoutCustomer,
  readStoredCustomerSessionMeta,
  readStoredCustomerToken,
  refreshCustomerToken,
  type CustomerUser,
} from './customer-auth-api'
import { CustomerAuthContext } from './useCustomerAuth'

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'anonymous' | 'loading' | 'authenticated'>(() =>
    readStoredCustomerToken() ? 'loading' : 'anonymous',
  )
  const [user, setUser] = useState<CustomerUser | null>(null)
  const refreshInFlightRef = useRef(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const clearSession = useCallback(() => {
    clearTimeout(refreshTimerRef.current)
    setApiAccessToken(null)
    clearCustomerSensitiveStorage()
    setUser(null)
    setStatus('anonymous')
    setSessionAccess({ status: 'anonymous', userId: null, roles: [], permissions: [], error: '' })
    window.dispatchEvent(new CustomEvent('ocevie:customer-logout'))
  }, [])

  useEffect(() => subscribeApiUnauthorized(() => clearSession()), [clearSession])

  useEffect(() => {
    if (status !== 'authenticated') return
    let active = true
    const scheduleNext = () => {
      clearTimeout(refreshTimerRef.current)
      if (!active || !readStoredCustomerToken()) return
      const meta = readStoredCustomerSessionMeta()
      const now = Date.now()
      const delay = meta ? Math.max(0, meta.refreshAt - now) : 45 * 60 * 1000
      if (meta && now >= meta.expiresAt) {
        clearSession()
        return
      }
      refreshTimerRef.current = setTimeout(() => {
        if (!active || refreshInFlightRef.current || !readStoredCustomerToken()) return
        refreshInFlightRef.current = true
        refreshCustomerToken()
          .then(() => {
            if (active) scheduleNext()
          })
          .catch(() => {
            if (active) clearSession()
          })
          .finally(() => {
            refreshInFlightRef.current = false
          })
      }, Math.min(delay, 2147483647))
    }
    scheduleNext()
    const onResume = () => {
      if (document.visibilityState === 'visible') scheduleNext()
    }
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('focus', onResume)
    return () => {
      active = false
      clearTimeout(refreshTimerRef.current)
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('focus', onResume)
    }
  }, [status, clearSession])

  useEffect(() => {
    const stored = readStoredCustomerToken()
    if (!stored) {
      setSessionAccess({ status: 'anonymous', userId: null, roles: [], permissions: [], error: '' })
      return
    }
    const controller = new AbortController()
    setApiAccessToken(stored)
    setSessionAccess({ status: 'loading', userId: null, roles: [], permissions: [], error: '' })
    fetchCustomerMe(controller.signal)
      .then(me => {
        if (controller.signal.aborted) return
        if (!me.roles.includes('PASSENGER')) {
          clearSession()
          return
        }
        setUser(me)
        setStatus('authenticated')
        setSessionAccess({
          status: 'ready',
          userId: me.userId,
          roles: me.roles,
          permissions: me.permissions,
          error: '',
        })
      })
      .catch(() => {
        if (!controller.signal.aborted) clearSession()
      })
    return () => controller.abort()
  }, [clearSession])

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginCustomer(username, password)
    setUser(result.user)
    setStatus('authenticated')
    setSessionAccess({
      status: 'ready',
      userId: result.user.userId,
      roles: result.user.roles,
      permissions: result.user.permissions,
      error: '',
    })
    return result.user
  }, [])

  const logout = useCallback(async () => {
    await logoutCustomer()
    clearSession()
  }, [clearSession])

  return (
    <CustomerAuthContext.Provider value={{ status, user, login, logout }}>
      {children}
    </CustomerAuthContext.Provider>
  )
}
