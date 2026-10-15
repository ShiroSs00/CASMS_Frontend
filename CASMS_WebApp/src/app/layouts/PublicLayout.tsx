import { useState } from 'react'
import { Link, Outlet } from 'react-router'
import { AuthAccountMenu } from '@/features/auth'
import { pendingBookingMessage } from '@/features/home'
import styles from './PublicLayout.module.css'

export function PublicLayout() {
  const [notice, setNotice] = useState('')
  return <div className={styles.pageShell}>
    <a className={styles.skipLink} href="#main-content">Chuyển đến nội dung chính</a>
    <header className={styles.header}><div className={styles.brandNav}><Link className={styles.brand} to="/">AURORA</Link><nav aria-label="Điều hướng chính"><a href="/#voyages">Chuyến du thuyền</a><a href="/#destinations">Điểm đến</a><a href="/#experience">Trải nghiệm</a></nav></div><div className={styles.accountNav}><button onClick={() => setNotice(pendingBookingMessage('my-bookings'))}>Booking của tôi</button><AuthAccountMenu /></div></header>
    {notice && <div className={styles.notice} role="status">{notice}<button onClick={() => setNotice('')} aria-label="Đóng thông báo">×</button></div>}
    <main id="main-content" tabIndex={-1}><Outlet /></main>
  </div>
}
