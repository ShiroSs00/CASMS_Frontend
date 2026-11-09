import { ApiError } from '../../lib/api/api-client';

// Only explicit business rejections allow abandoning an intent. A timeout,
// auth failure, conflict or malformed response is never proof of rollback.
export function bookingWasRejected(error: unknown) {
  return error instanceof ApiError && (
    (error.status === 400 && ['VALIDATION_FAILED', 'QUOTE_REQUIRED', 'QUOTE_SELECTION_MISMATCH'].includes(error.code ?? ''))
    || (error.status === 422 && ['CABIN_NOT_AVAILABLE', 'CABIN_OVERCAPACITY', 'CABIN_TYPE_EXHAUSTED',
      'CRUISE_NOT_OPEN_FOR_SALE', 'CRUISE_ALREADY_DEPARTED', 'SALE_SUSPENDED',
      'QUOTE_CRUISE_MISMATCH', 'QUOTE_PAYLOAD_MISSING', 'PRICING_POLICY_MISSING'].includes(error.code ?? ''))
    || (error.status === 409 && ['QUOTE_EXPIRED', 'QUOTE_INVALIDATED', 'QUOTE_POLICY_MISMATCH'].includes(error.code ?? ''))
  );
}

export function bookingErrorMessage(error: ApiError) {
  if (error.status === 0 || error.status === 408 || error.status >= 500) return 'Chưa xác định được kết quả đặt chỗ. Hãy kiểm tra kết quả trước khi tiếp tục.';
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại cùng tài khoản để khôi phục đặt chỗ.';
  if (error.status === 403) return 'Tài khoản không có quyền thực hiện giao dịch hoặc sử dụng báo giá này.';
  if (bookingWasRejected(error)) return 'Hệ thống đã từ chối yêu cầu. Kiểm tra kết quả rồi quay lại chọn phòng và lấy báo giá mới.';
  if (error.status === 409) return 'Giao dịch đang xử lý hoặc bị xung đột. Giữ nguyên yêu cầu và kiểm tra kết quả.';
  if (error.status === 400) return 'Dữ liệu đặt chỗ không hợp lệ. Kiểm tra kết quả và liên hệ hỗ trợ nếu cần.';
  if (error.status === 422) return 'Lựa chọn hiện chưa đủ điều kiện đặt chỗ. Kiểm tra kết quả trước khi tiếp tục.';
  return 'Hệ thống chưa xác nhận tạo đặt chỗ. Hãy kiểm tra kết quả.';
}
