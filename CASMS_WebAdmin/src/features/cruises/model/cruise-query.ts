import {
  CRUISE_STATUSES,
  CRUISE_TYPES,
  type CruiseStatus,
  type CruiseType,
} from './cruise-record.ts'

export type CruiseQuery = {
  sourceTripId?: string
  sourceVersionId?: string
  search: string
  status: CruiseStatus | ''
  cruiseType: CruiseType | ''
  departureDate: string
  shipId: string
  page: number
  pageSize: number
}

export const DEFAULT_CRUISE_QUERY: CruiseQuery = {
  search: '',
  status: '',
  cruiseType: '',
  departureDate: '',
  shipId: '',
  page: 1,
  pageSize: 4,
}

function isOneOf<T extends string>(value: string | null, values: readonly T[]): value is T {
  return value !== null && values.includes(value as T)
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function validIsoDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? '' : value
}

export function parseCruiseQuery(params: URLSearchParams): CruiseQuery {
  const status = params.get('status')
  const cruiseType = params.get('type')

  return {
    ...(params.get('sourceTripId') ? { sourceTripId: params.get('sourceTripId')! } : {}),
    ...(params.get('sourceVersionId') ? { sourceVersionId: params.get('sourceVersionId')! } : {}),
    search: params.get('q')?.trim() ?? '',
    status: isOneOf(status, CRUISE_STATUSES) ? status : '',
    cruiseType: isOneOf(cruiseType, CRUISE_TYPES) ? cruiseType : '',
    departureDate: validIsoDate(params.get('departureDate')),
    shipId: params.get('ship') ?? '',
    page: positiveInteger(params.get('page'), DEFAULT_CRUISE_QUERY.page),
    pageSize: positiveInteger(params.get('pageSize'), DEFAULT_CRUISE_QUERY.pageSize),
  }
}

export function serializeCruiseQuery(query: CruiseQuery) {
  const params = new URLSearchParams()
  if (query.sourceTripId) params.set('sourceTripId', query.sourceTripId)
  if (query.sourceVersionId) params.set('sourceVersionId', query.sourceVersionId)
  if (query.search) params.set('q', query.search)
  if (query.status) params.set('status', query.status)
  if (query.cruiseType) params.set('type', query.cruiseType)
  if (query.departureDate) params.set('departureDate', query.departureDate)
  if (query.shipId) params.set('ship', query.shipId)
  if (query.page > 1) params.set('page', String(query.page))
  if (query.pageSize !== DEFAULT_CRUISE_QUERY.pageSize) {
    params.set('pageSize', String(query.pageSize))
  }
  return params
}

export function hasActiveCruiseFilters(query: CruiseQuery) {
  return Boolean(
    query.search || query.status || query.cruiseType || query.departureDate || query.shipId || query.sourceTripId || query.sourceVersionId,
  )
}
