import { sanitizePageSize } from '../../../shared/pagination.ts'
import type {
  RegulationListQuery,
  RegulationScope,
  RegulationStatus,
  RegulationType,
} from './regulation'

// Empty means now; a demo date must never drive production effective status.
export const DEFAULT_REGULATION_EFFECTIVE_AT = ''
export const REGULATION_PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const

const REGULATION_TYPES: readonly RegulationType[] = [
  'SAFETY',
  'CAPACITY',
  'SPEED',
  'WEATHER',
  'ENVIRONMENT',
  'HEALTH',
]
const REGULATION_SCOPES: readonly RegulationScope[] = ['GLOBAL', 'SHIP', 'CRUISE']
const REGULATION_STATUSES: readonly RegulationStatus[] = [
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'EXPIRED',
]

export type RegulationListViewQuery = RegulationListQuery & {
  page: number
  pageSize: number
}

export const DEFAULT_REGULATION_LIST_QUERY: RegulationListViewQuery = {
  search: '',
  type: 'ALL',
  scope: 'ALL',
  status: 'ALL',
  effectiveAt: DEFAULT_REGULATION_EFFECTIVE_AT,
  page: 1,
  pageSize: REGULATION_PAGE_SIZE_OPTIONS[0],
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function oneOf<T extends string>(
  value: string | null,
  values: readonly T[],
  fallback: T | 'ALL',
) {
  return value !== null && values.includes(value as T) ? value as T : fallback
}

export function parseRegulationListQuery(
  params: URLSearchParams,
): RegulationListViewQuery {
  return {
    search: params.get('q')?.trim() ?? '',
    type: oneOf(params.get('type'), REGULATION_TYPES, 'ALL'),
    scope: oneOf(params.get('scope'), REGULATION_SCOPES, 'ALL'),
    status: oneOf(params.get('status'), REGULATION_STATUSES, 'ALL'),
    effectiveAt: params.get('effectiveAt')?.trim() && Number.isFinite(Date.parse(params.get('effectiveAt')!))
      ? params.get('effectiveAt')!.trim() : DEFAULT_REGULATION_EFFECTIVE_AT,
    page: positiveInteger(params.get('page'), 1),
    pageSize: sanitizePageSize(
      Number(params.get('pageSize')),
      REGULATION_PAGE_SIZE_OPTIONS,
      DEFAULT_REGULATION_LIST_QUERY.pageSize,
    ),
  }
}

export function serializeRegulationListQuery(query: RegulationListViewQuery) {
  const params = new URLSearchParams()
  if (query.search) params.set('q', query.search)
  if (query.type !== 'ALL') params.set('type', query.type)
  if (query.scope !== 'ALL') params.set('scope', query.scope)
  if (query.status !== 'ALL') params.set('status', query.status)
  if (query.effectiveAt !== DEFAULT_REGULATION_EFFECTIVE_AT) {
    params.set('effectiveAt', query.effectiveAt)
  }
  if (query.page > 1) params.set('page', String(query.page))
  if (query.pageSize !== DEFAULT_REGULATION_LIST_QUERY.pageSize) {
    params.set('pageSize', String(query.pageSize))
  }
  return params
}
