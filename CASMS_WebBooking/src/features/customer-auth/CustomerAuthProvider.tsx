import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { setApiAccessToken, subscribeApiUnauthorized } from '@/shared/api'
import { setSessionAccess } from '@/shared/auth'
import {
  fetchCustomerMe,
  loginCustomer,
  logoutCustomer,
  readStoredCustomerToken,
  writeStoredCustomerToken,
  type CustomerUser,
} from './customer-auth-api'
import { CustomerAuthContext } from './useCustomerAuth'

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'anonymous' | 'loading' | 'authenticated'>(() =>
    readStoredCustomerToken() ? 'loading' : 'anonymous',
  )
  const [user, setUser] = useState<CustomerUser | null>(null)

  const clearSession = useCallback(() => {
    setApiAccessToken(null)
    writeStoredCustomerToken(null)
    setUser(null)
    setStatus('anonymous')
    setSessionAccess({ status: 'anonymous', userId: null, roles: [], permissions: [], error: '' })
  }, [])

  useEffect(() => subscribeApiUnauthorized(() => clearSession()), [clearSession])

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
