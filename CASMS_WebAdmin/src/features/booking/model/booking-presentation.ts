import { cabinTypeLabel } from '@/shared/i18n/business-copy'
// Presentation only. Values come from the existing decoded API models.
export function bookingMoney(amount: number, currency: string) {
  const normalized = currency.trim().toUpperCase()
  const decimals = normalized === 'VND' ? 0 : 2
  const factor = 10 ** decimals
  const rounded = Math.round((amount + Number.EPSILON) * factor) / factor
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: decimals }).format(rounded)} ${currency}`
}
export function cabinTypeName(value: string) {
  return cabinTypeLabel(value)
}
