import { Outlet } from 'react-router'
import { AdminAccountActions } from '@/features/auth'
import { AdminAccountContext } from '@/shared/ui/admin-v3'

export function AdminAccountLayout() {
  return <AdminAccountContext value={<AdminAccountActions />}><Outlet /></AdminAccountContext>
}
