import type { ActivityAction, PosActivity } from './pos-contracts';

export function activityActions(activity: PosActivity['activity'], now: number): ActivityAction[] {
  if (['COMPLETED', 'CANCELLED'].includes(activity.status)) return [];
  if (activity.status === 'PLANNED') return ['open', 'cancel'];
  if (['OPEN', 'FULL'].includes(activity.status)) return Date.parse(activity.startTime) <= now ? ['start', 'cancel'] : ['cancel'];
  return activity.status === 'IN_PROGRESS' ? ['complete', 'cancel'] : [];
}
