import { notificationSchema as notification, countSchema, uniqueNotifications } from '../notifications/notification-contracts';
import type { RequestOptions } from '../../lib/api/api-client';
import { z } from 'zod';
import { readCardClaim } from './card-contracts';
import { passengerCardStatus, readCatalogue, catalogueServices, catalogueSchedules, readFolioAccount, readPassengerFolio, type FolioAccount } from './synced-contracts';
import { serviceSchema, scheduleSchema, requestSchema, activitySchema, activityAvailabilitySchema, excursionSchema, registrationSchema, entitlementSchema, decodeOnboard } from './onboard-contracts';
import type { BookingDetail, BookingSummary, Excursion, Package, PackageAssignment, PackageBenefits, Registration, ServiceRequest, UserMe } from './passenger-types';

type Transport = { request<T>(path: string, options?: RequestOptions): Promise<T> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = z.guid();
const date = z.iso.datetime({ offset: true });
const nullableText = z.string().nullable().default(null);
const nullableAmount = z.number().finite().nonnegative().nullable().default(null);
// At 2^39, binary64 spacing exceeds the Backend NUMERIC(19,4) unit of 0.0001.
const requiredFinancialAmount = z.number().finite().nonnegative().lt(2 ** 39);
const financialAmount = requiredFinancialAmount.nullable().default(null);
const cruiseStatus = z.enum(['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const bookingStatus = z.enum(['Draft', 'Confirmed', 'Cancelled']);
const participationStatus = z.enum(['Active', 'Cancelled']);
const bookingSummary = z.object({
  bookingId: uuid, bookingReference: z.string().min(1), cruiseId: uuid, cruiseCode: z.string(), cruiseName: z.string(),
  bookingStatus, departureDatetime: date, createdAt: date, agreedFareAmount: financialAmount, currency: nullableText,
  passengerCount: z.number().int().nonnegative(),
});
const bookingDetail = bookingSummary.omit({ passengerCount: true }).extend({
  returnDatetime: date, shipName: nullableText, requiredDepositAmount: financialAmount,
  totalPaidAmount: financialAmount, outstandingBalance: financialAmount, fullyPaid: z.boolean().nullable().default(null),
  contractReference: nullableText, contractStatus: z.enum(['Draft', 'Accepted', 'Cancelled']).nullable().default(null), contractSigningInstructions: nullableText, cancellationReason: nullableText,
  paymentPlan: z.enum(['FULL', 'DEPOSIT', 'STAGES']).nullable().default(null),
  installments: z.array(z.object({
    sequenceNo: z.number().int().positive(), requiredAmount: requiredFinancialAmount, currency: z.string(),
    dueAt: date.nullable().default(null), status: z.enum(['Scheduled', 'Cancelled']), description: nullableText,
    paidAmount: financialAmount, outstandingAmount: financialAmount, paid: z.boolean().nullable().default(null),
  })),
  passengers: z.array(z.object({
    bookingPassengerId: uuid, passengerId: uuid, fullName: z.string().min(1), email: nullableText,
    participationStatus, ownedByCurrentUser: z.boolean().optional(),
    cabinId: uuid.nullable().default(null), cabinNumber: nullableText, cabinType: nullableText,
    deckNumber: z.number().int().nullable().default(null), tourPackageId: uuid.nullable().default(null),
    tourPackageName: nullableText, agreedPackagePrice: nullableAmount,
  })),
});
const userMe = z.object({
  userId: uuid, username: z.string().min(1), email: nullableText,
  status: z.enum(['ACTIVE', 'LOCKED', 'DISABLED']), roles: z.array(z.string()),
  effectivePermissions: z.array(z.string()), passengerId: uuid.nullish(), fullName: nullableText, phoneNumber: nullableText,
});
const voyageCruise = z.object({
  cruiseId: uuid, cruiseCode: z.string(), cruiseName: z.string().min(1), status: cruiseStatus,
  shipId: uuid.nullish(), shipName: nullableText, departureDatetime: date, returnDatetime: date,
});
const checkin = z.object({
  cruiseCheckinId: uuid, bookingPassengerId: uuid,
  checkinStatus: z.enum(['NotStarted', 'InProgress', 'NeedsReview', 'Completed', 'BoardingReady']),
  emergencyContactName: z.string().nullish(), emergencyContactPhone: z.string().nullish(),
  locationTrackingAllowed: z.boolean().nullish(), locationSharingAllowed: z.boolean().nullish(),
  completedAt: date.nullish(), boardingReadyAt: date.nullish(),
  startedAt: date.nullish(), boardingBlockReason: nullableText,
});
const payment = z.object({
  paymentId: uuid, bookingId: uuid, operationType: z.enum(['Collect', 'Void']),
  requestedAmount: z.number().nullish(), confirmedAmount: z.number().nullish(), currency: z.string(),
  requestedAt: date.nullish(), confirmedAt: date.nullish(), status: z.enum(['Pending', 'Confirmed', 'Failed', 'Cancelled']),
});
const personalVoyage = z.object({
  bookingId: uuid, bookingReference: z.string(), bookingPassengerId: uuid, cruiseId: uuid, cruiseName: z.string(), cruiseStatus,
  bookingStatus: z.enum(['Confirmed', 'Cancelled']), participationStatus, itineraryId: uuid.nullish(),
  itineraryStatus: z.enum(['OPEN_FOR_SALE', 'ACTIVE', 'COMPLETED', 'CANCELLED']).nullish(), startDate: z.iso.date().nullish(), endDate: z.iso.date().nullish(),
  registeredActivities: z.array(z.object({
    registrationId: uuid, kind: z.enum(['ONBOARD_ACTIVITY','SHORE_EXCURSION']).nullable().default(null), activityId: uuid.nullable().default(null),
    quantity: z.number().int().positive().nullable().default(null), name: z.string(), startTime: date.nullish(), endTime: date.nullish(),
    location: z.string().nullish(), registrationStatus: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']), activityStatus: z.string(),
  })).default([]),
});
export type PassengerNotification = z.infer<typeof notification>;
export type PersonalVoyage = z.infer<typeof personalVoyage>;
function decode<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error('Thông tin từ hệ thống chưa đầy đủ. Vui lòng tải lại.');
  return result.data;
}
function id(value: string) { if (!uuidPattern.test(value)) throw new Error('Mã dữ liệu không hợp lệ. Vui lòng tải lại.'); return encodeURIComponent(value); }
function array<T>(value: unknown, key: string): T[] {
  if (!Array.isArray(value) || value.some(row => !row || typeof row !== 'object' || !uuidPattern.test(row[key]))) throw new Error('Danh sách từ hệ thống không hợp lệ.');
  return value as T[];
}
function detail(value: unknown): BookingDetail {
  const booking = decode(bookingDetail, value);
  if (new Set(booking.passengers.map(person => person.bookingPassengerId)).size !== booking.passengers.length) throw new Error('Hành khách trong đặt chỗ bị trùng.');
  if (new Set(booking.installments.map(item => item.sequenceNo)).size !== booking.installments.length
    || booking.installments.some(item => !/^[A-Z]{3}$/.test(item.currency) || (booking.currency && item.currency !== booking.currency))) throw new Error('Lịch thanh toán không khớp đặt chỗ.');
  return booking;
}
function serviceRequest(value: unknown): ServiceRequest { return decodeOnboard(requestSchema, value); }
export function createPassengerApi(client: Transport) {
  async function pages<T>(path: string, key: string, signal?: AbortSignal, query: RequestOptions['query'] = {}) {
    const rows: T[] = []; let total: number | undefined;
    for (let page = 0; page < 100; page++) {
      const result = await client.request<{ content: unknown; number: number; totalPages: number; totalElements: number }>(path, { query: { ...query, page, size: 50 }, signal });
      if (!result || result.number !== page || !Number.isInteger(result.totalPages) || result.totalPages < 0 || !Number.isInteger(result.totalElements) || result.totalElements < 0) throw new Error('Phân trang từ hệ thống không hợp lệ.');
      total ??= result.totalElements;
      if (total !== result.totalElements) throw new Error('Danh sách đã thay đổi. Vui lòng tải lại.');
      rows.push(...array<T>(result.content, key));
      if (page + 1 >= result.totalPages) {
        if (rows.length !== total) throw new Error('Chưa tải đủ danh sách. Vui lòng tải lại.');
        if (new Set(rows.map(r => (r as Record<string, unknown>)[key])).size !== rows.length) throw new Error('Danh sách bị trùng dữ liệu. Vui lòng tải lại.');
        return rows;
      }
    }
    throw new Error('Danh sách quá lớn. Vui lòng liên hệ hỗ trợ.');
  }
  return {
    async cardClaim(bookingPassengerId: string) {
      return readCardClaim(await client.request(`/checkin/passenger/${id(bookingPassengerId)}/card-claim`, { method: 'POST' }));
    },
    async me(signal?: AbortSignal): Promise<UserMe> {
      return decode(userMe, await client.request('/auth/me', { signal }));
    },
    async bookings(signal?: AbortSignal): Promise<BookingSummary[]> {
      return decode(z.array(bookingSummary), await pages<BookingSummary>('/booking', 'bookingId', signal));
    },
    async voyages(signal?: AbortSignal) {
      const rows = decode(z.array(personalVoyage), await client.request('/itineraries/mine', { signal }));
      if (new Set(rows.map(row => row.bookingPassengerId)).size !== rows.length) throw new Error('Danh sách chuyến đi bị trùng hồ sơ hành khách.');
      return rows;
    },
    async voyageCruise(cruiseId: string, signal?: AbortSignal) {
      const value = decode(voyageCruise, await client.request(`/cruise/${id(cruiseId)}`, { signal }));
      if (value.cruiseId !== cruiseId.toLowerCase()) throw new Error('Thông tin chuyến đi không khớp đặt chỗ.');
      return value;
    },
    async notifications(signal?: AbortSignal) { return uniqueNotifications(decode(z.array(notification), await client.request('/notifications', { signal }))); },
    async notificationUnread(signal?: AbortSignal) { return decode(z.object({ unreadCount: countSchema }), await client.request('/notifications/unread-count', { signal })).unreadCount; },
    async markAllNotificationsRead() { return decode(z.object({ updatedCount: countSchema }), await client.request('/notifications/read-all', { method: 'PATCH' })).updatedCount; },
    async markNotificationRead(notificationId: string) {
      const result = decode(notification, await client.request(`/notifications/${id(notificationId)}/read`, { method: 'PATCH' }));
      if (result.notificationId !== notificationId || !result.readAt) throw new Error('Chưa xác nhận được trạng thái đã đọc.');
      return result;
    },
    async acknowledgeNotification(notificationId: string) {
      const result = decode(notification, await client.request(`/notifications/${id(notificationId)}/ack`, { method: 'POST' }));
      if (result.notificationId !== notificationId) throw new Error('Thông báo xác nhận không khớp.');
      return result;
    },
    async cardStatus(bookingPassengerId: string, signal?: AbortSignal) {
      return decode(passengerCardStatus, await client.request(`/checkin/passenger/${id(bookingPassengerId)}/card`, { signal }));
    },
    async passengerCatalogue(bookingPassengerId: string, cruiseId: string, signal?: AbortSignal) {
      return readCatalogue(await client.request(`/servicepackage/passenger/${id(bookingPassengerId)}/catalogue`, { signal }), cruiseId);
    },
    async scopedServices(bookingPassengerId: string, cruiseId: string, signal?: AbortSignal) {
      return catalogueServices(readCatalogue(await client.request(`/servicepackage/passenger/${id(bookingPassengerId)}/catalogue`, { signal }), cruiseId));
    },
    async scopedSchedules(bookingPassengerId: string, cruiseId: string, serviceId: string, signal?: AbortSignal) {
      return catalogueSchedules(readCatalogue(await client.request(`/servicepackage/passenger/${id(bookingPassengerId)}/catalogue`, { signal }), cruiseId), serviceId);
    },
    async folioAccount(bookingId: string, cruiseId: string, signal?: AbortSignal) {
      return readFolioAccount(await client.request('/payment/guest/folio/account', { query: { bookingId: id(bookingId) }, signal }), bookingId, cruiseId);
    },
    async passengerFolio(account: FolioAccount, passengerId: string, signal?: AbortSignal) {
      return readPassengerFolio(await client.request('/payment/guest/folio/statement', { query: { bookingId: id(account.bookingId) }, signal }), account, passengerId);
    },
    async payments(bookingId: string, signal?: AbortSignal) {
      const rows = decode(z.array(payment), await client.request(`/payment/booking/${id(bookingId)}`, { signal }));
      if (rows.some(row => row.bookingId !== bookingId.toLowerCase())) throw new Error('Lịch sử thanh toán không khớp đặt chỗ.');
      return rows;
    },
    async checkin(passengerId: string, signal?: AbortSignal) {
      const value = decode(checkin, await client.request(`/checkin/passenger/${id(passengerId)}/status`, { signal }));
      if (value.bookingPassengerId !== passengerId) throw new Error('Hồ sơ check-in không khớp hành khách.');
      return value;
    },
    async startCheckin(passengerId: string, name: string, phone: string) {
      const value = decode(checkin, await client.request(`/checkin/passenger/${id(passengerId)}/start`, {
        method: 'POST', query: { emergencyContactName: name, emergencyContactPhone: phone },
      }));
      if (value.bookingPassengerId !== passengerId || value.checkinStatus !== 'InProgress') throw new Error('Chưa xác nhận được hồ sơ check-in.');
      return value;
    },
    async completeCheckin(passengerId: string) {
      const value = decode(checkin, await client.request(`/checkin/passenger/${id(passengerId)}/complete`, { method: 'POST' }));
      if (value.bookingPassengerId !== passengerId || value.checkinStatus !== 'BoardingReady') throw new Error('Chưa xác nhận được hồ sơ check-in.');
      return value;
    },
    decks: (shipId: string, signal?: AbortSignal) => pages<{ deckId: string; shipId: string; deckNumber: number; deckName?: string }>(
      `/decks/by-ship/${id(shipId)}`, 'deckId', signal).then(rows => {
        const value = decode(z.array(z.object({ deckId: uuid, shipId: uuid, deckNumber: z.number().int(), deckName: nullableText })), rows);
        if (value.some(row => row.shipId !== shipId)) throw new Error('Thông tin tầng không thuộc tàu đã chọn.');
        return value;
      }),
    async booking(bookingId: string, signal?: AbortSignal) {
      const value = detail(await client.request(`/booking/${id(bookingId)}`, { signal }));
      if (value.bookingId !== bookingId.toLowerCase()) throw new Error('Thông tin không khớp đặt chỗ.');
      return value;
    },
    async services(signal?: AbortSignal) { return decodeOnboard(z.array(serviceSchema), await client.request('/servicepackage/services', { signal })); },
    async service(serviceId: string, signal?: AbortSignal) {
      const value = decodeOnboard(serviceSchema, await client.request(`/servicepackage/services/${id(serviceId)}`, { signal }));
      if (value.id !== serviceId) throw new Error('Dịch vụ không khớp yêu cầu.');
      return value;
    },
    async entitlements(bookingId: string, signal?: AbortSignal) {
      return decodeOnboard(z.array(entitlementSchema), await client.request(`/booking/${id(bookingId)}/cruise-package-entitlements`, { signal }));
    },
    async serviceAvailability(serviceId: string, quantity: number, signal?: AbortSignal) {
      const value = decodeOnboard(z.object({ serviceId: uuid, requestedQuantity: z.number().int().positive(), available: z.boolean() }),
        await client.request(`/servicepackage/services/${id(serviceId)}/availability`, { query: { quantity }, signal }));
      if (value.serviceId !== serviceId || value.requestedQuantity !== quantity) throw new Error('Kết quả khả dụng không khớp dịch vụ và số lượng.');
      return value;
    },
    request: (requestId: string, signal?: AbortSignal) => client.request(`/servicepackage/requests/${id(requestId)}`, { signal }).then(value => {
      const result = serviceRequest(value); if (result.id !== requestId) throw new Error('Yêu cầu không khớp.'); return result;
    }),
    async requests(signal?: AbortSignal) { return array<ServiceRequest>(await client.request('/servicepackage/requests', { signal }), 'id').map(serviceRequest); },
    async serviceSchedules(serviceId: string, signal?: AbortSignal) {
      const slots = decodeOnboard(z.array(scheduleSchema), await client.request(`/servicepackage/services/${id(serviceId)}/schedules`, { signal }));
      if (slots.some(slot => slot.serviceId !== serviceId || slot.status !== 'OPEN'
          || !Number.isSafeInteger(slot.remainingCapacity) || slot.remainingCapacity < 0
          || !Number.isFinite(Date.parse(slot.startsAt)) || !Number.isFinite(Date.parse(slot.endsAt))))
        throw new Error('Lịch phục vụ chưa hợp lệ.');
      return slots;
    },
    requestByOperationKey: (key: string) => client.request<ServiceRequest>('/servicepackage/requests/by-operation-key', { query: { key } }).then(serviceRequest),
    createRequest: (serviceId: string, bookingPassengerId: string, quantity: number, note: string, serviceScheduleId?: string, idempotencyKey?: string) =>
      client.request<ServiceRequest>('/servicepackage/requests', { method: 'POST', body: {
        serviceId: id(serviceId), bookingPassengerId: id(bookingPassengerId), quantity, note: note.trim() || null,
        serviceScheduleId: serviceScheduleId ? id(serviceScheduleId) : null, idempotencyKey,
      } }).then(serviceRequest),
    updateRequest: (requestId: string, quantity: number, note: string) => client.request<ServiceRequest>(`/servicepackage/requests/${id(requestId)}`, { method: 'PUT', body: { quantity, note: note.trim() || null } }).then(serviceRequest),
    cancelRequest: (requestId: string) => client.request<ServiceRequest>(`/servicepackage/requests/${id(requestId)}/cancel`, { method: 'POST' }).then(serviceRequest),
    async activities(signal?: AbortSignal) { return decodeOnboard(z.array(activitySchema), await client.request('/activities', { signal })); },
    async activity(activityId: string, signal?: AbortSignal) {
      const value = decodeOnboard(activitySchema, await client.request(`/activities/${id(activityId)}`, { signal }));
      if (value.id !== activityId) throw new Error('Hoạt động không khớp yêu cầu.'); return value;
    },
    async activityAvailability(activityId: string, signal?: AbortSignal) {
      const value = decodeOnboard(activityAvailabilitySchema, await client.request(`/activities/${id(activityId)}/availability`, { signal }));
      if (value.activityId !== activityId) throw new Error('Chỗ trống không khớp hoạt động.'); return value;
    },
    async excursionAvailability(excursionId: string, participants: number) {
      const value = decodeOnboard(excursionSchema, await client.request(`/shore-excursions/${id(excursionId)}/availability`, { query: { participants } }));
      if (value.shoreExcursionId !== excursionId) throw new Error('Chỗ trống không khớp tour.'); return value;
    },
    async excursions(cruiseId: string, signal?: AbortSignal) {
      id(cruiseId);
      const voyages = decode(z.array(personalVoyage), await client.request('/itineraries/mine', { signal }));
      const candidates = voyages.filter(i => i.cruiseId === cruiseId && i.bookingStatus === 'Confirmed'
        && i.participationStatus === 'Active' && i.itineraryId && ['OPEN_FOR_SALE', 'ACTIVE'].includes(i.itineraryStatus ?? ''));
      const itineraryIds = [...new Set(candidates.map(i => i.itineraryId))];
      if (itineraryIds.length > 1) throw new Error('Hải trình chưa xác định duy nhất cho chuyến.');
      const voyage = candidates[0];
      if (!voyage?.itineraryId) return [];
      const stops = array<{ cruiseStopId: string; status?: string; itineraryId: string; portName?: string; portTimeZoneId?: string; arrivalItineraryDayId?: string }>(
        await client.request(`/cruise-stops/by-itinerary/${id(voyage.itineraryId)}`, { signal }), 'cruiseStopId')
        .filter(stop => stop.itineraryId === voyage.itineraryId && stop.status !== 'OMITTED' && stop.status !== 'SUBSTITUTED');
      const lists = await Promise.all(stops.map(async stop =>
        decodeOnboard(z.array(excursionSchema), await client.request('/shore-excursions', { query: { cruiseStopId: stop.cruiseStopId }, signal }))
          .filter(item => item.cruiseStopId === stop.cruiseStopId)
          .map(item => ({ ...item, portName: stop.portName, portTimeZoneId: stop.portTimeZoneId, arrivalItineraryDayId: stop.arrivalItineraryDayId, stopStatus: stop.status }))));
      return [...new Map(lists.flat().map(e => [e.shoreExcursionId, e])).values()];
    },
    async registrations(signal?: AbortSignal) { return decodeOnboard(z.array(registrationSchema), await client.request('/activities/registrations', { signal })); },
    registration: (registrationId: string) => client.request(`/activities/registrations/${id(registrationId)}`).then(value => decodeOnboard(registrationSchema, value)),
    registrationByOperationKey: (key: string, signal?: AbortSignal) => client.request('/activities/registrations/by-operation-key', { query: { key }, signal }).then(value => decodeOnboard(registrationSchema, value)),
    register: (kind: 'activity' | 'excursion', targetId: string, bookingPassengerId: string, quantity: number, operationKey?: string) => client.request<Registration>(kind === 'activity' ? `/activities/${id(targetId)}/registrations` : `/activities/excursions/${id(targetId)}/registrations`, { method: 'POST', idempotencyKey: operationKey, body: { bookingPassengerId: id(bookingPassengerId), quantity } }).then(value => decodeOnboard(registrationSchema, value)),
    confirmRegistration: (registrationId: string) => client.request<Registration>(`/activities/registrations/${id(registrationId)}/confirm`, { method: 'POST' }).then(value => decodeOnboard(registrationSchema, value)),
    updateRegistration: (registrationId: string, quantity: number) => client.request<Registration>(`/activities/registrations/${id(registrationId)}`, { method: 'PUT', body: { quantity } }).then(value => decodeOnboard(registrationSchema, value)),
    cancelRegistration: (registrationId: string, reason: string) => client.request<Registration>(`/activities/registrations/${id(registrationId)}/cancel`, { method: 'POST', query: reason.trim() ? { reason: reason.trim() } : undefined }).then(value => decodeOnboard(registrationSchema, value)),
    async packages(signal?: AbortSignal) { return array<Package>(await client.request('/servicepackage/packages', { signal }), 'id'); },
    benefits: (packageId: string, signal?: AbortSignal) => client.request<PackageBenefits>(`/servicepackage/packages/${id(packageId)}/benefits`, { signal }),
    excursion: (excursionId: string, signal?: AbortSignal) => client.request<Excursion>(`/shore-excursions/${id(excursionId)}`, { signal }),
    async assignments(bookingPassengerIds: readonly string[], signal?: AbortSignal) {
      bookingPassengerIds.forEach(id);
      const allowed = new Set(bookingPassengerIds);
      const own = array<PackageAssignment>(await client.request('/servicepackage/package-assignments', { signal }), 'bookingPassengerId');
      return own.filter(row => allowed.has(row.bookingPassengerId));
    },
    savePackage: (bookingPassengerId: string, packageId: string, exists: boolean) => client.request<PackageAssignment>(`/servicepackage/package-assignments/${id(bookingPassengerId)}`, { method: exists ? 'PUT' : 'POST', body: { tourPackageId: id(packageId) } }),
    removePackage: (bookingPassengerId: string) => client.request<void>(`/servicepackage/package-assignments/${id(bookingPassengerId)}`, { method: 'DELETE' }),
  };
}
