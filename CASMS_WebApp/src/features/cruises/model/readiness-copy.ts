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
export function readinessMessage(code:string|null|undefined):string {
 if(code==='MISSING_ONBOARD_STAFF'||code==='ONBOARD_STAFF_REQUIRED')return 'Chưa phân công Onboard Staff cho chuyến khởi hành.'
 return businessCopy(code&&keys[code]?keys[code]:'cruise.readiness.unknown')
}
