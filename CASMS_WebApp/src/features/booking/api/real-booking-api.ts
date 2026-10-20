import { apiRequest } from '@/shared/api'
import { decodeBookingContext, decodeBookingSummary, type BookingContext, type BookingSummary } from '@/domain/booking-context'
export type AvailableCabin = { cabinId: string; cabinNumber: string; deckId: string; deckNumber: number; deckName: string; cabinType: string; capacity: number; remainingCapacity: number; isAccessible: boolean; priceMultiplier?: number; estimatedPrice?: number }
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
  if (!cruise || cruise.cruiseId !== draft.cruiseId || cruise.status !== 'PUBLISHED' || !cruise.shipId || Date.parse(cruise.departureDatetime) <= now) errors.push('Vui lòng chọn chuyến du lịch đã công bố, có tàu và chưa khởi hành.')
  if (!/^[A-Z]{3}$/.test(draft.currency)) errors.push('Đơn vị tiền tệ phải là mã 3 chữ cái in hoa (VD: USD, VND).')
  if (!['FULL', 'DEPOSIT', 'STAGES'].includes(draft.paymentPlan)) errors.push('Vui lòng chọn hình thức thanh toán hợp lệ.')
  if (draft.notes.length > 500) errors.push('Ghi chú không được vượt quá 500 ký tự.')
  if (!cabins || !draft.passengers.length) errors.push('Cần danh sách phòng trống và ít nhất một hành khách.')
  if (!draft.passengers[0]?.email.trim() && !draft.passengers[0]?.phoneNumber.trim()) errors.push('Hành khách đại diện (người đầu tiên) cần nhập Email hoặc Số điện thoại để liên hệ và tra cứu.')
  const used = new Map<string, number>(), documents = new Set<string>()
  draft.passengers.forEach((person, index) => {
    const pIndex = index + 1
    const cabin = cabins?.find(item => item.cabinId === person.cabinId)
    if (!person.fullName.trim() || person.fullName.trim().length < 2) errors.push(`Hành khách ${pIndex}: Vui lòng nhập họ và tên (tối thiểu 2 ký tự).`)
    else if (person.fullName.trim().length > 100) errors.push(`Hành khách ${pIndex}: Họ tên không được vượt quá 100 ký tự.`)

    if (!cabin) errors.push(`Hành khách ${pIndex}: Vui lòng chọn phòng trống.`)

    if (person.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email.trim())) errors.push(`Hành khách ${pIndex}: Email "${person.email}" không đúng định dạng.`)
    if (person.phoneNumber.trim() && !/^(\+?[0-9]{8,15})$/.test(person.phoneNumber.trim())) errors.push(`Hành khách ${pIndex}: Số điện thoại phải từ 8 đến 15 chữ số (VD: 0912345678).`)

    if (person.dateOfBirth) {
      const birthTime = Date.parse(person.dateOfBirth)
      if (!Number.isFinite(birthTime) || birthTime > now) errors.push(`Hành khách ${pIndex}: Ngày sinh không hợp lệ hoặc ở tương lai.`)
      else if (new Date(person.dateOfBirth).getFullYear() < 1900) errors.push(`Hành khách ${pIndex}: Năm sinh không hợp lý (sau 1900).`)
    }

    if (person.documentType && !person.documentNumber.trim()) errors.push(`Hành khách ${pIndex}: Đã chọn loại giấy tờ thì vui lòng nhập số giấy tờ.`)
    if (person.documentNumber.trim()) {
      if (person.documentNumber.trim().length > 30) errors.push(`Hành khách ${pIndex}: Số giấy tờ không được vượt quá 30 ký tự.`)
      const number = person.documentNumber.trim().toUpperCase()
      if (documents.has(number)) errors.push(`Hành khách ${pIndex}: Số giấy tờ ${number} bị trùng lặp với hành khách khác.`)
      documents.add(number)
    }

    if (person.nationality.trim() && (person.nationality.trim().length < 2 || person.nationality.trim().length > 10)) {
      errors.push(`Hành khách ${pIndex}: Mã quốc tịch từ 2 đến 10 ký tự (VD: VN, USA).`)
    }

    if (person.cabinId) {
      used.set(person.cabinId, (used.get(person.cabinId) ?? 0) + 1)
    }
  })
  for (const [id, count] of used) {
    const c = cabins?.find(item => item.cabinId === id)
    if (count > (c?.remainingCapacity ?? -1)) {
      errors.push(`Phòng ${c?.cabinNumber ?? id} chỉ còn ${c?.remainingCapacity ?? 0} chỗ, nhưng bạn đã chọn cho ${count} hành khách.`)
    }
  }
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
