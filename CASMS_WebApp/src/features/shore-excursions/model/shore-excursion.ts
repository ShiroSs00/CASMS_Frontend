export const excursionStatuses = ['PLANNED', 'OPEN', 'FULL', 'CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
export type ExcursionStatus = typeof excursionStatuses[number]
export const statusLabels: Record<ExcursionStatus, string> = {
  PLANNED: 'Đã lên kế hoạch', OPEN: 'Đang mở đăng ký', FULL: 'Đủ khách', CLOSED: 'Đã đóng đăng ký',
  IN_PROGRESS: 'Đang diễn ra', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy',
}
export type ShoreExcursion = {
  shoreExcursionId: string; cruiseStopId: string; supplierId: string; supplierName: string
  excursionCode: string | null; excursionName: string; startTime: string; plannedReturnTime: string; meetingPoint: string
  minimumParticipants: number | null; maximumCapacity: number; registeredParticipants: number; availableCapacity: number
  price: number | null; currencyCode: string | null; status: ExcursionStatus; cancellationReason: string | null
  createdAt: string; updatedAt: string
}
export type ExcursionRequest = {
  cruiseStopId: string; supplierId: string; excursionCode?: string; excursionName: string
  startTime: string; plannedReturnTime: string; meetingPoint: string
  minimumParticipants?: number; maximumCapacity: number; price?: number; currencyCode?: string
}
export type ExcursionFormValues = Record<keyof ExcursionRequest, string>
export const emptyExcursionForm: ExcursionFormValues = {
  cruiseStopId: '', supplierId: '', excursionCode: '', excursionName: '', startTime: '', plannedReturnTime: '',
  meetingPoint: '', minimumParticipants: '', maximumCapacity: '', price: '', currencyCode: '',
}
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export const displayTime = (value: string) => new Date(value).toLocaleString('vi-VN')

// ShoreExcursionResponse, from the live OpenAPI and activity DTO (2026-10-18).
// An envelope or malformed row is an error, never a fabricated empty result.
export function normalizeExcursion(value: unknown): ShoreExcursion {
  const invalid = () => new Error('Dữ liệu chuyến tham quan không đúng định dạng.')
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  const row = value as Record<string, unknown>
  function text(key: string): string {
    if (typeof row[key] !== 'string') throw invalid()
    return row[key]
  }
  function optionalText(key: string): string | null { return row[key] == null ? null : text(key) }
  function id(key: string) { const result = text(key); if (!isUuid(result)) throw invalid(); return result }
  function date(key: string) {
    const result = text(key)
    if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(result) || !Number.isFinite(Date.parse(result))) throw invalid()
    return result
  }
  function number(key: string, minimum: number, integer = true): number {
    const result = row[key]
    if (typeof result !== 'number' || !Number.isFinite(result) || result < minimum || (integer && !Number.isSafeInteger(result))) throw invalid()
    return result
  }
  const status = excursionStatuses.find((item) => item === row.status)
  if (!status) throw invalid()
  return {
    shoreExcursionId: id('shoreExcursionId'), cruiseStopId: id('cruiseStopId'), supplierId: id('supplierId'), supplierName: text('supplierName'),
    excursionCode: optionalText('excursionCode'), excursionName: text('excursionName'), startTime: date('startTime'), plannedReturnTime: date('plannedReturnTime'), meetingPoint: text('meetingPoint'),
    minimumParticipants: row.minimumParticipants == null ? null : number('minimumParticipants', 1), maximumCapacity: number('maximumCapacity', 1),
    registeredParticipants: number('registeredParticipants', 0), availableCapacity: number('availableCapacity', 0),
    price: row.price == null ? null : number('price', 0, false), currencyCode: optionalText('currencyCode'), status,
    cancellationReason: optionalText('cancellationReason'), createdAt: date('createdAt'), updatedAt: date('updatedAt'),
  }
}
export function normalizeExcursions(value: unknown): ShoreExcursion[] {
  if (!Array.isArray(value)) throw new Error('Danh sách chuyến tham quan không đúng định dạng.')
  return value.map(normalizeExcursion)
}
export function toLocalTime(value: string): string {
  const date = new Date(value)
  const pad = (n: number, length = 2) => String(n).padStart(length, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}
export function excursionToForm(value: ShoreExcursion): ExcursionFormValues {
  return {
    cruiseStopId: value.cruiseStopId, supplierId: value.supplierId, excursionCode: value.excursionCode ?? '', excursionName: value.excursionName,
    startTime: toLocalTime(value.startTime), plannedReturnTime: toLocalTime(value.plannedReturnTime), meetingPoint: value.meetingPoint,
    minimumParticipants: value.minimumParticipants?.toString() ?? '', maximumCapacity: String(value.maximumCapacity),
    price: value.price?.toString() ?? '', currencyCode: value.currencyCode ?? '',
  }
}
export function validateExcursionForm(values: ExcursionFormValues): Partial<Record<keyof ExcursionFormValues, string>> {
  const errors: Partial<Record<keyof ExcursionFormValues, string>> = {}
  for (const key of ['cruiseStopId', 'supplierId'] as const) if (!isUuid(values[key].trim())) errors[key] = 'Nhập ID UUID hợp lệ.'
  for (const key of ['excursionName', 'meetingPoint'] as const) if (!values[key].trim() || values[key].trim().length > 250) errors[key] = 'Nhập nội dung từ 1 đến 250 ký tự.'
  if (values.excursionCode.trim().length > 50) errors.excursionCode = 'Tối đa 50 ký tự.'
  for (const key of ['startTime', 'plannedReturnTime'] as const) if (!values[key] || !Number.isFinite(Date.parse(values[key]))) errors[key] = 'Nhập thời gian hợp lệ.'
  for (const key of ['maximumCapacity', 'minimumParticipants'] as const) {
    if (key === 'minimumParticipants' && !values[key].trim()) continue
    if (!/^\d+$/.test(values[key]) || Number(values[key]) < 1 || Number(values[key]) > 2147483647) errors[key] = 'Nhập số nguyên từ 1 đến 2147483647.'
  }
  if (values.price.trim() && !/^\d{1,15}(?:\.\d{1,4})?$/.test(values.price.trim())) errors.price = 'Giá không âm, tối đa 15 chữ số nguyên và 4 chữ số thập phân.'
  if (values.currencyCode.trim() && !/^[A-Z]{3}$/.test(values.currencyCode.trim())) errors.currencyCode = 'Nhập 3 chữ cái viết hoa.'
  return errors
}
export function formToExcursionRequest(values: ExcursionFormValues): ExcursionRequest {
  if (Object.keys(validateExcursionForm(values)).length) throw new Error('Vui lòng kiểm tra các trường chưa hợp lệ.')
  return {
    cruiseStopId: values.cruiseStopId.trim(), supplierId: values.supplierId.trim(), excursionName: values.excursionName.trim(),
    excursionCode: values.excursionCode.trim() || undefined, meetingPoint: values.meetingPoint.trim(),
    startTime: new Date(values.startTime).toISOString(), plannedReturnTime: new Date(values.plannedReturnTime).toISOString(),
    maximumCapacity: Number(values.maximumCapacity), minimumParticipants: values.minimumParticipants.trim() ? Number(values.minimumParticipants) : undefined,
    price: values.price.trim() ? Number(values.price) : undefined, currencyCode: values.currencyCode.trim() || undefined,
  }
}
export type LifecycleAction = 'confirm' | 'close' | 'start' | 'complete' | 'cancel'
export const canEditExcursion = (status: ExcursionStatus) => ['PLANNED', 'OPEN', 'FULL', 'CLOSED'].includes(status)
export const canDeleteExcursion = (status: ExcursionStatus) => status === 'PLANNED'
export const actionLabels: Record<LifecycleAction, string> = { confirm: 'Mở đăng ký', close: 'Đóng đăng ký', start: 'Bắt đầu', complete: 'Hoàn thành', cancel: 'Hủy chuyến tham quan' }
// Source-state gates only. The backend checks timing, supplier, registrations and schedule.
// ShoreExcursionService.confirm/close/start/complete/cancel (2026-10-18).
export function lifecycleActions(status: ExcursionStatus): LifecycleAction[] {
  switch (status) {
    case 'PLANNED': return ['confirm', 'cancel']
    case 'OPEN': case 'FULL': return ['close', 'start', 'cancel']
    case 'CLOSED': return ['cancel']
    case 'IN_PROGRESS': return ['complete', 'cancel']
    default: return []
  }
}
