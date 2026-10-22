import type { CruiseRecord, CruiseStatus, CruiseType, PortRecord, ShipRecord } from './cruise-record'
import type { AssignmentCapabilities } from './ship-assignment'

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

export type ItinerarySummary = {
  itineraryId: string
  itineraryName: string
  itineraryType: 'ROUND_TRIP' | 'ONE_WAY'
  status: ItineraryStatus
  startDate: string
  endDate: string
  dayCount: number | null
  portCallCount: number | null
  seaDayCount: number | null
  routeLabel: string
  schedule: Array<{
    day: number
    label: string
    planned: string
    actual: string | null
  }>
}

export type CruiseListItem = {
  readinessSummary?: { ready: boolean; issues: string[] }
  cruise: CruiseRecord
  ship: ShipRecord | null
  departurePort: PortRecord
  returnPort: PortRecord
  itinerary: ItinerarySummary | null
}

export type CruiseListResult = {
  items: CruiseListItem[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  metrics: {
    conflict?: number
    draft: number
    published: number
    completed: number
    inProgress: number
  }
}

export type CapacitySummary = {
  shipTotalCapacity: number | null
  activePassengerCount: number | null
  remainingPassengerHeadroom: number | null
}

export type ReadinessCheck = {
  key: 'SHIP' | 'SCHEDULE' | 'ITINERARY' | 'CAPACITY' | 'CONFIGURATION' | 'PORTS'
  label: string
  state: 'PASS' | 'BLOCKED' | 'UNKNOWN'
  reason: string
}

export type RegulationSummary = {
  regulationId: string
  code: string
  name: string
  source: 'CRUISE' | 'SHIP' | 'GLOBAL'
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED'
}

export type IssueSummary = {
  issueId: string
  issueCode: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  description: string
}

export type CruiseDetailView = CruiseListItem & {
  supplementaryErrors?: Record<string, string>
  supplementaryLoading?: boolean
  capacity: CapacitySummary
  readiness: {
    state: 'READY' | 'BLOCKED' | 'UNKNOWN'
    checks: ReadinessCheck[]
    issues?: string[]
  }
  regulations: RegulationSummary[]
  issues: IssueSummary[]
  bookingHasData: boolean | null
  assignmentCapabilities: AssignmentCapabilities
}

export const cruiseStatusLabels: Record<CruiseStatus, string> = {
  DRAFT: 'Nháp',
  PUBLISHED: 'Đã phát hành',
  IN_PROGRESS: 'Đang vận hành',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
}

export const cruiseTypeLabels: Record<CruiseType, string> = {
  ONE_DAY: 'Chuyến trong ngày · ONE_DAY',
  MULTI_DAYS: 'Chuyến nhiều ngày · MULTI_DAYS',
}

export const itineraryStatusLabels: Record<ItineraryStatus, string> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  OPEN_FOR_SALE: 'Mở bán',
  ACTIVE: 'Đang hoạt động',
  COMPLETED: 'Hoàn thành',
  REJECTED: 'Từ chối',
  SUSPENDED: 'Tạm dừng',
  CANCELLED: 'Đã hủy',
}
