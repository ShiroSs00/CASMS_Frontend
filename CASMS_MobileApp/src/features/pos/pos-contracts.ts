import { z } from 'zod';
import { ApiError } from '../../lib/api/api-client';

export const uuid = z.guid();
const text = z.string();
const permissions = z.array(text);
const instant = z.iso.datetime({ offset: true });
// Binary64 must retain the Backend NUMERIC(19,4) unit. Signed ledger rows remain signed.
const amount = z.number().finite().gt(-(2 ** 39)).lt(2 ** 39);
// Jackson omits null fields on this backend.
const optionalId = uuid.nullable().default(null);
const optionalText = text.nullable().default(null);
const optionalInstant = instant.nullable().default(null);
export const terminal = z.object({
  terminalId: uuid, shipId: uuid, areaId: uuid, code: text, name: text,
  enabled: z.boolean(), permissions,
});
export const service = z.object({
  serviceId: uuid, code: text, name: text, unitPrice: amount.nonnegative().nullable().default(null),
  currency: text.regex(/^[A-Z]{3}$/).nullable().default(null), permissions,
});
export const posSession = z.object({
  sessionToken: text.min(1).max(128), expiresAt: instant, terminal,
  cruiseId: uuid, staffAssignmentId: optionalId,
});
export const context = z.object({
  terminal, cruiseId: uuid, staffAssignmentId: optionalId, services: z.array(service),
});
export const request = z.object({
  id: uuid, serviceId: uuid, quantity: z.number().int().positive().max(2147483647), status: z.enum(['REQUESTED','ACCEPTED','IN_PROGRESS','COMPLETED','REJECTED','CANCELLED']),
  assignedUserId: optionalId, requestTime: instant, note: optionalText,
  bookingPassengerId: optionalId, scheduleId: optionalId,
  passengerId: optionalId, bookingId: optionalId, completedAt: optionalInstant,
  usageMode: z.enum(['PRE_CRUISE','ONBOARD']).nullable().default(null),
  unitPriceSnapshot: amount.nullable().default(null), currencySnapshot: optionalText,
  fareBenefitSnapshotId: optionalId, fulfillmentUnitCode: optionalText,
  fulfilledQuantity: z.number().int().nonnegative().nullable().default(null),
});
export const activity = z.object({
  id: uuid, name: text, code: text, startTime: instant, endTime: instant,
  location: optionalText, status: z.enum(['PLANNED','OPEN','FULL','IN_PROGRESS','COMPLETED','CANCELLED']),
  cruiseId: optionalId, capacity: z.number().int().nonnegative().nullable().default(null), meetingPoint: optionalText,
});
export const activityEntry = z.object({ activity, permissions });
export const registration = z.object({
  id: uuid, bookingPassengerId: uuid, quantity: z.number().int().positive().max(2147483647),
  status: z.enum(['PENDING','CONFIRMED','CANCELLED','COMPLETED']), activityId: uuid, excursionId: optionalId,
  registeredAt: optionalInstant, notes: optionalText,
});
export const participation = z.object({
  id: uuid, registrationId: uuid, status: z.enum(['REGISTERED','CHECKED_IN','IN_PROGRESS','COMPLETED','NO_SHOW','CANCELLED']),
  checkInTime: optionalInstant, checkOutTime: optionalInstant,
});
export const saleInput = z.object({
  serviceId: uuid, bookingPassengerId: uuid, onboardAccountId: uuid,
  scheduleId: uuid.optional(), quantity: z.literal(1),
  idempotencyKey: text.min(1).max(100).refine(value => value.trim() === value),
});
export const sale = z.object({
  saleId: uuid, terminalId: uuid, areaId: uuid, serviceId: uuid, onboardAccountId: uuid, bookingPassengerId: uuid, employeeId: uuid,
  serviceRequestId: uuid, chargeId: uuid, unitPrice: amount.positive(),
  quantity: z.literal(1), amount: amount.positive(), currency: text.regex(/^[A-Z]{3}$/), createdAt: instant, reversedAt: optionalInstant,
});
export const statement = z.object({
  budget: z.object({
    accountId: uuid, passengerId: uuid, allocatedAmount: amount, usedAmount: amount,
    accountRemaining: amount, remainingAmount: amount, currency: text.regex(/^[A-Z]{3}$/),
  }),
  history: z.array(z.object({
    transactionId: uuid, type: text, amount, sourceType: optionalText,
    sourceReferenceId: optionalId, recordedAt: instant,
  })),
});

export type PosSession = z.infer<typeof posSession>;
export type PosContext = z.infer<typeof context>;
export type PosRequest = z.infer<typeof request>;
export type PosActivity = z.infer<typeof activityEntry>;
export type PosParticipation = z.infer<typeof participation>;
export type PosRegistration = z.infer<typeof registration>;
export type SaleInput = z.infer<typeof saleInput>;
export type Sale = z.infer<typeof sale>;
export type PosStatement = z.infer<typeof statement>;
export type RequestAction = 'assign' | 'accept' | 'reject' | 'start' | 'complete' | 'cancel';
export type AttendanceAction = 'check-in' | 'checkout' | 'complete' | 'no-show';
export type ActivityAction = 'open' | 'start' | 'complete' | 'cancel';
export type Credential = { deviceSecret: string } | { deviceAccessToken: string };
export const loginInput = z.object({
  deviceSecret: z.string().trim().min(1).max(128).optional(),
  deviceAccessToken: z.string().trim().min(1).max(4096).optional(),
  areaId: uuid.optional(), cruiseId: uuid.optional(),
}).refine(value => !!value.deviceSecret !== !!value.deviceAccessToken);

export function matchesPosSession(context: PosContext, session: PosSession) {
  return context.terminal.enabled && context.terminal.terminalId === session.terminal.terminalId
    && context.terminal.shipId === session.terminal.shipId && context.terminal.areaId === session.terminal.areaId
    && context.cruiseId === session.cruiseId && context.staffAssignmentId === session.staffAssignmentId;
}

export function decode<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError('Dữ liệu POS trả về không hợp lệ.', 502, 'POS_INVALID_RESPONSE');
  return result.data;
}

export function samePosScope(a: PosContext, b: PosContext) {
  return a.terminal.enabled && b.terminal.enabled && a.terminal.terminalId === b.terminal.terminalId
    && a.terminal.shipId === b.terminal.shipId && a.terminal.areaId === b.terminal.areaId
    && a.cruiseId === b.cruiseId && a.staffAssignmentId === b.staffAssignmentId;
}
