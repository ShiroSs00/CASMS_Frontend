import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import styles from './AdminShell.module.css'

const navigation = [
  { label: 'Tổng quan' }, { label: 'Bookings' }, { label: 'Check-in' },
  { label: 'Yêu cầu dịch vụ' }, { label: 'Tài khoản' },
  { label: 'Tàu', to: '/admin/ships' }, { label: 'Chuyến', to: '/admin/cruises' },
  { label: 'Quy định', to: '/admin/regulations' }, { label: 'Sự cố', to: '/admin/issues' },
  { label: 'Người dùng' }, { label: 'Báo cáo' },
]

export function AdminShell({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>
    <a href="#admin-v3-main" className={styles.skipLink}>Chuyển đến nội dung chính</a>
    <aside className={styles.sidebar} aria-label="Điều hướng quản trị">
      <div className={styles.brand}>AURORA</div>
      <p className={styles.subtitle}>Trung tâm vận hành</p>
      <nav aria-label="Vận hành" className={styles.navigation}>
        {navigation.map(item => item.to
          ? <NavLink key={item.label} to={item.to} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>{item.label}</NavLink>
          : <span key={item.label} className={styles.navItem} aria-disabled="true" title="Chưa có trong phiên bản này">{item.label}</span>)}
      </nav>
    </aside>
    <div className={styles.mainColumn}>
      <header className={styles.topbar}>
        <input className={styles.command} aria-label="Tìm kiếm hoặc chạy lệnh (chưa khả dụng)" placeholder="Tìm kiếm hoặc chạy lệnh…" disabled />
        <span className={styles.session}>Đã đăng nhập</span>
      </header>
      <main id="admin-v3-main" tabIndex={-1} className={styles.main}>{children}</main>
    </div>
  </div>
}
