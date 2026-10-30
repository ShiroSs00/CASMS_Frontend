import type {DepartureSection} from './preparation'

/** Route each blocker to its actual task without changing the server's decision. */
export function operationsConditionTarget(code:string):DepartureSection|'review'|null {
 if(['PLAN_APPROVAL_REQUIRED','PRICING_APPROVER_UNRESOLVED','PRICING_POLICY_APPROVAL_REQUIRED','PRICING_POLICY_NOT_APPROVED','PRICING_POLICY_MISSING','PRICING_POLICY_FARE_MISSING'].includes(code))return 'review'
 if(code.startsWith('PREPARATION_'))return 'preparation'
 if(code.startsWith('GUIDANCE_'))return 'guidance'
 if(['ONBOARD_STAFF_REQUIRED','MISSING_ONBOARD_STAFF','STAFF_SCHEDULE_CONFLICT','SHIP_REQUIRED','NO_SHIP_ASSIGNED','SHIP_NOT_ACTIVE','SHIP_NOT_CONFIGURED','SHIP_SCHEDULE_CONFLICT','NO_EFFECTIVE_REGULATIONS'].includes(code))return 'resources'
 if(code.startsWith('ITINERARY_')||['INVALID_SCHEDULE','PORTS_NOT_ACTIVE'].includes(code))return 'schedule'
 if(code.startsWith('PACKAGE_')||code.startsWith('MANDATORY_EXCURSION_')||code.startsWith('EXCURSION_'))return 'program'
 if(code.startsWith('ACTIVITY_')||['EXCURSION_CONFIGURATION_REQUIRED','NO_ACTIVE_PACKAGES'].includes(code))return 'program'
 if(['INVENTORY_EXHAUSTED','NO_AVAILABLE_CABINS'].includes(code))return 'sales'
 return null
}

const staffRoles:Readonly<Record<string,string>>={
 ONBOARD_STAFF:'Onboard Staff',CHECKIN_STAFF:'Nhân viên đón khách',ACTIVITY_SERVICE_MANAGER:'Quản lý hoạt động và dịch vụ',
 TOUR_GUIDE:'Hướng dẫn viên',PORT_COORDINATOR:'Điều phối cảng',BOOKING_AGENT:'Nhân viên đặt chỗ',
 FINANCE_OFFICER:'Nhân viên tài chính',CUSTOMER_SERVICE:'Chăm sóc khách hàng',CAPTAIN:'Thuyền trưởng',DECK_OFFICER:'Sĩ quan boong',
}
export const operationsStaffRole=(role:string)=>staffRoles[role]??'Chưa xác định vai trò'
export const operationsStaffStatus=(status:string)=>status==='ACTIVE'?'Đang được phân công':['INACTIVE','REMOVED'].includes(status)?'Đã ngừng phân công':'Chưa xác định trạng thái'
