import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button, ButtonLink, Field, Notice } from '@/shared/ui'
import { activateBookingAccount, ActivationError } from './activation-api'
import { validateActivationPassword, type ActivationLink } from './activation-link'
import styles from './BookingAccountActivationPage.module.css'

export function BookingAccountActivationPage({ link, support }: { link: ActivationLink; support: ReactNode }) {
  const [status, setStatus] = useState<'form' | 'invalid' | 'busy' | 'success' | 'blocked' | 'uncertain'>(() => link.read() ? 'form' : 'invalid')
  const [error, setError] = useState('')
  const [fields, setFields] = useState<{ password?: string; confirmation?: string }>({})
  const [visible, setVisible] = useState(false)
  const password = useRef<HTMLInputElement>(null), confirmation = useRef<HTMLInputElement>(null)
  const result = useRef<HTMLDivElement>(null)
  const locked = useRef(false), mounted = useRef(false), lifecycle = useRef({ generation: 0 })
  const request = useRef<AbortController | null>(null)

  useEffect(() => {
    mounted.current = true
    const lifetime = lifecycle.current
    const generation = ++lifetime.generation
    const clearInputs = () => {
      if (password.current) password.current.value = ''
      if (confirmation.current) confirmation.current.value = ''
    }
    const leave = () => { link.clear(); clearInputs(); request.current?.abort() }
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) { leave(); setStatus('invalid'); setError(''); setVisible(false) }
    }
    window.addEventListener('pagehide', leave)
    window.addEventListener('pageshow', restore)
    return () => {
      mounted.current = false
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('pageshow', restore)
      // React StrictMode replays effects synchronously. Clear only after a real unmount.
      queueMicrotask(() => { if (lifetime.generation === generation) leave() })
    }
  }, [link])

  useEffect(() => {
    if (['success', 'blocked', 'uncertain'].includes(status)) result.current?.focus()
  }, [status])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked.current || status !== 'form') return
    const token = link.read()
    if (!token) { setStatus('invalid'); return }
    const value = password.current?.value ?? '', repeated = confirmation.current?.value ?? ''
    const errors = validateActivationPassword(value, repeated)
    setFields(errors); setError('')
    if (errors.password || errors.confirmation) { (errors.password ? password : confirmation).current?.focus(); return }
    locked.current = true
    setStatus('busy')
    const controller = new AbortController()
    request.current = controller
    try {
      await activateBookingAccount(token, value, controller.signal)
      link.clear()
      if (mounted.current) { setVisible(false); setStatus('success') }
    } catch (cause) {
      if (!mounted.current) return
      const problem = cause instanceof ActivationError ? cause : new ActivationError('uncertain')
      setError(problem.message)
      if (problem.kind === 'password') { setFields({ password: problem.message }); setStatus('form') }
      else if (problem.kind === 'rejected') setStatus('form')
      else { link.clear(); setVisible(false); setStatus(problem.kind === 'uncertain' ? 'uncertain' : 'blocked') }
    } finally {
      // Keep passwords in the controls only; clear them after every submitted attempt.
      if (password.current) password.current.value = ''
      if (confirmation.current) confirmation.current.value = ''
      locked.current = false
      request.current = null
    }
  }

  const showForm = status === 'form' || status === 'busy'
  return <section className={styles.page} aria-labelledby="activation-title">
    <div className={styles.content}>
      <h1 id="activation-title">Thiết lập tài khoản OceVie</h1>
      {showForm ? <form onSubmit={event => { void submit(event) }} noValidate aria-busy={status === 'busy'}>
        {error && <Notice title="Chưa thể hoàn tất" tone="error">{error}</Notice>}
        <Field htmlFor="activation-password" label="Mật khẩu mới" hint="Từ 12 đến 72 ký tự. Ký tự có dấu hoặc ký tự đặc biệt có thể làm giảm độ dài tối đa." error={fields.password}>
          <input ref={password} id="activation-password" type={visible ? 'text' : 'password'} autoComplete="new-password" required disabled={status === 'busy'} />
        </Field>
        <Field htmlFor="activation-confirmation" label="Xác nhận mật khẩu" error={fields.confirmation}>
          <input ref={confirmation} id="activation-confirmation" type={visible ? 'text' : 'password'} autoComplete="new-password" required disabled={status === 'busy'} />
        </Field>
        <Button tone="text" autoWidth className={styles.visibility} aria-pressed={visible} aria-controls="activation-password activation-confirmation" disabled={status === 'busy'} onClick={() => setVisible(value => !value)}>{visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</Button>
        <Button type="submit" busy={status === 'busy'} fullWidth>{status === 'busy' ? 'Đang kích hoạt…' : 'Kích hoạt tài khoản'}</Button>
        {status === 'busy' && <p className={styles.pending} role="status">Đang xử lý yêu cầu…</p>}
      </form> : <div ref={result} tabIndex={-1} className={styles.result}>
        {status === 'success' ? <Notice title="Tài khoản đã được kích hoạt." tone="success">Bạn có thể đăng nhập ứng dụng OceVie bằng tên đăng nhập trong email.</Notice>
          : <Notice title={status === 'invalid' ? 'Liên kết kích hoạt không hợp lệ.' : status === 'uncertain' ? 'Cần kiểm tra kết quả kích hoạt' : 'Liên kết không còn sử dụng được'} tone={status === 'uncertain' ? 'warning' : 'error'}>
            {status === 'invalid' ? 'Vui lòng mở lại liên kết trong email hoặc liên hệ hỗ trợ.' : error}
          </Notice>}
      </div>}
      <div className={styles.navigation}><ButtonLink to="/" tone="secondary">Về trang chủ</ButtonLink>{support}</div>
    </div>
  </section>
}
