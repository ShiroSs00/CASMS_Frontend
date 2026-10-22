import { roleSafeAdminReturnTo } from '@/shared/ui/admin-v3'
import { useEffect, useState } from 'react'
import { authSession } from '../model/auth-session'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { AuthPageShell } from '../components/AuthPageShell'
import { LoginForm } from '../components/LoginForm'
import { safeAdminReturnTo } from '../model/auth-types'
import { useAuth } from '../useAuth'

export function LoginPage() {
  const auth = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const adminReturnTo = safeAdminReturnTo(params.get('returnTo'))
  const destination = (roles: readonly string[]) => roleSafeAdminReturnTo(roles,adminReturnTo) ?? '/403'
  const [arrivedExpired] = useState(auth.status === 'expired')
  const expired = arrivedExpired || params.get('reason') === 'expired'
  useEffect(() => { authSession.acknowledgeExpiry() }, [])
  if (auth.user) return <Navigate to={destination(auth.user.roles)} replace />
  return <AuthPageShell expired={expired} editorialTitle="Điều hành hành trình cùng OceVie." editorialDescription="Không gian làm việc dành cho quản lý và quản trị viên."><LoginForm expired={expired} login={auth.login} onSuccess={(user) => navigate(destination(user.roles), { replace: true })} /></AuthPageShell>
}
