import type { PreparationSection } from '../api/preparation-api'

export function preparationProgress(section: PreparationSection) {
  if (section.approvalStatus === 'STALE') return { label: 'Cần đối chiếu lại dữ liệu', tone: 'warning' as const, next: 'Người phụ trách đối chiếu thay đổi trước khi gửi lại để xác nhận.' }
  if (section.approvalStatus === 'CONFIRMED') return { label: 'Đã được xác nhận', tone: 'success' as const, next: 'Theo dõi thay đổi dữ liệu; kết quả này không thay thế các điều kiện khác của chuyến.' }
  if (section.approvalStatus === 'REJECTED') return { label: 'Hồ sơ không được chấp thuận', tone: 'error' as const, next: 'Đọc lý do từ chối và đối chiếu với người phụ trách trước khi xử lý tiếp.' }
  if (section.approvalStatus === 'RETURNED') return { label: 'Được yêu cầu bổ sung', tone: 'warning' as const, next: 'Người phụ trách bổ sung theo phản hồi rồi gửi lại xét duyệt.' }
  if (section.status === 'SUBMITTED') return { label: 'Chờ Quản lý vận hành xét duyệt', tone: 'info' as const }
  return { label: 'Đang chuẩn bị hồ sơ', tone: 'neutral' as const }
}

/** Eligibility for this actor is separate from data readiness and request failure. */
export function preparationSubmissionReason(section: PreparationSection): string | null {
  switch (section.submissionBlockReason) {
    case 'SECTION_SUBMITTER_ROLE_REQUIRED': return section.sectionCode === 'TECHNICAL_NAUTICAL'
      ? 'Quản lý tàu được phân công nộp nhóm xác nhận này.' : 'Điều phối Quản lý lịch trình của chuyến nộp nhóm hồ sơ này.'
    case 'ASSIGNED_SHIP_MANAGER_REQUIRED': return 'Tài khoản hiện tại chưa được phân công làm Quản lý tàu của chuyến.'
    case 'PREPARATION_COORDINATOR_REQUIRED': return 'Chỉ điều phối Quản lý lịch trình được phân công cho chuyến mới có thể nộp nhóm hồ sơ này.'
    case 'SUBMIT_PERMISSION_REQUIRED': return 'Tài khoản hiện tại không có quyền nộp nhóm hồ sơ này.'
    default: return section.submissionBlockReason ? 'Chưa xác minh được điều kiện nộp của tài khoản hiện tại. Tải lại hồ sơ để đối chiếu.' : null
  }
}
