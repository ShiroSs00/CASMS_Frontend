export type SpendingState = 'loading' | 'offline' | 'forbidden' | 'error' | 'missing-voyage' | 'unavailable' | 'ended' | 'missing-account' | 'empty';
export const spendingCopy: Record<SpendingState, { title: string; description: string }> = {
  loading: { title: 'Đang xác minh chuyến đi', description: 'Vui lòng chờ thông tin chuyến đi được tải lại.' },
  offline: { title: 'Đang chờ kết nối', description: 'Kết nối mạng để xác minh chuyến đi. Bạn có thể liên hệ quầy dịch vụ để kiểm tra chi tiêu.' },
  forbidden: { title: 'Chưa có quyền xem thông tin', description: 'Liên hệ đội ngũ hỗ trợ để kiểm tra quyền truy cập hồ sơ của bạn.' },
  error: { title: 'Chưa xác minh được chuyến đi', description: 'Tải lại thông tin hoặc liên hệ quầy dịch vụ. Chưa có số liệu chi tiêu được xác nhận trên màn hình này.' },
  'missing-voyage': { title: 'Chưa có chuyến đi được chọn', description: 'Mở đặt chỗ để chọn chuyến và hồ sơ hành khách của bạn.' },
  unavailable: { title: 'Xem sao kê tại quầy dịch vụ', description: 'Sao kê chi tiêu trên tàu hiện chưa được hỗ trợ trong ứng dụng. Liên hệ quầy dịch vụ hành khách để kiểm tra tài khoản và chi tiêu.' },
  ended: { title: 'Kiểm tra sao kê của chuyến đã kết thúc hoặc bị hủy', description: 'Liên hệ quầy dịch vụ để kiểm tra sao kê. Trạng thái chuyến đi không xác nhận tài khoản đã được quyết toán.' },
  // Reserved for an explicit, verified future account API response; never inferred from absent data.
  'missing-account': { title: 'Chưa có tài khoản chi tiêu', description: 'Hệ thống đã xác nhận hồ sơ chưa có tài khoản chi tiêu. Liên hệ quầy dịch vụ để được hướng dẫn.' },
  empty: { title: 'Chưa có giao dịch', description: 'Hệ thống đã xác nhận chưa có giao dịch trong phạm vi lịch sử được cung cấp.' },
};
export function spendingFoundationState(input: { allowed: boolean; pending: boolean; paused: boolean; error: boolean; errorStatus?: number; cruiseStatus?: string }): SpendingState {
  if (!input.allowed || input.errorStatus === 403) return 'forbidden';
  if (input.paused) return 'offline';
  if (input.error) return 'error';
  if (input.pending) return 'loading';
  if (!input.cruiseStatus) return 'missing-voyage';
  return ['COMPLETED','CANCELLED'].includes(input.cruiseStatus) ? 'ended' : 'unavailable';
}
