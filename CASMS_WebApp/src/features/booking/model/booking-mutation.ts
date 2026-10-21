import { ApiError } from '@/shared/api'

export function bookingMutationFailure(error: unknown) {
  // Only explicit rejections establish that a write was not accepted. A timeout,
  // server failure or unreadable success response can follow a committed write.
  const rejected = error instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(error.status)
  return {
    uncertain: !rejected,
    conflict: rejected && error.status === 409,
    message: error instanceof Error ? error.message : 'Chưa xác định được kết quả. Vui lòng kiểm tra đặt chỗ trước khi gửi lại.',
  }
}
