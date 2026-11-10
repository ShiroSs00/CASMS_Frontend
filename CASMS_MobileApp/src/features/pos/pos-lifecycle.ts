import type { ActivityAction, PosActivity, PosRequest } from './pos-contracts';
import { ApiError } from '../../lib/api/api-client';

export function fulfillmentInput(row: PosRequest, value: string) {
  if (!row.fareBenefitSnapshotId) return undefined;
  const quantity = Number(value.trim());
  if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(quantity) || quantity !== row.quantity || !row.fulfillmentUnitCode?.trim()) {
    throw new ApiError('Cần xác nhận đủ số lượng và đơn vị phục vụ.', 422, 'POS_FULFILLMENT_REQUIRED');
  }
  return { fulfilledQuantity: quantity, unitCode: row.fulfillmentUnitCode };
}

export function activityActions(activity: PosActivity['activity'], now: number): ActivityAction[] {
  if (['COMPLETED', 'CANCELLED'].includes(activity.status)) return [];
  if (activity.status === 'PLANNED') return ['open', 'cancel'];
  if (['OPEN', 'FULL'].includes(activity.status)) return Date.parse(activity.startTime) <= now ? ['start', 'cancel'] : ['cancel'];
  return activity.status === 'IN_PROGRESS' ? ['complete', 'cancel'] : [];
}
