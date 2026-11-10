import {businessCopy,type BusinessCopyKey} from '@/shared/i18n/business-copy'

// Explicit domain mapping. Legacy itinerary approval means whole Plan approval in v4.
const keys:Readonly<Record<string,BusinessCopyKey>>={
 NO_SHIP_ASSIGNED:'cruise.readiness.NO_SHIP_ASSIGNED',
 SHIP_NOT_ACTIVE:'cruise.readiness.SHIP_NOT_ACTIVE',
 SHIP_NOT_CONFIGURED:'cruise.readiness.SHIP_NOT_CONFIGURED',
 SHIP_SCHEDULE_CONFLICT:'cruise.readiness.SHIP_SCHEDULE_CONFLICT',
 INVALID_SCHEDULE:'cruise.readiness.INVALID_SCHEDULE',
 PORTS_NOT_ACTIVE:'cruise.readiness.PORTS_NOT_ACTIVE',
 ITINERARY_MISSING:'cruise.readiness.ITINERARY_MISSING',
 ITINERARY_NOT_APPROVED:'cruise.readiness.PLAN_APPROVAL_REQUIRED',
 PLAN_APPROVAL_REQUIRED:'cruise.readiness.PLAN_APPROVAL_REQUIRED',
 MISSING_CAPTAIN:'cruise.readiness.MISSING_CAPTAIN',
 STAFF_SCHEDULE_CONFLICT:'cruise.readiness.STAFF_SCHEDULE_CONFLICT',
 NO_EFFECTIVE_REGULATIONS:'cruise.readiness.NO_EFFECTIVE_REGULATIONS',
 DEPENDENCY_TIMEOUT:'cruise.readiness.DEPENDENCY_TIMEOUT',
 NO_ACTIVE_PACKAGES:'cruise.readiness.NO_ACTIVE_PACKAGES',
 PREPARATION_SECTION_UNCONFIRMED:'cruise.readiness.PREPARATION_SECTION_UNCONFIRMED',
}

const explicitMessages:Readonly<Record<string,string>>={
 NO_ELIGIBLE_CRUISE_PACKAGE:'Chưa có gói du thuyền đủ điều kiện mở bán.',
 ELIGIBLE_FARE_OFFER_REQUIRED:'Chưa có gói du thuyền đủ điều kiện mở bán cho chuyến.',
 CRUISE_PACKAGE_SELECTION_INELIGIBLE:'Gói du thuyền đã chọn chưa đủ điều kiện mở bán.',
 CRUISE_NOT_READY:'Chuyến khởi hành chưa được xác nhận sẵn sàng vận hành tại Bước 2.',
 READY_CONFIRMATION_REQUIRED:'Cần hoàn tất xác nhận sẵn sàng vận hành tại Bước 2 trước khi mở bán.',
 SALE_TERMS_APPROVAL_REQUIRED:'Chính sách giá và thuế/phí chưa được phê duyệt.',
 SALE_WINDOW_NOT_ACTIVE:'Thời gian mở nhận đặt chỗ chưa đến hoặc đã kết thúc.',
 BOOKING_WINDOW_CLOSED:'Thời gian nhận đặt chỗ đã đóng theo kế hoạch.',
 BOOKING_WINDOW_NOT_OPEN:'Chưa đến thời gian mở nhận đặt chỗ theo kế hoạch.',
 SALE_TAX_APPROVAL_REQUIRED:'Thuế trong hồ sơ chưa được phê duyệt.',
 SALE_PORT_FEE_APPROVAL_REQUIRED:'Phí cảng trong hồ sơ chưa được phê duyệt.',
}

export function readinessMessage(code:string|null|undefined,message?:string|null):string {
 if(code==='MISSING_ONBOARD_STAFF'||code==='ONBOARD_STAFF_REQUIRED')return 'Chưa phân công nhân viên trên tàu cho chuyến khởi hành.'
 if(code&&explicitMessages[code])return explicitMessages[code]
 if(code&&keys[code])return businessCopy(keys[code])
 if(message&&message.trim()&&!message.includes('Exception')&&!message.includes('Error:'))return message.trim()
 return businessCopy('cruise.readiness.unknown')
}

// Reviewed against CruiseService readiness details. Never derive UI actions from API URLs.
const actions:Readonly<Record<string,string>>={
 NO_SHIP_ASSIGNED:'Phân công tàu cho chuyến khởi hành.',
 SHIP_NOT_ACTIVE:'Đối chiếu trạng thái tàu hoặc chọn tàu khác đủ điều kiện.',
 SHIP_NOT_CONFIGURED:'Hoàn thiện cấu hình boong và cabin của tàu.',
 SHIP_SCHEDULE_CONFLICT:'Đối chiếu lịch tàu và điều chỉnh phân công.',
 INVALID_SCHEDULE:'Đối chiếu thời gian khởi hành và kết thúc.',
 PORTS_NOT_ACTIVE:'Đối chiếu trạng thái hoạt động của cảng.',
 ITINERARY_MISSING:'Hoàn thiện lịch trình của chuyến khởi hành.',
 PLAN_APPROVAL_REQUIRED:'Gửi và xét duyệt kế hoạch khởi hành theo quyền được cấp.',
 MISSING_ONBOARD_STAFF:'Phân công nhân viên trên tàu cho chuyến khởi hành.',
 STAFF_SCHEDULE_CONFLICT:'Đối chiếu lịch phân công và chọn nhân sự phù hợp.',
 NO_EFFECTIVE_REGULATIONS:'Đối chiếu các quy định vận hành được gán cho chuyến.',
 DEPENDENCY_TIMEOUT:'Kiểm tra lại điều kiện sau khi kết nối được khôi phục.',
 CRUISE_PACKAGE_SELECTION_INELIGIBLE:'Đối chiếu các gói du thuyền đã chọn và điều kiện còn thiếu của từng gói.',
 ELIGIBLE_FARE_OFFER_REQUIRED:'Hoàn thiện gói du thuyền đủ điều kiện bán của chuyến.',
 PREPARATION_SECTION_UNCONFIRMED:'Hoàn thiện và xác nhận phần hồ sơ chuẩn bị còn thiếu.',
 CRUISE_NOT_READY:'Hoàn tất Bước 2: Xác nhận sẵn sàng mở bán trước khi mở bán vé.',
 READY_CONFIRMATION_REQUIRED:'Kế hoạch và giá chưa được Quản lý vận hành xác nhận sẵn sàng mở bán tại Bước 2.',
 SALE_WINDOW_NOT_ACTIVE:'Đối chiếu thời gian mở và đóng nhận đặt chỗ trong kế hoạch.',
}
export const readinessAction=(code:string|null|undefined)=>code?actions[code]??null:null
