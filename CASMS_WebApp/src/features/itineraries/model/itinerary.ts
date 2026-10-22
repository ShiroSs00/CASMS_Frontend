export type ItineraryStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'OPEN_FOR_SALE'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'CANCELLED'

export type ItineraryType = 'ROUND_TRIP' | 'ONE_WAY'
export type ItineraryDayType = 'SEA_DAY' | 'PORT_DAY'
export type PortStatus = 'ACTIVE' | 'INACTIVE'
export type DestinationStatus = 'ACTIVE' | 'INACTIVE'
export type CruiseStopStatus = 'PLANNED' | 'DELAYED' | 'COMPLETED' | 'OMITTED' | 'SUBSTITUTED'
export type CruiseStopCallType = 'NORMAL' | 'LATE_NIGHT' | 'OVERNIGHT'
export type CruiseStopArrivalMethod = 'BERTH' | 'TENDER'

export type Itinerary = {
  itineraryId: string
  cruiseId: string
  itineraryName: string
  startDate: string
  endDate: string
  itineraryType: ItineraryType
  status: ItineraryStatus
  createdByUserId?: string | null
  createdAt?: string
  updatedAt?: string
}

export type ItineraryDraft = Pick<Itinerary, 'cruiseId' | 'itineraryName' | 'startDate' | 'endDate'> & { itineraryType: ItineraryType | '' }

export type ItineraryCruiseOption = {
  cruiseId: string; cruiseCode: string; cruiseName: string; departureDatetime: string; returnDatetime: string; status: string
}

export function validateItineraryDraft(draft: ItineraryDraft, context: {
  cruises: ItineraryCruiseOption[]; itineraries: Itinerary[]; editingId?: string
} | null): Record<string, string> {
  const errors: Record<string, string> = {}
  const cruise = context?.cruises.find(item => item.cruiseId === draft.cruiseId)
  if (!context) errors.cruiseId = 'Chưa tải đủ dữ liệu chuyến và lịch trình. Vui lòng thử lại.'
  else if (!cruise) errors.cruiseId = 'Vui lòng chọn chuyến du lịch trong danh sách.'
  else if (context.itineraries.some(item => item.cruiseId === draft.cruiseId && item.itineraryId !== context.editingId)) errors.cruiseId = 'Chuyến này đã có lịch trình. Hãy mở lịch trình hiện có.'
  const editing = Boolean(context?.editingId)
  if ((editing && !draft.itineraryName.trim()) || draft.itineraryName.trim().length > 200) errors.itineraryName = 'Tên lịch trình tối đa 200 ký tự; không để trống khi chỉnh sửa.'
  const startDate = draft.startDate || (!editing ? cruise?.departureDatetime.slice(0, 10) : '') || ''
  const endDate = draft.endDate || (!editing ? cruise?.returnDatetime.slice(0, 10) : '') || ''
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (!isDate(startDate)) errors.startDate = 'Vui lòng chọn ngày bắt đầu hợp lệ.'
  if (!isDate(endDate) || endDate <= startDate) errors.endDate = 'Ngày kết thúc phải sau ngày bắt đầu.'
  if (cruise) {
    const start = cruise.departureDatetime.slice(0, 10), end = cruise.returnDatetime.slice(0, 10)
    if (startDate < start || startDate > end) errors.startDate = 'Ngày bắt đầu phải nằm trong khoảng ngày của chuyến (UTC).'
    if (endDate > end || endDate < start) errors.endDate = 'Ngày kết thúc phải nằm trong khoảng ngày của chuyến (UTC).'
  }
  if ((editing || draft.itineraryType) && !['ROUND_TRIP', 'ONE_WAY'].includes(draft.itineraryType)) errors.itineraryType = 'Vui lòng chọn loại hành trình hợp lệ.'
  return errors
}

export type ItineraryDay = {
  itineraryDayId: string
  itineraryId: string
  dayNumber: number
  date: string
  dayType: ItineraryDayType
  shipTimeZoneId?: string | null
  description?: string | null
}

export type ItineraryDayDraft = Omit<ItineraryDay, 'itineraryDayId' | 'dayNumber'> & { dayNumber: number | '' }

export function validateItineraryDay(draft: ItineraryDayDraft, itinerary: Itinerary, days: ItineraryDay[], editingId?: string): string {
  // Validate BE's inferred values without sending FE-computed defaults.
  const dayNumber = !editingId && draft.dayNumber === '' ? Math.max(0, ...days.map(day => day.dayNumber)) + 1 : draft.dayNumber
  if (typeof dayNumber !== 'number' || !Number.isSafeInteger(dayNumber) || dayNumber < 1) return 'Số ngày phải là số nguyên dương.'
  const inferredTime = Date.parse(itinerary.startDate) + (dayNumber - 1) * 86400000
  if (!Number.isFinite(inferredTime)) return 'Ngày bắt đầu lịch trình không hợp lệ.'
  const date = !editingId && !draft.date ? new Date(inferredTime).toISOString().slice(0, 10) : draft.date
  const others = days.filter(day => day.itineraryDayId !== editingId)
  const numbers = [...others.map(day => day.dayNumber), dayNumber].sort((a, b) => a - b)
  if (numbers.some((number, index) => number !== index + 1)) return 'Ngày hành trình phải liên tục từ 1 và không trùng số ngày.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < itinerary.startDate || date > itinerary.endDate) return 'Ngày phải hợp lệ và nằm trong khoảng ngày của lịch trình.'
  if (others.some(day => day.date === date || (day.dayNumber < dayNumber && day.date > date) || (day.dayNumber > dayNumber && day.date < date))) return 'Ngày thực tế phải theo đúng thứ tự và không trùng ngày khác.'
  if (!['SEA_DAY', 'PORT_DAY'].includes(draft.dayType)) return 'Vui lòng chọn ngày trên biển hoặc ngày ghé cảng.'
  if (editingId || draft.shipTimeZoneId) {
    try { new Intl.DateTimeFormat('vi-VN', { timeZone: draft.shipTimeZoneId || 'invalid' }) } catch { return 'Vui lòng nhập múi giờ tàu hợp lệ, ví dụ Asia/Ho_Chi_Minh.' }
  }
  return ''
}

export type CruiseStop = {
  cruiseStopId: string
  itineraryId: string
  arrivalItineraryDayId: string
  departureItineraryDayId: string
  portId: string
  destinationId?: string | null
  stopOrder: number
  plannedArrival: string
  plannedDeparture: string
  callType: CruiseStopCallType
  arrivalMethod?: CruiseStopArrivalMethod | null
  status: CruiseStopStatus
  portName?: string
  destinationName?: string | null
  actualArrival?: string | null
  actualDeparture?: string | null
  allAboardTime?: string | null
  tenderTransferMinutes?: number | null
  cancellationReason?: string | null
  substitutedByStopId?: string | null
}

export type CruiseStopDraft = Omit<CruiseStop, 'cruiseStopId' | 'status' | 'portName' | 'destinationName' | 'stopOrder'> & { stopOrder: number | '' }

export type Port = {
  portId: string
  portCode: string
  portName: string
  countryCode: string
  timeZoneId: string
  latitude?: number | null
  longitude?: number | null
  description?: string | null
  status: PortStatus
}

export type PortDraft = Omit<Port, 'portId'>

export type Destination = {
  destinationId: string
  destinationName: string
  countryCode: string
  latitude?: number | null
  longitude?: number | null
  description?: string | null
  status: DestinationStatus
  ports?: DestinationPortSummary[]
  createdAt?: string
  updatedAt?: string
}

export type DestinationPortSummary = Pick<Port, 'portId' | 'portCode' | 'portName'>
export type DestinationDraft = Pick<Destination, 'destinationName' | 'countryCode' | 'description' | 'status' | 'latitude' | 'longitude'>
export const destinationStatusLabels: Record<DestinationStatus, string> = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngừng hoạt động' }

export function validateDestinationDraft(draft: DestinationDraft, editing = false): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!draft.destinationName.trim()) errors.destinationName = 'Vui lòng nhập tên điểm đến.'
  if (draft.destinationName.trim().length > 200) errors.destinationName = 'Tên điểm đến không được vượt quá 200 ký tự.'
  if (!editing && draft.countryCode.trim().length !== 2) errors.countryCode = 'Mã quốc gia phải gồm đúng 2 ký tự, ví dụ VN.'
  if ((draft.description?.trim().length ?? 0) > 1000) errors.description = 'Mô tả không được vượt quá 1000 ký tự.'
  if (!editing && !Object.hasOwn(destinationStatusLabels, draft.status)) errors.status = 'Vui lòng chọn trạng thái hợp lệ.'
  return errors
}

export type PageResult<T> = {
  items: T[]
  page: number
  pageSize: number
  pageCount: number
  total: number
}

export const itineraryStatusLabels: Record<ItineraryStatus, string> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  OPEN_FOR_SALE: 'Mở bán',
  ACTIVE: 'Đang hoạt động',
  COMPLETED: 'Hoàn thành',
  REJECTED: 'Bị từ chối',
  SUSPENDED: 'Tạm dừng',
  CANCELLED: 'Đã hủy',
}
