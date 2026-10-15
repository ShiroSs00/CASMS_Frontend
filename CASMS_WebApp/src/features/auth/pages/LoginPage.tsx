import { useEffect, useState } from 'react'
import { authSession } from '../model/auth-session'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { AuthPageShell } from '../components/AuthPageShell'
import { LoginForm } from '../components/LoginForm'
import { isStaff, safeAdminReturnTo } from '../model/auth-types'
import { useAuth } from '../useAuth'

export function LoginPage() {
  const auth = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const returnTo = safeAdminReturnTo(params.get('returnTo')) ?? '/admin'
  const [arrivedExpired] = useState(auth.status === 'expired')
  const expired = arrivedExpired || params.get('reason') === 'expired'
  useEffect(() => { authSession.acknowledgeExpiry() }, [])
  if (auth.user) return <Navigate to={auth.isStaff ? returnTo : '/'} replace />
  return <AuthPageShell expired={expired}><LoginForm expired={expired} login={auth.login} onSuccess={(user) => navigate(isStaff(user) ? returnTo : '/', { replace: true })} /></AuthPageShell>
}
