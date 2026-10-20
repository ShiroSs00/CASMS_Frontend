import { apiRequest } from '@/shared/api'
import { decodeBookingContext, decodeBookingSummary, type BookingContext, type BookingSummary } from '@/domain/booking-context'
export type AvailableCabin = { cabinId: string; cabinNumber: string; deckId: string; deckNumber: number; deckName: string; cabinType: string; capacity: number; remainingCapacity: number; isAccessible: boolean }
export type BookingDetail = BookingContext & { agreedFareAmount: number; currency: string; requiredDepositAmount: number; finalPaymentDueAt: string | null; contractReference: string | null; contractStatus: string | null; paymentPlan: string; contractSigningInstructions: string | null; departureDatetime: string; returnDatetime: string; cancellationReason: string | null; installments: { sequenceNo: number; requiredAmount: number; currency: string; dueAt: string; status: string; installmentType: string; description: string }[] }
export type BookingPersonDraft = { fullName: string; dateOfBirth: string; nationality: string; documentType: '' | 'NationalID' | 'Passport'; documentNumber: string; email: string; phoneNumber: string; cabinId: string; tourPackageId: string }
export type BookingDraft = { cruiseId: string; currency: string; paymentPlan: 'FULL' | 'DEPOSIT' | 'STAGES'; notes: string; passengers: BookingPersonDraft[] }
export type BookingCruiseOption = { cruiseId: string; cruiseCode: string; cruiseName: string; status: string; shipId: string | null; departureDatetime: string }
export function decodeBookingDetail(value: unknown): BookingDetail {
  const context = decodeBookingContext(value), row = value as Record<string, unknown>
  if (['agreedFareAmount', 'requiredDepositAmount'].some(key => typeof row[key] !== 'number' || !Number.isFinite(row[key])) || typeof row.currency !== 'string' || !Array.isArray(row.installments)) throw new Error('Thông tin giá và hợp đồng đặt chỗ không đầy đủ.')
  return { ...row, ...context } as BookingDetail
}
const path = (id: string) => '/booking/' + encodeURIComponent(id)
export function serializeBooking(draft: BookingDraft) {
  return { cruiseId: draft.cruiseId, currency: draft.currency, paymentPlan: draft.paymentPlan, notes: draft.notes.trim() || undefined, passengers: draft.passengers.map(person => ({ fullName: person.fullName.trim(), cabinId: person.cabinId, dateOfBirth: person.dateOfBirth || undefined, nationality: person.nationality.trim() || undefined, documentType: person.documentType || undefined, documentNumber: person.documentNumber.trim() || undefined, email: person.email.trim() || undefined, phoneNumber: person.phoneNumber.trim() || undefined, tourPackageId: person.tourPackageId || undefined })) }
}
export function validateBooking(draft: BookingDraft, cruise: BookingCruiseOption | undefined, cabins: AvailableCabin[] | null, now = Date.now()): string[] {
  const errors: string[] = []
  if (!cruise || cruise.cruiseId !== draft.cruiseId || cruise.status !== 'PUBLISHED' || !cruise.shipId || Date.parse(cruise.departureDatetime) <= now) errors.push('Chọn chuyến đã công bố, có tàu và chưa khởi hành.')
  if (!/^[A-Z]{3}$/.test(draft.currency) || !['FULL', 'DEPOSIT', 'STAGES'].includes(draft.paymentPlan) || draft.notes.length > 500) errors.push('Kiểm tra tiền tệ, hình thức thanh toán và ghi chú tối đa 500 ký tự.')
  if (!cabins || !draft.passengers.length) errors.push('Cần danh sách phòng trống và ít nhất một hành khách.')
  if (!draft.passengers[0]?.email.trim() && !draft.passengers[0]?.phoneNumber.trim()) errors.push('Hành khách đại diện cần email hoặc số điện thoại để liên hệ và tra cứu.')
  const used = new Map<string, number>(), documents = new Set<string>()
  draft.passengers.forEach((person, index) => {
    const cabin = cabins?.find(item => item.cabinId === person.cabinId)
    if (person.documentNumber.trim()) { const number = person.documentNumber.trim().toUpperCase(); if (documents.has(number)) errors.push('Số giấy tờ không được trùng giữa các hành khách.'); documents.add(number) }
    used.set(person.cabinId, (used.get(person.cabinId) ?? 0) + 1)
    if (person.fullName.trim().length < 2 || person.fullName.trim().length > 100 || !cabin || person.nationality && (person.nationality.length < 2 || person.nationality.length > 10) || person.documentNumber.length > 30 || person.documentType && !person.documentNumber.trim() || person.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email) || !/^(\+?[0-9]{8,15})?$/.test(person.phoneNumber) || person.dateOfBirth && (!Number.isFinite(Date.parse(person.dateOfBirth)) || Date.parse(person.dateOfBirth) > now)) errors.push(`Kiểm tra tên, phòng và thông tin liên hệ/giấy tờ của hành khách ${index + 1}.`)
  })
  for (const [id, count] of used) if (count > (cabins?.find(item => item.cabinId === id)?.remainingCapacity ?? -1)) errors.push('Số khách chọn cùng phòng vượt số chỗ còn lại.')
  return errors
}
export const realBookingApi = {
  async list(page: number, status?: string, cruiseId?: string, signal?: AbortSignal): Promise<{ content: BookingSummary[]; totalPages: number; totalElements: number }> {
    const data = await apiRequest<{ content: unknown[]; totalPages: number; totalElements: number }>('/booking', { query: { page, size: 20, status, cruiseId }, signal })
    if (!Array.isArray(data?.content) || !Number.isSafeInteger(data.totalPages) || !Number.isSafeInteger(data.totalElements)) throw new Error('Danh sách đặt chỗ không hợp lệ.')
    return { ...data, content: data.content.map(decodeBookingSummary) }
  },
  async get(id: string, signal?: AbortSignal) { const data = decodeBookingDetail(await apiRequest<unknown>(path(id), { signal })); if (data.bookingId !== id) throw new Error('Không đúng đặt chỗ yêu cầu.'); return data },
  lookup: async (reference: string, email: string, phoneNumber: string, signal?: AbortSignal) => decodeBookingDetail(await apiRequest<unknown>('/booking/lookup', { query: { reference: reference.trim(), email: email.trim() || undefined, phoneNumber: phoneNumber.trim() || undefined }, signal })),
  async cabins(cruiseId: string, signal?: AbortSignal, filters?: { cabinType?: string; deckId?: string; minCapacity?: number }): Promise<AvailableCabin[]> {
    const data = await apiRequest<AvailableCabin[]>('/booking/available-cabins', { query: { cruiseId, ...filters }, signal })
    if (!Array.isArray(data) || data.some(item => !item.cabinId || !item.cabinNumber || !Number.isSafeInteger(item.remainingCapacity) || item.remainingCapacity < 0 || !Number.isSafeInteger(item.capacity))) throw new Error('Thông tin phòng trống chưa đầy đủ.')
    return data
  },
  async cruises(signal?: AbortSignal) {
    const items: BookingCruiseOption[] = []
    for (let page = 0, pages = 1; page < pages; page++) { const data = await apiRequest<{ content: BookingCruiseOption[]; totalPages: number }>('/cruise', { query: { page, size: 100, status: 'PUBLISHED' }, signal }); if (!Array.isArray(data?.content) || !Number.isSafeInteger(data.totalPages)) throw new Error('Không tải được chuyến đã công bố.'); items.push(...data.content); pages = data.totalPages }
    return items
  },
  async packages(signal?: AbortSignal) { const data = await apiRequest<{ id: string; name: string; status: string; price: number; currency: string }[]>('/servicepackage/packages', { signal }); if (!Array.isArray(data) || data.some(item => !item.id || !item.name)) throw new Error('Không tải được gói dịch vụ.'); return data.filter(item => item.status === 'ACTIVE') },
  create: async (draft: BookingDraft) => decodeBookingDetail(await apiRequest<unknown>('/booking', { method: 'POST', body: serializeBooking(draft) })),
  confirm: async (id: string) => decodeBookingDetail(await apiRequest<unknown>(path(id) + '/confirm', { method: 'POST' })),
  cancel: async (id: string, reason: string) => decodeBookingDetail(await apiRequest<unknown>(path(id) + '/cancel', { method: 'POST', body: { reason: reason.trim() } })),
  changeCabin: async (bookingPassengerId: string, newCabinId: string, changeReason: string) => decodeBookingDetail(await apiRequest<unknown>('/booking/change-cabin', { method: 'POST', body: { bookingPassengerId, newCabinId, changeReason: changeReason.trim() || undefined } })),
}
