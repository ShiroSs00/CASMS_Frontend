import { ApiError, apiRequestRaw } from '@/shared/api'
import type { Activity, ActivityDraft, Availability, CruiseOption, Participation, Registration, ScheduleCheck } from '../model/activity'

function unwrap(value: unknown, status: number): unknown {
  if (!value || typeof value !== 'object' || !('success' in value) || value.success !== true || !('data' in value)) throw new ApiError('Dữ liệu hoạt động không đúng định dạng.', status)
  return value.data
}
function record(value: unknown, status: number): Activity {
  const dto = unwrap(value, status)
  if (!dto || typeof dto !== 'object' || !('id' in dto) || typeof dto.id !== 'string' || !('name' in dto) || typeof dto.name !== 'string' || !('cruiseId' in dto) || typeof dto.cruiseId !== 'string'
    || !('code' in dto) || typeof dto.code !== 'string' || !('status' in dto) || typeof dto.status !== 'string'
    || !('startTime' in dto) || typeof dto.startTime !== 'string' || !('endTime' in dto) || typeof dto.endTime !== 'string' || !('capacity' in dto) || !Number.isSafeInteger(dto.capacity) || Number(dto.capacity) < 1) throw new ApiError('Không đọc được thông tin hoạt động.', status)
  return dto as Activity
}
function list<T>(value: unknown, status: number): T[] {
  const dto = unwrap(value, status)
  if (!Array.isArray(dto)) throw new ApiError('Danh sách hoạt động không đúng định dạng.', status)
  return dto as T[]
}
function registration(value: unknown, status: number): Registration {
  const dto = unwrap(value, status) as Registration | null
  if (!dto || typeof dto.id !== 'string' || typeof dto.bookingPassengerId !== 'string' || !Number.isSafeInteger(dto.quantity) || dto.quantity < 1 || typeof dto.status !== 'string' || (!dto.activityId && !dto.excursionId)) throw new ApiError('Không đọc được đăng ký.', status)
  return dto
}
function participation(value: unknown, status: number): Participation {
  const dto = unwrap(value, status) as Participation | null
  if (!dto || typeof dto.id !== 'string' || typeof dto.registrationId !== 'string' || typeof dto.status !== 'string') throw new ApiError('Không đọc được lượt tham gia.', status)
  return dto
}
const byId = (id: string) => '/activities/' + encodeURIComponent(id)
export const activityApi = {
  list: (signal?: AbortSignal) => apiRequestRaw('/activities', (value, status) => list<Activity>(value, status).map(item => record({ success: true, data: item }, status)), { signal }),
  get: (id: string, signal?: AbortSignal) => apiRequestRaw(byId(id), record, { signal }),
  availability: (id: string, signal?: AbortSignal) => apiRequestRaw(byId(id) + '/availability', (value, status) => {
    const dto = unwrap(value, status) as Availability | null
    if (!dto || dto.activityId !== id || !Number.isSafeInteger(dto.capacity) || !Number.isSafeInteger(dto.availableSeats)) throw new ApiError('Không đọc được số chỗ còn lại.', status)
    return dto
  }, { signal }),
  schedule: (id: string, signal?: AbortSignal) => apiRequestRaw(byId(id) + '/schedule-check', (value, status) => {
    const dto = unwrap(value, status) as ScheduleCheck | null
    if (!dto || dto.activityId !== id || typeof dto.conflictFree !== 'boolean' || !Number.isSafeInteger(dto.conflicts)) throw new ApiError('Không đọc được kết quả kiểm tra lịch.', status)
    return dto
  }, { signal }),
  registrations: (id?: string, signal?: AbortSignal) => apiRequestRaw('/activities/registrations', (value, status) => list<Registration>(value, status).map(item => registration({ success: true, data: item }, status)), { query: { activityId: id }, signal }),
  registration: (id: string, signal?: AbortSignal) => apiRequestRaw('/activities/registrations/' + encodeURIComponent(id), registration, { signal }),
  register: (kind: 'activities' | 'excursions', id: string, bookingPassengerId: string, quantity: number) => apiRequestRaw(kind === 'activities' ? byId(id) + '/registrations' : '/activities/excursions/' + encodeURIComponent(id) + '/registrations', registration, { method: 'POST', body: { bookingPassengerId, quantity } }),
  updateRegistration: (id: string, quantity: number, notes: string) => apiRequestRaw('/activities/registrations/' + encodeURIComponent(id), registration, { method: 'PUT', body: { quantity, notes } }),
  registrationAction: (id: string, action: 'confirm' | 'cancel', reason?: string) => apiRequestRaw('/activities/registrations/' + encodeURIComponent(id) + '/' + action, registration, { method: 'POST', query: action === 'cancel' ? { reason } : undefined }),
  participations: (signal?: AbortSignal) => apiRequestRaw('/activities/participations', (value, status) => list<Participation>(value, status).map(item => participation({ success: true, data: item }, status)), { signal }),
  participation: (id: string, signal?: AbortSignal) => apiRequestRaw('/activities/participations/' + encodeURIComponent(id), participation, { signal }),
  attendance: (id: string, action: 'check-in' | 'checkout' | 'complete' | 'no-show') => apiRequestRaw('/activities/participations/' + encodeURIComponent(id) + '/' + action, participation, { method: 'POST' }),
  lifecycle: (id: string, action: 'open' | 'start' | 'complete' | 'cancel') => apiRequestRaw(byId(id) + '/actions/' + action, record, { method: 'POST' }),
  remove: (id: string) => apiRequestRaw(byId(id), (_value, status) => { if (status !== 204) throw new ApiError('Chưa xác nhận xóa hoạt động.', status) }, { method: 'DELETE' }),
  async cruises(signal?: AbortSignal): Promise<CruiseOption[]> {
    const read = (page: number) => apiRequestRaw('/cruise', (value, status) => unwrap(value, status) as { content: CruiseOption[]; totalPages: number }, { query: { page, size: 100 }, signal })
    const first = await read(0), values = [...first.content]
    for (let page = 1; page < first.totalPages; page++) values.push(...(await read(page)).content)
    return values
  },
  save: (draft: ActivityDraft, id?: string) => apiRequestRaw(id ? byId(id) : '/activities', record, { method: id ? 'PUT' : 'POST', body: {
    activityName: draft.activityName.trim(), description: draft.description.trim(), location: draft.location.trim(), cruiseId: draft.cruiseId,
    startTime: new Date(draft.startTime).toISOString(), endTime: new Date(draft.endTime).toISOString(), capacity: draft.capacity, price: draft.price, currencyCode: draft.currencyCode || undefined,
  } }),
}
