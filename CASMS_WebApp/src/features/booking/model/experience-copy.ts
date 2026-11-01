import type { Payment } from '../api/payment-api'

// Only catalogue units actually present in the current service model/data are translated.
export function serviceQuantityLabel(unitCode: string | null): string {
  const units: Record<string, string> = { PERSON: 'Số người sử dụng', SESSION: 'Số lượt sử dụng', DEVICE: 'Số thiết bị' }
  return unitCode && units[unitCode] ? units[unitCode] : 'Số lượng'
}
export const paymentStatusLabels: Record<Payment['status'], string> = {
  Pending: 'Khoản thanh toán chờ xác nhận',
  Confirmed: 'Đã xác nhận khoản thanh toán',
  Failed: 'Thanh toán không thành công',
  Cancelled: 'Yêu cầu thanh toán đã hủy',
}
