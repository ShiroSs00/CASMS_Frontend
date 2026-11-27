import { useSessionAccess } from '@/shared/auth'
import { Button, Loading, Notice } from '@/shared/ui'
import { roleSafeAdminReturnTo } from '@/shared/ui/admin-v3'
import { useEffect, useState } from 'react'
import { authSession } from '../model/auth-session'
import { Navigate, useSearchParams } from 'react-router'
import { AuthPageShell } from '../components/AuthPageShell'
import { LoginForm } from '../components/LoginForm'
import { safeAdminReturnTo } from '../model/auth-types'
import { useAuth } from '../useAuth'

export function LoginPage() {
  const auth = useAuth()
  const [params] = useSearchParams()
  const access = useSessionAccess()
  const adminReturnTo = safeAdminReturnTo(params.get('returnTo'))
  const destination = (roles: readonly string[]) => roleSafeAdminReturnTo(roles,adminReturnTo,access) ?? '/admin'
  const [arrivedExpired] = useState(auth.status === 'expired')
  const expired = arrivedExpired || params.get('reason') === 'expired'
  useEffect(() => { authSession.acknowledgeExpiry() }, [])
  if (auth.user) {
    if (access.status === 'error') return <AuthPageShell editorialTitle="Quyền truy cập" editorialDescription="Quyền được xác minh theo tài khoản đang đăng nhập."><div style={{ display: 'grid', gap: 'var(--space-4)' }}><Notice title="Chưa tải được quyền truy cập" tone="error"><p>{access.error}</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}><Button autoWidth onClick={access.retry}>Thử lại</Button><Button autoWidth tone="secondary" onClick={() => void auth.logout()}>Đăng xuất</Button></div></Notice><p id="auth-help" style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>Liên hệ quản trị viên nếu lỗi tải quyền vẫn tiếp diễn.</p></div></AuthPageShell>
    if (access.status !== 'ready' || access.userId !== auth.user.id) return <Loading label="Đang xác minh quyền tài khoản…" />
    return <Navigate to={destination(access.roles)} replace />
  }
  return <AuthPageShell expired={expired} editorialTitle="Đồng hành cùng OceVie" editorialDescription="Không gian điều hành dành cho quản trị viên, quản lý các bộ phận và nhân viên vận hành."><LoginForm expired={expired} login={auth.login} onSuccess={() => { /* Navigate only after /auth/me verifies the current permissions. */ }} /></AuthPageShell>
}
