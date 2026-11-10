import type { RequestOptions } from '../../lib/api/api-client';
import { z } from 'zod';
import type { Activity, BookingDetail, BookingSummary, Excursion, Package, PackageAssignment, PackageBenefits, Registration, Service, ServiceRequest, ServiceSchedule, UserMe } from './passenger-types';

type Transport = { request<T>(path: string, options?: RequestOptions): Promise<T> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = z.guid();
const date = z.iso.datetime({ offset: true });
const nullableText = z.string().nullable().default(null);
const nullableAmount = z.number().finite().nonnegative().nullable().default(null);
// At 2^39, binary64 spacing exceeds the Backend NUMERIC(19,4) unit of 0.0001.
const requiredFinancialAmount = z.number().finite().nonnegative().lt(2 ** 39);
const financialAmount = requiredFinancialAmount.nullable().default(null);
const bookingDetail = z.object({
  bookingId: uuid, bookingReference: z.string().min(1), cruiseId: uuid, cruiseCode: z.string(), cruiseName: z.string(),
  bookingStatus: z.enum(['Draft', 'Confirmed', 'Cancelled']), departureDatetime: date, returnDatetime: date, createdAt: date,
  agreedFareAmount: financialAmount, currency: nullableText, shipName: nullableText, requiredDepositAmount: financialAmount,
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
    participationStatus: z.enum(['Active', 'Cancelled']), ownedByCurrentUser: z.boolean().optional(),
    cabinId: uuid.nullable().default(null), cabinNumber: nullableText, cabinType: nullableText,
    deckNumber: z.number().int().nullable().default(null), tourPackageId: uuid.nullable().default(null),
    tourPackageName: nullableText, agreedPackagePrice: nullableAmount,
  })),
});
const notification = z.object({
  notificationId: uuid, title: z.string(), content: z.string(), notificationType: z.string(),
  createdAt: date, readAt: date.nullish(),
});
const checkin = z.object({
  cruiseCheckinId: uuid, bookingPassengerId: uuid,
  checkinStatus: z.enum(['NotStarted', 'InProgress', 'NeedsReview', 'Completed', 'BoardingReady']),
  emergencyContactName: z.string().nullish(), emergencyContactPhone: z.string().nullish(),
  locationTrackingAllowed: z.boolean().nullish(), locationSharingAllowed: z.boolean().nullish(),
  completedAt: date.nullish(), boardingReadyAt: date.nullish(),
});
const payment = z.object({
  paymentId: uuid, bookingId: uuid, operationType: z.enum(['Collect', 'Void']),
  requestedAmount: z.number().nullish(), confirmedAmount: z.number().nullish(), currency: z.string(),
  requestedAt: date.nullish(), confirmedAt: date.nullish(), status: z.enum(['Pending', 'Confirmed', 'Failed', 'Cancelled']),
});
const personalVoyage = z.object({
  bookingId: uuid, bookingReference: z.string(), bookingPassengerId: uuid, cruiseId: uuid, cruiseName: z.string(), cruiseStatus: z.string(),
  bookingStatus: z.enum(['Confirmed', 'Cancelled']), participationStatus: z.string(), itineraryId: uuid.nullish(),
  itineraryStatus: z.string().nullish(), startDate: z.iso.date().nullish(), endDate: z.iso.date().nullish(),
  registeredActivities: z.array(z.object({
    registrationId: uuid, name: z.string(), startTime: date.nullish(), endTime: date.nullish(),
    location: z.string().nullish(), registrationStatus: z.string(), activityStatus: z.string(),
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
function serviceRequest(value: ServiceRequest): ServiceRequest {
  if (!value || !uuidPattern.test(value.id) || !uuidPattern.test(value.serviceId)
      || !Number.isSafeInteger(value.quantity) || value.quantity < 1
      || (value.unitPriceSnapshot != null && (!Number.isFinite(value.unitPriceSnapshot) || value.unitPriceSnapshot < 0))
      || (value.fulfilledQuantity != null && (!Number.isSafeInteger(value.fulfilledQuantity) || value.fulfilledQuantity < 0))
      || (value.usageLimitSnapshot != null && (!Number.isSafeInteger(value.usageLimitSnapshot) || value.usageLimitSnapshot < 1))
      || (value.usageMode != null && !['LEGACY','PRE_CRUISE','ONBOARD'].includes(value.usageMode))
      || (value.usagePolicySnapshot != null && !['UNLIMITED','PER_DAY','PER_CRUISE'].includes(value.usagePolicySnapshot)))
    throw new Error('Thông tin yêu cầu dịch vụ chưa hợp lệ.');
  return value;
}
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
    async me(signal?: AbortSignal) {
      const value = await client.request<UserMe>('/auth/me', { signal });
      if (!value || !uuidPattern.test(value.userId) || !Array.isArray(value.roles) || !value.roles.every(r => typeof r === 'string') || !Array.isArray(value.effectivePermissions) || !value.effectivePermissions.every(p => typeof p === 'string')) throw new Error('Không xác minh được quyền tài khoản.');
      return value;
    },
    bookings: (signal?: AbortSignal) => pages<BookingSummary>('/booking', 'bookingId', signal),
    async voyages(signal?: AbortSignal) { return decode(z.array(personalVoyage), await client.request('/itineraries/mine', { signal })); },
    async notifications(signal?: AbortSignal) { return decode(z.array(notification), await client.request('/notifications', { signal })); },
    async markNotificationRead(notificationId: string) {
      const result = decode(notification, await client.request(`/notifications/${id(notificationId)}/read`, { method: 'PATCH' }));
      if (result.notificationId !== notificationId || !result.readAt) throw new Error('Chưa xác nhận được trạng thái đã đọc.');
      return result;
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
      `/decks/by-ship/${id(shipId)}`, 'deckId', signal),
    async booking(bookingId: string, signal?: AbortSignal) {
      const value = detail(await client.request(`/booking/${id(bookingId)}`, { signal }));
      if (value.bookingId !== bookingId.toLowerCase()) throw new Error('Thông tin không khớp đặt chỗ.');
      return value;
    },
    async cancelBooking(bookingId: string, reason: string) {
      if (!reason.trim()) throw new Error('Vui lòng nhập lý do hủy.');
      const value = detail(await client.request(`/booking/${id(bookingId)}/cancel`, { method: 'POST', body: { reason: reason.trim() } }));
      if (value.bookingId !== bookingId.toLowerCase() || value.bookingStatus !== 'Cancelled') throw new Error('Chưa xác nhận được việc hủy đặt chỗ.');
      return value;
    },
    async services(signal?: AbortSignal) { return array<Service>(await client.request('/servicepackage/services', { signal }), 'id'); },
    serviceAvailability: (serviceId: string, quantity: number) => client.request<{ serviceId: string; requestedQuantity: number; available: boolean }>(`/servicepackage/services/${id(serviceId)}/availability`, { query: { quantity } }),
    async requests(signal?: AbortSignal) { return array<ServiceRequest>(await client.request('/servicepackage/requests', { signal }), 'id').map(serviceRequest); },
    async serviceSchedules(serviceId: string, signal?: AbortSignal) {
      const slots = array<ServiceSchedule>(await client.request(`/servicepackage/services/${id(serviceId)}/schedules`, { signal }), 'id');
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
    updateRequest: (requestId: string, quantity: number, note: string) => client.request<ServiceRequest>(`/servicepackage/requests/${id(requestId)}`, { method: 'PUT', body: { quantity, note: note.trim() || null } }),
    cancelRequest: (requestId: string) => client.request<ServiceRequest>(`/servicepackage/requests/${id(requestId)}/cancel`, { method: 'POST' }),
    async activities(signal?: AbortSignal) { return array<Activity>(await client.request('/activities', { signal }), 'id'); },
    activityAvailability: (activityId: string, signal?: AbortSignal) => client.request<{ activityId: string; capacity: number; availableSeats: number; status: string }>(`/activities/${id(activityId)}/availability`, { signal }),
    excursionAvailability: (excursionId: string, participants: number) => client.request<Excursion>(
      `/shore-excursions/${id(excursionId)}/availability`, { query: { participants } }),
    async excursions(cruiseId: string, signal?: AbortSignal) {
      id(cruiseId);
      const voyages = decode(z.array(personalVoyage), await client.request('/itineraries/mine', { signal }));
      const voyage = voyages.find(i => i.cruiseId === cruiseId && i.bookingStatus === 'Confirmed'
        && i.participationStatus === 'Active' && i.itineraryId && ['OPEN_FOR_SALE', 'ACTIVE'].includes(i.itineraryStatus ?? ''));
      if (!voyage?.itineraryId) return [];
      const stops = array<{ cruiseStopId: string; status?: string; itineraryId: string }>(
        await client.request(`/cruise-stops/by-itinerary/${id(voyage.itineraryId)}`, { signal }), 'cruiseStopId')
        .filter(stop => stop.itineraryId === voyage.itineraryId && stop.status !== 'OMITTED' && stop.status !== 'SUBSTITUTED');
      const lists = await Promise.all(stops.map(async stop =>
        array<Excursion>(await client.request('/shore-excursions', { query: { cruiseStopId: stop.cruiseStopId }, signal }), 'shoreExcursionId')
          .filter(item => item.cruiseStopId === stop.cruiseStopId)));
      return [...new Map(lists.flat().map(e => [e.shoreExcursionId, e])).values()];
    },
    async registrations(signal?: AbortSignal) { return array<Registration>(await client.request('/activities/registrations', { signal }), 'id'); },
    register: (kind: 'activity' | 'excursion', targetId: string, bookingPassengerId: string, quantity: number) => client.request<Registration>(kind === 'activity' ? `/activities/${id(targetId)}/registrations` : `/activities/excursions/${id(targetId)}/registrations`, { method: 'POST', body: { bookingPassengerId: id(bookingPassengerId), quantity } }),
    confirmRegistration: (registrationId: string) => client.request<Registration>(`/activities/registrations/${id(registrationId)}/confirm`, { method: 'POST' }),
    updateRegistration: (registrationId: string, quantity: number) => client.request<Registration>(`/activities/registrations/${id(registrationId)}`, { method: 'PUT', body: { quantity } }),
    cancelRegistration: (registrationId: string, reason: string) => client.request<Registration>(`/activities/registrations/${id(registrationId)}/cancel`, { method: 'POST', query: reason.trim() ? { reason: reason.trim() } : undefined }),
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
