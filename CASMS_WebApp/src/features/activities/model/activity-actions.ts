import type { Activity, Participation } from './activity'
export function activityActions(item: Activity, now = Date.now()): ('open' | 'start' | 'complete' | 'cancel')[] {
  if (['COMPLETED', 'CANCELLED'].includes(item.status)) return []
  return [...(item.status === 'PLANNED' ? ['open' as const] : []), ...(['OPEN', 'FULL'].includes(item.status) && Date.parse(item.startTime) <= now ? ['start' as const] : []), ...(item.status === 'IN_PROGRESS' ? ['complete' as const] : []), 'cancel']
}
export function attendanceActions(item: Participation, parent: { status: string; endTime: string }, now = Date.now()): ('check-in' | 'checkout' | 'complete' | 'no-show')[] {
  if (item.status === 'REGISTERED') return [...(parent.status === 'IN_PROGRESS' ? ['check-in' as const] : []), ...(Date.parse(parent.endTime) < now ? ['no-show' as const] : [])]
  return item.status === 'CHECKED_IN' ? ['checkout'] : item.status === 'IN_PROGRESS' ? ['complete'] : []
}
