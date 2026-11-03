import type { ReactNode } from 'react'
import { ApiError } from '@/shared/api'
import { Button, Loading, Notice } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import styles from './Activities.module.css'
export function ActivityFrame({ children }: { children: ReactNode }) { return <AdminShell><div className={styles.content}>{children}</div></AdminShell> }
export function ActivityState({ loading, error, retry }: { loading: boolean; error: Error | null; retry: () => void }) {
  if (loading) return <Loading label="Đang tải hoạt động…" />
  return error ? <Notice title={error instanceof ApiError && error.status === 403 ? 'Bạn chưa có quyền xem hoạt động' : 'Không tải được hoạt động'} tone="error"><p>{error instanceof ApiError && error.status === 400 && error.message.includes('evaluate expression') ? 'Hệ thống đang gặp lỗi kiểm tra quyền hoạt động. Vui lòng liên hệ quản trị viên.' : error.message}</p><Button onClick={retry}>Thử lại</Button></Notice> : null
}
