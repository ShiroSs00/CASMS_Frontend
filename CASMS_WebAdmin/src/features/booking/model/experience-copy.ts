import type {
  Payment,
  PaymentMethod,
  SepayReconciliationAction,
  SepayReconciliationStatus,
  SepayTransactionStatus,
} from '../api/payment-api'

// Only catalogue units actually present in the current service model/data are translated.
export function serviceQuantityLabel(unitCode: string | null): string {
  const units: Record<string, string> = { PERSON: 'Số người sử dụng', SESSION: 'Số lượt sử dụng', DEVICE: 'Số thiết bị' }
  return unitCode && units[unitCode] ? units[unitCode] : 'Số lượng'
}

export const paymentStatusLabels: Record<Payment['status'], string> = {
  Initiated: 'Khởi tạo',
  Pending: 'Chờ xác nhận',
  Authorized: 'Đã ủy quyền',
  Captured: 'Đã thu từ cổng',
  Confirmed: 'Đã xác nhận thu',
  Failed: 'Không thành công',
  Cancelled: 'Đã hủy / hết hiệu lực',
  PartiallyRefunded: 'Đã hoàn một phần',
  Refunded: 'Đã hoàn toàn bộ',
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  Cash: 'Tiền mặt tại quầy',
  GatewaySandbox: 'Sandbox (mô phỏng)',
  Sepay: 'VietQR (SePay)',
  CreditCard: 'Thẻ thanh toán',
  TokenizedCard: 'Thẻ đã lưu',
}

export function paymentSourceLabel(payment: Pick<Payment, 'paymentMethod' | 'provider'>): string {
  if (payment.paymentMethod === 'Sepay') {
    if (payment.provider === 'SEPAY_VIETQR_RECONCILED') return 'VietQR (Đối soát Finance)'
    if (payment.provider === 'SEPAY_VISA' || payment.provider === 'SEPAY_MASTERCARD') return 'Thẻ qua SePay'
    return 'VietQR (SePay)'
  }
  return paymentMethodLabels[payment.paymentMethod] ?? payment.paymentMethod
}

export const sepayTxStatusLabels: Record<SepayTransactionStatus, string> = {
  RECEIVED: 'Đã tiếp nhận',
  PROCESSED: 'Đã ghi sổ',
  RETRY_REQUIRED: 'Cần xử lý lại',
  UNMATCHED: 'Không khớp mã',
  AMOUNT_MISMATCH: 'Sai lệch số tiền',
  RECONCILIATION_REQUIRED: 'Cần Finance đối soát',
  IGNORED: 'Đã bỏ qua',
}

export const sepayReconciliationStatusLabels: Record<SepayReconciliationStatus, string> = {
  NONE: 'Không cần đối soát',
  PENDING_REVIEW: 'Chờ đối soát',
  RESOLVED: 'Đã đối soát',
}

export const sepayReconciliationActionLabels: Record<SepayReconciliationAction, string> = {
  APPLY_TO_BOOKING: 'Ghi nhận vào đặt chỗ',
  MARK_FOR_REFUND: 'Chuyển quy trình hoàn tiền',
  MANUAL_RESOLVED: 'Đóng đối soát thủ công',
  DISMISSED: 'Không thuộc khoản thu đặt chỗ',
}

export const sepayExceptionCodeLabels: Record<string, string> = {
  UNDERPAID: 'Chuyển thiếu so với lệnh thu',
  OVERPAID: 'Chuyển dư so với lệnh thu',
  TRANSFER_CODE_UNMATCHED: 'Sai hoặc thiếu mã chuyển khoản',
  NO_ACTIVE_ORDER: 'Không có lệnh VietQR đang chờ khớp mã',
  ALREADY_SETTLED: 'Trùng khoản thu (lệnh đã tất toán)',
  ORDER_SUPERSEDED: 'Chuyển vào lệnh QR đã thay thế / hết hiệu lực',
  BOOKING_CANCELLED: 'Tiền đến sau khi đặt chỗ đã hủy',
  BOOKING_HOLD_EXPIRED: 'Tiền đến sau khi hết hạn giữ chỗ',
  BOOKING_ALREADY_PAID: 'Đặt chỗ đã thanh toán đủ trước đó',
  BALANCE_CHANGED: 'Số dư đặt chỗ đã thay đổi nhỏ hơn lệnh QR',
  ACCOUNT_MISMATCH: 'Sai tài khoản thụ hưởng',
  CURRENCY_MISMATCH: 'Sai đơn vị tiền tệ',
  INVALID_TRANSFER_TYPE: 'Loại giao dịch không hợp lệ',
  INVALID_TRANSFER_AMOUNT: 'Số tiền giao dịch không hợp lệ',
}
