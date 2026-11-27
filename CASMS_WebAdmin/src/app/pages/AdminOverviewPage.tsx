import { Navigate } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { AdminShell, staffRoleHome } from '@/shared/ui/admin-v3'
import { Button, Notice, PageHeader } from '@/shared/ui'

export function AdminOverviewPage() {
  const access = useSessionAccess()
  const home = staffRoleHome(access.roles, access)
  return home ? <Navigate to={home} replace /> : <AdminShell>
    <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
      <PageHeader title="Tổng quan không gian làm việc" breadcrumb="OCEVIE / TỔNG QUAN" description="Các chức năng hiển thị theo vai trò được phân công cho tài khoản." />
      <Notice title="Tài khoản chưa được cấp quyền truy cập chức năng" tone="warning">
        <p>Liên hệ quản trị hệ thống để được cấp quyền phù hợp với công việc, sau đó thử tải lại quyền.</p>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Button tone="secondary" autoWidth onClick={access.retry}>Thử tải lại quyền</Button>
        </div>
      </Notice>
    </div>
  </AdminShell>
}
