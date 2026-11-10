import { ApiError, apiRequestRaw } from '@/shared/api/client'

export type ActivationProblem = 'invalid' | 'disabled' | 'password' | 'rejected' | 'uncertain'
const messages: Record<ActivationProblem, string> = {
  invalid: 'Liên kết kích hoạt đã hết hạn, đã được sử dụng hoặc không còn hợp lệ. Vui lòng liên hệ hỗ trợ nếu bạn chưa thiết lập mật khẩu.',
  disabled: 'Tài khoản hiện không thể kích hoạt. Vui lòng liên hệ hỗ trợ.',
  password: 'Mật khẩu có quá nhiều ký tự có dấu hoặc ký tự đặc biệt. Vui lòng rút ngắn mật khẩu.',
  rejected: 'Chưa thể kích hoạt tài khoản. Vui lòng kiểm tra thông tin hoặc liên hệ hỗ trợ.',
  uncertain: 'Chưa xác định được kết quả kích hoạt. Bạn có thể kiểm tra đăng nhập ứng dụng OceVie bằng mật khẩu vừa thiết lập hoặc liên hệ hỗ trợ trước khi thử lại.',
}
export class ActivationError extends Error {
  readonly kind: ActivationProblem
  constructor(kind: ActivationProblem) { super(messages[kind]); this.name = 'ActivationError'; this.kind = kind }
}

export async function activateBookingAccount(token: string, password: string, signal?: AbortSignal): Promise<void> {
  try {
    await apiRequestRaw('/auth/booking-account/activate', (payload, status) => {
      const envelope = payload as { success?: unknown; code?: unknown; data?: unknown } | null
      if (status !== 200 || !envelope || envelope.success !== true || envelope.data != null) {
        throw new ApiError('', status, typeof envelope?.code === 'string' ? envelope.code : undefined)
      }
    }, { method: 'POST', authenticated: false, body: { token, password }, signal })
  } catch (error) {
    // Do not propagate raw server messages/details, request bodies or secrets to the UI.
    if (error instanceof ApiError) {
      if (error.code === 'ACCOUNT_SETUP_INVALID') throw new ActivationError('invalid')
      if (error.code === 'ACCOUNT_DISABLED') throw new ActivationError('disabled')
      if (error.code === 'PASSWORD_TOO_LONG') throw new ActivationError('password')
      if (error.status >= 400 && error.status < 500) throw new ActivationError('rejected')
    }
    throw new ActivationError('uncertain')
  }
}
