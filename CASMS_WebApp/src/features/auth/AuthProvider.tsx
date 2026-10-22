import { useEffect, type ReactNode } from 'react'
import { apiRequest } from '@/shared/api'
import { decodeSessionAccess, setSessionAccess } from '@/shared/auth'
import { authSession } from './model/auth-session'
import { useAuth } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const token = auth.session?.accessToken
  useEffect(() => authSession.start(), [])
  useEffect(() => {
    if (!token) { setSessionAccess({ status: 'anonymous', userId: null, permissions: [], error: '' }); return }
    const controller = new AbortController()
    setSessionAccess({ status: 'loading', userId: null, permissions: [], error: '' })
    void apiRequest<unknown>('/auth/me', { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) setSessionAccess(decodeSessionAccess(value))
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setSessionAccess({ status: 'error', userId: null, permissions: [], error: error instanceof Error ? error.message : 'Không tải được quyền tài khoản.' })
    })
    return () => { controller.abort(); setSessionAccess({ status: 'anonymous', userId: null, permissions: [], error: '' }) }
  }, [token])
  return children
}
