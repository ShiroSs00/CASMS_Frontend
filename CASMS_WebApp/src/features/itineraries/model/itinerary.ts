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
export type CallType = 'NORMAL' | 'LATE_NIGHT' | 'OVERNIGHT'
export type ArrivalMethod = 'BERTH' | 'TENDER'

export type StopDraft = {
  id: string
  portId: string
  destinationId: string
  arrival: string
  departure: string
  allAboardTime: string
  callType: CallType
  arrivalMethod: ArrivalMethod
}

export type DayDraft = {
  id: string
  date: string
  dayType: ItineraryDayType
  description: string
  stops: StopDraft[]
}

export type ItinerarySummary = {
  id: string
  itineraryName: string
  cruiseId: string
  cruiseCode: string
  shipName: string
  type: ItineraryType
  status: ItineraryStatus
  startDate: string
  endDate: string
  daysCount: number
  stopsCount: number
  owner: string
  updatedAt: string
  checkPassed: number
  checkTotal: number
  route: string[]
}

export type HistoryEvent = {
  id: string
  action: string
  description: string
  actor: string
  timestamp: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
}

export type Port = {
  id: string
  code: string
  name: string
  countryCode: string
  timeZone: string
  coordinates: string
  status: 'ACTIVE' | 'INACTIVE'
}

export type Destination = {
  id: string
  name: string
  countryCode: string
  description: string
  linkedPorts: number
  status: 'ACTIVE' | 'INACTIVE'
}

export type Supplier = {
  id: string
  name: string
  type: string
  contact: string
  phone: string
  activeTours: number
  status: 'ACTIVE' | 'INACTIVE'
}

export type ShoreExcursion = {
  id: string
  code: string
  name: string
  stop: string
  supplier: string
  schedule: string
  capacity: number
  booked: number
  price: string
  status: 'PLANNED' | 'OPEN' | 'FULL' | 'CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
}

export type TourGroup = {
  id: string
  code: string
  excursion: string
  guide: string
  vehicle: string
  meetingPoint: string
  capacity: number
  assigned: number
  assemblyTime: string
  status: 'PLANNED' | 'ASSEMBLING' | 'DEPARTED' | 'RETURNED' | 'CANCELLED'
}

export const itineraryStatusLabels: Record<ItineraryStatus, string> = {
  DRAFT: 'Bản nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  OPEN_FOR_SALE: 'Đã công bố',
  ACTIVE: 'Đang vận hành',
  COMPLETED: 'Hoàn tất',
  REJECTED: 'Cần chỉnh sửa',
  SUSPENDED: 'Tạm dừng',
  CANCELLED: 'Đã hủy',
}

export const itineraryTypeLabels: Record<ItineraryType, string> = {
  ROUND_TRIP: 'Khứ hồi',
  ONE_WAY: 'Một chiều',
}

export const dayTypeLabels: Record<ItineraryDayType, string> = {
  SEA_DAY: 'Ngày trên biển',
  PORT_DAY: 'Ngày ghé cảng',
}

export function statusTone(status: ItineraryStatus) {
  if (status === 'APPROVED' || status === 'OPEN_FOR_SALE' || status === 'COMPLETED') return 'success' as const
  if (status === 'PENDING_APPROVAL' || status === 'SUSPENDED') return 'warning' as const
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger' as const
  if (status === 'ACTIVE') return 'info' as const
  return 'neutral' as const
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
