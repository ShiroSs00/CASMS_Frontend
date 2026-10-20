export const bookingStatusName: Record<string, string> = { Draft: 'Nháp', Confirmed: 'Đã xác nhận', Cancelled: 'Đã hủy' }
export const bookingWhen = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN') : 'Chưa có thông tin'
