import { ApiError } from '../../lib/api/api-client';
const messages: Record<string, string> = {
  ONBOARD_BOOKING_CLOSED: 'Tạm ngừng nhận đăng ký trong giai đoạn hiện tại của hành trình. Kiểm tra lịch hoặc liên hệ quầy dịch vụ.',
  SERVICE_NOT_PRE_CRUISE: 'Dịch vụ này không nhận yêu cầu trước chuyến. Liên hệ quầy để kiểm tra thời điểm sử dụng.',
  SERVICE_SCHEDULE_CRUISE_MISMATCH: 'Lịch phục vụ không thuộc chuyến đang chọn. Vui lòng tải lại và chọn đúng lịch.',
  SERVICE_BOOKING_REQUIRED: 'Cần hồ sơ hành khách trong đặt chỗ đã xác nhận để gửi yêu cầu.',
  SERVICE_USAGE_TIME_REQUIRED: 'Chọn lịch phục vụ để hệ thống kiểm tra giờ hoạt động của dịch vụ.',
  SERVICE_USAGE_LIMIT_EXCEEDED: 'Số lượng yêu cầu vượt định mức đang còn khả dụng. Kiểm tra quyền lợi và các yêu cầu đang xử lý.',
  PREPAID_ENTITLEMENT_REQUIRED: 'Dịch vụ có phí cần quyền lợi đã mua phù hợp. Liên hệ quầy để được kiểm tra.',
  ENTITLEMENT_EXHAUSTED: 'Quyền lợi đã hết định mức khả dụng. Kiểm tra quyền lợi và các đăng ký đang xử lý.',
  ENTITLEMENT_NOT_FOUND: 'Chưa tìm thấy quyền lợi đã được cấp cho hồ sơ này. Liên hệ quầy để kiểm tra.',
  ENTITLEMENT_NOT_ACTIVE: 'Quyền lợi hiện chưa có hiệu lực. Kiểm tra lại thời hạn và hồ sơ.',
  ENTITLEMENT_AMBIGUOUS: 'Có nhiều quyền lợi chưa xác định được cách áp dụng. Liên hệ quầy để kiểm tra.',
  BENEFIT_USAGE_WINDOW_INVALID: 'Lịch hoặc thời điểm sử dụng nằm ngoài thời hạn quyền lợi đã mua.',
  BENEFIT_USAGE_UNIT_UNSUPPORTED: 'Đơn vị sử dụng chưa phù hợp với quyền lợi. Liên hệ quầy để kiểm tra.',
  ADDON_PURCHASE_REQUIRED: 'Mục này cần giao dịch mua thêm được xác nhận. Liên hệ quầy dịch vụ.',
  IDEMPOTENCY_CONFLICT: 'Mã yêu cầu trước đã gắn với nội dung khác. Đối soát yêu cầu đã lưu trước khi gửi tiếp.',
  POS_CHARGE_IMMUTABLE: 'Yêu cầu đã gắn với giao dịch tại quầy, không thể sửa số lượng tại đây. Liên hệ nhân viên để kiểm tra.',
};
export function onboardError(error: unknown) {
  return error instanceof ApiError && error.code && messages[error.code] ? new Error(messages[error.code]) : error;
}
