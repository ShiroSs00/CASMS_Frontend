import { salePrice, type ActivityAction, type PosActivity, type PosRequest, type RequestAction, type PosParticipation, type AttendanceAction, type PosRegistration, type Sale, type SaleInput, type SalePrice, type PosStatement } from './pos-contracts';
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

export function requestActions(row: PosRequest, owner: string, permissions: readonly string[]): RequestAction[] {
  if (row.status === 'REQUESTED' && !row.assignedUserId) return permissions.includes('SERVICE_REQUEST_ASSIGN') ? ['assign'] : [];
  if (row.assignedUserId !== owner || !permissions.includes('SERVICE_REQUEST_EXECUTE')) return [];
  if (row.status === 'REQUESTED') return ['accept','reject','cancel'];
  if (row.status === 'ACCEPTED') return ['start','cancel'];
  return row.status === 'IN_PROGRESS' ? ['complete'] : [];
}
export function verifyRequestOutcome(before: PosRequest, after: PosRequest, action: RequestAction, owner: string) {
  const status = { assign: 'REQUESTED', accept: 'ACCEPTED', reject: 'REJECTED', start: 'IN_PROGRESS', complete: 'COMPLETED', cancel: 'CANCELLED' }[action];
  if (after.id !== before.id || after.serviceId !== before.serviceId || after.bookingPassengerId !== before.bookingPassengerId
    || after.scheduleId !== before.scheduleId || after.quantity !== before.quantity || after.status !== status
    || after.fareBenefitSnapshotId !== before.fareBenefitSnapshotId || after.fulfillmentUnitCode !== before.fulfillmentUnitCode
    || (action === 'assign' && after.assignedUserId !== owner)
    || (action === 'complete' && after.fulfilledQuantity !== before.quantity)) invalidOutcome();
  return after;
}
export function attendanceActions(row: PosParticipation, activity: PosActivity['activity'], now: number): AttendanceAction[] {
  if (activity.status === 'CANCELLED') return [];
  if (row.status === 'CHECKED_IN') return ['checkout'];
  if (row.status === 'IN_PROGRESS') return ['complete'];
  if (row.status !== 'REGISTERED') return [];
  return [...(activity.status === 'IN_PROGRESS' ? ['check-in' as const] : []), ...(Date.parse(activity.endTime) <= now ? ['no-show' as const] : [])];
}
export function verifyRegistrationOutcome(before: PosRegistration, after: PosRegistration, action: 'confirm' | 'cancel' | 'update', quantity = before.quantity) {
  if (after.id !== before.id || after.bookingPassengerId !== before.bookingPassengerId || after.activityId !== before.activityId
    || after.excursionId !== before.excursionId || after.quantity !== quantity
    || after.status !== (action === 'confirm' ? 'CONFIRMED' : action === 'cancel' ? 'CANCELLED' : 'PENDING')) invalidOutcome();
  return after;
}
export function verifyAttendanceOutcome(before: PosParticipation, after: PosParticipation, action: AttendanceAction) {
  const status = { 'check-in': 'CHECKED_IN', checkout: 'IN_PROGRESS', complete: 'COMPLETED', 'no-show': 'NO_SHOW' }[action];
  if (after.id !== before.id || after.registrationId !== before.registrationId || after.status !== status) invalidOutcome();
  return after;
}
export function verifySalePreflight(service: { unitPrice: number | null; currency: string | null }, budget: PosStatement['budget'], reviewed: SalePrice | undefined, replay = false) {
  const expected = salePrice.safeParse(reviewed);
  if (!expected.success) throw new ApiError('Hồ sơ chưa có đơn giá và loại tiền đã xác nhận. Cần quản lý đối soát.', 409, 'POS_PRICE_CONFIRMATION_REQUIRED');
  const current = salePrice.safeParse({ amount: service.unitPrice, currency: service.currency });
  if (!current.success || current.data.currency !== budget.currency) {
    throw new ApiError('Đơn giá và hạn mức chưa cùng loại tiền được hỗ trợ. Chưa gửi giao dịch.', 409, 'POS_CURRENCY_MISMATCH');
  }
  if (current.data.currency !== expected.data.currency || current.data.amount !== expected.data.amount) {
    throw new ApiError('Đơn giá hoặc loại tiền đã thay đổi. Cần đối soát trước khi gửi.', 409, 'POS_PRICE_CHANGED');
  }
  // A previous attempt may already have consumed the allowance. Its exact-key
  // reconciliation must not be mistaken for a second purchase/funds check.
  if (!replay && (expected.data.amount > budget.accountRemaining || expected.data.amount > budget.remainingAmount)) {
    throw new ApiError('Cần kiểm tra lại hạn mức.', 409, 'POS_ALLOWANCE_RECHECK');
  }
  return expected.data;
}

export function verifySaleIntent(result: Sale, input: SaleInput, scope?: { terminalId: string; areaId: string; owner: string }, reviewed?: SalePrice) {
  if (result.serviceId !== input.serviceId || result.bookingPassengerId !== input.bookingPassengerId || result.onboardAccountId !== input.onboardAccountId
    || result.quantity !== input.quantity || result.amount !== result.unitPrice
    || (reviewed && (result.currency !== reviewed.currency || result.amount !== reviewed.amount || result.unitPrice !== reviewed.amount))
    || (scope && (result.terminalId !== scope.terminalId || result.areaId !== scope.areaId || result.employeeId !== scope.owner))) invalidOutcome();
  return result;
}
function invalidOutcome(): never { throw new ApiError('Kết quả POS không khớp thao tác.', 502, 'POS_INVALID_RESPONSE'); }
