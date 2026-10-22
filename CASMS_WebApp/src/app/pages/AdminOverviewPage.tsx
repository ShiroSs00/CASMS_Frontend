import { Navigate } from 'react-router'
import { useAuth } from '@/features/auth'
import { staffRoleHome } from '@/shared/ui/admin-v3'

/** Every login lands in its role's function, never the four-department picker. */
export function AdminOverviewPage() {
  const {user}=useAuth()
  return <Navigate to={staffRoleHome(user?.roles ?? []) ?? '/403'} replace />
}
