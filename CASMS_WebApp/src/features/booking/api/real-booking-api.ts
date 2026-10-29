import { ApiError, apiRequest } from '@/shared/api'
import { decodeBookingContext, decodeBookingSummary, type BookingContext, type BookingSummary } from '@/domain/booking-context'
export type AvailableCabin = { cabinId: string; cabinNumber: string; deckId: string | null; deckNumber: number | null; deckName: string | null; cabinType: string; capacity: number; remainingCapacity: number; isAccessible: boolean | null; priceMultiplier?: number | null; estimatedPrice?: number | null }
export type BookingListItem = BookingSummary & { agreedFareAmount: number | null; currency: string | null; departureDatetime: string | null; passengerCount: number | null }
type BookingProfile = BookingContext['passengers'][number] & { dateOfBirth: string | null; nationality: string | null; email: string | null; phoneNumber: string | null }
export type BookingDetail = Omit<BookingContext, 'passengers'> & { passengers: BookingProfile[]; agreedFareAmount: number; currency: string; requiredDepositAmount: number; finalPaymentDueAt: string | null; contractReference: string | null; contractStatus: string | null; paymentPlan: string | null; contractSigningInstructions: string | null; departureDatetime: string | null; returnDatetime: string | null; cancellationReason: string | null; installments: { sequenceNo: number; requiredAmount: number; currency: string; dueAt: string | null; status: string; installmentType: string; description: string | null }[] }
export type BookingPersonDraft = { fullName: string; dateOfBirth: string; nationality: string; documentType: '' | 'NationalID' | 'Passport'; documentNumber: string; email: string; phoneNumber: string; cabinId: string; tourPackageId: string }
export type BookingDraft = { cruiseId: string; currency: string; paymentPlan: 'FULL' | 'DEPOSIT' | 'STAGES'; notes: string; passengers: BookingPersonDraft[] }
export type BookingCruiseOption = { sellable?: boolean; cruiseId: string; cruiseCode: string; cruiseName: string; status: string; shipId: string | null; departureDatetime: string; returnDatetime?: string }
export function decodeBookingDetail(value: unknown): BookingDetail {
  const context = decodeBookingContext(value), row = value as Record<string, unknown>
  if (['agreedFareAmount', 'requiredDepositAmount'].some(key => typeof row[key] !== 'number' || !Number.isFinite(row[key])) || typeof row.currency !== 'string' || !Array.isArray(row.installments)) throw new Error('Thông tin giá và hợp đồng đặt chỗ không đầy đủ.')
  if (!/^[A-Z]{3}$/.test(row.currency) || (row.agreedFareAmount as number) < 0 || (row.requiredDepositAmount as number) < 0
    || (row.paymentPlan != null && !['FULL', 'DEPOSIT', 'STAGES'].includes(String(row.paymentPlan)))
    || (row.contractStatus != null && !['Draft', 'Accepted', 'Cancelled'].includes(String(row.contractStatus)))
    || ['contractReference', 'contractStatus', 'contractSigningInstructions', 'cancellationReason'].some(key => row[key] != null && typeof row[key] !== 'string')
    || ['departureDatetime', 'returnDatetime', 'finalPaymentDueAt'].some(key => row[key] != null && (typeof row[key] !== 'string' || !Number.isFinite(Date.parse(row[key] as string))))
    || row.installments.some(item => !item || !Number.isSafeInteger(item.sequenceNo) || item.sequenceNo < 1 || typeof item.requiredAmount !== 'number' || !Number.isFinite(item.requiredAmount) || item.requiredAmount < 0 || typeof item.currency !== 'string' || !/^[A-Z]{3}$/.test(item.currency) || !['Scheduled', 'Cancelled'].includes(item.status) || !['Deposit', 'FinalFare'].includes(item.installmentType) || (item.description != null && typeof item.description !== 'string') || (item.dueAt != null && (typeof item.dueAt !== 'string' || !Number.isFinite(Date.parse(item.dueAt)))))) throw new Error('Thông tin giá và hợp đồng đặt chỗ không hợp lệ.')
  const passengers = context.passengers.map((person, index) => {
    const source = (row.passengers as Record<string, unknown>[])[index]
    if (['dateOfBirth', 'nationality', 'email', 'phoneNumber'].some(key => source[key] != null && typeof source[key] !== 'string')
      || (source.dateOfBirth != null && (!/^\d{4}-\d{2}-\d{2}$/.test(String(source.dateOfBirth)) || !Number.isFinite(Date.parse(String(source.dateOfBirth))) || new Date(String(source.dateOfBirth)).toISOString().slice(0, 10) !== source.dateOfBirth))) throw new Error('Thông tin hồ sơ hành khách không hợp lệ.')
    // Do not render or carry the Backend's protected document-number field.
    return { ...person, dateOfBirth: source.dateOfBirth ?? null, nationality: source.nationality ?? null, email: source.email ?? null, phoneNumber: source.phoneNumber ?? null }
  })
  return { ...row, ...context, passengers, paymentPlan: row.paymentPlan ?? null } as BookingDetail
}
function decodeListItem(value: unknown): BookingListItem {
  const summary = decodeBookingSummary(value), row = value as Record<string, unknown>
  if ((row.agreedFareAmount != null && (typeof row.agreedFareAmount !== 'number' || !Number.isFinite(row.agreedFareAmount) || row.agreedFareAmount < 0))
    || (row.currency != null && (typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency)))
    || (row.departureDatetime != null && (typeof row.departureDatetime !== 'string' || !Number.isFinite(Date.parse(row.departureDatetime))))
    || (row.passengerCount != null && (!Number.isSafeInteger(row.passengerCount) || (row.passengerCount as number) < 0))) throw new Error('Thông tin tóm tắt đặt chỗ không hợp lệ.')
  return { ...summary, agreedFareAmount: row.agreedFareAmount as number ?? null, currency: row.currency as string ?? null, departureDatetime: row.departureDatetime as string ?? null, passengerCount: row.passengerCount as number ?? null }
}
const path = (id: string) => '/booking/' + encodeURIComponent(id)
export function serializeBooking(draft: BookingDraft) {
  return { cruiseId: draft.cruiseId, currency: draft.currency, paymentPlan: draft.paymentPlan, notes: draft.notes.trim() || undefined, passengers: draft.passengers.map(person => ({ fullName: person.fullName.trim(), cabinId: person.cabinId, dateOfBirth: person.dateOfBirth || undefined, nationality: person.nationality.trim() || undefined, documentType: person.documentType || undefined, documentNumber: person.documentNumber.trim() || undefined, email: person.email.trim() || undefined, phoneNumber: person.phoneNumber.trim() || undefined, tourPackageId: person.tourPackageId || undefined })) }
}
export function bookingPackageErrors(draft: BookingDraft, packages: { id: string; currency: string }[] | null): Record<string, string> {
  const errors: Record<string, string> = {}
  draft.passengers.forEach((person, index) => {
    if (!person.tourPackageId) return
    const pack = packages?.find(item => item.id === person.tourPackageId)
    if (!pack) errors[`person-${index}-tourPackageId`] = 'Gói đã chọn chưa tải được hoặc không còn hoạt động. Bỏ chọn hoặc tải lại gói.'
    else if (pack.currency !== draft.currency) errors[`person-${index}-tourPackageId`] = `Gói dùng ${pack.currency}, khác tiền tệ đặt chỗ ${draft.currency}. Chọn gói cùng tiền tệ hoặc bỏ chọn gói.`
  })
  return errors
}
export function bookingFieldErrors(draft: BookingDraft, cruise: BookingCruiseOption | undefined, cabins: AvailableCabin[] | null, now = Date.now(), step = 3): Record<string, string> {
  const errors: Record<string, string> = {}
  const used = new Map<string, number>(), documents = new Set<string>()
  if (step !== 2) {
    if (!cruise || cruise.cruiseId !== draft.cruiseId || cruise.status !== 'PUBLISHED' || cruise.sellable !== true || !cruise.shipId || !Number.isFinite(Date.parse(cruise.departureDatetime)) || Date.parse(cruise.departureDatetime) <= now) errors['real-booking-cruise'] = 'Chọn lần khởi hành đang mở bán và còn chỗ theo dữ liệu máy chủ.'
    if (!cabins || !draft.passengers.length) errors['real-booking-cruise'] = 'Cần danh sách phòng trống và ít nhất một hành khách.'
    draft.passengers.forEach(person => { if (person.cabinId) used.set(person.cabinId, (used.get(person.cabinId) ?? 0) + 1) })
    draft.passengers.forEach((person, index) => {
      const cabin = cabins?.find(item => item.cabinId === person.cabinId)
      if (!cabin) errors[`person-${index}-cabinId`] = 'Vui lòng chọn phòng còn trống.'
      else if ((used.get(cabin.cabinId) ?? 0) > cabin.remainingCapacity) errors[`person-${index}-cabinId`] = `Phòng ${cabin.cabinNumber} chỉ còn ${cabin.remainingCapacity} chỗ cho nhóm của bạn.`
    })
  }
  if (step !== 1) {
    if (!/^[A-Z]{3}$/.test(draft.currency)) errors['real-booking-currency'] = 'Tiền tệ phải là mã 3 chữ cái in hoa.'
    if (!['FULL', 'DEPOSIT', 'STAGES'].includes(draft.paymentPlan)) errors['real-booking-plan'] = 'Chọn hình thức thanh toán hợp lệ.'
    if (draft.notes.length > 500) errors['real-booking-notes'] = 'Ghi chú không được vượt quá 500 ký tự.'
    if (!draft.passengers[0]?.email.trim() && !draft.passengers[0]?.phoneNumber.trim()) errors['person-0-email'] = 'Người đại diện cần email hoặc số điện thoại liên hệ.'
    draft.passengers.forEach((person, index) => {
      const field = (key: keyof BookingPersonDraft, message: string) => { errors[`person-${index}-${key}`] = message }
      if (person.fullName.trim().length < 2 || person.fullName.trim().length > 100) field('fullName', 'Họ tên cần từ 2 đến 100 ký tự.')
      if (person.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email.trim())) field('email', 'Email chưa đúng định dạng.')
      if (person.phoneNumber.trim() && !/^(\+?[0-9]{8,15})$/.test(person.phoneNumber.trim())) field('phoneNumber', 'Số điện thoại cần 8–15 chữ số, có thể bắt đầu bằng +.')
      if (person.dateOfBirth) {
        const birth = Date.parse(person.dateOfBirth)
        const today = new Date(now); today.setHours(0, 0, 0, 0)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(person.dateOfBirth) || !Number.isFinite(birth) || new Date(birth).toISOString().slice(0, 10) !== person.dateOfBirth || birth >= today.getTime()) field('dateOfBirth', 'Ngày sinh cần là ngày hợp lệ trong quá khứ.')
      }
      if (person.documentType && !person.documentNumber.trim()) field('documentNumber', 'Nhập số giấy tờ cho loại đã chọn.')
      const number = person.documentNumber.trim().toUpperCase()
      if (number.length > 30) field('documentNumber', 'Số giấy tờ tối đa 30 ký tự.')
      if (number && documents.has(number)) field('documentNumber', 'Số giấy tờ trùng với hành khách khác.')
      if (number) documents.add(number)
      if (person.nationality.trim() && (person.nationality.trim().length < 2 || person.nationality.trim().length > 10)) field('nationality', 'Mã quốc tịch cần từ 2 đến 10 ký tự (VD: VN).')
    })
  }
  return errors
}
export function validateBooking(draft: BookingDraft, cruise: BookingCruiseOption | undefined, cabins: AvailableCabin[] | null, now = Date.now()): string[] {
  return Object.values(bookingFieldErrors(draft, cruise, cabins, now))
}
export const realBookingApi = {
  async list(page: number, status?: string, cruiseId?: string, signal?: AbortSignal): Promise<{ content: BookingListItem[]; totalPages: number; totalElements: number }> {
    const data = await apiRequest<{ content: unknown[]; number?: number; totalPages: number; totalElements: number }>('/booking', { query: { page, size: 20, status, cruiseId }, signal })
    if (!Array.isArray(data?.content) || !Number.isSafeInteger(data.totalPages) || data.totalPages < 0 || !Number.isSafeInteger(data.totalElements) || data.totalElements < 0) throw new Error('Danh sách đặt chỗ không hợp lệ.')
    if (data.number != null && data.number !== page) throw new Error('Phản hồi không thuộc trang đặt chỗ yêu cầu.')
    return { ...data, content: data.content.map(decodeListItem) }
  },
  async get(id: string, signal?: AbortSignal) { const data = decodeBookingDetail(await apiRequest<unknown>(path(id), { signal })); if (data.bookingId !== id) throw new Error('Không đúng đặt chỗ yêu cầu.'); return data },
  async lookup(reference: string, email: string, phoneNumber: string, signal?: AbortSignal) { const data = decodeBookingDetail(await apiRequest<unknown>('/booking/lookup', { query: { reference: reference.trim(), email: email.trim() || undefined, phoneNumber: phoneNumber.trim() || undefined }, signal })); if (data.bookingReference !== reference.trim()) throw new Error('Mã đặt chỗ trả về không khớp yêu cầu.'); return data },
  async cabins(cruiseId: string, signal?: AbortSignal, filters?: { cabinType?: string; deckId?: string; minCapacity?: number }): Promise<AvailableCabin[]> {
    const data = await apiRequest<AvailableCabin[]>('/booking/available-cabins', { query: { cruiseId, ...filters }, signal })
    if (!Array.isArray(data) || data.some(item => !item || typeof item.cabinId !== 'string' || !item.cabinId || typeof item.cabinNumber !== 'string' || !item.cabinNumber || !Number.isSafeInteger(item.remainingCapacity) || item.remainingCapacity < 0 || !Number.isSafeInteger(item.capacity) || item.capacity < 1 || item.remainingCapacity > item.capacity)) throw new Error('Thông tin phòng trống chưa đầy đủ.')
    if (data.some(item => ['estimatedPrice', 'priceMultiplier'].some(key => { const value = item[key as 'estimatedPrice' | 'priceMultiplier']; return value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0) }) || (item.deckNumber != null && !Number.isSafeInteger(item.deckNumber)) || (item.isAccessible != null && typeof item.isAccessible !== 'boolean') || ['deckId', 'deckName', 'cabinType'].some(key => { const value = item[key as 'deckId' | 'deckName' | 'cabinType']; return value != null && typeof value !== 'string' }))) throw new Error('Thông tin tầng hoặc giá tham chiếu phòng không hợp lệ.')
    return data
  },
  async cruises(signal?: AbortSignal) {
    const items: BookingCruiseOption[] = []
    for (let page = 0, pages = 1; page < pages; page++) { const data = await apiRequest<{ content: BookingCruiseOption[]; totalPages: number }>('/cruise', { query: { page, size: 100, status: 'PUBLISHED' }, signal }); if (!Array.isArray(data?.content) || !Number.isSafeInteger(data.totalPages) || data.totalPages < 0 || data.content.some(item => !item || !item.cruiseId || !item.cruiseName || item.status !== 'PUBLISHED' || !Number.isFinite(Date.parse(item.departureDatetime)))) throw new Error('Không tải được chuyến đã công bố.'); items.push(...data.content); pages = data.totalPages }
    const available=await Promise.all(items.map(async item=>{
      const state=await apiRequest<{cruiseId:string;sellable:boolean}>(`/cruise/${encodeURIComponent(item.cruiseId)}/sellability`,{signal})
      if(state.cruiseId!==item.cruiseId||typeof state.sellable!=='boolean')throw new ApiError('',502)
      return {...item,sellable:state.sellable}
    }))
    return available.filter(item=>item.sellable===true)
  },
  async packages(signal?: AbortSignal) { const data = await apiRequest<{ id: string; name: string; status: string; price: number; currency: string }[]>('/servicepackage/packages', { signal }); if (!Array.isArray(data) || data.some(item => !item || !item.id || !item.name || typeof item.status !== 'string' || typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0 || typeof item.currency !== 'string' || !/^[A-Z]{3}$/.test(item.currency))) throw new Error('Không tải được gói dịch vụ.'); return data.filter(item => item.status === 'ACTIVE') },
  async create(draft: BookingDraft) {
    if (draft.passengers.some(person => person.tourPackageId)) {
      // This read happens before any write. A failure here is safe to retry.
      const packages = await realBookingApi.packagesForCruise(draft.cruiseId).catch(() => { throw new ApiError('Chưa kiểm tra được gói dịch vụ. Đặt chỗ chưa được gửi; hãy tải lại gói và thử lại.', 422) })
      const errors = bookingPackageErrors(draft, packages)
      if (Object.keys(errors).length) throw new ApiError(Object.values(errors)[0], 422)
    }
    const data = decodeBookingDetail(await apiRequest<unknown>('/booking', { method: 'POST', body: serializeBooking(draft) }))
    if (data.cruiseId !== draft.cruiseId) throw new Error('Chuyến đi trả về không khớp yêu cầu đặt chỗ; cần kiểm tra kết quả trước khi gửi lại.')
    return data
  },
  async packagesForCruise(cruiseId: string, signal?: AbortSignal) {
    if (!cruiseId) return []
    const links = await apiRequest<unknown>('/cruise/' + encodeURIComponent(cruiseId) + '/packages', { signal })
    if (!Array.isArray(links) || links.some(item => !item || item.cruiseId !== cruiseId || typeof item.tourPackageId !== 'string' || !item.tourPackageId || typeof item.active !== 'boolean')) throw new ApiError('Chưa xác định được gói dịch vụ áp dụng cho lần khởi hành.', 502)
    const ids = new Set(links.filter(item => item.active).map(item => item.tourPackageId))
    // Assignment + ACTIVE is a prerequisite, not proof that sale/booking is open.
    const catalog = await realBookingApi.packages(signal)
    return catalog.filter(item => ids.has(item.id))
  },
  confirm: async (id: string) => decodeBookingDetail(await apiRequest<unknown>(path(id) + '/confirm', { method: 'POST' })),
  acceptContract: async (id:string,documentReference:string,notes?:string) => {
    const saved=decodeBookingDetail(await apiRequest<unknown>(path(id)+'/contract/accept',{method:'POST',body:{documentReference:documentReference.trim(),...(notes?.trim()?{notes:notes.trim()}:{})}}))
    if(saved.bookingId!==id||saved.contractStatus!=='Accepted')throw new ApiError('Chưa xác nhận được việc ghi nhận hợp đồng. Tải lại hồ sơ để đối chiếu.',502)
    return saved
  },
  cancel: async (id: string, reason: string) => decodeBookingDetail(await apiRequest<unknown>(path(id) + '/cancel', { method: 'POST', body: { reason: reason.trim() } })),
  changeCabin: async (bookingPassengerId: string, newCabinId: string, changeReason: string) => decodeBookingDetail(await apiRequest<unknown>('/booking/change-cabin', { method: 'POST', body: { bookingPassengerId, newCabinId, changeReason: changeReason.trim() || undefined } })),
}
