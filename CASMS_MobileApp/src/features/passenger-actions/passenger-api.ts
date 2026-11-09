import { ApiError, type RequestOptions } from '../../lib/api/api-client';
import { z } from 'zod';
import { bookingErrorMessage } from './booking-policy';
import type { Activity, BookingCreate, BookingDetail, BookingSummary, Cabin, Cruise, Excursion, Package, PackageAssignment, PackageBenefits, Registration, Service, ServiceRequest, ServiceSchedule, UserMe } from './passenger-types';

type Transport = { request<T>(path: string, options?: RequestOptions): Promise<T> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = z.guid();
const date = z.iso.datetime({ offset: true });
const nullableText = z.string().nullable().default(null);
const nullableAmount = z.number().finite().nonnegative().nullable().default(null);
const bookingDetail = z.object({
  bookingId: uuid, bookingReference: z.string().min(1), cruiseId: uuid, cruiseCode: z.string(), cruiseName: z.string(),
  bookingStatus: z.enum(['Draft', 'Confirmed', 'Cancelled']), departureDatetime: date, returnDatetime: date, createdAt: date,
  agreedFareAmount: nullableAmount, currency: nullableText, shipName: nullableText, requiredDepositAmount: nullableAmount,
  contractReference: nullableText, contractStatus: nullableText, contractSigningInstructions: nullableText, cancellationReason: nullableText,
  paymentPlan: z.enum(['FULL', 'DEPOSIT', 'STAGES']).nullable().default(null),
  installments: z.array(z.object({
    sequenceNo: z.number().int().positive(), requiredAmount: z.number().finite().nonnegative(), currency: z.string(),
    dueAt: date.nullable().default(null), status: z.string(), description: nullableText,
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
const bookingQuote = z.object({
  quoteId: uuid, cruiseId: uuid, currency: z.literal('USD'),
  paymentPlan: z.enum(['FULL', 'DEPOSIT', 'STAGES']), status: z.literal('ACTIVE'),
  totalAmount: z.number().nonnegative(), expiresAt: date,
  guestToken: z.string().min(1).max(100).nullish(),
  lineItems: z.array(z.object({ cabinId: uuid, tourPackageId: uuid.nullish() })),
});
const bookingInput = z.object({
  cruiseId: uuid, currency: z.literal('USD'), quoteId: uuid,
  quoteGuestToken: z.string().min(1).max(100).optional(),
  paymentPlan: z.enum(['FULL', 'DEPOSIT', 'STAGES']), notes: z.string().max(500).optional(),
  passengers: z.array(z.object({
    fullName: z.string().trim().min(2).max(100), cabinId: uuid,
    email: z.email().optional(), phoneNumber: z.string().regex(/^\+?\d{8,15}$/).optional(),
  })).min(1),
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
  return booking;
}
function ownedBooking(value: unknown, owner: string, cruiseId: string) {
  const booking = detail(value);
  if (!value || typeof value !== 'object' || !('bookedByUserId' in value)
    || value.bookedByUserId !== owner || booking.cruiseId !== cruiseId) {
    throw new Error('Không xác minh được chủ sở hữu hoặc chuyến của đặt chỗ.');
  }
  return booking;
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
    cruises: (signal?: AbortSignal) => pages<Cruise>('/cruise', 'cruiseId', signal, { status: 'PUBLISHED', saleState: 'OPEN_FOR_SALE' }),
    async booking(bookingId: string, signal?: AbortSignal) {
      const value = detail(await client.request(`/booking/${id(bookingId)}`, { signal }));
      if (value.bookingId !== bookingId.toLowerCase()) throw new Error('Thông tin không khớp đặt chỗ.');
      return value;
    },
    async bookingQuote(body: BookingCreate) {
      const { cruiseId, paymentPlan, passengers } = body;
      // Quote requests omit passenger PII but still validate the same selection.
      bookingInput.parse({ ...body, currency: 'USD', quoteId: cruiseId });
      const value = decode(bookingQuote, await client.request('/booking/quotes', { method: 'POST', body: {
        cruiseId, paymentPlan, currency: 'USD', passengers: passengers.map(({ cabinId }) => ({ cabinId })),
      } }));
      const selection = passengers.map(person => person.cabinId.toLowerCase()).sort();
      const quoted = value.lineItems.map(line => line.cabinId).sort();
      if (value.cruiseId !== cruiseId.toLowerCase() || value.paymentPlan !== paymentPlan || Date.parse(value.expiresAt) <= Date.now()
        || value.lineItems.length !== passengers.length
        || quoted.some((cabinId, i) => cabinId !== selection[i]) || value.lineItems.some(line => line.tourPackageId)) {
        throw new Error('Báo giá đã hết hạn hoặc không khớp lựa chọn. Vui lòng lấy báo giá mới.');
      }
      return value;
    },
    async createBooking(body: BookingCreate & { quoteId: string; currency: 'USD' }, bookingIdempotencyKey: string, owner: string) {
      z.uuidv4().parse(bookingIdempotencyKey);
      uuid.parse(owner);
      const input = bookingInput.parse(body);
      try {
        return ownedBooking(await client.request('/booking', { method: 'POST', body: input, bookingIdempotencyKey }), owner, input.cruiseId);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        // A server message may echo the recovery key or contact information.
        throw new ApiError(bookingErrorMessage(error), error.status, error.code);
      }
    },
    async recoverBooking(idempotencyKey: string, owner: string, cruiseId: string) {
      try {
        const value = await client.request('/booking/recovery', { query: { idempotencyKey } });
        return { state: 'completed' as const, booking: ownedBooking(value, owner, cruiseId) };
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        if (error.status === 404 && error.code === 'RECOVERY_NOT_FOUND') return { state: 'not-recorded' as const };
        if (error.status === 409 && error.code === 'RECOVERY_IN_PROGRESS') return { state: 'processing' as const };
        throw new ApiError(error.status === 0 ? error.message : 'Chưa xác minh được kết quả đặt chỗ.', error.status, error.code);
      }
    },
    async cancelBooking(bookingId: string, reason: string) {
      if (!reason.trim()) throw new Error('Vui lòng nhập lý do hủy.');
      const value = detail(await client.request(`/booking/${id(bookingId)}/cancel`, { method: 'POST', body: { reason: reason.trim() } }));
      if (value.bookingId !== bookingId.toLowerCase() || value.bookingStatus !== 'Cancelled') throw new Error('Chưa xác nhận được việc hủy đặt chỗ.');
      return value;
    },
    async cabins(cruiseId: string, signal?: AbortSignal) { return array<Cabin>(await client.request('/booking/available-cabins', { query: { cruiseId: id(cruiseId) }, signal }), 'cabinId'); },
    async services(signal?: AbortSignal) { return array<Service>(await client.request('/servicepackage/services', { signal }), 'id'); },
    serviceAvailability: (serviceId: string, quantity: number) => client.request<{ serviceId: string; requestedQuantity: number; available: boolean }>(`/servicepackage/services/${id(serviceId)}/availability`, { query: { quantity } }),
    async serviceSchedules(serviceId: string, signal?: AbortSignal) {
      return array<ServiceSchedule>(await client.request(`/servicepackage/services/${id(serviceId)}/schedules`, { signal }), 'id');
    },
    async requests(signal?: AbortSignal) { return array<ServiceRequest>(await client.request('/servicepackage/requests', { signal }), 'id'); },
    createRequest: (serviceId: string, bookingPassengerId: string, quantity: number, note: string, scheduleId?: string, idempotencyKey?: string) => client.request<ServiceRequest>('/servicepackage/requests', { method: 'POST', body: {
      serviceId: id(serviceId), bookingPassengerId: id(bookingPassengerId), quantity, note: note.trim() || null,
      ...(scheduleId ? { serviceScheduleId: id(scheduleId) } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    } }),
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
