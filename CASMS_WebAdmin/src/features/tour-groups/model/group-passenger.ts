import { isUuid, type GroupStatus, type TourGroup } from './tour-group.ts'

export const assignmentStatuses = ['ASSIGNED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED'] as const
export type AssignmentStatus = typeof assignmentStatuses[number]
export type GroupPassenger = {
  tourGroupPassengerId: string; tourGroupId: string; groupCode: string; shoreExcursionId: string; passengerId: string
  assignmentStatus: AssignmentStatus; assignedAt: string | null; checkedInAt: string | null; returnedAt: string | null; createdAt: string | null
}
export type PassengerAction = 'move' | 'remove' | 'departure' | 'return'
export const assignmentLabels: Record<AssignmentStatus, string> = {
  ASSIGNED: 'Đã phân công', CHECKED_IN: 'Đã điểm danh khởi hành', COMPLETED: 'Đã trở về', CANCELLED: 'Đã hủy phân công',
}
export const passengerActionLabels: Record<PassengerAction, string> = {
  move: 'Chuyển nhóm', remove: 'Gỡ phân công', departure: 'Điểm danh khởi hành', return: 'Điểm danh trở về',
}
export function rawPassengerRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dữ liệu phân công hành khách không đúng định dạng.')
  return value as Record<string, unknown>
}
function uuid(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value !== 'string' || !isUuid(value)) throw new Error(`Trường ${key} phải là ID UUID hợp lệ.`)
  return value
}
function instant(row: Record<string, unknown>, key: string): string | null {
  const value = row[key]
  if (value == null) return null
  if (typeof value !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`Thời gian ${key} không hợp lệ.`)
  return value
}
export function normalizePassenger(value: unknown): GroupPassenger {
  const row = rawPassengerRecord(value), assignmentStatus = assignmentStatuses.find((status) => status === row.assignmentStatus)
  if (!assignmentStatus || typeof row.groupCode !== 'string') throw new Error('Trạng thái hoặc mã nhóm của phân công không hợp lệ.')
  return {
    tourGroupPassengerId: uuid(row, 'tourGroupPassengerId'), tourGroupId: uuid(row, 'tourGroupId'), groupCode: row.groupCode,
    shoreExcursionId: uuid(row, 'shoreExcursionId'), passengerId: uuid(row, 'passengerId'), assignmentStatus,
    assignedAt: instant(row, 'assignedAt'), checkedInAt: instant(row, 'checkedInAt'), returnedAt: instant(row, 'returnedAt'), createdAt: instant(row, 'createdAt'),
  }
}
export function normalizePassengers(value: unknown): GroupPassenger[] {
  if (!Array.isArray(value)) throw new Error('Danh sách phân công hành khách không đúng định dạng.')
  return value.map(normalizePassenger)
}
export function normalizeAvailableCapacity(value: unknown): number {
  const { availableCapacity } = rawPassengerRecord(value)
  if (typeof availableCapacity !== 'number' || !Number.isSafeInteger(availableCapacity) || availableCapacity < 0) throw new Error('Số chỗ trống không hợp lệ.')
  return availableCapacity
}
export function normalizeEligibility(value: unknown): boolean {
  const { eligible } = rawPassengerRecord(value)
  if (typeof eligible !== 'boolean') throw new Error('Kết quả kiểm tra điều kiện hành khách không hợp lệ.')
  return eligible
}
export const canAssignPassenger = (status: GroupStatus) => status === 'PLANNED' || status === 'ASSEMBLING'
// TourGroupPassengerService gates; registration, excursion state and capacity remain authoritative on BE.
export function passengerActions(status: AssignmentStatus, groupStatus: GroupStatus): PassengerAction[] {
  if (status === 'ASSIGNED') return groupStatus === 'ASSEMBLING' ? ['move', 'remove', 'departure'] : ['move', 'remove']
  if (status === 'CHECKED_IN' && (groupStatus === 'DEPARTED' || groupStatus === 'RETURNED')) return ['return']
  return []
}
export function assertMoveTarget(source: TourGroup, target: TourGroup) {
  if (source.tourGroupId.toLowerCase() === target.tourGroupId.toLowerCase()) throw new Error('Chọn nhóm đích khác nhóm hiện tại.')
  if (source.shoreExcursionId.toLowerCase() !== target.shoreExcursionId.toLowerCase()) throw new Error('Chỉ có thể chuyển giữa các nhóm của cùng chuyến tham quan.')
  if (!canAssignPassenger(target.status)) throw new Error('Nhóm đích phải đang lên kế hoạch hoặc đang tập trung.')
  if (target.availableCapacity === 0) throw new Error('Nhóm đích đã hết chỗ. Vui lòng chọn nhóm khác hoặc tải lại.')
}
