import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError, apiRequest } from '@/shared/api'
import { Button, Field } from '@/shared/ui'
import { AuthPageShell } from '../components/AuthPageShell'
import styles from '../components/Auth.module.css'

// Keep the bearer token out of query strings, referrers and persistent storage.
let activationToken = ''
if (window.location.pathname === '/activate-employee-account') {
  activationToken = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
}

export function EmployeeActivationPage() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const validToken = /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/i.test(activationToken)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !validToken) return
    setError('')
    if (password.length < 12 || new TextEncoder().encode(password).length > 72) {
      setError('Mật khẩu cần ít nhất 12 ký tự và tối đa 72 byte.'); return
    }
    if (password !== confirmation) { setError('Hai mật khẩu chưa khớp. Vui lòng nhập lại.'); return }
    lock.current = true; setBusy(true)
    try {
      await apiRequest<void>('/auth/employee-account/activate', { method: 'POST', authenticated: false, body: { token: activationToken, password } })
      activationToken = ''; setPassword(''); setConfirmation(''); setDone(true)
    } catch (reason) {
      setError(reason instanceof ApiError && reason.code === 'EMPLOYEE_ACTIVATION_INVALID'
        ? 'Liên kết đã hết hạn hoặc đã được sử dụng. Hãy nhờ quản trị viên gửi lại email kích hoạt.'
        : 'Chưa kích hoạt được tài khoản. Vui lòng thử lại hoặc liên hệ quản trị viên.')
    } finally { lock.current = false; setBusy(false) }
  }
  return <AuthPageShell editorialTitle="Chào mừng bạn đến với OceVie" editorialDescription="Kích hoạt tài khoản để bắt đầu công việc được phân công.">
    <div className={styles.loginCard}>
      <h1>{done ? 'Tài khoản đã được kích hoạt' : 'Kích hoạt tài khoản nhân viên'}</h1>
      {done ? <p role="status">Bạn có thể đăng nhập bằng email công việc và mật khẩu vừa đặt.</p> : !validToken ? <p role="alert">Liên kết kích hoạt không hợp lệ. Hãy mở lại liên kết trong email hoặc nhờ quản trị viên gửi lại.</p> : <>
        <p>Đặt mật khẩu để hoàn tất kích hoạt. Liên kết chỉ dùng được một lần.</p>
        <form className={styles.loginForm} onSubmit={event => void submit(event)}>
          <Field htmlFor="activation-password" label="Mật khẩu mới *" hint="Ít nhất 12 ký tự. Nên kết hợp chữ, số và ký hiệu.">
            <div className={styles.passwordControl}>
              <input id="activation-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={72} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} />
              <button type="button" className={styles.passwordToggle} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} aria-controls="activation-password activation-confirmation" title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} disabled={busy} onClick={() => setShowPassword(v => !v)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword && <path d="m3 3 18 18" />}
                </svg>
              </button>
            </div>
          </Field>
          <Field htmlFor="activation-confirmation" label="Nhập lại mật khẩu *"><input id="activation-confirmation" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></Field>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <Button type="submit" busy={busy}>{busy ? 'Đang kích hoạt…' : 'Kích hoạt tài khoản'}</Button>
        </form>
      </>}
      <p><Link to="/login">Đến trang đăng nhập</Link></p>
      <p id="auth-help" className={styles.help}>Liên hệ quản trị viên nếu bạn cần gửi lại email kích hoạt.</p>
    </div>
  </AuthPageShell>
}
