import type { CruiseListItem } from './cruise-view'

/** Publication, plan approval, readiness and sale are independent backend facts. */
export function cruiseListProgress(item: CruiseListItem): string[] {
  if (['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(item.cruise.status)) return []
  const lines: string[] = []
  if (item.planStatus) lines.push('Hồ sơ: ' + ({ DRAFT: 'Đang lập kế hoạch', SUBMITTED: 'Chờ Quản lý vận hành xét duyệt', APPROVED: 'Đã được phê duyệt', REJECTED: 'Không được phê duyệt', REVISION_REQUESTED: 'Cần bổ sung theo phản hồi', WITHDRAWN: 'Đã rút để điều chỉnh' } as const)[item.planStatus])
  else lines.push('Chưa xác minh được tiến độ hồ sơ')
  if (item.readyStatus === 'READY') lines.push('Đã xác nhận sẵn sàng mở bán')
  if (item.readyStatus === 'INVALIDATED') lines.push('Điều kiện mở bán cần được đối chiếu lại')
  if (item.cruise.stoppedAt) lines.push('Đã dừng bán')
  else if (item.cruise.openedForSaleAt) lines.push('Đã thực hiện mở bán; kiểm tra điều kiện nhận đặt chỗ')
  return lines
}
