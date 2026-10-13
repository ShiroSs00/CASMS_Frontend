import { activePassengerCounts, cruiseFixtures, issueFixtures, itineraryFixtures, portFixtures, regulationFixtures, shipFixtures } from './fixtures.ts'
import type { CruiseDraft, CruiseRecord } from '../model/cruise-record'
import type { CruiseQuery } from '../model/cruise-query'
import type { CruiseDetailView, CruiseListItem, CruiseListResult, ReadinessCheck } from '../model/cruise-view'
import type { ShipCandidate } from '../model/ship-assignment'
import { validateCruiseDraft, validateCruiseSchedule } from '../model/cruise-validation.ts'

function clone<T>(value: T): T {
  return structuredClone(value)
}

function overlaps(first: CruiseRecord, second: CruiseRecord) {
  return first.departureDatetime < second.returnDatetime && second.departureDatetime < first.returnDatetime
}

function delay() {
  return new Promise((resolve) => setTimeout(resolve, 80))
}

export function createMockCruiseAdapter() {
  let cruises = clone(cruiseFixtures)

  function requireCruise(cruiseId: string) {
    const cruise = cruises.find((candidate) => candidate.cruiseId === cruiseId)
    if (!cruise) throw new Error('Không tìm thấy cruise.')
    return cruise
  }

  function toListItem(cruise: CruiseRecord): CruiseListItem {
    const departurePort = portFixtures.find((port) => port.portId === cruise.departurePortId)
    const returnPort = portFixtures.find((port) => port.portId === cruise.returnPortId)
    if (!departurePort || !returnPort) throw new Error('Cruise tham chiếu Port không hợp lệ.')
    return {
      cruise: clone(cruise),
      ship: clone(shipFixtures.find((ship) => ship.shipId === cruise.shipId) ?? null),
      departurePort: clone(departurePort),
      returnPort: clone(returnPort),
      itinerary: clone(itineraryFixtures[cruise.cruiseId] ?? null),
    }
  }

  async function list(query: CruiseQuery): Promise<CruiseListResult> {
    await delay()
    const normalizedSearch = query.search.toLocaleLowerCase('vi')
    const filtered = cruises
      .map(toListItem)
      .filter((item) => {
        const searchTarget = [item.cruise.cruiseCode, item.cruise.cruiseName, item.itinerary?.itineraryName ?? ''].join(' ').toLocaleLowerCase('vi')
        return (!normalizedSearch || searchTarget.includes(normalizedSearch))
          && (!query.status || item.cruise.status === query.status)
          && (!query.cruiseType || item.cruise.cruiseType === query.cruiseType)
          && (!query.departureDate || item.cruise.departureDatetime.slice(0, 10) === query.departureDate)
          && (!query.shipId || (query.shipId === 'UNASSIGNED' ? item.cruise.shipId === null : item.cruise.shipId === query.shipId))
      })
      .sort((left, right) => left.cruise.departureDatetime.localeCompare(right.cruise.departureDatetime))
    const pageCount = Math.max(1, Math.ceil(filtered.length / query.pageSize))
    const start = (query.page - 1) * query.pageSize
    return {
      items: clone(filtered.slice(start, start + query.pageSize)),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
      pageCount,
      metrics: {
        draft: cruises.filter((cruise) => cruise.status === 'DRAFT').length,
        pendingApproval: cruises.filter((cruise) => itineraryFixtures[cruise.cruiseId]?.status === 'PENDING_APPROVAL').length,
        openForSale: cruises.filter((cruise) => itineraryFixtures[cruise.cruiseId]?.status === 'OPEN_FOR_SALE').length,
        inProgress: cruises.filter((cruise) => cruise.status === 'IN_PROGRESS').length,
      },
    }
  }

  async function precheckShip(cruiseId: string, shipId: string): Promise<ShipCandidate> {
    await delay()
    const cruise = requireCruise(cruiseId)
    const ship = shipFixtures.find((candidate) => candidate.shipId === shipId)
    if (!ship) throw new Error('Không tìm thấy tàu.')
    const reasons: string[] = []
    if (ship.status !== 'ACTIVE') reasons.push(`${ship.status} · Chỉ tàu ACTIVE mới được phân công.`)
    const conflict = cruises.find((candidate) => candidate.cruiseId !== cruiseId && candidate.shipId === shipId && candidate.status !== 'CANCELLED' && overlaps(cruise, candidate))
    if (conflict) reasons.push(`Overlap ${conflict.cruiseCode} · ${conflict.departureDatetime.slice(0, 10)}–${conflict.returnDatetime.slice(0, 10)}.`)
    const passengers = activePassengerCounts[cruiseId] ?? 0
    if (ship.totalCapacity < passengers) reasons.push(`Sức chứa ${ship.totalCapacity} nhỏ hơn ${passengers} hành khách đang hoạt động.`)
    if (reasons.length) return { ship: clone(ship), state: 'UNAVAILABLE', reasons }
    if (cruise.status !== 'DRAFT' && passengers > 0 && cruise.shipId !== shipId) {
      return {
        ship: clone(ship),
        state: 'REQUIRES_IMPACT_CHECK',
        reasons: ['Cruise đã có booking; cần kiểm cabin, facility, activity và service phụ thuộc.'],
      }
    }
    return { ship: clone(ship), state: 'AVAILABLE', reasons: ['Tàu ACTIVE, đủ sức chứa và không có lịch chồng.'] }
  }

  async function getShipCandidates(cruiseId: string) {
    return Promise.all(shipFixtures.map((ship) => precheckShip(cruiseId, ship.shipId)))
  }

  async function mutateAssignment(cruiseId: string, shipId: string) {
    const cruise = requireCruise(cruiseId)
    const result = await precheckShip(cruiseId, shipId)
    if (result.state !== 'AVAILABLE') throw new Error(result.reasons.join(' '))
    cruise.shipId = shipId
    cruise.updatedAt = new Date().toISOString()
    return getDetail(cruiseId)
  }

  async function unassignShip(cruiseId: string) {
    await delay()
    const cruise = requireCruise(cruiseId)
    if (cruise.status !== 'DRAFT') throw new Error('Không thể gỡ tàu khỏi cruise đã phát hành hoặc đang vận hành.')
    cruise.shipId = null
    cruise.updatedAt = new Date().toISOString()
    return getDetail(cruiseId)
  }

  async function getDetail(cruiseId: string): Promise<CruiseDetailView> {
    await delay()
    const item = toListItem(requireCruise(cruiseId))
    const passengerCount = activePassengerCounts[cruiseId] ?? 0
    const checks: ReadinessCheck[] = []
    checks.push(item.ship
      ? { key: 'SHIP', label: 'Tàu', state: item.ship.status === 'ACTIVE' ? 'PASS' : 'BLOCKED', reason: item.ship.status === 'ACTIVE' ? 'Tàu ACTIVE và đã được phân công.' : `Tàu đang ở trạng thái ${item.ship.status}.` }
      : { key: 'SHIP', label: 'Tàu', state: 'BLOCKED', reason: 'Chưa phân công tàu.' })
    const scheduleErrors = validateCruiseSchedule(item.cruise.cruiseType, item.cruise.departureDatetime, item.cruise.returnDatetime)
    checks.push({ key: 'SCHEDULE', label: 'Lịch chạy', state: Object.keys(scheduleErrors).length ? 'BLOCKED' : 'PASS', reason: Object.values(scheduleErrors)[0] ?? 'Thời gian phù hợp loại chuyến.' })
    checks.push(item.itinerary
      ? { key: 'ITINERARY', label: 'Hải trình', state: ['APPROVED', 'OPEN_FOR_SALE', 'ACTIVE'].includes(item.itinerary.status) ? 'PASS' : 'BLOCKED', reason: `Trạng thái ${item.itinerary.status}.` }
      : { key: 'ITINERARY', label: 'Hải trình', state: 'UNKNOWN', reason: 'Chưa có dữ liệu hải trình.' })
    checks.push(item.ship
      ? { key: 'CAPACITY', label: 'Sức chứa', state: passengerCount <= item.ship.totalCapacity ? 'PASS' : 'BLOCKED', reason: `${passengerCount}/${item.ship.totalCapacity} hành khách.` }
      : { key: 'CAPACITY', label: 'Sức chứa', state: 'UNKNOWN', reason: 'Chưa thể kiểm tra khi chưa có tàu.' })
    const readinessState = checks.some((check) => check.state === 'BLOCKED') ? 'BLOCKED' : checks.some((check) => check.state === 'UNKNOWN') ? 'UNKNOWN' : 'READY'
    const isDraft = item.cruise.status === 'DRAFT'
    return {
      ...item,
      capacity: { shipTotalCapacity: item.ship?.totalCapacity ?? null, activePassengerCount: passengerCount, remainingPassengerHeadroom: item.ship ? item.ship.totalCapacity - passengerCount : null },
      readiness: { state: readinessState, checks },
      regulations: clone(regulationFixtures[cruiseId] ?? []),
      issues: clone(issueFixtures[cruiseId] ?? []),
      bookingHasData: passengerCount > 0,
      assignmentCapabilities: {
        assign: { allowed: item.cruise.shipId === null && isDraft, reason: item.cruise.shipId !== null ? 'Cruise đã có tàu.' : isDraft ? null : 'Chỉ cruise DRAFT mới được gán trong mock.' },
        change: { allowed: item.cruise.shipId !== null && ['DRAFT', 'PUBLISHED'].includes(item.cruise.status), reason: item.cruise.shipId === null ? 'Cruise chưa có tàu.' : ['DRAFT', 'PUBLISHED'].includes(item.cruise.status) ? null : 'Không thể đổi tàu ở trạng thái hiện tại.' },
        unassign: { allowed: item.cruise.shipId !== null && isDraft, reason: item.cruise.shipId === null ? 'Cruise chưa có tàu.' : isDraft ? null : 'Không thể gỡ tàu khỏi cruise đã phát hành.' },
      },
    }
  }

  async function createCruise(draft: CruiseDraft) {
    await delay()
    const errors = validateCruiseDraft(draft)
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
    if (cruises.some((cruise) => cruise.cruiseCode.toLocaleLowerCase() === draft.cruiseCode.trim().toLocaleLowerCase())) throw new Error('Mã chuyến đã tồn tại.')
    const now = new Date().toISOString()
    const cruise: CruiseRecord = { ...draft, cruiseCode: draft.cruiseCode.trim(), cruiseName: draft.cruiseName.trim(), cruiseId: crypto.randomUUID(), shipId: null, status: 'DRAFT', createdAt: now, updatedAt: now }
    cruises = [...cruises, cruise]
    return clone(cruise)
  }

  async function updateCruise(cruiseId: string, draft: CruiseDraft) {
    await delay()
    const current = requireCruise(cruiseId)
    const errors = validateCruiseDraft(draft)
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
    Object.assign(current, { ...draft, cruiseCode: current.cruiseCode, shipId: current.shipId, updatedAt: new Date().toISOString() })
    return clone(current)
  }

  return {
    list,
    getDetail,
    createCruise,
    updateCruise,
    getShipCandidates,
    precheckShip,
    assignShip: mutateAssignment,
    changeShip: mutateAssignment,
    unassignShip,
    ships: clone(shipFixtures),
    ports: clone(portFixtures),
  }
}

export const mockCruiseAdapter = createMockCruiseAdapter()
