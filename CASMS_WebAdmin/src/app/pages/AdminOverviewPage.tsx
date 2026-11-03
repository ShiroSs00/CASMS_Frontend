import { Navigate } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { AdminShell, staffRoleHome } from '@/shared/ui/admin-v3'
import { Notice } from '@/shared/ui'

export function AdminOverviewPage() {
  const access = useSessionAccess()
  const home = staffRoleHome(access.roles,access)
  return home ? <Navigate to={home} replace /> : <AdminShell><Notice title="Tài khoản chưa được cấp quyền truy cập chức năng">Liên hệ người quản trị để được cấp quyền phù hợp với công việc.</Notice></AdminShell>
}
