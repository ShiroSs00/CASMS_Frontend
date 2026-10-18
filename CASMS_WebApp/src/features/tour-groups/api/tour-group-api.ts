import { ApiError, apiRequestRaw } from '@/shared/api'
import { isUuid, normalizeCapacity, normalizeGroup, normalizeGroups, type GroupAction, type GroupRequest, type GroupStatus } from '../model/tour-group'

export type GroupFilters = { excursionId?: string; guideId?: string; status?: GroupStatus }
const base = '/tour-groups'
function uuid(value: string) { if (!isUuid(value)) throw new ApiError('ID UUID không hợp lệ.', 0); return encodeURIComponent(value) }
const path = (id: string) => `${base}/${uuid(id)}`
function decode<T>(normalize: (payload: unknown) => T) {
  return (payload: unknown, status: number): T => {
    try { return normalize(payload) } catch (error) { throw new ApiError(error instanceof Error ? error.message : 'Dữ liệu nhóm tour không hợp lệ.', status) }
  }
}
const group = decode(normalizeGroup)
export const tourGroupApi = {
  list: (query: GroupFilters, signal?: AbortSignal) => apiRequestRaw(base, decode(normalizeGroups), { query, signal }),
  get: (id: string, signal?: AbortSignal) => apiRequestRaw(path(id), group, { signal }),
  create: (body: GroupRequest, signal?: AbortSignal) => apiRequestRaw(base, group, { method: 'POST', body, signal }),
  update: (id: string, body: GroupRequest, signal?: AbortSignal) => apiRequestRaw(path(id), group, { method: 'PUT', body, signal }),
  assignGuide: (id: string, guideId: string, signal?: AbortSignal) => {
    uuid(guideId)
    return apiRequestRaw(`${path(id)}/guide`, group, { method: 'PATCH', body: { guideId }, signal })
  },
  assignPassenger: (id: string, passengerId: string, signal?: AbortSignal) => {
    uuid(passengerId)
    return apiRequestRaw(`${path(id)}/passengers`, group, { method: 'POST', body: { passengerId }, signal })
  },
  removePassenger: (id: string, passengerId: string, signal?: AbortSignal) => apiRequestRaw(`${path(id)}/passengers/${uuid(passengerId)}`, group, { method: 'DELETE', signal }),
  capacity: (id: string, signal?: AbortSignal) => apiRequestRaw(`${path(id)}/capacity`, decode(normalizeCapacity), { signal }),
  validate: (id: string, signal?: AbortSignal) => apiRequestRaw(`${path(id)}/validate`, decode((payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !('message' in payload) || typeof payload.message !== 'string') throw new Error('Kết quả kiểm tra nhóm tour không đúng định dạng.')
    return payload.message
  }), { method: 'POST', signal }),
  transition: (id: string, action: GroupAction, reason?: string, signal?: AbortSignal) => apiRequestRaw(`${path(id)}/${action}`, group, { method: 'PATCH', body: action === 'cancel' ? { reason } : undefined, signal }),
}
