import type { PlanView } from '../api/mainflow-api'
import {planEvidence} from './plan-evidence'
import type {DepartureSection} from './preparation'

/** Route each blocker to its actual task without changing the server's decision. */
export function operationsConditionTarget(code:string):DepartureSection|'review'|null {
 if(code==='ELIGIBLE_FARE_OFFER_REQUIRED'||code==='CRUISE_PACKAGE_SELECTION_INELIGIBLE'||code.startsWith('FARE_')||code.startsWith('CABIN_MAPPING_')||code.startsWith('CABIN_CATEGORY_'))return 'fare-packages'
 if(['PORT_TIMEZONE_CHANGED','PORT_SNAPSHOT_UNAVAILABLE','PORT_NOT_ACTIVE','INVALID_PORT_CALL_TIME','INVALID_PORT_TIMEZONE'].includes(code))return 'schedule'
 if(code.startsWith('SALE_')||code==='UNIFIED_PLAN_REVIEW_REQUIRED')return 'review'
 if(code==='GUIDANCE_BEFORE_BOOKING_CLOSE')return 'review'
 if(['PLAN_APPROVAL_REQUIRED','PRICING_APPROVER_UNRESOLVED','PRICING_POLICY_APPROVAL_REQUIRED','PRICING_POLICY_NOT_APPROVED','PRICING_POLICY_MISSING','PRICING_POLICY_FARE_MISSING'].includes(code))return 'review'
 if(code.startsWith('PREPARATION_'))return 'preparation'
 if(code.startsWith('GUIDANCE_'))return 'guidance'
 if(['ONBOARD_STAFF_REQUIRED','MISSING_ONBOARD_STAFF','STAFF_SCHEDULE_CONFLICT'].includes(code))return 'staff'
 if(['SHIP_REQUIRED','NO_SHIP_ASSIGNED','SHIP_NOT_ACTIVE','SHIP_NOT_CONFIGURED','SHIP_SCHEDULE_CONFLICT','NO_EFFECTIVE_REGULATIONS'].includes(code))return 'resources'
 if(code.startsWith('ITINERARY_')||['INVALID_SCHEDULE','PORTS_NOT_ACTIVE'].includes(code))return 'schedule'
 if(code.startsWith('PACKAGE_')||code.startsWith('MANDATORY_EXCURSION_')||code.startsWith('EXCURSION_'))return 'program'
 if(code.startsWith('SERVICE_')||code.startsWith('ACTIVITY_')||['EXCURSION_CONFIGURATION_REQUIRED','NO_ACTIVE_PACKAGES'].includes(code))return 'program'
 if(['INVENTORY_EXHAUSTED','NO_AVAILABLE_CABINS'].includes(code))return 'sales'
 return null
}

const staffRoles:Readonly<Record<string,string>>={
 ONBOARD_STAFF:'Nhân viên phục vụ trên tàu',CHECKIN_STAFF:'Nhân viên đón khách',ACTIVITY_SERVICE_MANAGER:'Quản lý hoạt động và dịch vụ',
 TOUR_GUIDE:'Hướng dẫn viên',PORT_COORDINATOR:'Điều phối cảng',BOOKING_AGENT:'Nhân viên đặt chỗ',
 FINANCE_OFFICER:'Nhân viên tài chính',CUSTOMER_SERVICE:'Chăm sóc khách hàng',CAPTAIN:'Thuyền trưởng',DECK_OFFICER:'Sĩ quan boong',
}
export const operationsStaffRole=(role:string)=>staffRoles[role]??'Chưa xác định vai trò'
export const operationsStaffStatus=(status:string)=>status==='ACTIVE'?'Đang được phân công':['INACTIVE','REMOVED','CANCELLED'].includes(status)?'Đã ngừng phân công':'Chưa xác định trạng thái'

/** Only facts present in the submitted dossier may identify a maker. */
export function planMakerReason(data: PlanView, actorId: string | null): string | null {
 if (!actorId) return null
 if (data.submittedBy === actorId) return 'Bạn là người gửi hồ sơ. Cần người xét duyệt khác.'
 if (data.unifiedPackageReview && data.submittedSnapshot && typeof data.submittedSnapshot === 'object'
   && 'saleTermsMakerIds' in data.submittedSnapshot
   && Array.isArray(data.submittedSnapshot.saleTermsMakerIds)
   && data.submittedSnapshot.saleTermsMakerIds.includes(actorId))
   return 'Bạn đã cấu hình thuế hoặc phí cảng trong hồ sơ này. Cần người xét duyệt khác.'
 if (data.unifiedPackageReview && planEvidence(data.submittedSnapshot).packages.some(p => p.makers.includes(actorId))) return 'Bạn đã tạo hoặc gửi giá trong hồ sơ này. Cần người xét duyệt khác.'
 return null
}
export function operationsPlanLabel(data: PlanView) {
 return data.planStatus === 'APPROVED' && (data.planBlockers.length > 0 || data.readyBlockers.includes('PLAN_APPROVAL_REQUIRED')) ? 'Cần xét duyệt lại' : ({DRAFT:'Chưa gửi',SUBMITTED:'Chờ xét duyệt',APPROVED:'Đã phê duyệt',REJECTED:'Đã từ chối',REVISION_REQUESTED:'Cần chỉnh sửa',WITHDRAWN:'Đã rút hồ sơ'} as const)[data.planStatus]
}
