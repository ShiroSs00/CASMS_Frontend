import { ApiError } from '@/shared/api'

function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('Thông tin công khai chưa đầy đủ.', 502)
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError('Thông tin công khai chưa đầy đủ.', 502)
  return value
}
function instant(value: unknown): string {
  const result = text(value)
  if (!Number.isFinite(Date.parse(result))) throw new ApiError('Thời gian chưa được xác nhận.', 502)
  return result
}
function sequence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new ApiError('Thứ tự lịch trình chưa hợp lệ.', 502)
  return value
}
function zone(value: unknown): string {
  const result = text(value)
  try { new Intl.DateTimeFormat('vi-VN', { timeZone: result }) }
  catch { throw new ApiError('Múi giờ lịch trình chưa được xác nhận.', 502) }
  return result
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new ApiError('Chi tiết lịch trình chưa đầy đủ.', 502)
  return value
}
function duration(value: unknown): number | null {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new ApiError('Thời lượng chưa được xác nhận.', 502)
  return value
}

export const publicSaleLabels: Record<string, string> = {
  OPEN_FOR_SALE: 'Đang mở bán', NOT_YET_OPEN: 'Chưa mở bán', STOPPED: 'Đã ngừng bán',
  SOLD_OUT: 'Đã hết chỗ', DEPARTED: 'Đã khởi hành', DRAFT: 'Bản nháp', CANCELLED: 'Đã hủy',
}

export function decodePublicSale(value: unknown, id: string) {
  const data = row(value)
  const state = text(data.publicSaleState)
  if (data.cruiseId !== id || typeof data.publicDisplayEligible !== 'boolean'
    || data.publicDisplayEligible && state !== 'OPEN_FOR_SALE'
    || !data.publicDisplayEligible && state === 'OPEN_FOR_SALE') throw new ApiError('Chưa xác nhận được trạng thái công khai.', 502)
  const openedForSaleAt = data.openedForSaleAt == null ? null : instant(data.openedForSaleAt)
  if (data.publicDisplayEligible && !openedForSaleAt) throw new ApiError('Chưa xác nhận được quyết định mở bán.', 502)
  return { publicDisplayEligible: data.publicDisplayEligible, publicSaleState: state,
    openedForSaleAt, evaluatedAt: instant(data.evaluatedAt) }
}

/** Explicit projection. Internal schedule fields never enter the view model. */
export function decodePublicItinerary(value: unknown, id: string) {
  const data = row(value)
  if (data.cruiseId !== id) throw new ApiError('Lịch trình không khớp chuyến khởi hành.', 502)
  return {
    cruiseId: id, departureDatetime: instant(data.departureDatetime), returnDatetime: instant(data.returnDatetime),
    durationDays: duration(data.durationDays), durationNights: duration(data.durationNights),
    days: list(data.days).map(value => {
      const day = row(value)
      const date = text(day.date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new ApiError('Ngày lịch trình chưa hợp lệ.', 502)
      const shipTimeZoneId = zone(day.shipTimeZoneId)
      if (shipTimeZoneId !== 'Asia/Ho_Chi_Minh') throw new ApiError('Chưa xác nhận được múi giờ tàu.', 502)
      return { dayNumber: sequence(day.dayNumber), date, shipTimeZoneId,
        portCalls: list(day.portCalls).map(value => {
          const port = row(value)
          const seq = sequence(port.sequence)
          return { sequence: seq, portName: typeof port.portName === 'string' ? port.portName : null,
            countryCode: typeof port.countryCode === 'string' ? port.countryCode : null,
            portTimeZoneId: zone(port.portTimeZoneId), arrival: instant(port.arrival), departure: instant(port.departure),
            isEmbarkation: typeof port.isEmbarkation === 'boolean' ? port.isEmbarkation : seq === 1,
            isDisembarkation: typeof port.isDisembarkation === 'boolean' ? port.isDisembarkation : false,
            destinationVisits: list(port.destinationVisits).map(value => {
              const visit = row(value)
              return { sequence: sequence(visit.sequence), destinationName: typeof visit.destinationName === 'string' ? visit.destinationName : null }
            }) }
        }) }
    }),
  }
}
