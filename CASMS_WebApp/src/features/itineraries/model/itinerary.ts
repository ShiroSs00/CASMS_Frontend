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

export type ItineraryDraft = Pick<Itinerary, 'cruiseId' | 'itineraryName' | 'startDate' | 'endDate' | 'itineraryType'> & {
  createdByUserId?: string
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

export type ItineraryDayDraft = Omit<ItineraryDay, 'itineraryDayId'>

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
}

export type CruiseStopDraft = Omit<CruiseStop, 'cruiseStopId' | 'status' | 'portName' | 'destinationName'>

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
  description?: string | null
  status: DestinationStatus
}

export type DestinationDraft = Omit<Destination, 'destinationId'>

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
