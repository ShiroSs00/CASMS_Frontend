import type { PlanView } from '../api/mainflow-api'

export function planConditionTitle(manager: boolean, status: PlanView['planStatus']): string {
  if (status === 'SUBMITTED') return manager ? 'Hồ sơ đã gửi: các mục cần đối chiếu' : 'Cần xử lý trước khi phê duyệt'
  if (status === 'APPROVED') return 'Hồ sơ đã duyệt: các mục cần đối chiếu lại'
  return manager ? 'Cần xử lý trước khi gửi hồ sơ' : 'Hồ sơ cần được bổ sung để xét duyệt'
}

export function planConditionMessage(code: string, manager: boolean, status: PlanView['planStatus'] = 'DRAFT'): string | null {
  const submitted = status === 'SUBMITTED' || status === 'APPROVED'
  if (manager && submitted && code === 'SALE_TERMS_REQUIRED') return 'Hồ sơ đã gửi còn thiếu cấu hình thuế và phí cảng. Đối chiếu với Quản lý vận hành phụ trách cấu hình; nếu cần sửa hồ sơ, chờ yêu cầu chỉnh sửa theo quy trình xét duyệt.'
  if (manager && submitted && code === 'FARE_PLAN_SELECTION_REQUIRED') return 'Hồ sơ đã gửi còn thiếu lựa chọn gói du thuyền. Quản lý lịch trình bổ sung khi hồ sơ được mở lại theo yêu cầu chỉnh sửa của Quản lý vận hành.'
  if (!manager && submitted && code === 'SALE_TERMS_REQUIRED') return 'Hồ sơ thiếu cấu hình thuế và phí cảng. Dùng Yêu cầu chỉnh sửa khi được cấp quyền để mở lại hồ sơ; Quản lý vận hành phụ trách cấu hình bổ sung tại mục Điều kiện thương mại mở bán. Người lập không tự xét duyệt hồ sơ của mình.'
  if (code === 'SALE_TERMS_REQUIRED') return manager
    ? 'Quản lý vận hành phụ trách cấu hình thuế và phí cảng. Kiểm tra kết quả cấu hình trước khi gửi hồ sơ.'
    : 'Hồ sơ thiếu cấu hình thuế và phí cảng. Đối chiếu mục Điều kiện thương mại mở bán; người có quyền cấu hình thuộc Quản lý vận hành xử lý phần còn thiếu. Người lập không tự xét duyệt hồ sơ của mình.'
  if (code === 'FARE_PLAN_SELECTION_REQUIRED') return manager
    ? 'Chọn một gói du thuyền đủ điều kiện để đưa vào hồ sơ gửi duyệt.'
    : 'Quản lý lịch trình cần bổ sung lựa chọn gói du thuyền vào hồ sơ. Nếu hồ sơ đang khóa, dùng thao tác Yêu cầu chỉnh sửa khi được cấp quyền.'
  return null
}
