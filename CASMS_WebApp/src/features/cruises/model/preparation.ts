import type { useSessionAccess } from '@/shared/auth'
import type { CruiseDetailView, ReadinessCheck } from './cruise-view'
export const departureSections = [
  ['overview', 'Tổng quan'], ['schedule', 'Lịch thực tế'], ['resources', 'Tàu và nhân sự'],
  ['program', 'Chương trình và dịch vụ'], ['sales', 'Cấu hình bán'], ['checks', 'Kiểm tra và mở bán'],
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
    key==='overview'
    ||key==='schedule'&&['ITINERARY_READ','CRUISE_READ'].some(p=>access.has(p))
    ||key==='resources'&&['SHIP_READ','CRUISE_STAFF_READ','CRUISE_REGULATION_READ'].some(p=>access.has(p))
    ||key==='program'&&['ACTIVITY_READ','EXCURSION_READ','SERVICE_READ'].some(p=>access.has(p))
    ||key==='sales'&&['CRUISE_READ','BOOKING_READ','CRUISE_MANIFEST_READ','TOUR_PACKAGE_ASSIGN'].some(p=>access.has(p))
    ||key==='checks'&&!manager&&(access.canDo('CRUISE_VALIDATE')||access.has('CRUISE_READ')))
}
