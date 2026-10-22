// Presentation only. Values come from the existing decoded API models.
export function bookingMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 20 }).format(amount)} ${currency}`
}
export function cabinTypeName(value: string) {
  return ({ INTERIOR: 'Phòng trong', OCEAN_VIEW: 'Hướng biển', BALCONY: 'Ban công', SUITE: 'Suite' } as Record<string, string>)[value] ?? value
}
