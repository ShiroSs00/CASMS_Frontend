import { ApiError, apiRequest } from '@/shared/api'

export type Requirement = { serviceId: string; serviceName: string; required: number; assigned: number }
export type StaffingRequest = {
  id: string; cruiseId: string; cruiseName: string; cruiseCode: string; departure: string; returning: string
  status: string; revision: number; requirements: Requirement[]
  operatingBudgetVnd?: string | null
  returnReason?: string | null
}
export type WorkPlan = {
  windows: { windowId: string; resourceId: string; definitionId: string; kind: 'SERVICE'|'ONBOARD'|'SHORE';
    name: string; startsAt: string; endsAt: string; userIds: string[] }[]
  serviceAssignments: { userId: string; serviceId: string; serviceName: string }[]
}
type CandidateStatus = 'AVAILABLE'|'ALREADY_ASSIGNED'|'MISSING_QUALIFICATION'|'SCHEDULE_CONFLICT'
type Candidate = {userId: string; username: string; status: CandidateStatus}
export const candidateStatusCopy: Record<CandidateStatus,string> = {
  AVAILABLE:'Có thể phân công',
  ALREADY_ASSIGNED:'Đã được phân công',
  MISSING_QUALIFICATION:'Thiếu năng lực cho ca này',
  SCHEDULE_CONFLICT:'Trùng lịch',
}
type Preparation = {
  scheduleRevision: number; request: StaffingRequest | null; services: { id: string; name: string }[]
  hasOperatingBudget: boolean
}
const path = '/cruises/staffing-requests'
const planPath = (id: string) => `/cruises/${encodeURIComponent(id)}/staffing-requests`
const staffPath = (cruise: string, user: string) => `/cruise/${encodeURIComponent(cruise)}/staff/${encodeURIComponent(user)}`
export const staffingApi = {
  inbox: (signal: AbortSignal) => apiRequest<StaffingRequest[]>(path+'/inbox', { signal }),
  detail: (id: string, signal: AbortSignal) => apiRequest<StaffingRequest>(path+'/'+encodeURIComponent(id), { signal }),
  workPlan: (id: string, signal: AbortSignal) => apiRequest<WorkPlan>(`/cruise/${encodeURIComponent(id)}/staff/work-plan`, { signal }),
  candidates: (id: string, kind: WorkPlan['windows'][number]['kind'], resourceId: string, signal: AbortSignal) =>
    apiRequest<Candidate[]>(`/cruise/${encodeURIComponent(id)}/staff/candidates?${new URLSearchParams({kind,resourceId})}`, {signal}),
  preparation: (id: string, signal: AbortSignal) => apiRequest<Preparation>(planPath(id), { signal }),
  send: (id: string, scheduleRevision: number, requirements: {serviceId: string; requiredCount: number}[]) =>
    apiRequest<StaffingRequest>(planPath(id), { method:'POST', body:{scheduleRevision,requirements} }),
  transition: (request: StaffingRequest, action: 'HR_SUBMITTED'|'SHIP_CONFIRMED'|'PLANNER_CONFIRMED'|'OPS_APPROVED'|'RETURNED', comment?: string) => apiRequest<StaffingRequest>(`${path}/${encodeURIComponent(request.id)}/${action}`, {
    method:'POST', body:{expectedRevision:request.revision,comment},
  }),
  assignService: (cruise: string, user: string, serviceId: string) =>
    apiRequest<void>(staffPath(cruise,user)+'/service', {method:'PUT',body:{serviceId}}),
  assignShift: (cruise: string, user: string, kind: 'ONBOARD'|'SHORE', occurrence: string) =>
    apiRequest<void>(`${staffPath(cruise,user)}/activity-shifts/${kind}/${encodeURIComponent(occurrence)}`, {method:'PUT'}),
  grantQualification: (user: string, kind: 'ONBOARD'|'SHORE', definitionId: string) =>
    apiRequest<void>(`/staff/${encodeURIComponent(user)}/activity-qualifications/${kind}/${encodeURIComponent(definitionId)}`, {method:'PUT'}),
}

const errors: Record<string,string> = {
  PREPARATION_BUDGET_REQUIRED:'Lưu ngân sách vận hành dự kiến trước khi gửi yêu cầu nhân sự.',
  STAFFING_REVISION_CONFLICT:'Yêu cầu đã được cập nhật. Tải lại trước khi gửi.',
  STAFFING_SOURCE_REVISION_STALE:'Tour đã thay đổi. Tải lại yêu cầu trước khi gửi.',
  STAFFING_OPEN_REQUEST_EXISTS:'Tour đã có yêu cầu nhân sự đang xử lý.',
  STAFFING_CREW_SHORTAGE:'Còn dịch vụ thiếu người. Bố trí đủ người trước khi gửi phương án.',
  STAFF_WORK_TIME_CONFLICT:'Nhân viên đã có ca trùng giờ. Hãy chọn người khác.',
  STAFF_QUALIFICATION_REQUIRED:'Nhân viên chưa có năng lực đã đăng ký cho ca này.',
  SERVICE_NOT_AVAILABLE_ON_SHIP:'Dịch vụ này hiện không khả dụng trên tàu.',
}
export function staffingError(error: unknown) {
  return error instanceof ApiError && error.code && errors[error.code]
    || (error instanceof Error ? error.message : 'Chưa hoàn tất thao tác. Tải lại để kiểm tra.')
}

export const staffingStatus: Record<string,string> = {
  SENT_TO_HR:'Chờ Nhân sự phân công', HR_SUBMITTED:'Chờ Quản lý tàu xác nhận',
  SHIP_CONFIRMED:'Chờ Quản lý lịch trình xác nhận', PLANNER_CONFIRMED:'Chờ Vận hành duyệt',
  OPS_APPROVED:'Đã duyệt', RETURNED:'Đã trả lại', CANCELLED:'Đã hủy',
}
