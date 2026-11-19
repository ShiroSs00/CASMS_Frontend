import { ApiError, apiRequest } from '@/shared/api'

export type Requirement = { serviceId: string; serviceName: string; required: number; assigned: number }
export type NeedInput = { areaId: string; positionCode: string; requiredCount: number }
export type Need = NeedInput & { needId: string; areaName: string; planRevision: number; assignedUserIds: string[] }
export type ReviewDetails = {
  request: StaffingRequest
  ship: { name: string; status: string; cabins: { cabinId: string; number: string; status: string }[] } | null
  areas: { areaId: string; name: string; terminals: Terminal[]; eligibleTerminals: Terminal[]; staffIds: string[] }[]
  terminalOptions: Terminal[]
  plannedServices: { serviceId: string; name: string; eligibleAreaIds: string[]; placements: { areaId: string; terminalId: string }[];
    proposal?: { deckName: string; note: string; status: 'PENDING' | 'CONFIRMED' | 'RETURNED' } | null }[]
  activities: { activityId: string; kind: string; name: string; staffIds: string[] }[]
  staff: { userId: string; username: string; role: string }[]
  positionOptions: string[]
  canReturnToAsm?: boolean
}
type Terminal = { terminalId: string; name: string }
export type StaffingAction = 'HR_SUBMITTED' | 'SHIP_CONFIRMED' | 'PLANNER_CONFIRMED' | 'OPS_APPROVED'
  | 'RETURNED' | 'SHIP_CHECKED' | 'SEND_TO_HR' | 'HR_RETURN_SHIP' | 'HR_APPROVED'
  | 'HR_RETURN_STAFF' | 'CRM_RETURN_HR' | 'CRM_RETURN_SHIP' | 'OPS_RETURN_CRM' | 'SHIP_RETURN_ASM'
export type StaffingRequest = {
  id: string; cruiseId: string; cruiseName: string; cruiseCode: string; departure: string; returning: string
  status: string; revision: number; requirements: Requirement[]
  operatingBudgetVnd?: string | null
  returnReason?: string | null
  workflowVersion?: 'LEGACY' | 'V2'
  shipReviewWorkflow?: boolean
  asmProgramWorkflow?: boolean
  activeAreaIds?: string[]
  needs?: Need[]
  shipPlanStale?: boolean
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
  cruisesWithoutShipManager: (signal: AbortSignal) =>
    apiRequest<Pick<StaffingRequest, 'cruiseId' | 'cruiseName' | 'cruiseCode'>[]>(path+'/ship-manager-needed', { signal }),
  detail: (id: string, signal: AbortSignal) => apiRequest<StaffingRequest>(path+'/'+encodeURIComponent(id), { signal }),
  workPlan: (id: string, signal: AbortSignal) => apiRequest<WorkPlan>(`/cruise/${encodeURIComponent(id)}/staff/work-plan`, { signal }),
  candidates: (id: string, kind: WorkPlan['windows'][number]['kind'], resourceId: string, signal: AbortSignal) =>
    apiRequest<Candidate[]>(`/cruise/${encodeURIComponent(id)}/staff/candidates?${new URLSearchParams({kind,resourceId})}`, {signal}),
  preparation: (id: string, signal: AbortSignal) => apiRequest<Preparation>(planPath(id), { signal }),
  send: (id: string, scheduleRevision: number) =>
    apiRequest<StaffingRequest>(planPath(id), { method:'POST', body:{scheduleRevision} }),
  reviewDetails: (id: string, signal: AbortSignal) =>
    apiRequest<ReviewDetails>(`${path}/${encodeURIComponent(id)}/review-details`, { signal }),
  saveShipPlan: (request: StaffingRequest, activeAreaIds: string[], needs: NeedInput[]) =>
    apiRequest<ReviewDetails>(`${path}/${encodeURIComponent(request.id)}/ship-plan`, {
      method: 'PUT', body: { expectedRevision: request.revision, activeAreaIds, needs },
    }),
  placePos: (request: StaffingRequest, areaId: string, terminalId: string) =>
    apiRequest<ReviewDetails>(`${path}/${encodeURIComponent(request.id)}/area-pos/${encodeURIComponent(areaId)}`, {
      method: 'PUT', body: { expectedRevision: request.revision, terminalId },
    }),
  placeService: (request: StaffingRequest, serviceId: string, areaId: string, terminalId: string) =>
    apiRequest<ReviewDetails>(`${path}/${encodeURIComponent(request.id)}/service-placements/${encodeURIComponent(serviceId)}`, {
      method: 'PUT', body: { expectedRevision: request.revision, areaId, terminalId },
    }),
  assignNeed: (request: StaffingRequest, needId: string, userId: string, assigned: boolean) =>
    apiRequest<StaffingRequest>(`${path}/${encodeURIComponent(request.id)}/needs/${encodeURIComponent(needId)}/assignments/${encodeURIComponent(userId)}`, {
      method: 'PUT', body: { expectedRevision: request.revision, assigned },
    }),
  transition: (request: StaffingRequest, action: StaffingAction, comment?: string) => apiRequest<StaffingRequest>(`${path}/${encodeURIComponent(request.id)}/${action}`, {
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
  STAFFING_CREW_SHORTAGE:'Còn khu vực, dịch vụ hoặc ca hoạt động thiếu người. Kiểm tra phân công trước khi gửi.',
  STAFFING_SHIP_PLAN_INCOMPLETE:'Kiểm tra tàu, POS, vị trí phục vụ và nhu cầu của từng khu vực mở.',
  STAFFING_SHIP_REVIEW_STALE:'Cấu hình phục vụ đã thay đổi. Trả yêu cầu để quản lý tàu kiểm tra lại.',
  STAFFING_SERVICE_POS_PERMISSION_REQUIRED:'Dịch vụ chưa được phép phục vụ tại khu vực và POS này.',
  STAFFING_NEED_ASSIGNMENT_INVALID:'Nhân viên chưa đủ điều kiện, đã được bố trí cho vị trí khác hoặc vị trí đã đủ người.',
  STAFF_WORK_TIME_CONFLICT:'Nhân viên đã có ca trùng giờ. Hãy chọn người khác.',
  STAFF_QUALIFICATION_REQUIRED:'Nhân viên chưa có năng lực đã đăng ký cho ca này.',
  SERVICE_NOT_AVAILABLE_ON_SHIP:'Dịch vụ này hiện không khả dụng trên tàu.',
}
export function staffingError(error: unknown) {
  return error instanceof ApiError && error.code && errors[error.code]
    || (error instanceof Error ? error.message : 'Chưa hoàn tất thao tác. Tải lại để kiểm tra.')
}

export const staffingStatus: Record<string,string> = {
  PENDING_ASM:'Chờ Quản lý dịch vụ hoàn tất chương trình', PENDING_SHIP_REVIEW:'Chờ Quản lý tàu chuẩn bị',
  SHIP_REVIEWED:'Chờ Quản lý lịch trình gửi nhân sự', HR_APPROVED:'Chờ Quản lý vận hành duyệt',
  SENT_TO_HR:'Chờ Quản lý nhân sự phân công', HR_SUBMITTED:'Chờ Quản lý tàu xác nhận',
  SHIP_CONFIRMED:'Chờ Quản lý lịch trình xác nhận', PLANNER_CONFIRMED:'Chờ Quản lý vận hành duyệt',
  OPS_APPROVED:'Đã duyệt', RETURNED:'Đã trả lại', CANCELLED:'Đã hủy',
}

export function staffingStatusLabel(request: StaffingRequest) {
  if (request.workflowVersion === 'V2' && request.status === 'HR_SUBMITTED') return 'Chờ Quản lý lịch trình kiểm tra'
  if (request.shipReviewWorkflow && request.status === 'SHIP_CONFIRMED') return 'Chờ Quản lý nhân sự duyệt'
  return staffingStatus[request.status] ?? 'Trạng thái chưa xác định'
}

export function staffingMissing(request: StaffingRequest) {
  return request.workflowVersion === 'V2'
    ? (request.needs ?? []).reduce((sum, need) => sum + Math.max(0, need.requiredCount - need.assignedUserIds.length), 0)
    : request.requirements.reduce((sum, item) => sum + Math.max(0, item.required - item.assigned), 0)
}

export const positionLabels: Record<string, string> = {
  ONBOARD_STAFF: 'Nhân viên phục vụ trên tàu',
  SHIP_MANAGER: 'Quản lý tàu',
  FINANCE_OFFICER: 'Nhân viên tài chính',
}

export const staffingShipStatusLabels: Record<string, string> = {
  DRAFT: 'Đang thiết lập',
  READY: 'Sẵn sàng hoạt động',
  IN_SERVICE: 'Đang hoạt động',
  MAINTENANCE: 'Đang bảo trì',
  SUSPENDED: 'Tạm dừng hoạt động',
  RETIRED: 'Đã ngừng hoạt động',
}

export const staffingCabinStatusLabels: Record<string, string> = {
  AVAILABLE: 'Sẵn sàng',
  OCCUPIED: 'Đang có khách',
  MAINTENANCE: 'Bảo trì',
  OUT_OF_SERVICE: 'Ngừng phục vụ',
}
