import { apiRequest, apiRequestRaw } from '@/shared/api'

type Row = Record<string, unknown>
function row(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dữ liệu dịch vụ không hợp lệ.'); return value as Row }
function text(value: unknown): string { if (typeof value !== 'string' || !value.trim()) throw new Error('Thông tin dịch vụ không đầy đủ.'); return value }
function optional(value: unknown): string | null { if (value == null) return null; if (typeof value !== 'string') throw new Error('Thông tin dịch vụ không hợp lệ.'); return value }
function count(value: unknown, min = 0): number { if (!Number.isSafeInteger(value) || (value as number) < min) throw new Error('Số lượng không hợp lệ.'); return value as number }
function money(value: unknown): number | null { if (value == null) return null; if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Giá không hợp lệ.'); return value }
function currency(value: unknown): string | null { if (value == null) return null; const code = text(value); if (!/^[A-Z]{3}$/.test(code)) throw new Error('Tiền tệ không hợp lệ.'); return code }
function time(value: unknown): string { const result = text(value); if (!Number.isFinite(Date.parse(result))) throw new Error('Thời gian không hợp lệ.'); return result }
function state(value: unknown, allowed: string[]): string { const result = text(value); if (!allowed.includes(result)) throw new Error('Trạng thái chưa được hỗ trợ.'); return result }
function list<T>(value: unknown, decode: (item: unknown) => T): T[] { if (!Array.isArray(value)) throw new Error('Danh sách dịch vụ không hợp lệ.'); return value.map(decode) }
function identity<T extends { id: string }>(item: T, id: string): T { if (item.id !== id) throw new Error('Dữ liệu trả về không khớp yêu cầu.'); return item }
const part = (id: string) => encodeURIComponent(text(id))

export type CustomerPackage = { id: string; name: string; code: string; description: string | null; type: string; price: number; currency: string; status: string; startDate: string | null; endDate: string | null }
export function decodeCustomerPackage(value: unknown): CustomerPackage {
  const v = row(value), price = money(v.price), code = currency(v.currency)
  if (price == null || code == null) throw new Error('Giá gói không đầy đủ.')
  for (const key of ['startDate', 'endDate']) if (v[key] != null && (!/^\d{4}-\d{2}-\d{2}$/.test(String(v[key])) || !Number.isFinite(Date.parse(String(v[key]))) || new Date(String(v[key])).toISOString().slice(0, 10) !== v[key])) throw new Error('Ngày áp dụng gói không hợp lệ.')
  return { id: text(v.id), name: text(v.name), code: text(v.code), description: optional(v.description), type: state(v.type, ['BASIC', 'PREMIUM', 'ADVANCED']), price, currency: code, status: state(v.status, ['DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED', 'CANCELLED']), startDate: optional(v.startDate), endDate: optional(v.endDate) }
}
export type CustomerActivity = { id: string; cruiseId: string; name: string; description: string | null; startTime: string; endTime: string; location: string | null; capacity: number; price: number | null; currency: string | null; status: string }
export function decodeCustomerActivity(value: unknown): CustomerActivity {
  const v = row(value)
  return { id: text(v.id), cruiseId: text(v.cruiseId), name: text(v.name), description: optional(v.description), startTime: time(v.startTime), endTime: time(v.endTime), location: optional(v.location), capacity: count(v.capacity, 1), price: money(v.price), currency: currency(v.currencyCode), status: state(v.status, ['PLANNED', 'OPEN', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']) }
}
export type CustomerRegistration = { id: string; passengerId: string; bookingPassengerId: string; activityId: string | null; excursionId: string | null; quantity: number; status: string; notes?: string | null; registeredAt: string }
export function decodeCustomerRegistration(value: unknown): CustomerRegistration {
  const v = row(value), activityId = optional(v.activityId), excursionId = optional(v.excursionId)
  if (Boolean(activityId) === Boolean(excursionId)) throw new Error('Đăng ký cần đúng một hoạt động hoặc tour tham quan.')
  return { id: text(v.id), passengerId: text(v.passengerId), bookingPassengerId: text(v.bookingPassengerId), activityId, excursionId, quantity: count(v.quantity, 1), status: state(v.status, ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']), notes: optional(v.notes), registeredAt: time(v.registeredAt) }
}
export type CustomerService = { id: string; name: string; description: string | null; type: string; price: number | null; currency: string | null; capacity: number | null; status: string }
export function decodeCustomerService(value: unknown): CustomerService {
  const v = row(value)
  return { id: text(v.id), name: text(v.name), description: optional(v.description), type: text(v.type), price: money(v.price), currency: currency(v.currency), capacity: v.capacity == null ? null : count(v.capacity, 1), status: state(v.status, ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'CANCELLED']) }
}
export type CustomerServiceRequest = { id: string; passengerId: string; serviceId: string; bookingId: string | null; bookingPassengerId: string | null; quantity: number; note: string | null; status: string; requestTime: string; completedAt: string | null }
export function decodeCustomerServiceRequest(value: unknown): CustomerServiceRequest {
  const v = row(value)
  return { id: text(v.id), passengerId: text(v.passengerId), serviceId: text(v.serviceId), bookingId: optional(v.bookingId), bookingPassengerId: optional(v.bookingPassengerId), quantity: count(v.quantity, 1), note: optional(v.note), status: state(v.status, ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED']), requestTime: time(v.requestTime), completedAt: v.completedAt == null ? null : time(v.completedAt) }
}
export type CustomerExcursion = { id: string; cruiseStopId: string; name: string; startTime: string; endTime: string; meetingPoint: string | null; maximumCapacity: number; availableCapacity: number; price: number | null; currency: string | null; status: string }
export function decodeCustomerExcursion(value: unknown): CustomerExcursion {
  const v = row(value), capacity = count(v.maximumCapacity, 1), available = count(v.availableCapacity)
  if (available > capacity) throw new Error('Chỗ trống tour tham quan không hợp lệ.')
  return { id: text(v.shoreExcursionId), cruiseStopId: text(v.cruiseStopId), name: text(v.excursionName), startTime: time(v.startTime), endTime: time(v.plannedReturnTime), meetingPoint: optional(v.meetingPoint), maximumCapacity: capacity, availableCapacity: available, price: money(v.price), currency: currency(v.currencyCode), status: state(v.status, ['PLANNED', 'OPEN', 'FULL', 'CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']) }
}
function positive(quantity: number) { return count(quantity, 1) }
function note(value: string) { if (value.length > 500) throw new Error('Ghi chú tối đa 500 ký tự.'); return value.trim() || undefined }
function registrationResult(value: unknown, id: string | null, expected: string, quantity?: number) {
  const result = decodeCustomerRegistration(value)
  if ((id && result.id !== id) || result.status !== expected || (quantity != null && result.quantity !== quantity)) throw new Error('Kết quả đăng ký chưa khớp thao tác. Kiểm tra kết quả trước khi gửi lại.')
  return result
}
function requestResult(value: unknown, id: string | null, expected: string, quantity?: number) {
  const result = decodeCustomerServiceRequest(value)
  if ((id && result.id !== id) || result.status !== expected || (quantity != null && result.quantity !== quantity)) throw new Error('Kết quả dịch vụ chưa khớp thao tác. Kiểm tra kết quả trước khi gửi lại.')
  return result
}
const registrationPath = (id: string) => '/activities/registrations/' + part(id)
const requestPath = (id: string) => '/servicepackage/requests/' + part(id)
export const customerExtrasApi = {
  async package(id: string, signal?: AbortSignal) { return identity(decodeCustomerPackage(await apiRequest<unknown>('/servicepackage/packages/' + part(id), { signal })), id) },
  async activities(cruiseId: string, signal?: AbortSignal) {
    // This endpoint has no cruiseId filter and returns a complete, unpaged list.
    return list(await apiRequest<unknown>('/activities', { signal }), decodeCustomerActivity).filter(item => item.cruiseId === cruiseId)
  },
  async activity(id: string, cruiseId: string, signal?: AbortSignal) { const item = identity(decodeCustomerActivity(await apiRequest<unknown>('/activities/' + part(id), { signal })), id); if (item.cruiseId !== cruiseId) throw new Error('Hoạt động không thuộc chuyến đi này.'); return item },
  async activityAvailability(id: string, signal?: AbortSignal) {
    const v = row(await apiRequest<unknown>('/activities/' + part(id) + '/availability', { signal }))
    if (v.activityId !== id) throw new Error('Chỗ trống trả về không khớp hoạt động.')
    const capacity = count(v.capacity, 1), availableSeats = count(v.availableSeats)
    if (availableSeats > capacity) throw new Error('Chỗ trống không hợp lệ.')
    return { capacity, availableSeats, status: state(v.status, ['PLANNED', 'OPEN', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']) }
  },
  async registrations(signal?: AbortSignal) { return list(await apiRequest<unknown>('/activities/registrations', { signal }), decodeCustomerRegistration) },
  async registration(id: string, signal?: AbortSignal) { return identity(decodeCustomerRegistration(await apiRequest<unknown>(registrationPath(id), { signal })), id) },
  async registerActivity(id: string, bookingPassengerId: string, quantity: number) {
    const result = registrationResult(await apiRequest<unknown>('/activities/' + part(id) + '/registrations', { method: 'POST', body: { bookingPassengerId, quantity: positive(quantity) } }), null, 'PENDING', quantity)
    if (result.activityId !== id || result.bookingPassengerId !== bookingPassengerId) throw new Error('Kết quả đăng ký không khớp yêu cầu. Kiểm tra trước khi gửi lại.')
    return result
  },
  async confirmRegistration(id: string) { return registrationResult(await apiRequest<unknown>(registrationPath(id) + '/confirm', { method: 'POST' }), id, 'CONFIRMED') },
  async updateRegistration(id: string, quantity: number, notes: string) { return registrationResult(await apiRequest<unknown>(registrationPath(id), { method: 'PUT', body: { quantity: positive(quantity), notes: note(notes) } }), id, 'PENDING', quantity) },
  async cancelRegistration(id: string, reason: string) { return registrationResult(await apiRequest<unknown>(registrationPath(id) + '/cancel', { method: 'POST', query: { reason: note(reason) } }), id, 'CANCELLED') },
  async excursions(cruiseStopId: string, signal?: AbortSignal) {
    const result = await apiRequestRaw('/shore-excursions', value => list(value, decodeCustomerExcursion), { query: { cruiseStopId, status: 'OPEN' }, signal })
    if (result.some(item => item.cruiseStopId !== cruiseStopId)) throw new Error('Tour trả về không thuộc điểm dừng của chuyến này.')
    return result
  },
  async excursion(id: string, cruiseStopId: string, signal?: AbortSignal) {
    const item = identity(await apiRequestRaw('/shore-excursions/' + part(id), decodeCustomerExcursion, { signal }), id)
    if (item.cruiseStopId !== cruiseStopId) throw new Error('Tour không thuộc điểm dừng của chuyến này.')
    return item
  },
  async excursionAvailability(id: string, cruiseStopId: string, participants: number, signal?: AbortSignal) {
    const item = identity(await apiRequestRaw('/shore-excursions/' + part(id) + '/availability', decodeCustomerExcursion, { query: { participants: positive(participants) }, signal }), id)
    if (item.cruiseStopId !== cruiseStopId || item.availableCapacity < participants) throw new Error('Chỗ trống tour không khớp yêu cầu.')
    return item
  },
  async registerExcursion(id: string, bookingPassengerId: string, quantity: number) {
    const result = registrationResult(await apiRequest<unknown>('/activities/excursions/' + part(id) + '/registrations', { method: 'POST', body: { bookingPassengerId, quantity: positive(quantity) } }), null, 'PENDING', quantity)
    if (result.excursionId !== id || result.bookingPassengerId !== bookingPassengerId) throw new Error('Kết quả tour không khớp yêu cầu. Kiểm tra trước khi gửi lại.')
    return result
  },
  async services(signal?: AbortSignal) { return list(await apiRequest<unknown>('/servicepackage/services', { signal }), decodeCustomerService).filter(item => item.status === 'ACTIVE') },
  async service(id: string, signal?: AbortSignal) { return identity(decodeCustomerService(await apiRequest<unknown>('/servicepackage/services/' + part(id), { signal })), id) },
  async serviceAvailability(id: string, quantity: number, signal?: AbortSignal) {
    const v = row(await apiRequest<unknown>('/servicepackage/services/' + part(id) + '/availability', { query: { quantity: positive(quantity) }, signal }))
    if (v.serviceId !== id || v.requestedQuantity !== quantity || typeof v.available !== 'boolean') throw new Error('Thông tin khả dụng không khớp dịch vụ yêu cầu.')
    return v.available
  },
  async requests(signal?: AbortSignal) { return list(await apiRequest<unknown>('/servicepackage/requests', { signal }), decodeCustomerServiceRequest) },
  async request(id: string, signal?: AbortSignal) { return identity(decodeCustomerServiceRequest(await apiRequest<unknown>(requestPath(id), { signal })), id) },
  async createRequest(serviceId: string, bookingPassengerId: string, quantity: number, value: string) {
    const result = requestResult(await apiRequest<unknown>('/servicepackage/requests', { method: 'POST', body: { serviceId, bookingPassengerId, quantity: positive(quantity), note: note(value) } }), null, 'REQUESTED', quantity)
    if (result.serviceId !== serviceId || result.bookingPassengerId !== bookingPassengerId) throw new Error('Kết quả dịch vụ không khớp yêu cầu. Kiểm tra trước khi gửi lại.')
    return result
  },
  async updateRequest(id: string, quantity: number, value: string) { return requestResult(await apiRequest<unknown>(requestPath(id), { method: 'PUT', body: { quantity: positive(quantity), note: note(value) } }), id, 'REQUESTED', quantity) },
  async cancelRequest(id: string) { return requestResult(await apiRequest<unknown>(requestPath(id) + '/cancel', { method: 'POST' }), id, 'CANCELLED') },
}
