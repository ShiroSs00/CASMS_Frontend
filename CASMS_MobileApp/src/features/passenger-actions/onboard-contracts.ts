import { z } from 'zod';

const uuid = z.guid();
const stamp = z.iso.datetime({ offset: true });
const text = z.string().nullable().default(null);
const integer = z.number().int().safe().nonnegative();
const amount = z.number().finite().nonnegative().lt(2 ** 39).nullable().default(null);
const currency = z.string().regex(/^[A-Z]{3}$/).nullable().default(null);
export const serviceSchema = z.object({
  id: uuid, code: z.string(), name: z.string().min(1), description: text, type: text,
  price: amount, currency, capacity: integer.nullable().default(null), status: z.enum(['ACTIVE','INACTIVE','SUSPENDED','CANCELLED']),
  requiresSchedule: z.boolean(), canBuyPreCruise: z.boolean(), canBuyOnboard: z.boolean().optional(),
  canSellIndependently: z.boolean().optional(), unitCode: text, categoryId: uuid.nullish(), categoryName: text,
  applicabilityScope: text, preCruiseUsagePolicy: z.enum(['UNLIMITED','PER_DAY','PER_CRUISE']).nullish(),
  preCruiseUsageLimit: integer.nullish(), usageTimeZone: text,
});
export const scheduleSchema = z.object({
  id: uuid, serviceId: uuid, cruiseId: uuid.nullable().default(null), startsAt: stamp, endsAt: stamp, location: z.string(),
  capacity: integer, remainingCapacity: integer, status: z.string(), timeZoneId: text,
  cruiseStopId: uuid.nullish(), portName: text,
}).refine(s => Date.parse(s.endsAt) > Date.parse(s.startsAt) && s.remainingCapacity <= s.capacity);
export const requestSchema = z.object({
  id: uuid, serviceId: uuid, passengerId: uuid, bookingId: uuid.nullable().default(null), bookingPassengerId: uuid.nullable().default(null),
  scheduleId: uuid.nullish(), quantity: integer.positive(), status: z.enum(['REQUESTED','ACCEPTED','IN_PROGRESS','COMPLETED','REJECTED','CANCELLED']),
  note: text, requestTime: stamp, completedAt: stamp.nullable().default(null),
  unitPriceSnapshot: amount.optional(), currencySnapshot: currency.optional(),
  fareBenefitSnapshotId: uuid.nullish(), usageMode: z.enum(['LEGACY','PRE_CRUISE','ONBOARD']).nullish(),
  usagePolicySnapshot: z.enum(['UNLIMITED','PER_DAY','PER_CRUISE']).nullish(), usageLimitSnapshot: integer.positive().nullish(),
  usageTimeZoneSnapshot: text, fulfilledQuantity: integer.nullish(), fulfillmentUnitCode: text,
}).passthrough();
export const activitySchema = z.object({
  id: uuid, code: z.string(), name: z.string().min(1), description: text, startTime: stamp, endTime: stamp,
  location: text, capacity: integer, price: amount, currencyCode: currency, cruiseId: uuid,
  status: z.enum(['PLANNED','OPEN','FULL','IN_PROGRESS','COMPLETED','CANCELLED']),
  meetingPoint: text, deckNumber: z.number().int().nullish(), deckName: text, cabinNumber: text,
});
export const activityAvailabilitySchema = z.object({ activityId: uuid, capacity: integer, availableSeats: integer,
  status: z.enum(['PLANNED','OPEN','FULL','IN_PROGRESS','COMPLETED','CANCELLED']) }).refine(v => v.availableSeats <= v.capacity);
export const excursionSchema = z.object({
  shoreExcursionId: uuid, cruiseStopId: uuid, excursionName: z.string().min(1),
  startTime: stamp, plannedReturnTime: stamp, meetingPoint: text,
  status: z.enum(['PLANNED','OPEN','FULL','CLOSED','IN_PROGRESS','COMPLETED','CANCELLED']),
  price: amount, currencyCode: currency, availableCapacity: integer.nullable().default(null), maximumCapacity: integer.nullish(), cancellationReason: text,
});
export const registrationSchema = z.object({
  id: uuid, passengerId: uuid, bookingPassengerId: uuid, activityId: uuid.nullable().default(null), excursionId: uuid.nullable().default(null),
  quantity: integer.positive(), status: z.enum(['PENDING','CONFIRMED','CANCELLED','COMPLETED']), registeredAt: stamp, notes: text,
}).refine(r => Boolean(r.activityId) !== Boolean(r.excursionId));
export const entitlementSchema = z.object({
  grantId: uuid, bookingPassengerId: uuid, benefitName: z.string(), inclusion: z.string(), sourcePackageName: z.string().nullable().default(null),
  grantedAt: stamp.nullable().default(null), status: z.string(), usagePolicy: text, usageUnit: text, serviceUnitCode: text,
  grantedQuantity: integer.nullable().default(null), usedQuantity: integer.nullable().default(null), remainingQuantity: integer.nullable().default(null),
  requiresReservation: z.boolean().nullable().default(null), usageStartsAt: stamp.nullable().default(null), usageEndsAt: stamp.nullable().default(null),
  occurrences: z.array(z.object({ resourceType: z.enum(['SERVICE','ACTIVITY','EXCURSION']), resourceId: uuid, name: z.string() })),
  registrations: z.array(z.object({ operation_id: uuid, operation_type: z.string(), status: z.string(), quantity: integer.positive() })),
  blockers: z.array(z.object({ code: z.string(), message: z.string(), dependencyId: uuid.nullish() })), canRegister: z.boolean(),
});
export type Entitlement = z.infer<typeof entitlementSchema>;
export function decodeOnboard<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error('Dữ liệu tiện ích chưa hợp lệ. Vui lòng tải lại để kiểm tra.');
  return parsed.data;
}
export function ownRequests<T extends { bookingId: string | null; bookingPassengerId: string | null }>(rows: T[], booking: string, person: string) {
  return booking && person ? rows.filter(r => r.bookingId === booking && r.bookingPassengerId === person) : [];
}
export function matchingEntitlements(rows: Entitlement[], person: string, kind: string, resource: string) {
  return rows.filter(r => r.bookingPassengerId === person && r.occurrences.some(o => o.resourceType === kind && o.resourceId === resource));
}
export function filterServices<T extends { name: string; description?: string | null; categoryId?: string | null; status: string }>(rows: T[], search: string, category: string) {
  const term = search.trim().toLocaleLowerCase('vi-VN');
  return rows.filter(s => s.status === 'ACTIVE' && (!category || s.categoryId === category)
    && `${s.name} ${s.description ?? ''}`.toLocaleLowerCase('vi-VN').includes(term));
}

export const serviceOperationSchema = z.object({ key: z.string().trim().min(1).max(100), bookingId: uuid, bookingPassengerId: uuid, serviceId: uuid, payload: z.object({ quantity: integer.positive(), scheduleId: uuid.nullable(), noteFingerprint: z.string().regex(/^[0-9a-f]{16}$/) }).optional() });

export function matchesRequestIntent(row: { serviceId: string; bookingId: string | null; bookingPassengerId: string | null; quantity: number; scheduleId?: string | null; note?: string | null },
  expected: { serviceId: string; bookingId: string; bookingPassengerId: string; quantity: number; scheduleId?: string | null; note: string }) {
  return row.serviceId === expected.serviceId && row.bookingId === expected.bookingId && row.bookingPassengerId === expected.bookingPassengerId
    && row.quantity === expected.quantity && (row.scheduleId ?? '') === (expected.scheduleId ?? '') && (row.note ?? '') === expected.note.trim();
}

type ActionScope = { backend: string; owner?: string; epoch?: number; bookingId: string; bookingPassengerId: string };
export function onboardScopeIsCurrent(expected: ActionScope, current: { backend: string; owner?: string; epoch?: number; expiresAt?: number; authenticated: boolean },
  selected: { apiUrl: string; owner: string; signedInAt: number; bookingId: string; bookingPassengerId: string } | null, now: number) {
  return !!expected.owner && !!expected.bookingId && !!expected.bookingPassengerId && current.authenticated
    && current.backend === expected.backend && current.owner === expected.owner && current.epoch === expected.epoch && (current.expiresAt ?? 0) > now
    && (!selected || selected.apiUrl === expected.backend && selected.owner === expected.owner && selected.signedInAt === expected.epoch
      && selected.bookingId === expected.bookingId && selected.bookingPassengerId === expected.bookingPassengerId);
}

/** Advisory draft identity only; Backend SHA-256/idempotency remains authoritative. No raw note is persisted. */
export function serviceNoteFingerprint(note: string) {
  let hash = 0xcbf29ce484222325n;
  for (const character of note.trim()) hash = BigInt.asUintN(64, (hash ^ BigInt(character.codePointAt(0)!)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, '0');
}
