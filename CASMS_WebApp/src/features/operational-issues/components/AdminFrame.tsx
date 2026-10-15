import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

import styles from './OperationalIssues.module.css'

const navigation = [
  { label: 'Tổng quan' },
  { label: 'Bookings' },
  { label: 'Check-in' },
  { label: 'Yêu cầu dịch vụ' },
  { label: 'Tài khoản' },
  { label: 'Tàu', to: '/admin/ships' },
  { label: 'Chuyến', to: '/admin/cruises' },
  { label: 'Hải trình', to: '/admin/itineraries' },
  { label: 'Quy định', to: '/admin/regulations' },
  { label: 'Sự cố', to: '/admin/issues' },
  { label: 'Người dùng' },
  { label: 'Báo cáo' },
]

export function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.appShell}>
      <a className={styles.skipLink} href="#oim-main">
        Chuyển đến nội dung chính
      </a>
      <aside className={styles.sidebar} aria-label="Điều hướng quản trị">
        <div className={styles.brand}>AURORA</div>
        <div className={styles.brandCaption}>Trung tâm vận hành</div>
        {navigation.map((item) => item.to ? (
          <NavLink
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
            key={item.label}
            to={item.to}
          >{item.label}</NavLink>
        ) : <span className={styles.navLink} key={item.label} aria-disabled="true">{item.label}</span>)}
      </aside>
      <header className={styles.topbar}>
        <span className={styles.globalSearch}>Tìm kiếm hoặc chạy lệnh…</span>
        <span className={styles.signedIn}>Đã đăng nhập</span>
      </header>
      <main className={styles.main} id="oim-main" tabIndex={-1}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  )
}
