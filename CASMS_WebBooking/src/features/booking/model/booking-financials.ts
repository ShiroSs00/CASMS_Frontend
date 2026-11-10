import { bookingMoney } from './booking-presentation'

export function financialAmount(value: unknown): number | null {
  if (value == null) return null
  // At 2^39, binary64 spacing exceeds the Backend NUMERIC(19,4) unit of 0.0001.
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 2 ** 39) throw new Error('Thông tin thanh toán không hợp lệ.')
  return value
}
export function financialFlag(value: unknown): boolean | null {
  if (value == null) return null
  if (typeof value !== 'boolean') throw new Error('Trạng thái thanh toán không hợp lệ.')
  return value
}
export function financialMoney(value: number | null | undefined, currency: string) {
  return value == null ? 'Chưa cập nhật' : bookingMoney(value, currency)
}
export function paymentState(paid: boolean | null | undefined) {
  return paid === true ? 'Đã thanh toán đủ' : paid === false ? 'Chưa thanh toán đủ' : 'Chưa cập nhật'
}
