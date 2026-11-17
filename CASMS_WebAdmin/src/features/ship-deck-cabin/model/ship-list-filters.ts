import { shipStatuses, type ShipStatus } from './types'

export type ShipListFilters = { search: string; status: ShipStatus | ''; type: string }

const typeIdPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i

export function readShipListFilters(params: URLSearchParams): ShipListFilters {
  const status = params.get('status') ?? ''
  const type = params.get('shipTypeId') ?? ''
  return {
    search: (params.get('q') ?? '').trim().slice(0, 100),
    status: Object.hasOwn(shipStatuses, status) ? status as ShipStatus : '',
    type: params.get('legacy') === 'true' ? 'legacy' : typeIdPattern.test(type) ? type : '',
  }
}

export function shipListParams(filters: ShipListFilters, page: number) {
  const params = new URLSearchParams()
  if (filters.search.trim()) params.set('q', filters.search.trim())
  if (filters.status) params.set('status', filters.status)
  if (filters.type === 'legacy') params.set('legacy', 'true')
  else if (filters.type) params.set('shipTypeId', filters.type)
  if (page > 0) params.set('page', String(page))
  return params
}

export function readShipListPage(params: URLSearchParams) {
  const value = params.get('page') ?? ''
  const page = Number(value)
  return /^\d+$/.test(value) && page <= 2147483647 ? page : 0
}
