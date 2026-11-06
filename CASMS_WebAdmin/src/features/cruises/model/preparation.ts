import type { useSessionAccess } from '@/shared/auth'
import type { CruiseDetailView, ReadinessCheck } from './cruise-view'
export const departureSections = [
  ['operation', 'Vận hành sau mở bán'], ['transaction-policy', 'Chính sách giao dịch'], ['overview', 'Tổng quan'], ['schedule', 'Lịch thực tế'], ['resources', 'Tàu và quy định'],
  ['program', 'Chương trình và dịch vụ'], ['fare-packages', 'Gói du thuyền'], ['staff', 'Nhân sự chuyến khởi hành'], ['preparation', 'Hồ sơ chuẩn bị khởi hành'], ['sales', 'Cấu hình bán'], ['guidance', 'Hướng dẫn trước chuyến'], ['checks', 'Xác nhận và mở bán'], ['handoff', 'Bàn giao vận hành'], ['changes', 'Thay đổi lịch và theo dõi xử lý'],
] as const
export type DepartureSection = typeof departureSections[number][0]
export function preparationSection(value: string | null): DepartureSection {
  return departureSections.some(([key]) => key === value) ? value as DepartureSection : 'overview'
}
export function cruiseListReturn(value: string | null): string {
  if (!value) return '/admin/cruises'
  try { const url = new URL(value, 'https://ocvviet.local'); return url.origin === 'https://ocvviet.local' && url.pathname === '/admin/cruises' ? url.pathname + url.search : '/admin/cruises' } catch { return '/admin/cruises' }
}
export function preparationIssueSection(check: ReadinessCheck): DepartureSection {
  return check.key === 'SHIP' || check.key === 'CONFIGURATION' ? 'resources' : check.key === 'ITINERARY' || check.key === 'PORTS' || check.key === 'SCHEDULE' ? 'schedule' : 'checks'
}
export function preparationProblems(detail: CruiseDetailView): ReadinessCheck[] {
  return detail.readiness.checks.filter(check => check.state !== 'PASS')
}

export function allowedDepartureSections(access:ReturnType<typeof useSessionAccess>){
  const manager=access.roles.includes('CRUISE_MANAGER')&&!access.roles.includes('OPERATIONS_MANAGER')
  return departureSections.filter(([key])=>
    key==='operation'&&access.roles.includes('OPERATIONS_MANAGER')&&['CRUISE_START','CRUISE_COMPLETE','CRUISE_CANCEL','OPERATIONAL_ISSUE_READ'].some(p=>access.has(p))
    ||key==='transaction-policy'&&access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_PRICING_APPROVE')
    ||key==='overview'
    ||key==='fare-packages'&&['ACTIVITY_SERVICE_MANAGER','OPERATIONS_MANAGER','CRUISE_MANAGER','BOOKING_AGENT'].some(role=>access.roles.includes(role))&&['TOUR_PACKAGE_MANAGE','CRUISE_READ','CRUISE_PRICING_APPROVE','BOOKING_READ'].some(p=>access.has(p))
    ||key==='schedule'&&['ITINERARY_READ','CRUISE_READ'].some(p=>access.has(p))
    ||key==='resources'&&['SHIP_READ','CRUISE_STAFF_READ','CRUISE_REGULATION_READ','CRUISE_ASSIGN_SHIP','CRUISE_CHANGE_SHIP'].some(p=>access.canDo(p))
    ||key==='program'&&(access.roles.includes('CRUISE_MANAGER')&&access.has('CRUISE_UPDATE_DRAFT')
      ||access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_READ'))
    ||key==='staff'&&access.canDo('CRUISE_STAFF_READ')
    ||key==='preparation'&&access.has('CRUISE_PREPARATION_READ')
    ||key==='guidance'&&access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_READ')
    ||key==='handoff'&&access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_MANIFEST_READ')
    ||key==='changes'&&access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_READ')
    ||key==='sales'&&!manager&&['CRUISE_READ','BOOKING_READ','CRUISE_MANIFEST_READ','TOUR_PACKAGE_ASSIGN'].some(p=>access.has(p))
    ||key==='checks'&&!manager&&(access.canDo('CRUISE_VALIDATE')||access.has('CRUISE_READ')))
    .map(([key,label])=>[key,manager&&key==='schedule'?'Lịch khởi hành':access.roles.includes('OPERATIONS_MANAGER')&&key==='sales'?(access.has('CRUISE_MANIFEST_READ')?'Cabin và hành khách':'Tồn cabin'):manager&&key==='resources'&&!access.canDo('CRUISE_STAFF_READ')?(access.canDo('CRUISE_REGULATION_READ')?'Tàu và quy định':'Tàu'):label] as const)
}

export const operationsPreparationSections:readonly DepartureSection[]=['preparation','staff','resources','guidance','checks','handoff']
export function operationsSectionStage(section:DepartureSection):1|3 {
  return operationsPreparationSections.includes(section)?3:1
}
