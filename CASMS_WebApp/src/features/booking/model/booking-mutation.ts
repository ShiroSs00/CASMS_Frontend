import { ApiError } from '@/shared/api'

/** Customer copy is selected from reviewed codes; never render an arbitrary server message. */
export function bookingTransactionFailure(error:unknown) {
  if(error instanceof ApiError){
    if(error.code==='BUSINESS_POLICY_REQUIRED')return 'Hiện chưa thể phát hành báo giá hoặc nhận đặt chỗ cho lựa chọn này. Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ.'
    if(['SALE_SUSPENDED','CRUISE_SALE_STOPPED'].includes(error.code??''))return 'Chuyến khởi hành đang tạm dừng nhận đặt chỗ mới. Thông tin bạn đã nhập vẫn được giữ.'
    if(['FARE_QUOTED_PRICE_STALE','QUOTE_INVALIDATED','QUOTE_POLICY_MISMATCH','QUOTE_SELECTION_MISMATCH','FARE_OFFER_INELIGIBLE','FARE_OFFER_NOT_AVAILABLE','PACKAGE_NOT_AVAILABLE_FOR_CRUISE','PACKAGE_NOT_ACTIVE'].includes(error.code??''))return 'Giá hoặc điều kiện của lựa chọn đã thay đổi. Kiểm tra lại hành trình và gói trước khi yêu cầu báo giá mới.'
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
