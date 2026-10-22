import type { ShipStatus } from './types'

// A presentation state, not a backend lifecycle enum or raw DTO.
export type ShipReadiness = 'READY' | 'ATTENTION' | 'BLOCKED'
export type Supplement<T> = { status: 'loading' } | { status: 'loaded'; data: T }
  | { status: 'unavailable' | 'denied'; message: string }
export type ShipSupplements = {
  capacity: { deckCount: number; cabinCount: number }
  readiness: ShipReadiness
  currentCruise: { id: string; code: string } | null
}
export type SupplementField = keyof ShipSupplements
export type ShipListItem = {
  id: string
  name: string
  code: string
  status: ShipStatus
} & { [K in SupplementField]: Supplement<ShipSupplements[K]> }
export type ShipListMetrics = {
  activeCount: number
  maintenanceCount: number
  configuredCabinCount: number | null
  attentionCount: number | null
}
export type ShipListState = { metrics: ShipListMetrics; items: ShipListItem[] }
export type ShipListFilters = { search: string; status: ShipStatus | 'ALL'; readiness: ShipReadiness | 'ALL' }
export interface ShipListRepository {
  load(signal: AbortSignal): Promise<ShipListState>
  loadField?<K extends SupplementField>(id: string, field: K, signal: AbortSignal): Promise<ShipSupplements[K]>
}

export function shipListState(items: ShipListItem[]): ShipListState {
  return { items, metrics: {
    activeCount: items.filter(item => item.status === 'ACTIVE').length,
    maintenanceCount: items.filter(item => item.status === 'MAINTENANCE').length,
    configuredCabinCount: items.every(item => item.capacity.status === 'loaded')
      ? items.reduce((total, item) => total + (item.capacity.status === 'loaded' ? item.capacity.data.cabinCount : 0), 0) : null,
    attentionCount: items.every(item => item.readiness.status === 'loaded')
      ? items.filter(item => item.readiness.status === 'loaded' && item.readiness.data !== 'READY').length : null,
  } }
}

export const emptyShipFilters: ShipListFilters = { search: '', status: 'ALL', readiness: 'ALL' }
const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').trim().toLocaleLowerCase('vi')
export function filterShips(items: ShipListItem[], filters: ShipListFilters) {
  const term = normalize(filters.search)
  return items.filter(item => (!term || normalize(item.name).includes(term) || normalize(item.code).includes(term))
    && (filters.status === 'ALL' || item.status === filters.status)
    && (filters.readiness === 'ALL' || (item.readiness.status === 'loaded' && item.readiness.data === filters.readiness)))
}
