import type { ReactNode } from 'react'
import { ApiError } from '@/shared/api'
import { Badge, Button, Notice } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { statusLabels, type ExcursionStatus } from '../model/shore-excursion'
import styles from './ShoreExcursions.module.css'

const backendMessages: Record<string, string> = {
  'Supplier is not active.': 'Nhà cung cấp hiện không hoạt động.',
  'Supplier must be verified before use.': 'Nhà cung cấp phải được xác minh trước khi sử dụng.',
  'Cruise stop not found.': 'Không tìm thấy điểm dừng.',
  'Return time must be after start time.': 'Thời gian trở về phải sau thời gian bắt đầu.',
  'Minimum participants must be between 1 and maximum capacity.': 'Số khách tối thiểu phải từ 1 đến sức chứa tối đa.',
  'Excursion cannot start before cruise stop arrival.': 'Chuyến tham quan không thể bắt đầu trước khi tàu đến điểm dừng.',
  'Excursion must return before all-aboard/departure time.': 'Chuyến tham quan phải trở về trước giờ tập trung lên tàu hoặc giờ rời cảng.',
  'Planned return time must be before all-aboard time.': 'Thời gian trở về phải trước giờ tập trung lên tàu.',
  'Excursion schedule overlaps another excursion at the same cruise stop.': 'Lịch chuyến tham quan trùng với một chuyến khác tại cùng điểm dừng.',
  'Excursion starts too soon after arrival for tender transfer.': 'Thời gian bắt đầu chưa đủ cho việc trung chuyển từ tàu vào bờ.',
  'Excursion code already exists at this cruise stop.': 'Mã chuyến tham quan đã tồn tại tại điểm dừng này.',
  'Cannot delete an excursion with registrations.': 'Không thể xóa chuyến tham quan đã có đăng ký.',
  'Only PLANNED excursions can be deleted.': 'Chỉ có thể xóa chuyến tham quan đang lên kế hoạch.',
  'Only OPEN or FULL excursions can be closed.': 'Chỉ có thể đóng đăng ký khi chuyến tham quan đang mở hoặc đủ khách.',
  'Only OPEN or FULL excursions can start.': 'Chỉ có thể bắt đầu chuyến tham quan đang mở đăng ký hoặc đủ khách.',
  'Current time is outside the excursion time window.': 'Thời điểm hiện tại nằm ngoài khoảng thời gian diễn ra chuyến tham quan.',
  'Completed or cancelled excursion cannot be cancelled.': 'Không thể hủy chuyến tham quan đã hoàn thành hoặc đã hủy.',
  'Cancellation reason is required.': 'Vui lòng nhập lý do hủy.',
  'Internal server error': 'Máy chủ chưa thể xử lý yêu cầu. Vui lòng thử lại sau.',
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Đã xảy ra lỗi. Vui lòng thử lại.'
  if (backendMessages[error.message]) return backendMessages[error.message]
  if (error.message.startsWith('Shore excursion not found:')) return 'Không tìm thấy chuyến tham quan.'
  if (error.message.startsWith('Supplier not found:')) return 'Không tìm thấy nhà cung cấp.'
  if (error.message.startsWith('Excursion cannot be edited in status') || error.message.startsWith('Expected status')) return 'Trạng thái hiện tại không cho phép thao tác này. Vui lòng tải lại chi tiết chuyến tham quan.'
  if (error.message.startsWith('Excursion is unavailable or has insufficient capacity.')) return 'Chuyến tham quan chưa mở đăng ký hoặc không đủ chỗ cho số khách yêu cầu.'
  return error.message
}

export function ShoreLayout({ children }: { children: ReactNode }) {
  return <AdminShell><div className={styles.page}>{children}</div></AdminShell>
}
export function ShoreError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = error instanceof ApiError ? error.status : undefined
  return <Notice tone="error" title={status === 403 ? 'Bạn không có quyền thực hiện thao tác này' : status === 401 ? 'Phiên đăng nhập không hợp lệ' : status === 404 ? 'Không tìm thấy chuyến tham quan' : 'Không thể thực hiện yêu cầu'}>
    <p>{errorMessage(error)}</p>
    {status !== undefined && <p>{status ? `HTTP ${status}` : 'Lỗi kết nối hoặc dữ liệu yêu cầu'}</p>}
    {status === 403 && <p>Liên hệ quản trị viên để kiểm tra quyền truy cập chuyến tham quan bờ.</p>}
    {onRetry && <Button tone="secondary" onClick={onRetry}>Thử lại</Button>}
  </Notice>
}
export function ExcursionBadge({ status }: { status: ExcursionStatus }) {
  return <Badge label={statusLabels[status]} tone={status === 'CANCELLED' ? 'error' : status === 'COMPLETED' ? 'success' : 'neutral'} />
}
