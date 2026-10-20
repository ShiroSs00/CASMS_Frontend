import { ApiError, apiRequestRaw } from '@/shared/api'
import { isUuid, type TourGroup } from '../model/tour-group'
import { assertMoveTarget, canAssignPassenger, normalizeAvailableCapacity, normalizeEligibility, normalizePassenger, normalizePassengers, passengerActions, rawPassengerRecord, type AssignmentStatus, type GroupPassenger, type PassengerAction } from '../model/group-passenger'
import { tourGroupApi } from './tour-group-api'

const base = '/tour-group-passengers'
function uuid(value: string) { if (!isUuid(value)) throw new ApiError('ID UUID không hợp lệ.', 0); return value }
const path = (id: string) => `${base}/${encodeURIComponent(uuid(id))}`
function decode<T>(normalize: (value: unknown) => T) {
  return (value: unknown, status: number): T => {
    try { return normalize(value) } catch (error) { throw new ApiError(error instanceof Error ? error.message : 'Dữ liệu phân công không hợp lệ.', status) }
  }
}
function assignmentResponse(expected: Partial<Pick<GroupPassenger, 'tourGroupPassengerId' | 'tourGroupId' | 'passengerId' | 'assignmentStatus'>>) {
  return decode((value) => {
    const row = normalizePassenger(value)
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
      if (row[key].toLowerCase() !== expected[key]?.toLowerCase()) throw new Error('Phản hồi phân công không khớp thao tác yêu cầu. Vui lòng tải lại dữ liệu để kiểm tra.')
    }
    return row
  })
}
const resultingStatus: Record<Exclude<PassengerAction, 'move'>, AssignmentStatus> = { remove: 'CANCELLED', departure: 'CHECKED_IN', return: 'COMPLETED' }
export const groupPassengerApi = {
  eligible: (groupId: string, signal?: AbortSignal): Promise<{ passengerId: string; fullName: string }[]> => apiRequestRaw(`${base}/groups/${encodeURIComponent(uuid(groupId))}/eligible-passengers`, decode(value => {
    if (!Array.isArray(value) || value.some(row => !row || typeof row.passengerId !== 'string' || !isUuid(row.passengerId) || typeof row.fullName !== 'string' || !row.fullName.trim())) throw new Error('Danh sách hành khách đủ điều kiện không đầy đủ.')
    return value.map(row => ({ passengerId: row.passengerId, fullName: row.fullName }))
  }), { signal }),
  list: (groupId: string, signal?: AbortSignal) => apiRequestRaw(base, decode((value) => {
    const rows = normalizePassengers(value)
    if (rows.some((row) => row.tourGroupId.toLowerCase() !== groupId.toLowerCase())) throw new Error('Danh sách phân công không thuộc nhóm đang xem.')
    return rows
  }), { query: { groupId: uuid(groupId) }, signal }),
  get: (id: string, signal?: AbortSignal) => apiRequestRaw(path(id), assignmentResponse({ tourGroupPassengerId: id }), { signal }),
  assign: (groupId: string, passengerId: string, signal?: AbortSignal) => apiRequestRaw(base, assignmentResponse({ tourGroupId: groupId, passengerId, assignmentStatus: 'ASSIGNED' }), { method: 'POST', body: { tourGroupId: uuid(groupId), passengerId: uuid(passengerId) }, signal }),
  move: (id: string, targetTourGroupId: string, signal?: AbortSignal) => apiRequestRaw(`${path(id)}/move`, assignmentResponse({ tourGroupId: targetTourGroupId, assignmentStatus: 'ASSIGNED' }), { method: 'PATCH', body: { targetTourGroupId: uuid(targetTourGroupId) }, signal }),
  action: (id: string, action: Exclude<PassengerAction, 'move'>, signal?: AbortSignal) => apiRequestRaw(`${path(id)}/${action}`, assignmentResponse({ tourGroupPassengerId: id, assignmentStatus: resultingStatus[action] }), { method: 'PATCH', signal }),
  capacity: (groupId: string, signal?: AbortSignal) => apiRequestRaw(`${base}/groups/${encodeURIComponent(uuid(groupId))}/available-capacity`, decode(normalizeAvailableCapacity), { signal }),
  eligibility: (passengerId: string, excursionId: string, signal?: AbortSignal) => apiRequestRaw(`${base}/eligibility`, decode(normalizeEligibility), { query: { passengerId: uuid(passengerId), excursionId: uuid(excursionId) }, signal }),
  validate: (groupId: string, passengerId: string, signal?: AbortSignal) => apiRequestRaw(`${base}/validate`, decode((value) => {
    const row = rawPassengerRecord(value)
    if (typeof row.message !== 'string' || !row.message.trim()) throw new Error('Kết quả kiểm tra phân công không hợp lệ.')
    return row.message
  }), { method: 'POST', query: { groupId: uuid(groupId), passengerId: uuid(passengerId) }, signal }),
}

export async function checkPassengerAvailability(group: TourGroup, passengerId: string, signal?: AbortSignal) {
  if (!await groupPassengerApi.eligibility(passengerId, group.shoreExcursionId, signal)) throw new ApiError('Hành khách cần có đăng ký đã xác nhận cho chuyến tham quan này.', 0)
  const capacity = await groupPassengerApi.capacity(group.tourGroupId, signal)
  if (capacity === 0) throw new ApiError('Nhóm đã hết chỗ. Vui lòng tải lại dữ liệu.', 0)
}

export async function checkPassengerAssignment(group: TourGroup, passengerId: string, signal?: AbortSignal) {
  if (!canAssignPassenger(group.status)) throw new ApiError('Nhóm phải đang lên kế hoạch hoặc đang tập trung để thêm hành khách.', 0)
  await checkPassengerAvailability(group, passengerId, signal)
  await groupPassengerApi.validate(group.tourGroupId, passengerId, signal)
}

export async function performPassengerAction(groupId: string, assignmentId: string, action: PassengerAction, targetId: string, signal?: AbortSignal) {
  const assignment = await groupPassengerApi.get(assignmentId, signal)
  const source = await tourGroupApi.get(groupId, signal)
  if (assignment.tourGroupId.toLowerCase() !== source.tourGroupId.toLowerCase()) throw new ApiError('Phân công không thuộc nhóm đang xem. Vui lòng tải lại.', 0)
  if (!passengerActions(assignment.assignmentStatus, source.status).includes(action)) throw new ApiError('Trạng thái hiện tại không cho phép thao tác này. Vui lòng tải lại.', 0)
  if (action === 'move') {
    const target = await tourGroupApi.get(uuid(targetId), signal)
    assertMoveTarget(source, target)
    await checkPassengerAssignment(target, assignment.passengerId, signal)
    return groupPassengerApi.move(assignmentId, target.tourGroupId, signal)
  }
  return groupPassengerApi.action(assignmentId, action, signal)
}
