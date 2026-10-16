import type { ShipStatus } from './types'

// A presentation state, not a backend lifecycle enum or raw DTO.
export type ShipReadiness = 'READY' | 'ATTENTION' | 'BLOCKED'
export type ShipListItem = {
  id: string
  name: string
  code: string
  status: ShipStatus
  deckCount: number
  cabinCount: number
  readiness: ShipReadiness
  currentCruise: { id: string; code: string } | null
}
export type ShipListMetrics = {
  activeCount: number
  maintenanceCount: number
  configuredCabinCount: number
  attentionCount: number
}
export type ShipListState = { metrics: ShipListMetrics; items: ShipListItem[] }
export type ShipListFilters = { search: string; status: ShipStatus | 'ALL'; readiness: ShipReadiness | 'ALL' }
export interface ShipListRepository { load(signal: AbortSignal): Promise<ShipListState> }

export const emptyShipFilters: ShipListFilters = { search: '', status: 'ALL', readiness: 'ALL' }
const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').trim().toLocaleLowerCase('vi')
export function filterShips(items: ShipListItem[], filters: ShipListFilters) {
  const term = normalize(filters.search)
  return items.filter(item => (!term || normalize(item.name).includes(term) || normalize(item.code).includes(term))
    && (filters.status === 'ALL' || item.status === filters.status)
    && (filters.readiness === 'ALL' || item.readiness === filters.readiness))
}
