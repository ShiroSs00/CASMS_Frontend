import { ApiError, apiRequest } from '@/shared/api'

export type CheckinRecord = {
  bookingPassengerId: string
  checkinStatus: 'NotStarted' | 'InProgress' | 'NeedsReview' | 'Completed' | 'BoardingReady'
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  startedAt: string | null
  completedAt: string | null
  boardingReadyAt: string | null
  boardingBlockReason: string | null
}

export function decodeCheckin(value: unknown, passengerId: string): CheckinRecord {
  const row = value as Record<string, unknown> | null
  if (!row || typeof row !== 'object' || row.bookingPassengerId !== passengerId
    || !['NotStarted', 'InProgress', 'NeedsReview', 'Completed', 'BoardingReady'].includes(String(row.checkinStatus))
    || ['emergencyContactName', 'emergencyContactPhone', 'boardingBlockReason'].some(key => row[key] != null && typeof row[key] !== 'string')
    || ['startedAt', 'completedAt', 'boardingReadyAt'].some(key => row[key] != null && (typeof row[key] !== 'string' || !Number.isFinite(Date.parse(row[key] as string))))) {
    throw new ApiError('Hồ sơ thủ tục không khớp hành khách hoặc chưa đầy đủ. Tải lại để đối chiếu trước khi tiếp tục.', 502)
  }
  return {
    bookingPassengerId: passengerId,
    checkinStatus: row.checkinStatus as CheckinRecord['checkinStatus'],
    emergencyContactName: row.emergencyContactName as string | null ?? null,
    emergencyContactPhone: row.emergencyContactPhone as string | null ?? null,
    startedAt: row.startedAt as string | null ?? null,
    completedAt: row.completedAt as string | null ?? null,
    boardingReadyAt: row.boardingReadyAt as string | null ?? null,
    boardingBlockReason: row.boardingBlockReason as string | null ?? null,
  }
}

const path = (passengerId: string) => `/checkin/passenger/${encodeURIComponent(passengerId)}`
export function checkinFailureMessage(reason: unknown): string {
  if (reason instanceof ApiError) {
    const messages: Record<string, string> = {
      CHECKIN_CONTRACT_REQUIRED: 'Hợp đồng chưa được ghi nhận chấp nhận. Đối chiếu hợp đồng trước khi kiểm tra lại điều kiện lên tàu.',
      CHECKIN_EMERGENCY_CONTACT_REQUIRED: 'Hồ sơ chưa có đủ tên và số điện thoại người liên hệ khẩn cấp. Cần bổ sung liên hệ trước khi hoàn tất thủ tục.',
      PRE_DEPARTURE_PAYMENT_INCOMPLETE: 'Khoản phải thu trước khởi hành chưa được thanh toán đủ. Liên hệ bộ phận tài chính đối soát khoản thu rồi kiểm tra lại.',
      CHECKIN_PASSENGER_INELIGIBLE: 'Hành khách không còn tham gia hoặc đặt chỗ chưa được xác nhận. Tải lại đặt chỗ để kiểm tra trước khi làm thủ tục.',
      INVALID_PHONE_NUMBER: 'Số điện thoại liên hệ khẩn cấp chưa hợp lệ. Kiểm tra mã quốc gia và số điện thoại đã nhập.',
      CHECKIN_WINDOW_CLOSED: 'Hiện ngoài thời gian làm thủ tục trực tuyến của chuyến.',
      CHECKIN_SCHEDULE_UNAVAILABLE: 'Chưa có lịch khởi hành hợp lệ để kiểm tra thời gian làm thủ tục.',
    }
    if (reason.code && messages[reason.code]) return messages[reason.code]
    if (reason.status === 403) return 'Tài khoản chưa được phép làm thủ tục cho hành khách hoặc chuyến này. Kiểm tra lại phân công của bạn.'
  }
  return reason instanceof Error ? reason.message : 'Chưa cập nhật được hồ sơ thủ tục. Kiểm tra trạng thái trước khi gửi lại.'
}
export const checkinApi = {
  async status(passengerId: string, signal?: AbortSignal): Promise<CheckinRecord | null> {
    try { return decodeCheckin(await apiRequest(path(passengerId) + '/status', { signal }), passengerId) }
    catch (reason) { if (reason instanceof ApiError && reason.status === 404) return null; throw reason }
  },
  async start(passengerId: string, name: string, phone: string) {
    return decodeCheckin(await apiRequest(path(passengerId) + '/start', { method: 'POST', query: { emergencyContactName: name.trim(), emergencyContactPhone: phone } }), passengerId)
  },
  async complete(passengerId: string) {
    return decodeCheckin(await apiRequest(path(passengerId) + '/complete', { method: 'POST' }), passengerId)
  },
}
