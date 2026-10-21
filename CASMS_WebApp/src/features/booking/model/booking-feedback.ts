// Public presentation only: never expose transport internals or distinguish
// whether a guest reference exists when the supplied contact does not match.
export function bookingLookupFailure(status?: number) {
  if (status !== undefined && [400, 403, 404, 422].includes(status)) return 'Không tìm thấy đặt chỗ khớp thông tin đã nhập. Kiểm tra lại mã và email hoặc số điện thoại đại diện.'
  if (status === 429) return 'Bạn đã tra cứu nhiều lần. Vui lòng chờ rồi thử lại; thông tin đã nhập vẫn được giữ.'
  return 'Chưa thể tra cứu lúc này. Thông tin đã nhập vẫn được giữ; vui lòng thử lại sau.'
}

export function bookingReadFailure(status?: number) {
  if (status === 403) return 'Bạn chưa được phép xem thông tin này. Có thể thử tải lại hoặc liên hệ bộ phận hỗ trợ nếu tình trạng tiếp tục.'
  if (status === 401) return 'Cần đăng nhập để xem thông tin này.'
  if (status === 0) return 'Kết nối bị gián đoạn hoặc yêu cầu quá thời gian. Thử tải lại để kiểm tra dữ liệu mới nhất.'
  if (status !== undefined && status >= 500) return 'Dịch vụ tạm thời chưa sẵn sàng. Lựa chọn của bạn được giữ nguyên; vui lòng thử tải lại sau.'
  return 'Chưa tải được thông tin. Vui lòng thử tải lại để kiểm tra dữ liệu mới nhất.'
}
