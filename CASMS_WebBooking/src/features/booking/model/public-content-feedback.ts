import { ApiError } from '@/shared/api'
import { bookingReadFailure } from './booking-feedback'

export function publicContentFailure(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Thông tin này hiện không còn trong danh mục công khai.'
    if (error.code === 'PUBLIC_ITINERARY_UNAVAILABLE') return 'Lịch trình hiện chưa sẵn sàng để hiển thị. Vui lòng quay lại sau.'
    if (error.code === 'FARE_OFFER_INELIGIBLE') return 'Gói du thuyền hiện chưa đủ điều kiện hiển thị.'
    if (error.code === 'FARE_QUOTED_PRICE_STALE') return 'Giá gói du thuyền đã thay đổi. Vui lòng tải lại thông tin giá.'
    if (error.status === 503) return 'Dịch vụ đang tạm thời gián đoạn. Vui lòng thử lại sau.'
    return bookingReadFailure(error.status)
  }
  return bookingReadFailure(0)
}

