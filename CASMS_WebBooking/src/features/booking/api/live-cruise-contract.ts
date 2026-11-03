export type LiveCruiseDto = {
  cruiseId: string
  cruiseCode?: string | null
  cruiseName: string
  shipId?: string | null
  shipName?: string | null
  cruiseType?: 'ONE_DAY' | 'MULTI_DAYS' | null
  departureDatetime: string
  returnDatetime: string
  departurePortName?: string | null
  returnPortName?: string | null
  status: string
}

export type LiveCruisePageDto = {
  content: LiveCruiseDto[]
  number: number
  totalPages: number
  totalElements: number
}

export type LiveCruise = {
  id: string
  code?: string
  title: string
  shipId?: string
  ship?: string
  type?: 'ONE_DAY' | 'MULTI_DAYS'
  departure: string
  returnAt: string
  departurePort?: string
  returnPort?: string
}

export type LiveCruisePage = {
  items: LiveCruise[]
  page: number
  pageCount: number
  total: number
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const optionalText = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined
export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value)
function requiredText(value: unknown, field: string) {
  const text = optionalText(value)
  if (!text) throw new Error(`Dữ liệu cruise thiếu ${field}.`)
  return text
}
function requiredInstant(value: unknown, field: string) {
  const text = requiredText(value, field)
  if (!Number.isFinite(Date.parse(text))) throw new Error(`Dữ liệu cruise có ${field} không hợp lệ.`)
  return text
}

export function toPublishedCruise(value: unknown): LiveCruise | null {
  if (!record(value)) throw new Error('Dữ liệu cruise không đúng định dạng.')
  if (value.status !== 'PUBLISHED') return null
  const id = requiredText(value.cruiseId, 'cruiseId')
  if (!isUuid(id)) throw new Error('Dữ liệu cruise có cruiseId không hợp lệ.')
  if (value.shipId != null && !isUuid(value.shipId)) throw new Error('Dữ liệu cruise có shipId không hợp lệ.')
  return {
    id,
    code: optionalText(value.cruiseCode),
    title: requiredText(value.cruiseName, 'cruiseName'),
    shipId: value.shipId ?? undefined,
    ship: optionalText(value.shipName),
    type: value.cruiseType === 'ONE_DAY' || value.cruiseType === 'MULTI_DAYS' ? value.cruiseType : undefined,
    departure: requiredInstant(value.departureDatetime, 'departureDatetime'),
    returnAt: requiredInstant(value.returnDatetime, 'returnDatetime'),
    departurePort: optionalText(value.departurePortName),
    returnPort: optionalText(value.returnPortName),
  }
}

export function toPublishedPage(value: unknown): LiveCruisePage {
  if (!record(value) || !Array.isArray(value.content)
    || !Number.isInteger(value.number) || (value.number as number) < 0
    || !Number.isInteger(value.totalPages) || (value.totalPages as number) < 0
    || !Number.isInteger(value.totalElements) || (value.totalElements as number) < 0
    || value.content.length > (value.totalElements as number)
    || (value.totalPages === 0 && (value.number !== 0 || value.totalElements !== 0))
    || ((value.number as number) >= (value.totalPages as number) && value.content.length > 0)) {
    throw new Error('Phân trang cruise không đúng định dạng.')
  }
  const items = value.content.map((item) => {
    const cruise = toPublishedCruise(item)
    if (!cruise) throw new Error('Danh mục PUBLISHED chứa cruise chưa công bố.')
    return cruise
  })
  return { items, page: (value.number as number) + 1, pageCount: Math.max(1, value.totalPages as number), total: value.totalElements as number }
}
