// Shared number presentation only; never calculates balances or converts currencies.
export function financialMoney(value: number | null | undefined, currency: string | null | undefined,
  { signed = false }: { signed?: boolean } = {}) {
  if (value == null || !Number.isFinite(value) || (!signed && value < 0) || Math.abs(value) >= 2 ** 39
    || !currency || !/^[A-Z]{3}$/.test(currency)) return 'Chưa cập nhật';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 20 }).format(value)} ${currency}`;
}
export function bookingFinancialMoney(value: number | null | undefined, currency: string | null | undefined) {
  return financialMoney(value, currency);
}
export function financialTransactionStatus(status: string | null | undefined) {
  const labels: Record<string, string> = { PENDING: 'Đang chờ ghi nhận', POSTED: 'Đã ghi sổ', FAILED: 'Không thành công', VOIDED: 'Đã hủy ghi nhận' };
  return status ? labels[status] ?? 'Chưa cập nhật' : 'Chưa cập nhật';
}
export function financialHistoryScope(scope: 'account' | 'passenger' | null | undefined) {
  return scope === 'account' ? 'Lịch sử giao dịch của toàn tài khoản'
    : scope === 'passenger' ? 'Lịch sử giao dịch của hành khách' : 'Phạm vi lịch sử chưa được xác nhận';
}
export function bookingPaymentState(paid: boolean | null | undefined) {
  return paid === true ? 'Đã thanh toán đủ' : paid === false ? 'Chưa thanh toán đủ' : 'Chưa cập nhật';
}
