import { useSessionAccess } from '@/shared/auth'
import { AdminShell, canEnterWorkspace, workspaceForPath, canRoleOpenAdminPath, staffRoleHome } from '@/shared/ui/admin-v3'
import { BrandLogo, Button, ButtonLink, Loading, Notice, PageHeader } from '@/shared/ui'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'
import { safeAdminReturnTo, safeCustomerReturnTo } from './model/auth-types'
import styles from './components/Auth.module.css'

export function SessionBoundary() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') return <div className={styles.loading}><BrandLogo /><Loading label="Đang khôi phục phiên đăng nhập…" /></div>
  if (auth.status === 'expired' && location.pathname.startsWith('/admin')) {
    const query = new URLSearchParams({ reason: 'expired' })
    const returnTo = safeAdminReturnTo(`${location.pathname}${location.search}${location.hash}`) ?? safeCustomerReturnTo(`${location.pathname}${location.search}${location.hash}`)
    if (returnTo) query.set('returnTo', returnTo)
    return <Navigate to={`/login?${query}`} replace />
  }
  return <Outlet />
}

export function AdminGuard() {
  const auth = useAuth(), access = useSessionAccess(), location = useLocation()
  const workspace = location.pathname.startsWith('/admin/workspaces/') ? workspaceForPath(location.pathname) : undefined
  if (!auth.user) return <Navigate to={`/login?${new URLSearchParams({ returnTo: `${location.pathname}${location.search}${location.hash}` })}`} replace />
  if (!auth.isStaff) return <Navigate to="/403" replace />
  if (access.status === 'anonymous' || access.status === 'loading') return <AdminShell><Loading label="Đang kiểm tra quyền truy cập…" /></AdminShell>
  if (access.status === 'error') return <AdminShell><Notice title="Chưa tải được quyền truy cập" tone="error"><p>{access.error}</p><Button onClick={access.retry}>Thử lại</Button></Notice></AdminShell>
  const granted = access.userId === auth.user.id && canRoleOpenAdminPath(auth.user.roles,location.pathname,location.search,access) && (!workspace || canEnterWorkspace(workspace,access))
  if (!granted) {
    const home = staffRoleHome(auth.user.roles,access)
    return <AdminShell><PageHeader breadcrumb="OCEVIE / 403" title="Bạn không có quyền truy cập" description={home ? 'Tài khoản chưa được cấp quyền sử dụng chức năng này.' : 'Tài khoản chưa được cấp quyền truy cập chức năng.'} actions={home ? <ButtonLink to={home}>Về chức năng được phép</ButtonLink> : undefined} /></AdminShell>
  }
  return <Outlet />
}

export function CustomerGuard() {
  return <Navigate to="/booking/lookup" replace />
}
