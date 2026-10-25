import { useEffect, useState, type ReactNode } from 'react'
import { apiRequest } from '@/shared/api'
import { decodeSessionAccess, setSessionAccess, subscribeAccessRetry } from '@/shared/auth'
import { authSession } from './model/auth-session'
import { useAuth } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const token = auth.session?.accessToken
  const userId = auth.user?.id
  const [attempt, setAttempt] = useState(0)
  useEffect(() => authSession.start(), [])
  useEffect(() => subscribeAccessRetry(() => setAttempt(value => value + 1)), [])
  useEffect(() => {
    if (!token || !userId) { setSessionAccess({ status: 'anonymous', userId: null, permissions: [], error: '' }); return }
    const controller = new AbortController()
    setSessionAccess({ status: 'loading', userId, permissions: [], error: '' })
    void apiRequest<unknown>('/auth/me', { signal: controller.signal }).then(value => {
      const access = decodeSessionAccess(value)
      if (access.userId !== userId) throw new Error('Thông tin quyền không thuộc tài khoản hiện tại. Vui lòng đăng nhập lại.')
      if (!controller.signal.aborted) setSessionAccess(access)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setSessionAccess({ status: 'error', userId: null, permissions: [], error: error instanceof Error ? error.message : 'Không tải được quyền tài khoản.' })
    })
    return () => { controller.abort(); setSessionAccess({ status: 'anonymous', userId: null, permissions: [], error: '' }) }
  }, [token, userId, attempt])
  return children
}
