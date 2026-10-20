import { apiRequest, ApiError } from '@/shared/api'
import type {
  AvailableCabinQuery, Cabin, CabinDraft, CabinStatus, CheckResult, CruisePreview,
  DataSnapshot, Deck, DeckCapacity, DeckDraft, EntityKind, HistoryEntry,
  Ship, ShipCapacity, ShipDraft, ShipStatus,
} from '../model/types'
import type { AssignmentDto, CabinDto, CruiseDto, DeckDto, PageDto, ShipDto } from './dto'
import type { ShipListState, ShipSupplements, SupplementField } from '../model/ship-list-types'

let revision = 0
const listeners = new Set<() => void>()
const notify = () => { revision += 1; listeners.forEach((listener) => listener()) }
const paths: Record<EntityKind, string> = { ships: '/ships', decks: '/decks', cabins: '/cabins' }
const idPath = (kind: EntityKind, id: string) => `${paths[kind]}/${encodeURIComponent(id)}`
const ship = (dto: ShipDto): Ship => ({
  id: dto.shipId, code: dto.shipCode, name: dto.shipName, status: dto.status,
  capacity: dto.totalCapacity, totalDecks: dto.totalDecks, commissionDate: dto.commissionDate ?? '',
  createdAt: dto.createdAt, updatedAt: dto.updatedAt,
})
const deck = (dto: DeckDto): Deck => ({ id: dto.deckId, shipId: dto.shipId, number: dto.deckNumber,
  name: dto.deckName ?? '', createdAt: dto.createdAt, updatedAt: dto.updatedAt })
const cabin = (dto: CabinDto): Cabin => ({ id: dto.cabinId, shipId: dto.shipId, deckId: dto.deckId,
  number: dto.cabinNumber, type: dto.cabinType, capacity: dto.capacity, status: dto.status, accessible: dto.isAccessible })
const cruise = (dto: CruiseDto): CruisePreview => ({ id: dto.cruiseId, code: dto.cruiseCode,
  name: dto.cruiseName, status: dto.status, departure: dto.departureDatetime, returnAt: dto.returnDatetime })
const checkedBoolean = (value: boolean): boolean => {
  if (typeof value !== 'boolean') throw new ApiError('Backend không trả kết quả kiểm tra hợp lệ.', 200)
  return value
}
const booleanResult = (value: boolean, title: string): CheckResult => ({
  allowed: checkedBoolean(value), tone: value ? 'success' : 'warning',
  title: `${title}: ${value ? 'Đáp ứng' : 'Chưa đáp ứng'}`,
  message: value ? 'Điều kiện kiểm tra được đáp ứng.' : 'Điều kiện kiểm tra chưa được đáp ứng.',
})

// List endpoints expose pageable only. Retrieve every page before local UI filtering.
async function allPages<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const first = await apiRequest<PageDto<T>>(path, { query: { page: 0, size: 100 }, signal })
  if (!first || !Array.isArray(first.content) || !Number.isInteger(first.totalPages) || first.totalPages < 0) {
    throw new ApiError('Backend trả danh sách phân trang không hợp lệ.', 200)
  }
  const rows = [...first.content]
  for (let page = 1; page < first.totalPages; page += 1) {
    const next = await apiRequest<PageDto<T>>(path, { query: { page, size: 100 }, signal })
    if (!next || !Array.isArray(next.content) || next.number !== page) throw new ApiError('Không tải đủ các trang dữ liệu. Hãy thử lại.', 200)
    rows.push(...next.content)
  }
  if (rows.length !== first.totalElements) throw new ApiError('Danh sách đã thay đổi trong lúc tải. Hãy thử lại để nhận đủ dữ liệu.', 200)
  return rows
}

export const shipDeckCabinApi = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  getRevision: () => revision,
  async listShips(signal: AbortSignal): Promise<Ship[]> {
    return (await allPages<ShipDto>(paths.ships, signal)).map(ship)
  },
  async loadShipList(signal: AbortSignal): Promise<ShipListState> {
    const ships = await allPages<ShipDto>(paths.ships, signal)
    return { items: ships.map(dto => ({
      id: dto.shipId, name: dto.shipName, code: dto.shipCode, status: dto.status,
      capacity: { status: 'loading' }, readiness: { status: 'loading' }, currentCruise: { status: 'loading' },
    })), metrics: {
      activeCount: ships.filter(dto => dto.status === 'ACTIVE').length,
      maintenanceCount: ships.filter(dto => dto.status === 'MAINTENANCE').length,
      configuredCabinCount: ships.length ? null : 0, attentionCount: ships.length ? null : 0,
    } }
  },
  async loadShipListField<K extends SupplementField>(id: string, field: K, signal: AbortSignal): Promise<ShipSupplements[K]> {
    const loaders: { [P in SupplementField]: () => Promise<ShipSupplements[P]> } = {
      capacity: async () => {
        const summary = await shipDeckCabinApi.getShipCapacity(id, signal)
        if (!summary || ![summary.actualDeckCount, summary.actualCabinCount].every(value => Number.isInteger(value) && value >= 0)) {
          throw new ApiError('Backend trả số boong/phòng không hợp lệ.', 200)
        }
        return { deckCount: summary.actualDeckCount, cabinCount: summary.actualCabinCount }
      },
      readiness: async () => checkedBoolean(await apiRequest<boolean>(`${idPath('ships', id)}/readiness`, { signal })) ? 'READY' : 'ATTENTION',
      currentCruise: () => shipDeckCabinApi.getCurrentCruise(id, signal),
    }
    return loaders[field]()
  },
  async listSnapshot(signal?: AbortSignal): Promise<DataSnapshot> {
    const [ships, decks, cabins] = await Promise.all([
      allPages<ShipDto>(paths.ships, signal),
      allPages<DeckDto>(paths.decks, signal),
      allPages<CabinDto>(paths.cabins, signal),
    ])
    return { ships: ships.map(ship), decks: decks.map(deck), cabins: cabins.map(cabin) }
  },
  async get(kind: EntityKind, id: string, signal?: AbortSignal) {
    if (kind === 'ships') return ship(await apiRequest<ShipDto>(idPath(kind, id), { signal }))
    if (kind === 'decks') return deck(await apiRequest<DeckDto>(idPath(kind, id), { signal }))
    return cabin(await apiRequest<CabinDto>(idPath(kind, id), { signal }))
  },
  async saveShip(draft: ShipDraft, id?: string) {
    const body = {
      shipName: draft.name.trim(), totalCapacity: draft.capacity, totalDecks: draft.totalDecks,
      ...(draft.commissionDate ? { commissionDate: draft.commissionDate } : {}),
      ...(!id ? { shipCode: draft.code.trim(), status: draft.status } : {}),
    }
    const saved = ship(await apiRequest<ShipDto>(id ? idPath('ships', id) : paths.ships, { method: id ? 'PATCH' : 'POST', body }))
    notify(); return saved
  },
  async saveDeck(draft: DeckDraft, id?: string) {
    const body = { deckNumber: draft.number, deckName: draft.name.trim(), ...(!id ? { shipId: draft.shipId } : {}) }
    const saved = deck(await apiRequest<DeckDto>(id ? idPath('decks', id) : paths.decks, { method: id ? 'PATCH' : 'POST', body }))
    notify(); return saved
  },
  async saveCabin(draft: CabinDraft, id?: string) {
    const body = { cabinType: draft.type, capacity: draft.capacity, isAccessible: draft.accessible,
      ...(!id ? { shipId: draft.shipId, deckId: draft.deckId, cabinNumber: draft.number.trim(), status: draft.status } : {}) }
    const saved = cabin(await apiRequest<CabinDto>(id ? idPath('cabins', id) : paths.cabins, { method: id ? 'PATCH' : 'POST', body }))
    notify(); return saved
  },
  async deleteUnused(kind: EntityKind, id: string) {
    await apiRequest<void>(`${idPath(kind, id)}/unused`, { method: 'DELETE' }); notify()
  },
  async changeShipStatus(id: string, status: ShipStatus) {
    await apiRequest<ShipDto>(`${idPath('ships', id)}/status`, { method: 'POST', query: { status } }); notify()
  },
  async changeCabinStatus(id: string, status: CabinStatus) {
    await apiRequest<CabinDto>(`${idPath('cabins', id)}/status`, { method: 'POST', query: { status } }); notify()
  },
  async blockCabin(id: string, reasonStatus: 'OCCUPIED' | 'MAINTENANCE') {
    await apiRequest<CabinDto>(`${idPath('cabins', id)}/block`, { method: 'POST', query: { reasonStatus } }); notify()
  },
  async releaseCabin(id: string) {
    await apiRequest<CabinDto>(`${idPath('cabins', id)}/release`, { method: 'POST' }); notify()
  },
  async validate(kind: EntityKind, id: string) {
    await apiRequest<void>(`${idPath(kind, id)}/validate`, { method: 'POST' })
    return { tone: 'success', allowed: true, title: 'Cấu hình hợp lệ', message: kind === 'cabins' ? 'Cabin thuộc đúng boong và tàu đã đăng ký.' : 'Cấu hình đã được kiểm tra hợp lệ.' } satisfies CheckResult
  },
  async validateDeckShip(id: string, shipId: string) {
    return booleanResult(await apiRequest<boolean>(`${idPath('decks', id)}/validate-ship`, { query: { shipId } }), 'Boong thuộc tàu')
  },
  getShipCapacity: (id: string, signal?: AbortSignal) => apiRequest<ShipCapacity>(`${idPath('ships', id)}/capacity-summary`, { signal }),
  getDeckCapacity: (id: string, signal?: AbortSignal) => apiRequest<DeckCapacity>(`${idPath('decks', id)}/capacity`, { signal }),
  async getDeckCabins(id: string, signal?: AbortSignal) {
    return (await apiRequest<CabinDto[]>(`${idPath('decks', id)}/cabins`, { signal })).map(cabin)
  },
  async getCurrentCruise(id: string, signal?: AbortSignal) {
    try {
      const dto = await apiRequest<CruiseDto | null>(`${idPath('ships', id)}/current-cruise`, { signal })
      return dto ? cruise(dto) : null
    } catch (error) {
      // Observed backend contract for no current cruise. Other 404/errors remain errors.
      if (error instanceof ApiError && error.status === 404 && error.message === 'No active cruise found for ship currently') return null
      throw error
    }
  },
  async getAffectedCruises(id: string, start: string, end: string) {
    return (await apiRequest<CruiseDto[]>(`${idPath('ships', id)}/affected-cruises`, { query: { start, end } })).map(cruise)
  },
  async getHistory(id: string, signal?: AbortSignal): Promise<HistoryEntry[]> {
    return (await apiRequest<AssignmentDto[]>(`${idPath('cabins', id)}/assignments`, { signal })).map((dto) => ({
      id: dto.cabinAssignmentId, passengerId: dto.bookingPassengerId, from: dto.validFrom,
      to: dto.validTo, actorId: dto.assignedByUserId, reason: dto.changeReason ?? '',
    }))
  },
  async searchAvailable(query: AvailableCabinQuery, signal?: AbortSignal) {
    try {
      return (await apiRequest<CabinDto[]>(`${paths.cabins}/search`, { method: 'POST', body: query, signal })).map(cabin)
    } catch (error) {
      if (error instanceof ApiError && error.status >= 500) {
        throw new ApiError('Chưa thể xác nhận danh sách cabin sẵn sàng. Vui lòng thử lại.', error.status, error.code)
      }
      throw error
    }
  },
  async inspectReadiness(id: string) {
    return booleanResult(await apiRequest<boolean>(`${idPath('ships', id)}/readiness`), 'Sẵn sàng vận hành')
  },
  async inspectSchedule(id: string, start: string, end: string) {
    return booleanResult(await apiRequest<boolean>(`${idPath('ships', id)}/availability`, { query: { start, end } }), 'Lịch khả dụng')
  },
  async inspectCabin(id: string, requiredCapacity: number, requireAccessible: boolean): Promise<CheckResult[]> {
    const base = idPath('cabins', id)
    const results = await Promise.all([
      apiRequest<boolean>(`${base}/availability`),
      apiRequest<boolean>(`${base}/capacity-check`, { query: { requiredCapacity } }),
      apiRequest<boolean>(`${base}/compatibility-check`, { query: { requireAccessible } }),
    ])
    return results.map((value, index) => ({
      ...booleanResult(value, ['Trạng thái sẵn sàng', 'Sức chứa', 'Hỗ trợ tiếp cận'][index]),
      message: index === 0
        ? `${value ? 'Cabin đang ở trạng thái Sẵn sàng.' : 'Cabin chưa ở trạng thái Sẵn sàng.'} Kết quả này không xác nhận chỗ cho một đặt chỗ hoặc chuyến đi cụ thể.`
        : value ? 'Cabin đáp ứng yêu cầu đã chọn.' : 'Cabin chưa đáp ứng yêu cầu đã chọn. Vui lòng chọn cabin phù hợp hơn.',
    }))
  },
}
