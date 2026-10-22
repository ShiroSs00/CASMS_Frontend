import { useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { AdminShell, canEnterWorkspace, workspaceForPath, canRoleOpenAdminPath, staffRoleHome } from '@/shared/ui/admin-v3'
import { Loading, Notice } from '@/shared/ui'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'
import { safeAdminReturnTo, safeCustomerReturnTo } from './model/auth-types'
import styles from './components/Auth.module.css'

export function SessionBoundary() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') return <div className={styles.loading} role="status">Đang khôi phục phiên đăng nhập…</div>
  if (auth.status === 'expired' && location.pathname.startsWith('/admin')) {
    const query = new URLSearchParams({ reason: 'expired' })
    const returnTo = safeAdminReturnTo(`${location.pathname}${location.search}${location.hash}`) ?? safeCustomerReturnTo(`${location.pathname}${location.search}${location.hash}`)
    if (returnTo) query.set('returnTo', returnTo)
    return <Navigate to={`/login?${query}`} replace />
  }
  return <Outlet />
}

export function AdminGuard() {
  const auth = useAuth()
  const access = useSessionAccess()
  const location = useLocation()
  const [admitted, setAdmitted] = useState('')
  const workspace = location.pathname.startsWith('/admin/workspaces/') ? workspaceForPath(location.pathname) : undefined
  const key = auth.user && auth.isStaff ? `${auth.user.id}:${[...auth.user.roles].sort().join(',')}:${location.pathname}${location.search}` : ''
  const granted = Boolean(auth.user && auth.isStaff && access.status==='ready'
    && access.userId===auth.user.id && canRoleOpenAdminPath(auth.user.roles,location.pathname,location.search,access)
    && (!workspace || canEnterWorkspace(workspace,access)))
  // Preserve an already admitted page during same-account token refresh. Feature
  // mutations still use fresh access.has(); switching user/department never reuses it.
  const nextAdmission = granted ? key : ''
  const refreshingAccess = access.status === 'loading' || access.status === 'anonymous'
  if (admitted !== nextAdmission && (!refreshingAccess || admitted !== key)) setAdmitted(nextAdmission)
  if (!auth.user) return <Navigate to={`/login?${new URLSearchParams({ returnTo: `${location.pathname}${location.search}${location.hash}` })}`} replace />
  if (!auth.isStaff) return <Navigate to="/403" replace />
  if (access.status === 'anonymous' || access.status === 'loading') return admitted === key ? <Outlet /> : <AdminShell><Loading label="Đang kiểm tra quyền truy cập…" /></AdminShell>
  if (access.status === 'error') return <AdminShell><Notice title="Chưa tải được quyền truy cập" tone="error">{access.error} Vui lòng tải lại trang để thử lại.</Notice></AdminShell>
  if (!granted) return <AdminShell><Notice title="Bạn chưa được cấp quyền vào chức năng này" tone="warning"><p>Quyền truy cập được xác định theo tài khoản đăng nhập và phân quyền của hệ thống.</p><Link to={staffRoleHome(auth.user.roles) ?? '/403'}>Về khu chức năng của tôi</Link></Notice></AdminShell>
  return <Outlet />
}

export function CustomerGuard() {
  return <Navigate to="/booking/lookup" replace />
}
