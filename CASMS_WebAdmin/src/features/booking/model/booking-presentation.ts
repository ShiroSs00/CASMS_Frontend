import { cabinTypeLabel } from '@/shared/i18n/business-copy'
// Presentation only. Values come from the existing decoded API models.
export function bookingMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 20 }).format(amount)} ${currency}`
}
export function cabinTypeName(value: string) {
  return cabinTypeLabel(value)
}
