import type { CruiseStop, ItineraryStatus } from './itinerary'

export const stopOperations = {
  reorder: { label: 'Đổi thứ tự ghé cảng', permission: 'CRUISE_STOP_REORDER', kind: 'number' },
  plannedArrival: { label: 'Điều chỉnh giờ đến dự kiến', permission: 'CRUISE_STOP_TIME_MANAGE', kind: 'time' },
  plannedDeparture: { label: 'Điều chỉnh giờ rời dự kiến', permission: 'CRUISE_STOP_TIME_MANAGE', kind: 'time' },
  allAboard: { label: 'Đặt giờ tất cả khách lên tàu', permission: 'CRUISE_STOP_ALL_ABOARD', kind: 'time' },
  actualArrival: { label: 'Ghi nhận tàu đến thực tế', permission: 'CRUISE_STOP_ACTUAL_ARRIVAL', kind: 'time' },
  actualDeparture: { label: 'Ghi nhận tàu rời thực tế', permission: 'CRUISE_STOP_ACTUAL_DEPARTURE', kind: 'time' },
  omit: { label: 'Bỏ lần ghé cảng', permission: 'CRUISE_STOP_OMIT', kind: 'reason' },
  substitute: { label: 'Thay bằng lần ghé cảng khác', permission: 'CRUISE_STOP_SUBSTITUTE', kind: 'stop' },
} as const
export type StopOperation = keyof typeof stopOperations

export function validateStopOperation(action: StopOperation, value: string, stop: CruiseStop, stops: CruiseStop[], itineraryStatus: ItineraryStatus): string {
  if (['COMPLETED', 'CANCELLED'].includes(itineraryStatus) || ['OMITTED', 'SUBSTITUTED', 'COMPLETED'].includes(stop.status)) return 'Lần ghé cảng hoặc lịch trình đã kết thúc, không thể thay đổi.'
  if (action === 'reorder') {
    const order = Number(value)
    if (!['DRAFT', 'PENDING_APPROVAL'].includes(itineraryStatus)) return 'Chỉ đổi thứ tự khi lịch trình còn ở giai đoạn chuẩn bị.'
    if (!Number.isSafeInteger(order) || order < 1) return 'Thứ tự phải là số nguyên dương.'
    if (stops.some(item => item.cruiseStopId !== stop.cruiseStopId && item.stopOrder === order)) return 'Thứ tự này đang được lần ghé cảng khác sử dụng.'
  } else if (action === 'substitute') {
    if (!stops.some(item => item.cruiseStopId === value && item.cruiseStopId !== stop.cruiseStopId && item.itineraryId === stop.itineraryId && !['OMITTED', 'SUBSTITUTED', 'COMPLETED'].includes(item.status))) return 'Chọn lần ghé cảng thay thế hợp lệ trong cùng lịch trình.'
  } else if (action === 'omit') {
    if (!value.trim()) return 'Vui lòng nêu lý do bỏ điểm dừng.'
  } else {
    const timestamp = Date.parse(value)
    if (!Number.isFinite(timestamp)) return 'Nhập thời gian hợp lệ.'
    if (action === 'plannedArrival' && timestamp >= Date.parse(stop.plannedDeparture)) return 'Giờ đến phải trước giờ rời dự kiến.'
    if (action === 'plannedDeparture' && timestamp <= Date.parse(stop.plannedArrival)) return 'Giờ rời phải sau giờ đến dự kiến.'
    if (action === 'allAboard' && (timestamp < Date.parse(stop.plannedArrival) || timestamp > Date.parse(stop.plannedDeparture))) return 'Giờ lên tàu phải nằm trong khoảng lưu cảng.'
    if (action.startsWith('actual') && timestamp > Date.now()) return 'Không thể ghi nhận sự kiện thực tế trong tương lai.'
    if (action === 'actualDeparture' && (!stop.actualArrival || timestamp <= Date.parse(stop.actualArrival))) return 'Cần ghi nhận giờ đến thực tế trước giờ rời.'
  }
  return ''
}
