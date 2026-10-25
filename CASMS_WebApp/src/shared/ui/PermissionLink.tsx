import { useContext } from 'react'
import { Link, useResolvedPath, type LinkProps } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { AdminRoleContext } from './admin-v3/admin-account-context'
import { canRoleOpenAdminPath } from './admin-v3/admin-navigation'

/** Protected links use the same route requirements as the guard. */
export function PermissionLink({ hideWhenDenied = true, children, ...props }: LinkProps & { hideWhenDenied?: boolean }) {
  const access = useSessionAccess(), roles = useContext(AdminRoleContext)
  const resolved = useResolvedPath(props.to)
  const target = resolved.pathname
  if (target === '/admin' || target.startsWith('/admin/')) {
    if (!canRoleOpenAdminPath(roles,target,resolved.search,access)) return hideWhenDenied ? null : <span className={props.className}>{children}</span>
  }
  return <Link {...props}>{children}</Link>
}
