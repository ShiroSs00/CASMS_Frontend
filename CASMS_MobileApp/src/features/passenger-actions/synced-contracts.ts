import { z } from 'zod';
import { ApiError } from '../../lib/api/api-client';
import type { Service, ServiceSchedule } from './passenger-types';

const uuid = z.guid();
const instant = z.iso.datetime({ offset: true });
const text = z.string().nullable().default(null);
const amount = z.number().finite().gt(-(2 ** 39)).lt(2 ** 39)
  .refine(value => Number(value.toFixed(4)) === value);
const currency = z.enum(['USD', 'VND']);
export const passengerCataloguePermissions = ['SERVICE_REQUEST_READ', 'SERVICE_REQUEST_CREATE'] as const;
export const passengerCardStatus = z.object({
  status: z.enum(['NOT_ASSIGNED', 'ASSIGNED', 'UNAVAILABLE']), confirmedAt: instant.nullable().default(null),
});
export const terminalChoices = z.array(z.object({
  terminalId: uuid, shipId: uuid, areaId: uuid, cruiseId: uuid, code: z.string(), name: z.string(),
}));
const placement = z.object({ serviceId: uuid, deckId: uuid, deckName: z.string(), areaId: uuid.nullable().default(null), areaName: text });
const schedule = z.object({ serviceId: uuid, scheduleId: uuid, location: z.string(), startsAt: instant, endsAt: instant,
  remainingCapacity: z.number().int().nonnegative() }).refine(row => Date.parse(row.endsAt) > Date.parse(row.startsAt));
export const passengerCatalogue = z.object({ cruiseId: uuid, services: z.array(z.object({
  serviceId: uuid, serviceName: z.string(), description: text, unitCode: text,
  unitPrice: amount.nonnegative().nullable().default(null), currency: currency.nullable().default(null),
  canBuyPreCruise: z.boolean(), canBuyOnboard: z.boolean(), canSellIndependently: z.boolean(), requiresSchedule: z.boolean(),
  remainingCapacity: z.number().int().nonnegative().nullable().default(null), placements: z.array(placement), schedules: z.array(schedule),
})) });
export type Catalogue = z.infer<typeof passengerCatalogue>;
export function readCatalogue(value: unknown, cruiseId: string): Catalogue {
  const parsed = passengerCatalogue.safeParse(value);
  if (!parsed.success) throw new ApiError('Chưa xác minh được danh mục dịch vụ. Vui lòng tải lại.', 502, 'CATALOGUE_INVALID');
  const result = parsed.data;
  if (result.cruiseId !== cruiseId || new Set(result.services.map(row => row.serviceId)).size !== result.services.length
    || result.services.some(row => row.placements.some(p => p.serviceId !== row.serviceId)
      || row.schedules.some(s => s.serviceId !== row.serviceId) || new Set(row.schedules.map(s => s.scheduleId)).size !== row.schedules.length))
    throw new ApiError('Danh mục chưa khớp chuyến đi.', 502, 'CATALOGUE_SCOPE');
  return result;
}
// Adapt verified active catalogue entries to the existing request editor; no global fallback.
export function catalogueServices(catalogue: Catalogue): Service[] {
  return catalogue.services.map(row => ({ id: row.serviceId, code: '', name: row.serviceName, description: row.description,
    type: null, price: row.unitPrice, currency: row.currency, capacity: row.remainingCapacity, status: 'ACTIVE',
    unitCode: row.unitCode, requiresSchedule: row.requiresSchedule, canBuyPreCruise: row.canBuyPreCruise,
    canBuyOnboard: row.canBuyOnboard, placements: row.placements,
  }));
}
export function catalogueSchedules(catalogue: Catalogue, serviceId: string): ServiceSchedule[] {
  return (catalogue.services.find(row => row.serviceId === serviceId)?.schedules ?? []).map(row => ({
    id: row.scheduleId, serviceId, cruiseId: catalogue.cruiseId, startsAt: row.startsAt, endsAt: row.endsAt,
    location: row.location, remainingCapacity: row.remainingCapacity, status: 'OPEN',
  }));
}
export const folioAccount = z.object({ onboardAccountId: uuid, bookingId: uuid, cruiseId: uuid,
  accountStatus: z.enum(['PENDING_ACTIVATION','ACTIVE','POSTING_BLOCKED','SUSPENDED','CLOSED']), currency, settlementStatus: text });
export const folioStatement = z.object({ onboardAccountId: uuid, bookingReference: text, cabinNumber: text,
  cruiseTitle: z.string(), primaryGuestName: text, accountStatus: z.enum(['PENDING_ACTIVATION','ACTIVE','POSTING_BLOCKED','SUSPENDED','CLOSED']),
  creditLimit: amount.nullable().default(null), securityDepositHeld: amount.nullable().default(null),
  totalCharges: amount, totalCredits: amount, netPayableBalance: amount.nullable().default(null), remainingCredit: amount.nullable().default(null),
  currency, scope: z.literal('PASSENGER'), statementAsOf: instant,
  transactions: z.array(z.object({ transactionId: uuid, transactionTime: instant, passengerName: text, outletOrLocation: text,
    description: text, transactionType: z.string().min(1), amount, currency, status: z.string().min(1) })),
  memberLimits: z.array(z.object({ passengerId: uuid, passengerName: text, memberRole: z.string(),
    limitAmount: amount, spentAmount: amount, remainingAmount: amount, status: z.string() })),
});
export type FolioAccount = z.infer<typeof folioAccount>;
export function readFolioAccount(value: unknown, bookingId: string, cruiseId: string) {
  const parsed = folioAccount.safeParse(value);
  if (!parsed.success) throw new ApiError('Chưa xác minh được tài khoản chi tiêu. Vui lòng tải lại.', 502, 'FOLIO_INVALID');
  const result = parsed.data;
  if (result.bookingId !== bookingId || result.cruiseId !== cruiseId)
    throw new ApiError('Tài khoản chưa khớp chuyến đi.', 502, 'FOLIO_SCOPE');
  return result;
}
export function readPassengerFolio(value: unknown, account: FolioAccount, passengerId: string) {
  const parsed = folioStatement.safeParse(value);
  if (!parsed.success) throw new ApiError('Chưa xác minh được sao kê cá nhân. Vui lòng tải lại.', 502, 'FOLIO_INVALID');
  const result = parsed.data;
  if (result.onboardAccountId !== account.onboardAccountId || result.currency !== account.currency
    || result.memberLimits.some(row => row.passengerId !== passengerId)
    || new Set(result.transactions.map(row => row.transactionId)).size !== result.transactions.length)
    throw new ApiError('Sao kê chưa khớp hồ sơ hành khách.', 502, 'FOLIO_SCOPE');
  if (result.transactions.some(row => row.currency !== result.currency))
    throw new ApiError('Sao kê có các loại tiền chưa đồng nhất. Vui lòng liên hệ quầy để kiểm tra.', 502, 'FOLIO_CURRENCY');
  return result;
}
