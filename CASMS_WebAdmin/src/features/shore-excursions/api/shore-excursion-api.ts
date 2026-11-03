import { ApiError, apiRequestRaw } from '@/shared/api'
import { isUuid, normalizeExcursion, normalizeExcursions, type ExcursionRequest, type ExcursionStatus, type LifecycleAction } from '../model/shore-excursion'

export type ExcursionFilters = { cruiseStopId?: string; supplierId?: string; status?: ExcursionStatus }
const base = '/shore-excursions'
function path(id: string) {
  if (!isUuid(id)) throw new ApiError('ID chuyến tham quan không hợp lệ.', 0)
  return `${base}/${encodeURIComponent(id)}`
}
function decoder<T>(normalize: (payload: unknown) => T) {
  return (payload: unknown, status: number): T => {
    try { return normalize(payload) } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : 'Dữ liệu không hợp lệ.', status)
    }
  }
}
const excursion = decoder(normalizeExcursion)
export const shoreExcursionApi = {
  list: (filters: ExcursionFilters, signal?: AbortSignal) => apiRequestRaw(base, decoder(normalizeExcursions), { query: filters, signal }),
  get: (id: string, signal?: AbortSignal) => apiRequestRaw(path(id), excursion, { signal }),
  create: (body: ExcursionRequest, signal?: AbortSignal) => apiRequestRaw(base, excursion, { method: 'POST', body, signal }),
  update: (id: string, body: ExcursionRequest, signal?: AbortSignal) => apiRequestRaw(path(id), excursion, { method: 'PUT', body, signal }),
  remove: (id: string, signal?: AbortSignal) => apiRequestRaw(path(id), (_payload, status) => {
    if (status !== 204) throw new ApiError('Phản hồi xóa chuyến tham quan không đúng định dạng.', status)
  }, { method: 'DELETE', signal }),
  transition: (id: string, action: LifecycleAction, reason?: string, signal?: AbortSignal) => apiRequestRaw(`${path(id)}/${action}`, excursion, {
    method: 'PATCH', body: action === 'cancel' ? { reason } : undefined, signal,
  }),
  refreshCapacity: (id: string, signal?: AbortSignal) => apiRequestRaw(`${path(id)}/refresh-capacity`, excursion, { method: 'PATCH', signal }),
  availability: (id: string, participants: number, signal?: AbortSignal) => apiRequestRaw(`${path(id)}/availability`, excursion, { query: { participants }, signal }),
  validate: (id: string, signal?: AbortSignal) => apiRequestRaw(`${path(id)}/validate`, decoder((payload) => {
    if (!payload || typeof payload !== 'object' || !('message' in payload) || typeof payload.message !== 'string') throw new Error('Kết quả kiểm tra không đúng định dạng.')
    return payload.message
  }), { method: 'POST', signal }),
}
