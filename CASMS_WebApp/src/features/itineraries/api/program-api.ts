import { apiRequest, apiRequestRaw } from '@/shared/api'

export type ProgramActivity = { id: string; cruiseId: string; name: string; description: string | null; startTime: string; endTime: string; location: string | null; capacity: number | null; deckId: string | null; cabinId: string | null; price: number | null; currencyCode: string | null; status: string }
export type ProgramExcursion = { shoreExcursionId: string; cruiseStopId: string; excursionName: string; startTime: string; plannedReturnTime: string; status: string; supplierId: string; meetingPoint: string; minimumParticipants: number | null; maximumCapacity: number; price: number | null; currencyCode: string | null }
export type ProgramService = { id: string; name: string; type: string }
export type ActivityUpdateRequest = { activityName: string; description: string | null; cruiseId: string; startTime: string; endTime: string; location: string | null; capacity: number | null; deckId: string | null; cabinId: string | null; price: number | null; currencyCode: string | null }

function rows<T>(value: unknown, fields: string[]): T[] {
  if (!Array.isArray(value) || value.some(row => !row || fields.some(field => typeof row[field] !== 'string' || !row[field]))) throw new Error('Dữ liệu chương trình không đúng định dạng. Vui lòng tải lại.')
  return value as T[]
}
function activities(value: unknown): ProgramActivity[] {
  const result = rows<ProgramActivity>(value, ['id', 'cruiseId', 'name', 'startTime', 'endTime', 'status'])
  if (result.some(row => row.capacity != null && (!Number.isSafeInteger(row.capacity) || row.capacity < 1) || !Number.isFinite(Date.parse(row.startTime)) || !Number.isFinite(Date.parse(row.endTime)))) throw new Error('Thông tin hoạt động không đầy đủ.')
  return result
}
export const programApi = {
  updateExcursion: (row: ProgramExcursion, startTime: string, plannedReturnTime: string, meetingPoint: string) => apiRequestRaw(`/shore-excursions/${encodeURIComponent(row.shoreExcursionId)}`, value => rows<ProgramExcursion>([value], ['shoreExcursionId', 'cruiseStopId', 'excursionName', 'startTime', 'plannedReturnTime', 'status'])[0], { method: 'PUT', body: { cruiseStopId: row.cruiseStopId, supplierId: row.supplierId, excursionName: row.excursionName, startTime, plannedReturnTime, meetingPoint, minimumParticipants: row.minimumParticipants, maximumCapacity: row.maximumCapacity, price: row.price, currencyCode: row.currencyCode } }),
  activities: async (cruiseId: string, signal?: AbortSignal) => activities(await apiRequest<unknown>('/activities', { signal })).filter(row => row.cruiseId === cruiseId),
  excursions: (signal?: AbortSignal) => apiRequestRaw('/shore-excursions', value => {
    const result = rows<ProgramExcursion>(value, ['shoreExcursionId', 'cruiseStopId', 'excursionName', 'startTime', 'plannedReturnTime', 'status', 'supplierId', 'meetingPoint'])
    if (result.some(row => !Number.isSafeInteger(row.maximumCapacity) || row.maximumCapacity < 1 || !Number.isFinite(Date.parse(row.startTime)) || !Number.isFinite(Date.parse(row.plannedReturnTime)))) throw new Error('Dữ liệu tham quan chưa đầy đủ.')
    return result
  }, { signal }),
  services: async (signal?: AbortSignal) => rows<ProgramService>(await apiRequest<unknown>('/servicepackage/services', { signal }), ['id', 'name', 'type']),
  updateActivity: async (id: string, body: ActivityUpdateRequest) => activities([await apiRequest<unknown>(`/activities/${encodeURIComponent(id)}`, { method: 'PUT', body })])[0],
}
