export type ActivationLink = { read: () => string | null; clear: () => void }

export function validActivationToken(value: string): boolean {
  // BookingEmailService generates unpadded URL-safe Base64; the public DTO caps it at 128.
  return /^[A-Za-z0-9_-]{1,128}$/.test(value)
}

export function captureActivationLink(browser: Pick<Window, 'location' | 'history'>): ActivationLink {
  let token: string | null = null
  if (browser.location.pathname === '/activate-booking-account') {
    const fragment = browser.location.hash.slice(1)
    const params = new URLSearchParams(fragment)
    const values = params.getAll('token')
    const query = new URLSearchParams(browser.location.search)
    const queryToken = query.has('token')
    // Never accept a query token. Strip it from subsequent navigation as well.
    query.delete('token')
    try {
      browser.history.replaceState(browser.history.state, '', browser.location.pathname + (query.size ? `?${query}` : ''))
      if (!queryToken && [...params.keys()].every(key => key === 'token') && values.length === 1 && validActivationToken(values[0])) token = values[0]
    } catch {
      // Fail closed if the sensitive fragment could not be removed.
    }
  }
  return { read: () => token, clear: () => { token = null } }
}

export function validateActivationPassword(password: string, confirmation: string) {
  const errors: { password?: string; confirmation?: string } = {}
  if (!password.trim()) errors.password = 'Nhập mật khẩu mới.'
  // Java @Size and String.length() use the same UTF-16 code units.
  else if (password.length < 8) errors.password = 'Mật khẩu cần có ít nhất 8 ký tự.'
  else if (password.length > 24) errors.password = 'Mật khẩu không được quá 24 ký tự.'
  else if (new TextEncoder().encode(password).length > 72) errors.password = 'Mật khẩu có quá nhiều ký tự có dấu hoặc ký tự đặc biệt. Vui lòng rút ngắn mật khẩu.'
  if (!confirmation) errors.confirmation = 'Nhập lại mật khẩu mới.'
  else if (confirmation !== password) errors.confirmation = 'Mật khẩu xác nhận chưa khớp.'
  return errors
}
