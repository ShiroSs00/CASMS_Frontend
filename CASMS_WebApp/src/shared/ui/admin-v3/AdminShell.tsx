import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import styles from './AdminShell.module.css'

const navigation: { label: string; items: { label: string; to?: string }[] }[] = [
  { label: 'BOOKING', items: [{ label: 'Tổng quan' }, { label: 'Booking' }, { label: 'Check-in' }] },
  { label: 'OPERATIONS', items: [
    { label: 'Yêu cầu dịch vụ' }, { label: 'Hoạt động' }, { label: 'Sự cố', to: '/admin/issues' },
  ] },
  { label: 'MASTER DATA', items: [
    { label: 'Tàu & cabin', to: '/admin/ships' }, { label: 'Hải trình', to: '/admin/itineraries' },
    { label: 'Package' }, { label: 'Chuyến', to: '/admin/cruises' },
  ] },
  { label: 'SHORE OPERATIONS', items: [
    { label: 'Nhà cung cấp', to: '/admin/suppliers' }, { label: 'Chuyến tham quan bờ' }, { label: 'Nhóm tour' },
  ] },
  { label: 'FINANCE', items: [{ label: 'Thanh toán' }, { label: 'Refund' }, { label: 'Báo cáo' }] },
  { label: 'SYSTEM', items: [
    { label: 'Người dùng & quyền' }, { label: 'Quy định', to: '/admin/regulations' },
  ] },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isItemActive = (to?: string) => (to ? pathname === to || pathname.startsWith(`${to}/`) : false)

  return <div className={styles.shell}>
    <a href="#admin-v3-main" className={styles.skipLink}>Chuyển đến nội dung chính</a>
    <aside className={styles.sidebar} aria-label="Điều hướng quản trị">
      {/* ASSET_PENDING: replace this text fallback when the official OceVie logo is supplied. */}
      <div className={styles.brand}>OceVie</div>
      <p className={styles.subtitle}>ĐIỀU PHỐI &amp; VẬN HÀNH</p>
      <nav aria-label="Vận hành" className={styles.navigation}>
        {navigation.map(group => <div key={group.label} className={styles.navGroup}>
          <p className={styles.groupLabel}>{group.label}</p>
          {group.items.map(item => item.to
            ? <NavLink key={item.label} to={item.to} className={({ isActive }) => `${styles.navItem} ${isActive || isItemActive(item.to) ? styles.active : ''}`}>{item.label}</NavLink>
            : <span key={item.label} className={styles.navItem} aria-disabled="true" title="Chưa có trong phiên bản này">{item.label}</span>)}
        </div>)}
      </nav>
    </aside>
    <div className={styles.mainColumn}>
      <header className={styles.topbar}>
        {/* Presentational Figma context until assignment/account context is integrated. */}
        <p className={styles.assignment}>Chuyến được phân công: OceVie Aurora · 20/11/2026</p>
        <div className={styles.account}>
          <span className={styles.role}>Nhân viên vận hành</span>
          <span className={styles.accountLabel} aria-disabled="true" title="Chưa có trong phiên bản này">Tài khoản ▾</span>
        </div>
      </header>
      <main id="admin-v3-main" tabIndex={-1} className={styles.main}>{children}</main>
    </div>
  </div>
}
