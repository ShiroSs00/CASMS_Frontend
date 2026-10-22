import { Outlet } from 'react-router'
import { AdminAccountActions, useAuth } from '@/features/auth'
import { AdminAccountContext, AdminRoleContext } from '@/shared/ui/admin-v3'

export function AdminAccountLayout() {
  const {user}=useAuth()
  return <AdminRoleContext value={user?.roles ?? []}><AdminAccountContext value={<AdminAccountActions />}><Outlet /></AdminAccountContext></AdminRoleContext>
}
