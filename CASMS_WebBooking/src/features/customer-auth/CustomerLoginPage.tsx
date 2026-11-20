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
                hint="Tên đăng nhập được gửi trong email xác nhận hoặc kích hoạt tài khoản."
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
                <input
                  id="customer-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                />
              </Field>
              <div className={styles.actions}>
                <Button
                  tone="text"
                  autoWidth
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(value => !value)}
                >
                  {showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                </Button>
              </div>
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
            Sau khi đặt chỗ thành công, OceVie gửi liên kết kích hoạt tài khoản qua email người đại diện. Bạn có thể mở
            liên kết đó để thiết lập mật khẩu.
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
