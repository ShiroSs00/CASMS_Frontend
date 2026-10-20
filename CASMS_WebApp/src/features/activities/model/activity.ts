export type Activity = {
  id: string; code: string; name: string; description: string | null; startTime: string; endTime: string
  location: string | null; capacity: number; price: number | null; currencyCode: string | null; status: string; cruiseId: string
}
export type ActivityDraft = { activityCode: string; activityName: string; description: string; startTime: string; endTime: string; location: string; capacity: number; price: number | null; currencyCode: string; cruiseId: string }
export type CruiseOption = { cruiseId: string; cruiseCode: string; cruiseName: string; departureDatetime: string; returnDatetime: string }
export type Availability = { activityId: string; capacity: number; availableSeats: number; status: string }
export type ScheduleCheck = { activityId: string; conflictFree: boolean; conflicts: number }
export type Registration = { id: string; bookingPassengerId: string; activityId: string | null; excursionId: string | null; quantity: number; status: string; registeredAt: string }
export type Participation = { id: string; registrationId: string; status: string; checkInTime: string | null; checkOutTime: string | null }
export const activityStatusLabels: Record<string, string> = { PLANNED: 'Đã lên kế hoạch', OPEN: 'Mở đăng ký', FULL: 'Đủ chỗ', IN_PROGRESS: 'Đang diễn ra', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' }
export const attendanceLabels: Record<string, string> = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', CANCELLED: 'Đã hủy', COMPLETED: 'Hoàn thành', REGISTERED: 'Đã đăng ký', CHECKED_IN: 'Đã điểm danh', IN_PROGRESS: 'Đang tham gia', NO_SHOW: 'Vắng mặt' }
export function activityTime(value: string | null) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN') : 'Chưa có thông tin' }
export function validateActivity(draft: ActivityDraft, cruises: CruiseOption[] | null): Record<string, string> {
  const errors: Record<string, string> = {}, cruise = cruises?.find(item => item.cruiseId === draft.cruiseId)
  if (!cruise) errors.cruiseId = 'Vui lòng chọn chuyến từ danh sách đã tải.'
  if (!draft.activityCode.trim() || draft.activityCode.trim().length > 50) errors.activityCode = 'Mã hoạt động bắt buộc, tối đa 50 ký tự.'
  if (!draft.activityName.trim() || draft.activityName.trim().length > 200) errors.activityName = 'Tên hoạt động bắt buộc, tối đa 200 ký tự.'
  if (draft.description.length > 1000) errors.description = 'Mô tả tối đa 1000 ký tự.'
  if (draft.location.length > 250) errors.location = 'Địa điểm tối đa 250 ký tự.'
  const start = Date.parse(draft.startTime), end = Date.parse(draft.endTime)
  if (!Number.isFinite(start)) errors.startTime = 'Vui lòng chọn giờ bắt đầu.'
  if (!Number.isFinite(end) || end <= start) errors.endTime = 'Giờ kết thúc phải sau giờ bắt đầu.'
  if (cruise && (start < Date.parse(cruise.departureDatetime) || end > Date.parse(cruise.returnDatetime))) errors.endTime = 'Thời gian hoạt động phải nằm trong khoảng thời gian chuyến.'
  if (!Number.isSafeInteger(draft.capacity) || draft.capacity < 1) errors.capacity = 'Sức chứa phải là số nguyên dương.'
  if (draft.price !== null && (!Number.isFinite(draft.price) || draft.price < 0)) errors.price = 'Giá phải là số không âm.'
  if (draft.currencyCode && !/^[A-Z]{3}$/.test(draft.currencyCode)) errors.currencyCode = 'Mã tiền tệ gồm 3 chữ cái viết hoa.'
  return errors
}
