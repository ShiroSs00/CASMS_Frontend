import { ApiError, apiRequest, apiRequestRaw } from '@/shared/api'
export type ExcursionRegistrationContext = { id: string; name: string; cruiseStopId: string; status: string; startTime: string; endTime: string }
function excursion(value: unknown, status: number): ExcursionRegistrationContext {
  const item = value as { shoreExcursionId?: string; excursionName?: string; cruiseStopId?: string; status?: string; startTime?: string; plannedReturnTime?: string } | null
  if (!item?.shoreExcursionId || !item.excursionName || !item.cruiseStopId || !item.status || !Number.isFinite(Date.parse(item.startTime ?? '')) || !Number.isFinite(Date.parse(item.plannedReturnTime ?? ''))) throw new ApiError('Chưa đọc đủ thông tin chuyến tham quan.', status)
  return { id: item.shoreExcursionId, name: item.excursionName, cruiseStopId: item.cruiseStopId, status: item.status, startTime: item.startTime!, endTime: item.plannedReturnTime! }
}
export const registrationContextApi = {
  list: (signal?: AbortSignal) => apiRequestRaw('/shore-excursions', (value, status) => { if (!Array.isArray(value)) throw new ApiError('Danh sách tham quan không hợp lệ.', status); return value.map(item => excursion(item, status)) }, { signal }),
  async get(id: string, signal?: AbortSignal) {
    const item = await apiRequestRaw('/shore-excursions/' + encodeURIComponent(id), excursion, { signal })
    if (item.id !== id) throw new Error('Chuyến tham quan trả về không khớp lựa chọn.')
    const stop = await apiRequest<{ cruiseStopId: string; itineraryId: string }>('/cruise-stops/' + encodeURIComponent(item.cruiseStopId), { signal })
    if (stop.cruiseStopId !== item.cruiseStopId || !stop.itineraryId) throw new Error('Không xác định được lịch trình của điểm dừng.')
    const itinerary = await apiRequest<{ itineraryId: string; cruiseId: string }>('/itineraries/' + encodeURIComponent(stop.itineraryId), { signal })
    if (itinerary.itineraryId !== stop.itineraryId || !itinerary.cruiseId) throw new Error('Không xác định được chuyến đi của lịch trình.')
    return { ...item, cruiseId: itinerary.cruiseId }
  },
}
