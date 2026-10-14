export type PaginationToken = number | 'ellipsis'

export type ClientPage<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  start: number
  end: number
  hasPrevious: boolean
  hasNext: boolean
}

function positiveInteger(value: number, fallback: number) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export function sanitizePageSize(
  value: number,
  choices: readonly number[],
  fallback: number,
) {
  const safeFallback = positiveInteger(fallback, 1)
  return choices.includes(value) ? value : safeFallback
}

export function paginateItems<T>(
  items: readonly T[],
  requestedPage: number,
  requestedPageSize: number,
): ClientPage<T> {
  const pageSize = positiveInteger(requestedPageSize, 1)
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(positiveInteger(requestedPage, 1), 1), totalPages)
  const offset = (page - 1) * pageSize

  return {
    items: items.slice(offset, offset + pageSize),
    page,
    pageSize,
    total,
    totalPages,
    start: total === 0 ? 0 : offset + 1,
    end: Math.min(offset + pageSize, total),
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  }
}

export function buildPaginationRange(
  currentPage: number,
  totalPages: number,
): PaginationToken[] {
  const safeTotal = Math.max(1, positiveInteger(totalPages, 1))
  const current = Math.min(Math.max(positiveInteger(currentPage, 1), 1), safeTotal)

  if (safeTotal <= 7) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1)
  }

  const pages = new Set([1, safeTotal, current - 1, current, current + 1])
  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= safeTotal)
    .sort((left, right) => left - right)
  const result: PaginationToken[] = []

  for (const page of sorted) {
    const previous = result.at(-1)
    if (typeof previous === 'number' && page - previous > 1) result.push('ellipsis')
    result.push(page)
  }

  return result
}
