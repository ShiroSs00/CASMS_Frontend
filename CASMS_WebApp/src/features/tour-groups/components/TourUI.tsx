import type { ReactNode } from 'react'
import { ApiError } from '@/shared/api'
import { Badge, Button, Notice } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { groupStatusLabels, type GroupStatus } from '../model/tour-group'
import styles from './TourGroups.module.css'

const messages: Record<string, string> = {
  'Only ASSIGNED passengers can be moved': 'Chỉ có thể chuyển hành khách đang ở trạng thái đã phân công.',
  'Only ASSIGNED records can be cancelled': 'Chỉ có thể gỡ phân công chưa điểm danh khởi hành.',
  'Only ASSIGNED passengers can be checked in': 'Chỉ có thể điểm danh khởi hành cho hành khách đang ở trạng thái đã phân công.',
  'Passenger check-in requires the group to be ASSEMBLING': 'Nhóm phải đang tập trung để điểm danh khởi hành.',
  'Only CHECKED_IN passengers can be marked COMPLETED': 'Hành khách cần được điểm danh khởi hành trước khi ghi nhận trở về.',
  'The group must have departed before passenger return is recorded': 'Nhóm phải khởi hành trước khi ghi nhận hành khách trở về.',
  'Passenger assignment requires a PLANNED or ASSEMBLING group': 'Nhóm phải đang lên kế hoạch hoặc đang tập trung để phân công hành khách.',
  'Shore excursion must be OPEN to assign passengers': 'Chuyến tham quan phải đang mở để phân công hành khách.',
  'Passenger must have a CONFIRMED registration for this shore excursion': 'Hành khách cần có đăng ký đã xác nhận cho chuyến tham quan này.',
  'Passenger already has an active assignment in this group': 'Hành khách đã có phân công còn hiệu lực trong nhóm này.',
  'Passenger already has an active assignment in the target group': 'Hành khách đã có phân công còn hiệu lực trong nhóm đích.',
  'Passenger can only move between groups of the same shore excursion': 'Chỉ có thể chuyển giữa các nhóm của cùng chuyến tham quan.',
  'Target group must differ from the current group': 'Nhóm đích phải khác nhóm hiện tại.',
  'Target tour group ID is required': 'Vui lòng nhập ID nhóm đích.',
  'Tour group has reached maximum capacity': 'Nhóm đã đạt sức chứa tối đa.',
  'Shore excursion has reached maximum capacity': 'Chuyến tham quan đã đạt sức chứa tối đa.',
  'Only PLANNED groups can be updated.': 'Chỉ có thể chỉnh sửa nhóm đang lên kế hoạch.',
  'Passenger not found.': 'Không tìm thấy hành khách.', 'Passenger assignment not found.': 'Không tìm thấy phân công hành khách trong nhóm.',
  'Passenger must have a CONFIRMED registration for this shore excursion.': 'Hành khách cần có đăng ký đã xác nhận cho chuyến tham quan này.',
  'Passenger is already assigned to a group for this excursion.': 'Hành khách đã được phân vào một nhóm của chuyến tham quan này.',
  'Guide ID is required.': 'Vui lòng nhập ID hướng dẫn viên.',
  'Guide has another group scheduled during this time.': 'Hướng dẫn viên có lịch trùng với nhóm khác trong khoảng thời gian này.',
  'Excursion not found.': 'Không tìm thấy chuyến tham quan.',
  'Cannot create or prepare a group for this excursion.': 'Trạng thái chuyến tham quan hiện không cho phép tạo hoặc chuẩn bị nhóm.',
  'Group code already exists for this excursion.': 'Mã nhóm đã tồn tại trong chuyến tham quan này.',
  'Group capacity cannot exceed excursion capacity.': 'Sức chứa nhóm không được vượt sức chứa chuyến tham quan.',
  'Tour group has reached its maximum capacity.': 'Nhóm đã đạt sức chứa tối đa.',
  'Assigned passengers exceed excursion capacity.': 'Số hành khách được phân công vượt sức chứa chuyến tham quan.',
  'Meeting point is required.': 'Vui lòng nhập điểm tập trung.',
  'Planned return time must be after departure time.': 'Thời gian trở về dự kiến phải sau giờ khởi hành.',
  'Assembly time must not be after departure time.': 'Giờ tập trung không được sau giờ khởi hành.',
  'Group departure cannot be before excursion start time.': 'Giờ khởi hành nhóm không được trước giờ bắt đầu chuyến tham quan.',
  'Group return cannot be after excursion return time.': 'Giờ trở về của nhóm không được sau giờ trở về chuyến tham quan.',
  'A guide must be assigned before confirming the group.': 'Cần phân công hướng dẫn viên trước khi xác nhận nhóm.',
  'Meeting point and group schedule must be completed.': 'Cần hoàn thiện điểm tập trung và lịch trình của nhóm.',
  'This group cannot be cancelled in its current status.': 'Trạng thái hiện tại không cho phép hủy nhóm.',
  'Cannot start a group without assigned passengers.': 'Chưa thể khởi hành khi nhóm chưa có hành khách được phân công.',
  'Cannot depart before planned departure time.': 'Chưa đến giờ khởi hành dự kiến.',
  'Return time cannot be before departure time.': 'Thời gian trở về không được trước giờ khởi hành.',
  'Cancellation reason is required.': 'Vui lòng nhập lý do hủy.',
  'Internal server error': 'Máy chủ chưa thể xử lý yêu cầu. Vui lòng thử lại sau.',
}
function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Đã xảy ra lỗi. Vui lòng thử lại.'
  if (messages[error.message]) return messages[error.message]
  if (error.message.startsWith('Tour group not found:')) return 'Không tìm thấy nhóm tour.'
  if (error.message.startsWith('Tour group passenger assignment not found:')) return 'Không tìm thấy phân công hành khách.'
  if (error.message.startsWith('Passenger not found:')) return 'Không tìm thấy hành khách.'
  if (error.message.startsWith('Shore excursion not found:')) return 'Không tìm thấy chuyến tham quan trong ngữ cảnh nhóm tour.'
  if (error.message.startsWith('Expected status')) return 'Trạng thái hiện tại không cho phép thao tác này. Vui lòng tải lại nhóm tour.'
  return error.message
}
export function TourLayout({ children }: { children: ReactNode }) { return <AdminShell><div className={styles.page}>{children}</div></AdminShell> }
export function TourError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = error instanceof ApiError ? error.status : undefined
  return <Notice tone="error" title={status === 403 ? 'Bạn không có quyền thực hiện thao tác này' : status === 401 ? 'Phiên đăng nhập không hợp lệ' : status === 404 ? 'Không tìm thấy dữ liệu' : 'Không thể thực hiện yêu cầu'}>
    <p>{errorMessage(error)}</p>{status !== undefined && <p>{status ? `HTTP ${status}` : 'Lỗi kết nối hoặc dữ liệu yêu cầu'}</p>}
    {status === 403 && <p>Liên hệ quản trị viên để kiểm tra quyền truy cập nhóm tour.</p>}
    {onRetry && <Button tone="secondary" onClick={onRetry}>Thử lại</Button>}
  </Notice>
}
export function GroupBadge({ status }: { status: GroupStatus }) { return <Badge label={groupStatusLabels[status]} tone={status === 'CANCELLED' ? 'error' : status === 'RETURNED' ? 'success' : 'neutral'} /> }
