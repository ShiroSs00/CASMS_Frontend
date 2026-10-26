import { Outlet } from 'react-router'
import { AdminAccountActions, useAuth } from '@/features/auth'
import { AdminAccountContext, AdminRoleContext } from '@/shared/ui/admin-v3'
import { useSessionAccess } from '@/shared/auth'

export function AdminAccountLayout() {
  const {user}=useAuth()
  const access = useSessionAccess()
  const roles = access.status === 'ready' && access.userId === user?.id ? access.roles : []
  return <AdminRoleContext value={roles}><AdminAccountContext value={<AdminAccountActions />}><Outlet key={user?.id ?? 'anonymous'} /></AdminAccountContext></AdminRoleContext>
}
