import { apiRequest } from '@/shared/api'

import type { CruiseQuery } from '../model/cruise-query'
import type { CruiseDraft, CruiseRecord, PortRecord, ShipRecord } from '../model/cruise-record'
import type { CruiseDetailView, CruiseListItem, CruiseListResult, ReadinessCheck } from '../model/cruise-view'
import type { ShipCandidate } from '../model/ship-assignment'
import type { CapacityDto, CruiseDto, PageDto, ReadinessDto } from './dto'

const root = '/cruise'
const byId = (id: string) => `${root}/${encodeURIComponent(id)}`

type RegulationProjection = {
  source: 'CRUISE' | 'SHIP' | 'GLOBAL'
  regulation: { regulationId: string; regulationCode: string; name: string; status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED' }
}

function cruiseBody(draft: CruiseDraft) {
  return { ...draft, departureDatetime: new Date(draft.departureDatetime).toISOString(), returnDatetime: new Date(draft.returnDatetime).toISOString() }
}

function toCruise(dto: CruiseDto): CruiseRecord {
  return {
    cruiseId: dto.cruiseId,
    cruiseCode: dto.cruiseCode,
    cruiseName: dto.cruiseName,
    shipId: dto.shipId ?? dto.ship?.shipId ?? null,
    cruiseType: dto.cruiseType,
    departureDatetime: dto.departureDatetime,
    returnDatetime: dto.returnDatetime,
    departurePortId: dto.departurePortId,
    returnPortId: dto.returnPortId,
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

const fallbackPort = (id: string): PortRecord => ({
  portId: id, portCode: null, portName: id, countryCode: '', timeZoneId: '', status: 'ACTIVE',
})

function toItem(dto: CruiseDto): CruiseListItem {
  return {
    cruise: toCruise(dto),
    ship: dto.ship ?? null,
    departurePort: dto.departurePort ?? { ...fallbackPort(dto.departurePortId), portName: dto.departurePortName ?? dto.departurePortId },
    returnPort: dto.returnPort ?? { ...fallbackPort(dto.returnPortId), portName: dto.returnPortName ?? dto.returnPortId },
    itinerary: null,
  }
}

async function getShip(id: string | null, signal?: AbortSignal) {
  if (!id) return null
  return apiRequest<ShipRecord>(`/ships/${encodeURIComponent(id)}`, { signal })
}

async function getPort(id: string, signal?: AbortSignal) {
  return apiRequest<PortRecord>(`/ports/${encodeURIComponent(id)}`, { signal })
}

async function listShips(signal?: AbortSignal) {
  const page = await apiRequest<PageDto<ShipRecord>>('/ships', { query: { page: 0, size: 100 }, signal })
  return page.content
}

function readinessChecks(value: ReadinessDto): ReadinessCheck[] {
  const issue = (keyword: string, fallback: string) => value.issues?.find((item) => item.toLocaleLowerCase().includes(keyword)) ?? fallback
  return [
    { key: 'SHIP', label: 'Ship assignment', state: value.shipAssigned && value.shipActive ? 'PASS' : 'BLOCKED', reason: issue('ship', value.shipAssigned ? 'Ship state do backend xác nhận.' : 'Chưa gán tàu.') },
    { key: 'SCHEDULE', label: 'Schedule', state: value.scheduleValid ? 'PASS' : 'BLOCKED', reason: issue('schedule', 'Kết quả validate schedule từ backend.') },
    { key: 'ITINERARY', label: 'Itinerary', state: value.itineraryConfigured ? 'PASS' : 'BLOCKED', reason: issue('itinerary', value.itineraryConfigured ? 'Đã cấu hình itinerary.' : 'Backend báo chưa cấu hình itinerary.') },
    { key: 'CONFIGURATION', label: 'Cấu hình tàu', state: value.shipConfigurationValid ? 'PASS' : 'BLOCKED', reason: value.shipConfigurationValid ? 'Cấu hình boong và cabin hợp lệ.' : 'Cần hoàn tất cấu hình boong và cabin.' },
    { key: 'PORTS', label: 'Cảng đi / về', state: value.portsActive ? 'PASS' : 'BLOCKED', reason: value.portsActive ? 'Cảng đang hoạt động.' : 'Cần kiểm tra trạng thái cảng.' },
  ]
}

export const cruiseApi = {
  async list(query: CruiseQuery, signal?: AbortSignal): Promise<CruiseListResult> {
    const page = await apiRequest<PageDto<CruiseDto>>(root, {
      query: {
        status: query.status || undefined,
        shipId: query.shipId && query.shipId !== 'UNASSIGNED' ? query.shipId : undefined,
        cruiseType: query.cruiseType || undefined,
        page: query.page - 1,
        size: query.pageSize,
        sort: 'departureDatetime,asc',
      }, signal,
    })
    const items = page.content.map(toItem)
    const shipIds = [...new Set(items.flatMap((item) => item.cruise.shipId ? [item.cruise.shipId] : []))]
    const ships = await Promise.all(shipIds.map((id) => getShip(id, signal)))
    for (const item of items) item.ship = ships.find((ship) => ship?.shipId === item.cruise.shipId) ?? null
    const readinessResults = await Promise.allSettled(items.map((item) => apiRequest<ReadinessDto>(`${byId(item.cruise.cruiseId)}/readiness`, { signal })))
    readinessResults.forEach((result, index) => {
      if (result.status === 'fulfilled') items[index].readinessSummary = { ready: result.value.ready, issues: result.value.issues ?? [] }
    })
    return {
      items,
      total: page.totalElements,
      page: page.number + 1,
      pageSize: page.size ?? query.pageSize,
      pageCount: Math.max(1, page.totalPages),
      metrics: {
        conflict: readinessResults.every((result) => result.status === 'fulfilled') ? items.filter((item) => !item.readinessSummary?.ready).length : undefined,
        draft: items.filter((item) => item.cruise.status === 'DRAFT').length,
        pendingApproval: items.filter((item) => item.cruise.status === 'PUBLISHED').length,
        openForSale: items.filter((item) => item.cruise.status === 'COMPLETED').length,
        inProgress: items.filter((item) => item.cruise.status === 'IN_PROGRESS').length,
      },
    }
  },
  listShips,
  listPorts: (signal?: AbortSignal) => apiRequest<PortRecord[]>('/ports/active', { signal }),
  async getDetail(id: string, signal?: AbortSignal): Promise<CruiseDetailView> {
    const dto = await apiRequest<CruiseDto>(byId(id), { signal })
    const cruise = toCruise(dto)
    const [ship, departurePort, returnPort, readiness, capacity, issues, regulationSnapshot] = await Promise.all([
      dto.ship ? Promise.resolve(dto.ship) : getShip(cruise.shipId, signal),
      dto.departurePort ? Promise.resolve(dto.departurePort) : getPort(cruise.departurePortId, signal),
      dto.returnPort ? Promise.resolve(dto.returnPort) : getPort(cruise.returnPortId, signal),
      apiRequest<ReadinessDto>(`${byId(id)}/readiness`, { signal }),
      cruise.shipId ? apiRequest<CapacityDto>(`${byId(id)}/validate-capacity`, { signal }) : Promise.resolve(null),
      apiRequest<CruiseDetailView['issues']>('/operational-issues', { query: { cruiseId: id }, signal }),
      apiRequest<{ direct: RegulationProjection[]; inherited: RegulationProjection[] }>(`/cruises/${encodeURIComponent(id)}/regulations/effective`, { signal }),
    ])
    const checks = readinessChecks(readiness)
    return {
      cruise,
      ship,
      departurePort,
      returnPort,
      itinerary: null,
      capacity: { shipTotalCapacity: capacity?.shipTotalCapacity ?? null, activePassengerCount: capacity?.bookedPassengersCount ?? null, remainingPassengerHeadroom: capacity?.availableCapacity ?? null },
      readiness: { state: readiness.ready ? 'READY' : 'BLOCKED', checks, issues: readiness.issues },
      regulations: [...regulationSnapshot.direct, ...regulationSnapshot.inherited].map((item) => ({ regulationId: item.regulation.regulationId, code: item.regulation.regulationCode, name: item.regulation.name, source: item.source, status: item.regulation.status })),
      issues,
      bookingHasData: capacity ? capacity.bookedPassengersCount > 0 : null,
      assignmentCapabilities: {
        assign: { allowed: !ship && ['DRAFT', 'PUBLISHED'].includes(cruise.status), reason: ship ? 'Cruise đã có tàu.' : null },
        change: { allowed: Boolean(ship) && ['DRAFT', 'PUBLISHED'].includes(cruise.status), reason: ['DRAFT', 'PUBLISHED'].includes(cruise.status) ? null : 'Chỉ DRAFT/PUBLISHED có thể đổi tàu.' },
        unassign: { allowed: Boolean(ship) && cruise.status === 'DRAFT', reason: cruise.status === 'DRAFT' ? null : 'Chỉ DRAFT và không có booking mới được gỡ tàu.' },
      },
    }
  },
  async createCruise(draft: CruiseDraft) {
    return toCruise(await apiRequest<CruiseDto>(root, { method: 'POST', body: cruiseBody(draft) }))
  },
  async updateCruise(id: string, draft: CruiseDraft) {
    const body = cruiseBody(draft)
    return toCruise(await apiRequest<CruiseDto>(`${byId(id)}/draft`, { method: 'PATCH', body: { cruiseName: body.cruiseName, cruiseType: body.cruiseType, departureDatetime: body.departureDatetime, returnDatetime: body.returnDatetime, departurePortId: body.departurePortId, returnPortId: body.returnPortId } }))
  },
  async getShipCandidates(id: string) {
    const ships = await listShips()
    return Promise.all(ships.map(async (ship): Promise<ShipCandidate> => {
      if (ship.status !== 'ACTIVE') return { ship, state: 'UNAVAILABLE', reasons: [`${ship.status} · chỉ tàu ACTIVE.`] }
      const available = await apiRequest<boolean>(`${byId(id)}/validate-ship-availability`, { query: { shipId: ship.shipId } })
      return available
        ? { ship, state: 'AVAILABLE', reasons: ['Backend xác nhận tàu khả dụng trong lịch cruise.'] }
        : { ship, state: 'UNAVAILABLE', reasons: ['Backend báo tàu không khả dụng hoặc bị overlap.'] }
    }))
  },
  async assignShip(id: string, shipId: string) {
    return toCruise(await apiRequest<CruiseDto>(`${byId(id)}/assign-ship`, { method: 'POST', query: { shipId } }))
  },
  async changeShip(id: string, shipId: string) {
    return toCruise(await apiRequest<CruiseDto>(`${byId(id)}/change-assigned-ship`, { method: 'PUT', query: { newShipId: shipId } }))
  },
  async unassignShip(id: string) {
    await apiRequest<unknown>(`${byId(id)}/unassign-ship`, { method: 'POST' })
  },
  validateSchedule: (id: string) => apiRequest<unknown>(`${byId(id)}/validate-schedule`),
  validateCapacity: (id: string) => apiRequest<unknown>(`${byId(id)}/validate-capacity`),
  readiness: (id: string) => apiRequest<ReadinessDto>(`${byId(id)}/readiness`),
  publish: (id: string) => apiRequest<CruiseDto>(`${byId(id)}/publish`, { method: 'POST' }),
  start: (id: string) => apiRequest<CruiseDto>(`${byId(id)}/start`, { method: 'POST' }),
  complete: (id: string) => apiRequest<CruiseDto>(`${byId(id)}/complete`, { method: 'POST' }),
  cancel: (id: string, reason: string) => apiRequest<CruiseDto>(`${byId(id)}/cancel`, { method: 'POST', body: { reason } }),
}
