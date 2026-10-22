import { useContext, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { ApiError } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Loading, Notice } from '@/shared/ui'
import { AdminRoleContext, AdminShell, canRoleOpenAdminPath } from '@/shared/ui/admin-v3'
import { catalogConfig } from '../model/catalog'
import styles from './Catalog.module.css'
export function CatalogFrame({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const roles=useContext(AdminRoleContext)
  const access=useSessionAccess()
  const entries = [...Object.values(catalogConfig), { label: 'Yêu cầu dịch vụ', route: '/admin/service-requests' }].filter(item=>canRoleOpenAdminPath(roles,item.route,'',access))
  return <AdminShell><div className={styles.content}><nav className={styles.navigation} aria-label="Danh mục dịch vụ tàu">{entries.map(item => <Link key={item.route} to={item.route} aria-current={pathname === item.route || pathname.startsWith(item.route + '/') ? 'page' : undefined}>{item.label}</Link>)}</nav>{children}</div></AdminShell>
}
export function CatalogState({ loading, error, retry }: { loading: boolean; error: Error | null; retry: () => void }) {
  if (loading) return <Loading label="Đang tải dữ liệu dịch vụ…" />
  return error ? <Notice title={error instanceof ApiError && error.status === 403 ? 'Bạn chưa có quyền xem thông tin này' : 'Không tải được dữ liệu dịch vụ'} tone="error"><p>{error instanceof ApiError && error.status === 400 && error.message.includes('evaluate expression') ? 'Hệ thống đang gặp lỗi kiểm tra quyền dịch vụ. Vui lòng liên hệ quản trị viên.' : error.message}</p><Button onClick={retry}>Thử lại</Button></Notice> : null
}
