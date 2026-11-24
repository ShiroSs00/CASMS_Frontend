import { cabinTypeLabel } from '@/shared/i18n/business-copy'
// Presentation only. Values come from the existing decoded API models.
export function bookingMoney(amount: number, currency: string) {
  const maxFrac = currency === 'VND' ? 0 : 2
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: maxFrac }).format(amount)} ${currency}`
}
export function cabinTypeName(value: string) {
  return cabinTypeLabel(value)
}
