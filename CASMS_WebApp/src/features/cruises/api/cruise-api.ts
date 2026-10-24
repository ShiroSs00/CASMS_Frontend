import { getSessionAccess, hasPermissions } from '@/shared/auth'
import { ApiError, apiRequest } from '@/shared/api'
import { scheduleInstant } from '../model/cruise-validation'

import type { CruiseQuery } from '../model/cruise-query'
import type { CruiseDraft, CruiseRecord, PortRecord, ShipRecord } from '../model/cruise-record'
import type { CruiseDetailView, CruiseListItem, CruiseListResult, ReadinessCheck, ItinerarySummary } from '../model/cruise-view'
import type { ShipCandidate } from '../model/ship-assignment'
import type { CapacityDto, CruiseDto, CruiseSaveRequestDto, PageDto, ReadinessDto } from './dto'

const root = '/cruise'
const byId = (id: string) => `${root}/${encodeURIComponent(id)}`

type RegulationProjection = {
  source: 'CRUISE' | 'SHIP' | 'GLOBAL'
  regulation: { regulationId: string; regulationCode: string; name: string; status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED' }
}

function cruiseBody(draft: CruiseDraft): CruiseSaveRequestDto {
  return { cruiseName:draft.cruiseName.trim(),
    ...(draft.cruiseType ? {cruiseType:draft.cruiseType} : {}),
    departureDatetime:scheduleInstant(draft.departureDatetime).toISOString(), returnDatetime:scheduleInstant(draft.returnDatetime).toISOString(),
    departurePortId:draft.departurePortId, returnPortId:draft.returnPortId }
}
async function readPage<T>(path: string, page: number, signal?: AbortSignal) {
  const result = await apiRequest<PageDto<T>>(path,{query:{page,size:100},signal})
  if (!result || !Array.isArray(result.content) || !Number.isSafeInteger(result.totalPages) || result.totalPages < 0 || result.totalPages > 10000) throw new ApiError('Danh sách phân trang từ hệ thống không hợp lệ.',502)
  return result
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
  portId: id, portCode: null, portName: 'Chưa tải thông tin cảng', countryCode: '', timeZoneId: '', status: 'UNKNOWN',
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
  const first = await readPage<ShipRecord>('/ships',0,signal)
  const ships = [...first.content]
  for (let page=1;page<first.totalPages;page++) ships.push(...(await readPage<ShipRecord>('/ships',page,signal)).content)
  return ships
}

function readinessChecks(value: ReadinessDto): ReadinessCheck[] {
  const issue = (keyword: string, fallback: string) => value.issues?.find((item) => item.toLocaleLowerCase().includes(keyword)) ?? fallback
  return [
    { key: 'SHIP', label: 'Phân công tàu', state: value.shipAssigned && value.shipActive ? 'PASS' : 'BLOCKED', reason: issue('ship', value.shipAssigned ? 'Kiểm tra trạng thái hoạt động của tàu.' : 'Chưa gán tàu.') },
    { key: 'SCHEDULE', label: 'Lịch chạy', state: value.scheduleValid ? 'PASS' : 'BLOCKED', reason: issue('schedule', value.scheduleValid ? 'Lịch chạy hợp lệ.' : 'Cần kiểm tra lịch chạy.') },
    { key: 'ITINERARY', label: 'Lịch trình', state: value.itineraryConfigured ? 'PASS' : 'BLOCKED', reason: issue('itinerary', value.itineraryConfigured ? 'Đã cấu hình lịch trình.' : 'Chưa cấu hình lịch trình.') },
    { key: 'CONFIGURATION', label: 'Cấu hình tàu', state: value.shipConfigurationValid ? 'PASS' : 'BLOCKED', reason: value.shipConfigurationValid ? 'Cấu hình boong và cabin hợp lệ.' : 'Cần hoàn tất cấu hình boong và cabin.' },
    { key: 'PORTS', label: 'Cảng đi / về', state: value.portsActive ? 'PASS' : 'BLOCKED', reason: value.portsActive ? 'Cảng đang hoạt động.' : 'Cần kiểm tra trạng thái cảng.' },
  ]
}

async function linkedItinerary(cruiseId: string, signal?: AbortSignal): Promise<ItinerarySummary | null> {
  let pageNumber = 0
  while (true) {
    const page = await readPage<ItinerarySummary & {cruiseId:string}>('/itineraries',pageNumber,signal)
    const found = page.content.find(item => item.cruiseId === cruiseId)
    if (found) return { ...found, dayCount: null, portCallCount: null, seaDayCount: null, routeLabel: '', schedule: [] }
    if (++pageNumber >= page.totalPages) return null
  }
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
    const ships = await Promise.allSettled(shipIds.map(id => getShip(id,signal)))
    for (const item of items) {
      const result = ships[shipIds.indexOf(item.cruise.shipId ?? '')]
      if (result?.status === 'fulfilled') item.ship = result.value
    }
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
        published: items.filter((item) => item.cruise.status === 'PUBLISHED').length,
        completed: items.filter((item) => item.cruise.status === 'COMPLETED').length,
        inProgress: items.filter((item) => item.cruise.status === 'IN_PROGRESS').length,
      },
    }
  },
  listShips,
  async listPorts(signal?: AbortSignal) {
    const ports = await apiRequest<PortRecord[]>('/ports/active',{signal})
    if (!Array.isArray(ports) || ports.some(port => !port || typeof port.portId !== 'string' || !port.portId || typeof port.portName !== 'string' || !port.portName.trim() || port.status !== 'ACTIVE') || new Set(ports.map(port=>port.portId)).size !== ports.length) throw new ApiError('Không đọc được danh sách cảng hoạt động. Vui lòng thử lại.',502)
    return [...ports].sort((a,b)=>a.portName.localeCompare(b.portName,'vi'))
  },
  async getDetail(id: string, signal?: AbortSignal, onCore?: (detail: CruiseDetailView) => void): Promise<CruiseDetailView> {
    const dto = await apiRequest<CruiseDto>(byId(id), { signal })
    const cruise = toCruise(dto)
    const base: CruiseDetailView = {
      ...toItem(dto), supplementaryLoading: true, supplementaryErrors: {},
      capacity: { shipTotalCapacity: null, activePassengerCount: null, remainingPassengerHeadroom: null },
      readiness: { state: 'UNKNOWN', checks: [] }, regulations: [], issues: [], bookingHasData: null,
      assignmentCapabilities: { assign: { allowed: false, reason: 'Đang tải thông tin phân công.' }, change: { allowed: false, reason: 'Đang tải thông tin phân công.' }, unassign: { allowed: false, reason: 'Đang tải thông tin phân công.' } },
    }
    onCore?.(base)
    const access = getSessionAccess()
    const optional = <T,>(permission: string, load: () => Promise<T>) => hasPermissions(access,{mode:'ANY',permissions:[permission]}) ? load() : Promise.resolve(null)
    const results = await Promise.allSettled([
      optional('SHIP_READ', () => dto.ship ? Promise.resolve(dto.ship) : getShip(cruise.shipId, signal)),
      optional('PORT_READ', () => dto.departurePort ? Promise.resolve(dto.departurePort) : getPort(cruise.departurePortId, signal)),
      optional('PORT_READ', () => dto.returnPort ? Promise.resolve(dto.returnPort) : getPort(cruise.returnPortId, signal)),
      optional('CRUISE_VALIDATE', () => apiRequest<ReadinessDto>(`${byId(id)}/readiness`, { signal })),
      cruise.shipId ? optional('CRUISE_VALIDATE', () => apiRequest<CapacityDto>(`${byId(id)}/validate-capacity`, { signal })) : Promise.resolve(null),
      optional('OPERATIONAL_ISSUE_READ', () => apiRequest<CruiseDetailView['issues']>('/operational-issues', { query: { cruiseId: id }, signal })),
      optional('CRUISE_REGULATION_READ', () => apiRequest<{ direct: RegulationProjection[]; inherited: RegulationProjection[] }>(`/cruises/${encodeURIComponent(id)}/regulations/effective`, { signal })),
      optional('ITINERARY_READ', () => linkedItinerary(id, signal)),
    ])
    const supplementaryErrors: Record<string, string> = {}
    for (const [index, key] of ['ship', 'departurePort', 'returnPort', 'readiness', 'capacity', 'issues', 'regulations', 'itinerary'].entries()) {
      const result = results[index]
      if (result.status === 'rejected') supplementaryErrors[key] = result.reason instanceof Error ? result.reason.message : 'Không tải được dữ liệu liên quan.'
    }
    const [s, p, r, ready, cap, incidents, regulations, plan] = results
    const ship = s.status === 'fulfilled' ? s.value : null
    const departurePort = p.status === 'fulfilled' && p.value ? p.value : { ...fallbackPort(cruise.departurePortId), portName: 'Chưa tải được cảng đi' }
    const returnPort = r.status === 'fulfilled' && r.value ? r.value : { ...fallbackPort(cruise.returnPortId), portName: 'Chưa tải được cảng về' }
    const readiness = ready.status === 'fulfilled' ? ready.value : null
    const capacity = cap.status === 'fulfilled' ? cap.value : null
    const regulationSnapshot = regulations.status === 'fulfilled' ? regulations.value : null
    return {
      cruise,
      ship,
      departurePort,
      returnPort,
      itinerary: plan.status === 'fulfilled' ? plan.value : null,
      supplementaryLoading: false, supplementaryErrors,
      capacity: { shipTotalCapacity: capacity?.shipTotalCapacity ?? null, activePassengerCount: capacity?.bookedPassengersCount ?? null, remainingPassengerHeadroom: capacity?.availableCapacity ?? null },
      readiness: { state: readiness ? readiness.ready ? 'READY' : 'BLOCKED' : 'UNKNOWN', checks: readiness ? readinessChecks(readiness) : [], issues: readiness?.issues },
      regulations: regulationSnapshot ? [...regulationSnapshot.direct, ...regulationSnapshot.inherited].map((item) => ({ regulationId: item.regulation.regulationId, code: item.regulation.regulationCode, name: item.regulation.name, source: item.source, status: item.regulation.status })) : [],
      issues: incidents.status === 'fulfilled' ? incidents.value ?? [] : [],
      bookingHasData: capacity ? capacity.bookedPassengersCount > 0 : null,
      assignmentCapabilities: {
        assign: { allowed: !cruise.shipId && ['DRAFT', 'PUBLISHED'].includes(cruise.status), reason: cruise.shipId ? 'Chuyến đã có tàu.' : null },
        change: { allowed: Boolean(ship) && ['DRAFT', 'PUBLISHED'].includes(cruise.status), reason: ship ? null : 'Chưa tải được tàu để đổi phân công.' },
        unassign: { allowed: Boolean(ship) && cruise.status === 'DRAFT', reason: cruise.status === 'DRAFT' ? null : 'Chỉ chuyến nháp và không có đặt chỗ mới được gỡ tàu.' },
      },
    }
  },
  async createCruise(draft: CruiseDraft) {
    return toCruise(await apiRequest<CruiseDto>(root, { method: 'POST', body: cruiseBody(draft) }))
  },
  async updateCruise(id: string, draft: CruiseDraft) {
    const body = cruiseBody(draft)
    return toCruise(await apiRequest<CruiseDto>(`${byId(id)}/draft`, { method: 'PATCH', body: { cruiseName: body.cruiseName, ...(body.cruiseType ? {cruiseType:body.cruiseType} : {}), departureDatetime: body.departureDatetime, returnDatetime: body.returnDatetime, departurePortId: body.departurePortId, returnPortId: body.returnPortId } }))
  },
  async getShipCandidates(id: string) {
    const ships = await listShips()
    return Promise.all(ships.map(async (ship): Promise<ShipCandidate> => {
      if (ship.status !== 'ACTIVE') return { ship, state: 'UNAVAILABLE', reasons: [`${ship.status} · chỉ tàu ACTIVE.`] }
      const available = await apiRequest<boolean>(`${byId(id)}/validate-ship-availability`, { query: { shipId: ship.shipId } })
      return available
        ? { ship, state: 'AVAILABLE', reasons: ['Tàu đáp ứng kiểm tra lịch phân công.'] }
        : { ship, state: 'UNAVAILABLE', reasons: ['Tàu không đáp ứng lịch phân công hoặc có chuyến trùng thời gian.'] }
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
  validateSchedule: (id: string) => apiRequest<boolean>(`${byId(id)}/validate-schedule`),
  validateCapacity: (id: string) => apiRequest<CapacityDto>(`${byId(id)}/validate-capacity`),
  readiness: (id: string) => apiRequest<ReadinessDto>(`${byId(id)}/readiness`),
  publish: (id: string) => apiRequest<CruiseDto>(`${byId(id)}/publish`, { method: 'POST' }),
  start: (id: string) => apiRequest<CruiseDto>(`${byId(id)}/start`, { method: 'POST' }),
  complete: (id: string) => apiRequest<CruiseDto>(`${byId(id)}/complete`, { method: 'POST' }),
  cancel: (id: string, reason: string) => apiRequest<CruiseDto>(`${byId(id)}/cancel`, { method: 'POST', body: { reason } }),
  deleteDraft: (id: string) => apiRequest<void>(`${byId(id)}/draft`, { method: 'DELETE' }),
}
