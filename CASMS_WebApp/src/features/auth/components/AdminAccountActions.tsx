import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../useAuth'
import styles from './AdminAccountActions.module.css'

export function AdminAccountActions() {
  const auth = useAuth()
  const navigate = useNavigate()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  if (!auth.user) return null

  async function logout() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try {
      await auth.logout()
      navigate('/login', { replace: true })
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return <div className={styles.account}>
    <span className={styles.avatar} aria-hidden="true">{auth.user.username.slice(0,2).toUpperCase()}</span><span className={styles.username}><small>Tài khoản nhân sự</small>{auth.user.username}</span>
    <button type="button" disabled={busy} onClick={() => void logout()}>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>
  </div>
}
