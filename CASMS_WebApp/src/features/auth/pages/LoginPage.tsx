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
    if (access.status === 'error') return <AuthPageShell editorialTitle="Quyền truy cập" editorialDescription="Quyền được xác minh theo tài khoản đang đăng nhập."><Notice title="Chưa tải được quyền truy cập" tone="error"><p>{access.error}</p><Button onClick={access.retry}>Thử lại</Button><Button tone="secondary" onClick={() => void auth.logout()}>Đăng xuất</Button></Notice></AuthPageShell>
    if (access.status !== 'ready' || access.userId !== auth.user.id) return <Loading label="Đang xác minh quyền tài khoản…" />
    return <Navigate to={destination(auth.user.roles)} replace />
  }
  return <AuthPageShell expired={expired} editorialTitle="Điều hành hành trình cùng OceVie." editorialDescription="Không gian làm việc dành cho quản trị viên, quản lý và nhân viên đặt chỗ."><LoginForm expired={expired} login={auth.login} onSuccess={() => { /* Navigate only after /auth/me verifies the current permissions. */ }} /></AuthPageShell>
}
