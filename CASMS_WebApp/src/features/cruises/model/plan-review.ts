import type { useSessionAccess } from '@/shared/auth'
import type { MainflowAction, PlanView } from '../api/mainflow-api'

export const planReviewStates = {
  DRAFT: { title: 'Chưa gửi phê duyệt', description: 'Hoàn thiện các thông tin còn thiếu, sau đó gửi kế hoạch cho Quản lý vận hành (OPS) xét duyệt.', tone: 'neutral' },
  WITHDRAWN: { title: 'Đã rút kế hoạch', description: 'Kiểm tra các thay đổi và gửi lại kế hoạch cho OPS khi hoàn tất.', tone: 'neutral' },
  SUBMITTED: { title: 'Đã gửi · Chờ OPS phê duyệt', description: 'Kế hoạch đã được gửi đến Quản lý vận hành (OPS). Theo dõi kết quả xét duyệt tại đây.', tone: 'info' },
  APPROVED: { title: 'OPS đã phê duyệt kế hoạch', description: 'Kế hoạch đã được duyệt. OPS tiếp tục đối chiếu chính sách giá và điều kiện sẵn sàng trước khi xác nhận mở bán.', tone: 'success' },
  REJECTED: { title: 'Kế hoạch không được phê duyệt', description: 'Xem lý do phản hồi từ OPS bên dưới để xử lý bước tiếp theo.', tone: 'error' },
  REVISION_REQUESTED: { title: 'OPS yêu cầu bổ sung', description: 'Cập nhật kế hoạch theo phản hồi bên dưới, sau đó gửi lại cho OPS xét duyệt.', tone: 'warning' },
} as const

export function planReviewActions(data: PlanView, access: ReturnType<typeof useSessionAccess>): MainflowAction[] {
  const crm=access.roles.includes('CRUISE_MANAGER')&&access.canDo('CRUISE_UPDATE_DRAFT')
  const ops=access.roles.includes('OPERATIONS_MANAGER')&&access.canDo('ITINERARY_APPROVE')
  return (['submit','withdraw','approve','reject','request-revision','ready'] as const).filter(action=>
    data.allowedActions.includes(action==='ready'?'SET_READY':action.toUpperCase().replace('-','_'))
    && (action==='ready'?access.roles.includes('OPERATIONS_MANAGER')&&access.canDo('CRUISE_VALIDATE'):action==='submit'||action==='withdraw'?crm:ops)
    && (action!=='approve'||data.submittedBy!==access.userId&&data.planBlockers.length===0))
}
