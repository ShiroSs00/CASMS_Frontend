import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../useAuth'
import styles from './Auth.module.css'

export function AuthAccountMenu() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  if (!auth.user) return <Link className={styles.accountTrigger} to="/login">Đăng nhập</Link>
  async function logout() {
    if (busy) return
    setBusy(true)
    try { await auth.logout(); setOpen(false); navigate('/', { replace: true }) }
    finally { setBusy(false) }
  }
  return <div className={styles.account} ref={root}>
    <button className={styles.accountTrigger} ref={trigger} type="button" aria-expanded={open} aria-controls="aurora-account-menu" onClick={() => setOpen((value) => !value)}>{auth.user.username} <span aria-hidden="true">▾</span></button>
    {open && <div className={styles.accountMenu} id="aurora-account-menu" aria-label="Tài khoản AURORA">
      <button type="button" disabled title="Quản lý tài khoản chưa khả dụng">Tài khoản AURORA</button>
      {auth.isStaff && <Link to="/admin" onClick={() => setOpen(false)}>Khu vực quản trị</Link>}
      <button type="button" className={styles.logout} disabled={busy} onClick={() => void logout()}>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>
    </div>}
  </div>
}
