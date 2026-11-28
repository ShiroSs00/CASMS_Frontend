import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button, Field, Notice, PageHeader, Panel } from '@/shared/ui'
import styles from './CustomerLoginPage.module.css'
import { useCustomerAuth } from './useCustomerAuth'

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/my-bookings'
  return raw
}

export function CustomerLoginPage() {
  const { status, login } = useCustomerAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const nextPath = safeNextPath(params.get('next'))
  const reference = params.get('reference') ?? ''

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(nextPath, { replace: true })
    }
  }, [status, navigate, nextPath])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    if (!username.trim() || !password) {
      setError('Nhập tên đăng nhập (hoặc email) và mật khẩu của tài khoản hành khách.')
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await login(username.trim(), password)
      navigate(nextPath, { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Đăng nhập chưa thành công. Kiểm tra lại thông tin tài khoản.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topline}>
        <Link to="/booking/lookup">← Quay lại tra cứu đặt chỗ</Link>
        <p className={styles.helper}>Dành cho hành khách OceVie</p>
      </div>
      <PageHeader
        breadcrumb="TÀI KHOẢN HÀNH KHÁCH"
        title="Đăng nhập để quản lý & thanh toán đặt chỗ"
        description={
          reference
            ? `Đăng nhập bằng tài khoản hành khách của đặt chỗ ${reference} để tạo mã VietQR và theo dõi tiến độ thanh toán.`
            : 'Đăng nhập bằng tài khoản hành khách đã kích hoạt để xem đặt chỗ, lịch trả và thanh toán qua VietQR.'
        }
      />
      <div className={styles.grid}>
        <Panel title="Thông tin đăng nhập">
          <form noValidate aria-busy={busy} onSubmit={submit}>
            <fieldset disabled={busy} className={styles.fields}>
              <Field
                htmlFor="customer-username"
                label="Tên đăng nhập hoặc email *"
              >
                <input
                  id="customer-username"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                />
              </Field>
              <Field htmlFor="customer-password" label="Mật khẩu *">
                <div className={styles.passwordControl}>
                  <input
                    id="customer-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-pressed={showPassword}
                    aria-controls="customer-password"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    disabled={busy}
                    onClick={() => setShowPassword(value => !value)}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                      {showPassword && <path d="m3 3 18 18" />}
                    </svg>
                  </button>
                </div>
              </Field>
              {error && (
                <Notice title="Chưa đăng nhập được" tone="error">
                  {error}
                </Notice>
              )}
              <Button type="submit" busy={busy}>
                {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </Button>
            </fieldset>
          </form>
        </Panel>
        <aside className={styles.help}>
          <h2>Chưa có mật khẩu đăng nhập?</h2>
          <p>
            Sau khi đặt chỗ thành công, OceVie gửi tên đăng nhập và mật khẩu tạm qua email người đại diện. Vui lòng kiểm
            tra hộp thư (kể cả mục Thư rác) để lấy thông tin đăng nhập.
          </p>
          <p className={styles.helper}>
            Nếu chỉ cần xem thông tin đặt chỗ mà chưa thanh toán, bạn vẫn có thể dùng{' '}
            <Link to={reference ? `/booking/lookup?reference=${encodeURIComponent(reference)}` : '/booking/lookup'}>
              Tra cứu đặt chỗ công khai
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  )
}
