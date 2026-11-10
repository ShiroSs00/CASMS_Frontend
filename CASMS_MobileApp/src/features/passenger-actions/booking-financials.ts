export function bookingFinancialMoney(value: number | null | undefined, currency: string | null | undefined) {
  if (value == null || !Number.isFinite(value) || value < 0 || value >= 2 ** 39 || !currency || !/^[A-Z]{3}$/.test(currency)) return 'Chưa cập nhật';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 20 }).format(value)} ${currency}`;
}
export function bookingPaymentState(paid: boolean | null | undefined) {
  return paid === true ? 'Đã thanh toán đủ' : paid === false ? 'Chưa thanh toán đủ' : 'Chưa cập nhật';
}
