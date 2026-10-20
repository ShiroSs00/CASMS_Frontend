import { useRef, useState, type FormEvent } from 'react'
import { ApiError } from '@/shared/api'
import { Button, Field } from '@/shared/ui'
import type { AuthUser } from '../model/auth-types'
import styles from './Auth.module.css'

function loginMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'ACCOUNT_DISABLED' || /disabled|locked/i.test(error.message)) return 'Tài khoản đã bị khóa hoặc ngừng hoạt động. Vui lòng liên hệ quản trị viên.'
    if (error.code === 'INVALID_CREDENTIALS' || error.status === 401 || /invalid username or password/i.test(error.message)) return 'Tên đăng nhập hoặc mật khẩu không đúng.'
  }
  return error instanceof Error ? error.message : 'Không thể đăng nhập. Vui lòng thử lại.'
}

export function LoginForm({ expired, login, onSuccess }: {
  expired: boolean; login: (username: string, password: string) => Promise<AuthUser>; onSuccess: (user: AuthUser) => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const lock = useRef(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    setAttempted(true); setError('')
    if (!username.trim() || !password) return
    lock.current = true; setBusy(true)
    try { const user = await login(username.trim(), password); setPassword(''); onSuccess(user) }
    catch (reason) { setError(loginMessage(reason)) }
    finally { lock.current = false; setBusy(false) }
  }
  return <div className={styles.loginCard}>
    <p className={styles.eyebrow}>{expired ? 'PHIÊN ĐĂNG NHẬP' : 'TÀI KHOẢN OCVVIET'}</p>
    <h1>{expired ? 'Phiên của bạn đã hết hạn' : 'Chào mừng trở lại'}</h1>
    <p>{expired ? 'Đăng nhập lại để tiếp tục. Thông tin bạn đang xem không được coi là đã lưu nếu backend chưa xác nhận.' : 'Đăng nhập bằng tài khoản OcvViet để tiếp tục vào khu vực phù hợp với vai trò của bạn.'}</p>
    <form className={styles.loginForm} onSubmit={(event) => void submit(event)} noValidate>
      <Field htmlFor="auth-username" label="Tên đăng nhập" error={attempted && !username.trim() ? 'Nhập tên đăng nhập.' : undefined}><input id="auth-username" name="username" autoComplete="username" value={username} disabled={busy} required aria-invalid={attempted && !username.trim()} aria-describedby={attempted && !username.trim() ? 'auth-username-hint' : undefined} onChange={(event) => setUsername(event.target.value)} /></Field>
      <Field htmlFor="auth-password" label="Mật khẩu" error={attempted && !password ? 'Nhập mật khẩu.' : undefined}><input id="auth-password" name="password" type="password" autoComplete="current-password" value={password} disabled={busy} required aria-invalid={attempted && !password} aria-describedby={attempted && !password ? 'auth-password-hint' : undefined} onChange={(event) => setPassword(event.target.value)} /></Field>
      <div className={styles.sessionHint}><span>Phiên đăng nhập được duy trì trong phiên trình duyệt</span><a href="#auth-help">Cần hỗ trợ?</a></div>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <Button type="submit" className={styles.loginButton} disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</Button>
    </form>
    <p className={styles.center}>Tài khoản được cấp và quản lý bởi hệ thống AURORA</p>
    <p className={styles.help} id="auth-help">Liên hệ quản trị viên nếu bạn không thể đăng nhập</p>
  </div>
}
