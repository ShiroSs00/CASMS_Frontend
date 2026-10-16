import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'
import { safeAdminReturnTo, safeCustomerReturnTo } from './model/auth-types'
import styles from './components/Auth.module.css'

export function SessionBoundary() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') return <div className={styles.loading} role="status">Đang khôi phục phiên đăng nhập…</div>
  if (auth.status === 'expired' && location.pathname !== '/login') {
    const query = new URLSearchParams({ reason: 'expired' })
    const returnTo = safeAdminReturnTo(`${location.pathname}${location.search}${location.hash}`) ?? safeCustomerReturnTo(`${location.pathname}${location.search}${location.hash}`)
    if (returnTo) query.set('returnTo', returnTo)
    return <Navigate to={`/login?${query}`} replace />
  }
  return <Outlet />
}

export function AdminGuard() {
  const auth = useAuth()
  const location = useLocation()
  if (!auth.user) return <Navigate to={`/login?${new URLSearchParams({ returnTo: `${location.pathname}${location.search}${location.hash}` })}`} replace />
  if (!auth.isStaff) return <Navigate to="/403" replace />
  return <Outlet />
}

export function CustomerGuard() {
  const auth = useAuth()
  const location = useLocation()
  // A development-only preview renders isolated, fictitious records, never account data.
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === '1') return <Outlet />
  if (!auth.user) return <Navigate to={`/login?${new URLSearchParams({ returnTo: location.pathname + location.search })}`} replace />
  return <Outlet />
}