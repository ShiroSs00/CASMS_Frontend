export function bookingLookupErrors(reference: string, email: string, phone: string) {
  const errors: Record<string, string> = {}
  if (!reference.trim()) errors.reference = 'Nhập mã đặt chỗ.'
  if (!email.trim() && !phone.trim()) errors.email = 'Nhập email hoặc số điện thoại liên hệ của đặt chỗ.'
  if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Email chưa đúng định dạng.'
  if (phone.trim() && !/^\+?[0-9]{8,15}$/.test(phone.trim())) errors.phone = 'Số điện thoại cần 8–15 chữ số, có thể bắt đầu bằng +.'
  return errors
}

export type BookingRecovery = { idempotencyKey: string; cruiseId: string }
const recoveryKey = (owner: string) => 'ocevie.booking-agent.recovery.v1:' + owner
export function readBookingRecovery(owner: string): BookingRecovery | null {
  const raw = sessionStorage.getItem(recoveryKey(owner))
  if (!raw) return null
  const value = JSON.parse(raw) as BookingRecovery
  if (!value || typeof value.idempotencyKey !== 'string' || !value.idempotencyKey || typeof value.cruiseId !== 'string' || !value.cruiseId) throw new Error('Tham chiếu phục hồi đặt chỗ không hợp lệ. Cần đối chiếu với bộ phận hỗ trợ trước khi tạo lại.')
  return { idempotencyKey: value.idempotencyKey, cruiseId: value.cruiseId }
}
export function writeBookingRecovery(owner: string, value: BookingRecovery | null) {
  if (value) sessionStorage.setItem(recoveryKey(owner), JSON.stringify(value))
  else sessionStorage.removeItem(recoveryKey(owner))
}
