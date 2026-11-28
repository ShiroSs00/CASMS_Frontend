import { ApiError } from '@/shared/api'

/** Customer copy is selected from reviewed codes; never render an arbitrary server message. */
export function bookingTransactionFailure(error:unknown) {
  if(error instanceof ApiError){
    if(error.code==='PAYMENT_SCHEDULE_UNAVAILABLE')return 'Hình thức thanh toán đã chọn không phù hợp với các hạn thanh toán của chuyến. Chọn hình thức được hệ thống cho phép và yêu cầu báo giá mới; thông tin hành khách vẫn được giữ.'
    if(error.code==='BOOKING_CONTRACT_NOT_ACCEPTED')return 'Cần ghi nhận hợp đồng đã ký trước khi xác nhận đặt chỗ.'
    if(error.code==='BOOKING_DEPOSIT_NOT_PAID')return 'Khoản thu đã được đối soát chưa đủ mức cọc yêu cầu. Kiểm tra thanh toán trước khi xác nhận đặt chỗ.'
    if(error.code==='CANCELLATION_CASE_REQUIRED')return 'Đặt chỗ này cần gửi yêu cầu hủy để bộ phận tài chính xem xét. Không hủy trực tiếp.'
    if(error.code==='FARE_CABIN_CHANGE_NOT_SUPPORTED')return 'Chưa hỗ trợ đổi cabin của gói du thuyền trong luồng này. Giữ nguyên nhóm và cabin đã phân.'
    if(error.code==='RECOVERY_IN_PROGRESS')return 'Yêu cầu đặt chỗ vẫn đang xử lý. Kiểm tra kết quả sau; không tạo lại đặt chỗ.'
    if(error.code==='BUSINESS_POLICY_REQUIRED')return 'Hiện chưa thể phát hành báo giá hoặc nhận đặt chỗ cho lựa chọn này. Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ.'
    if(['SALE_SUSPENDED','CRUISE_SALE_STOPPED'].includes(error.code??''))return 'Chuyến khởi hành đang tạm dừng nhận đặt chỗ mới. Thông tin bạn đã nhập vẫn được giữ.'
    if(['FARE_QUOTED_PRICE_STALE','QUOTE_INVALIDATED','QUOTE_POLICY_MISMATCH','QUOTE_SELECTION_MISMATCH','FARE_OFFER_INELIGIBLE','FARE_OFFER_NOT_AVAILABLE','PACKAGE_NOT_AVAILABLE_FOR_CRUISE','PACKAGE_NOT_ACTIVE'].includes(error.code??''))return 'Giá hoặc điều kiện của lựa chọn đã thay đổi. Kiểm tra lại hành trình và gói trước khi yêu cầu báo giá mới.'
    if(error.code==='PASSENGER_IDENTITY_MISMATCH')return 'Thông tin định danh (họ tên, ngày sinh hoặc số giấy tờ) không khớp với hồ sơ hành khách đã lưu. Để trống ngày sinh/giấy tờ nếu dùng lại hồ sơ cũ, hoặc xác minh cập nhật hồ sơ trước khi tạo đặt chỗ.'
    if(error.code==='BOOKING_HOLD_EXPIRED')return 'Giữ chỗ không còn hiệu lực. Kiểm tra lại tình trạng đặt chỗ trước khi tiếp tục.'
    if(error.status===0||error.status>=500)return 'Chưa xác định được kết quả do kết nối hoặc dịch vụ kiểm tra bị gián đoạn. Kiểm tra kết quả trước khi gửi lại; thông tin đã nhập vẫn được giữ.'
    if(error.status===401||error.status===403)return 'Tài khoản hiện chưa được phép thực hiện thao tác này. Kiểm tra đăng nhập hoặc liên hệ bộ phận hỗ trợ.'
  }
  return 'Chưa thể hoàn tất yêu cầu. Kiểm tra lại thông tin và kết quả thao tác trước khi gửi tiếp.'
}

export function bookingMutationFailure(error: unknown) {
  // Only explicit rejections establish that a write was not accepted. A timeout,
  // server failure or unreadable success response can follow a committed write.
  const rejected = error instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(error.status)
  return {
    uncertain: !rejected,
    conflict: rejected && error.status === 409,
    message: bookingTransactionFailure(error),
  }
}
