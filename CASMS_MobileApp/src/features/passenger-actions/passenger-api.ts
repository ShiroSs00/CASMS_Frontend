import type { RequestOptions } from '@/lib/api/api-client';
import type { Activity, BookingCreate, BookingDetail, BookingSummary, Cabin, Cruise, Excursion, Package, PackageAssignment, PackageBenefits, Registration, Service, ServiceRequest, UserMe } from './passenger-types';

type Transport = { request<T>(path: string, options?: RequestOptions): Promise<T> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value: string) { if (!uuidPattern.test(value)) throw new Error('Mã dữ liệu không hợp lệ. Vui lòng tải lại.'); return encodeURIComponent(value); }
function array<T>(value: unknown, key: string): T[] {
  if (!Array.isArray(value) || value.some(row => !row || typeof row !== 'object' || !uuidPattern.test(row[key]))) throw new Error('Danh sách từ hệ thống không hợp lệ.');
  return value as T[];
}
function detail(value: unknown): BookingDetail {
  if (!value || typeof value !== 'object' || !('bookingId' in value) || !uuidPattern.test(String(value.bookingId)) || !('passengers' in value)) throw new Error('Thông tin đặt chỗ không hợp lệ.');
  const booking = value as BookingDetail;
  array(booking.passengers, 'bookingPassengerId');
  if (!['Draft', 'Confirmed', 'Cancelled'].includes(booking.bookingStatus)) throw new Error('Trạng thái đặt chỗ không hợp lệ.');
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
    cruises: (signal?: AbortSignal) => pages<Cruise>('/cruise', 'cruiseId', signal, { status: 'PUBLISHED' }),
    async booking(bookingId: string, signal?: AbortSignal) { return detail(await client.request(`/booking/${id(bookingId)}`, { signal })); },
    async createBooking(body: BookingCreate) { return detail(await client.request('/booking', { method: 'POST', body })); },
    async cancelBooking(bookingId: string, reason: string) {
      if (!reason.trim()) throw new Error('Vui lòng nhập lý do hủy.');
      return detail(await client.request(`/booking/${id(bookingId)}/cancel`, { method: 'POST', body: { reason: reason.trim() } }));
    },
    async cabins(cruiseId: string, signal?: AbortSignal) { return array<Cabin>(await client.request('/booking/available-cabins', { query: { cruiseId: id(cruiseId) }, signal }), 'cabinId'); },
    async services(signal?: AbortSignal) { return array<Service>(await client.request('/servicepackage/services', { signal }), 'id'); },
    serviceAvailability: (serviceId: string, quantity: number) => client.request<{ serviceId: string; requestedQuantity: number; available: boolean }>(`/servicepackage/services/${id(serviceId)}/availability`, { query: { quantity } }),
    async requests(signal?: AbortSignal) { return array<ServiceRequest>(await client.request('/servicepackage/requests', { signal }), 'id'); },
    createRequest: (serviceId: string, bookingPassengerId: string, quantity: number, note: string) => client.request<ServiceRequest>('/servicepackage/requests', { method: 'POST', body: { serviceId: id(serviceId), bookingPassengerId: id(bookingPassengerId), quantity, note: note.trim() || null } }),
    updateRequest: (requestId: string, quantity: number, note: string) => client.request<ServiceRequest>(`/servicepackage/requests/${id(requestId)}`, { method: 'PUT', body: { quantity, note: note.trim() || null } }),
    cancelRequest: (requestId: string) => client.request<ServiceRequest>(`/servicepackage/requests/${id(requestId)}/cancel`, { method: 'POST' }),
    async activities(signal?: AbortSignal) { return array<Activity>(await client.request('/activities', { signal }), 'id'); },
    activityAvailability: (activityId: string, signal?: AbortSignal) => client.request<{ activityId: string; capacity: number; availableSeats: number; status: string }>(`/activities/${id(activityId)}/availability`, { signal }),
    async excursions(cruiseId: string, signal?: AbortSignal) {
      id(cruiseId);
      const itineraries = await pages<{ itineraryId: string; cruiseId: string; status: string }>('/itineraries', 'itineraryId', signal);
      const relevant = itineraries.filter(i => i.cruiseId === cruiseId && ['OPEN_FOR_SALE', 'ACTIVE', 'APPROVED'].includes(i.status));
      const stopLists = await Promise.all(relevant.map(i => client.request(`/cruise-stops/by-itinerary/${id(i.itineraryId)}`, { signal }).then(value => array<{ cruiseStopId: string }>(value, 'cruiseStopId'))));
      const stops = [...new Map(stopLists.flat().map(s => [s.cruiseStopId, s])).values()];
      const lists = await Promise.all(stops.map(stop => client.request('/shore-excursions', { query: { cruiseStopId: stop.cruiseStopId }, signal }).then(value => array<Excursion>(value, 'shoreExcursionId'))));
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
