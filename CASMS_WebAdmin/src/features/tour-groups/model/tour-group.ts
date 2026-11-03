export const groupStatuses = ['PLANNED', 'ASSEMBLING', 'DEPARTED', 'RETURNED', 'CANCELLED'] as const
export type GroupStatus = typeof groupStatuses[number]
export const groupStatusLabels: Record<GroupStatus, string> = {
  PLANNED: 'Đã lên kế hoạch', ASSEMBLING: 'Đang tập trung', DEPARTED: 'Đã khởi hành', RETURNED: 'Đã trở về', CANCELLED: 'Đã hủy',
}
export type TourGroup = {
  tourGroupId: string; shoreExcursionId: string; excursionName: string; groupCode: string
  maximumCapacity: number; assignedPassengers: number; availableCapacity: number
  guideId: string | null; vehicleId: string | null; meetingPoint: string | null
  assemblyTime: string | null; plannedDepartureTime: string | null; plannedReturnTime: string | null
  actualDepartureTime: string | null; actualReturnTime: string | null; status: GroupStatus; notes: string | null
}
export type GroupCapacity = { maximumCapacity: number; availableCapacity: number }
export type GroupExcursion = {
  shoreExcursionId: string; excursionName: string; excursionCode: string | null; status: string
  maximumCapacity: number | null; meetingPoint: string | null; startTime: string | null; plannedReturnTime: string | null
}
export const inheritedGroupFields = ['maximumCapacity', 'meetingPoint', 'assemblyTime', 'plannedDepartureTime', 'plannedReturnTime'] as const
export const canUseGroupExcursion = (excursion: GroupExcursion) => !['CLOSED', 'COMPLETED', 'CANCELLED'].includes(excursion.status)
export type GroupRequest = {
  shoreExcursionId: string; groupCode: string; maximumCapacity: number
  guideId?: string; vehicleId?: string; meetingPoint?: string
  assemblyTime?: string; plannedDepartureTime?: string; plannedReturnTime?: string; notes?: string
}
export type GroupFormValues = Record<keyof GroupRequest, string>
export const emptyGroupForm: GroupFormValues = {
  shoreExcursionId: '', groupCode: '', maximumCapacity: '', guideId: '', vehicleId: '', meetingPoint: '',
  assemblyTime: '', plannedDepartureTime: '', plannedReturnTime: '', notes: '',
}
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export const displayTime = (value: string | null) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa đặt'

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dữ liệu nhóm tour không đúng định dạng.')
  return value as Record<string, unknown>
}
function text(row: Record<string, unknown>, key: string): string {
  if (typeof row[key] !== 'string') throw new Error(`Trường ${key} của nhóm tour không hợp lệ.`)
  return row[key]
}
function id(row: Record<string, unknown>, key: string): string {
  const value = text(row, key)
  if (!isUuid(value)) throw new Error(`Trường ${key} phải là ID UUID hợp lệ.`)
  return value
}
function integer(row: Record<string, unknown>, key: string, min: number): number {
  const value = row[key]
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) throw new Error(`Trường ${key} không hợp lệ.`)
  return value
}
function optionalDate(row: Record<string, unknown>, key: string): string | null {
  if (row[key] == null) return null
  const value = text(row, key)
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`Thời gian ${key} không hợp lệ.`)
  return value
}
// TourGroupResponse: raw DTO from TourGroupController, not an ApiResponse envelope.
export function normalizeGroup(value: unknown): TourGroup {
  const row = record(value), status = groupStatuses.find((item) => item === row.status)
  if (!status) throw new Error('Trạng thái nhóm tour không đúng định dạng.')
  return {
    tourGroupId: id(row, 'tourGroupId'), shoreExcursionId: id(row, 'shoreExcursionId'), excursionName: text(row, 'excursionName'), groupCode: text(row, 'groupCode'),
    maximumCapacity: integer(row, 'maximumCapacity', 1), assignedPassengers: integer(row, 'assignedPassengers', 0), availableCapacity: integer(row, 'availableCapacity', 0),
    guideId: row.guideId == null ? null : id(row, 'guideId'), vehicleId: row.vehicleId == null ? null : id(row, 'vehicleId'),
    meetingPoint: row.meetingPoint == null ? null : text(row, 'meetingPoint'), notes: row.notes == null ? null : text(row, 'notes'),
    assemblyTime: optionalDate(row, 'assemblyTime'), plannedDepartureTime: optionalDate(row, 'plannedDepartureTime'), plannedReturnTime: optionalDate(row, 'plannedReturnTime'),
    actualDepartureTime: optionalDate(row, 'actualDepartureTime'), actualReturnTime: optionalDate(row, 'actualReturnTime'), status,
  }
}
export function normalizeGroups(value: unknown): TourGroup[] {
  if (!Array.isArray(value)) throw new Error('Danh sách nhóm tour không đúng định dạng.')
  return value.map(normalizeGroup)
}
export function normalizeCapacity(value: unknown): GroupCapacity {
  const row = record(value)
  return { maximumCapacity: integer(row, 'maximumCapacity', 1), availableCapacity: integer(row, 'availableCapacity', 0) }
}
function localTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value), pad = (n: number, width = 2) => String(n).padStart(width, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}
export function groupToForm(group: TourGroup): GroupFormValues {
  return {
    shoreExcursionId: group.shoreExcursionId, groupCode: group.groupCode, maximumCapacity: String(group.maximumCapacity),
    guideId: group.guideId ?? '', vehicleId: group.vehicleId ?? '', meetingPoint: group.meetingPoint ?? '', notes: group.notes ?? '',
    assemblyTime: localTime(group.assemblyTime), plannedDepartureTime: localTime(group.plannedDepartureTime), plannedReturnTime: localTime(group.plannedReturnTime),
  }
}
export function excursionGroupDefaults(excursion: GroupExcursion | undefined): Pick<GroupFormValues, typeof inheritedGroupFields[number]> {
  return {
    maximumCapacity: excursion?.maximumCapacity?.toString() ?? '', meetingPoint: excursion?.meetingPoint ?? '',
    assemblyTime: localTime(excursion?.startTime ?? null), plannedDepartureTime: localTime(excursion?.startTime ?? null),
    plannedReturnTime: localTime(excursion?.plannedReturnTime ?? null),
  }
}
export function validateGroupForm(values: GroupFormValues, excursion?: GroupExcursion, assignedPassengers = 0): Partial<Record<keyof GroupFormValues, string>> {
  const errors: Partial<Record<keyof GroupFormValues, string>> = {}
  if (!isUuid(values.shoreExcursionId.trim())) errors.shoreExcursionId = 'Nhập ID UUID chuyến tham quan hợp lệ.'
  for (const key of ['guideId', 'vehicleId'] as const) if (values[key].trim() && !isUuid(values[key].trim())) errors[key] = 'Nhập ID UUID hợp lệ.'
  if (values.groupCode.trim().length > 50) errors.groupCode = 'Mã nhóm tối đa 50 ký tự.'
  if (!/^\d+$/.test(values.maximumCapacity) || Number(values.maximumCapacity) < 1 || Number(values.maximumCapacity) > 2147483647) errors.maximumCapacity = 'Nhập sức chứa tối đa là số nguyên từ 1 đến 2147483647.'
  // BE inherits the excursion meeting point when this field is omitted.
  if (values.meetingPoint.trim().length > 250) errors.meetingPoint = 'Điểm tập trung tối đa 250 ký tự.'
  if (values.notes.length > 500) errors.notes = 'Ghi chú tối đa 500 ký tự.'
  for (const key of ['assemblyTime', 'plannedDepartureTime', 'plannedReturnTime'] as const) if (values[key] && !Number.isFinite(Date.parse(values[key]))) errors[key] = 'Nhập thời gian hợp lệ.'
  if (excursion) {
    if (!canUseGroupExcursion(excursion)) errors.shoreExcursionId = 'Chuyến tham quan đã đóng, hoàn thành hoặc bị hủy. Chọn chuyến khác để tạo hoặc chỉnh sửa nhóm.'
    for (const key of ['meetingPoint', 'assemblyTime', 'plannedDepartureTime', 'plannedReturnTime'] as const) if (!values[key].trim()) errors[key] = 'Thông tin này chưa có trong chuyến tham quan. Vui lòng bổ sung cho nhóm.'
    if (!errors.maximumCapacity && excursion.maximumCapacity != null && Number(values.maximumCapacity) > excursion.maximumCapacity) errors.maximumCapacity = `Sức chứa nhóm không được vượt ${excursion.maximumCapacity} khách của chuyến tham quan.`
    if (!errors.maximumCapacity && Number(values.maximumCapacity) < assignedPassengers) errors.maximumCapacity = `Nhóm đã có ${assignedPassengers} khách được phân công; không thể giảm sức chứa thấp hơn số này.`
    if (excursion.startTime && Date.parse(values.plannedDepartureTime) < Date.parse(excursion.startTime)) errors.plannedDepartureTime = `Khởi hành từ ${displayTime(excursion.startTime)}, theo lịch chuyến tham quan.`
    if (excursion.plannedReturnTime && Date.parse(values.plannedReturnTime) > Date.parse(excursion.plannedReturnTime)) errors.plannedReturnTime = `Trở về chậm nhất ${displayTime(excursion.plannedReturnTime)}, theo lịch chuyến tham quan.`
  }
  if (Date.parse(values.assemblyTime) > Date.parse(values.plannedDepartureTime)) errors.assemblyTime = 'Giờ tập trung không được sau giờ khởi hành.'
  if (Date.parse(values.plannedReturnTime) <= Date.parse(values.plannedDepartureTime)) errors.plannedReturnTime = 'Giờ trở về phải sau giờ khởi hành.'
  return errors
}
export function formToGroupRequest(values: GroupFormValues): GroupRequest {
  if (Object.keys(validateGroupForm(values)).length) throw new Error('Vui lòng kiểm tra các trường chưa hợp lệ.')
  const instant = (value: string) => value ? new Date(value).toISOString() : undefined
  return {
    shoreExcursionId: values.shoreExcursionId.trim(), groupCode: values.groupCode.trim(), maximumCapacity: Number(values.maximumCapacity),
    guideId: values.guideId.trim() || undefined, vehicleId: values.vehicleId.trim() || undefined,
    meetingPoint: values.meetingPoint.trim(), notes: values.notes.trim() || undefined,
    assemblyTime: instant(values.assemblyTime), plannedDepartureTime: instant(values.plannedDepartureTime), plannedReturnTime: instant(values.plannedReturnTime),
  }
}
export type GroupAction = 'confirm' | 'start' | 'complete' | 'cancel'
export const actionLabels: Record<GroupAction, string> = { confirm: 'Xác nhận tập trung', start: 'Khởi hành', complete: 'Xác nhận trở về', cancel: 'Hủy nhóm tour' }
export const canPrepareGroup = (status: GroupStatus) => status === 'PLANNED'
// Source-state gates from TourGroupService (2026-10-18); remaining checks stay on BE.
export function groupActions(status: GroupStatus): GroupAction[] {
  if (status === 'PLANNED') return ['confirm', 'cancel']
  if (status === 'ASSEMBLING') return ['start', 'cancel']
  if (status === 'DEPARTED') return ['complete']
  return []
}
