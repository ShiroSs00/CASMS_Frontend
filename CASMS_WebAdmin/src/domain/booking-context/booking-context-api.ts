import { apiRequest } from '@/shared/api'

export type BookingSummary = { bookingId: string; bookingReference: string; bookingStatus: 'Draft' | 'Confirmed' | 'Cancelled'; cruiseId: string; cruiseName: string }
export type BookingPassenger = { bookingPassengerId: string; passengerId: string; fullName: string; participationStatus: 'Active' | 'Cancelled'; cabinId?: string | null; cabinNumber?: string | null; tourPackageId?: string | null; tourPackageName?: string | null }
export type BookingContext = BookingSummary & { passengers: BookingPassenger[] }
export function decodeBookingSummary(value: unknown): BookingSummary {
  if (!value || typeof value !== 'object') throw new Error('Không đọc được đặt chỗ.')
  const row = value as Record<string, unknown>
  if (['bookingId', 'bookingReference', 'cruiseId', 'cruiseName'].some(field => typeof row[field] !== 'string' || !row[field]) || !['Draft', 'Confirmed', 'Cancelled'].includes(String(row.bookingStatus))) throw new Error('Thông tin đặt chỗ không đầy đủ.')
  return { bookingId: row.bookingId as string, bookingReference: row.bookingReference as string, bookingStatus: row.bookingStatus as BookingSummary['bookingStatus'], cruiseId: row.cruiseId as string, cruiseName: row.cruiseName as string }
}
export function decodeBookingContext(value: unknown): BookingContext {
  const summary = decodeBookingSummary(value)
  const rows = (value as Record<string, unknown>).passengers
  if (!Array.isArray(rows) || rows.some(row => !row || ['bookingPassengerId', 'passengerId', 'fullName'].some(field => typeof row[field] !== 'string' || !row[field]) || !['Active', 'Cancelled'].includes(row.participationStatus))) throw new Error('Danh sách hành khách của đặt chỗ không đầy đủ.')
  return { ...summary, passengers: rows.map(row => ({ bookingPassengerId: row.bookingPassengerId, passengerId: row.passengerId, fullName: row.fullName, participationStatus: row.participationStatus, cabinId: row.cabinId, cabinNumber: row.cabinNumber, tourPackageId: row.tourPackageId, tourPackageName: row.tourPackageName })) }
}
export const bookingContextApi = {
  async list(cruiseId?: string, signal?: AbortSignal): Promise<BookingSummary[]> {
    const items: BookingSummary[] = []
    for (let page = 0, pages = 1; page < pages; page++) {
      const value = await apiRequest<{ content: unknown[]; totalPages: number }>('/booking', { query: { cruiseId, page, size: 100 }, signal })
      if (!value || !Array.isArray(value.content) || !Number.isSafeInteger(value.totalPages) || value.totalPages < 0) throw new Error('Danh sách đặt chỗ không đúng định dạng.')
      items.push(...value.content.map(decodeBookingSummary)); pages = value.totalPages
    }
    return items
  },
  async get(id: string, signal?: AbortSignal): Promise<BookingContext> {
    const value = decodeBookingContext(await apiRequest<unknown>(`/booking/${encodeURIComponent(id)}`, { signal }))
    if (value.bookingId !== id) throw new Error('Phản hồi không thuộc đặt chỗ đã chọn.')
    return value
  },
}
