export const bookingStatusName: Record<string, string> = { Draft: 'Chờ xác nhận', Confirmed: 'Đã xác nhận', Cancelled: 'Đã hủy' }
export const bookingWhen = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có thông tin'
export const bookingPlanName = (value: string | null) => value ? ({ FULL: 'Thanh toán toàn bộ', DEPOSIT: 'Đặt cọc', STAGES: 'Thanh toán theo đợt' } as Record<string, string>)[value] ?? value : 'Chưa có kế hoạch thanh toán'
