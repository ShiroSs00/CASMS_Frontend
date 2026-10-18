import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import styles from './AdminShell.module.css'

const navigation: { label: string; items: { label: string; to?: string }[] }[] = [
  { label: 'ĐẶT CHỖ', items: [{ label: 'Tổng quan' }, { label: 'Đặt chỗ' }, { label: 'Làm thủ tục' }] },
  { label: 'VẬN HÀNH', items: [
    { label: 'Yêu cầu dịch vụ' }, { label: 'Hoạt động' }, { label: 'Sự cố', to: '/admin/issues' },
  ] },
  { label: 'DỮ LIỆU DANH MỤC', items: [
    { label: 'Tàu & cabin', to: '/admin/ships' }, { label: 'Hải trình', to: '/admin/itineraries' },
    { label: 'Gói dịch vụ' }, { label: 'Chuyến', to: '/admin/cruises' },
  ] },
  { label: 'DỊCH VỤ BỜ', items: [
    { label: 'Nhà cung cấp', to: '/admin/suppliers' }, { label: 'Chuyến tham quan bờ' }, { label: 'Nhóm tour' },
  ] },
  { label: 'TÀI CHÍNH', items: [{ label: 'Thanh toán' }, { label: 'Hoàn tiền' }, { label: 'Báo cáo' }] },
  { label: 'HỆ THỐNG', items: [
    { label: 'Người dùng & quyền' }, { label: 'Quy định', to: '/admin/regulations' },
  ] },
]

export function AdminShell({ children, className = '', topbar }: { children: ReactNode; className?: string; topbar?: ReactNode }) {
  const { pathname } = useLocation()
  const section = pathname.split('/')[2] ?? ''
  const activeTo = /\/regulations(?:\/|$)/.test(pathname) ? '/admin/regulations'
    : ['ships', 'decks', 'cabins'].includes(section) ? '/admin/ships'
      : ['itineraries', 'ports', 'destinations'].includes(section) ? '/admin/itineraries'
        : `/admin/${section}`

  return <div className={className ? `${styles.shell} ${className}` : styles.shell}>
    <a href="#admin-v3-main" className={styles.skipLink}>Chuyển đến nội dung chính</a>
    <aside className={styles.sidebar} aria-label="Điều hướng quản trị">
      {/* ASSET_PENDING: replace this text fallback when the official OceVie logo is supplied. */}
      <div className={styles.brand}>OceVie</div>
      <p className={styles.subtitle}>ĐIỀU PHỐI &amp; VẬN HÀNH</p>
      <nav aria-label="Vận hành" className={styles.navigation}>
        {navigation.map(group => <div key={group.label} className={styles.navGroup}>
          <p className={styles.groupLabel}>{group.label}</p>
          {group.items.map(item => item.to
            ? <Link key={item.label} to={item.to} aria-current={item.to === activeTo ? 'page' : undefined} className={`${styles.navItem} ${item.to === activeTo ? styles.active : ''}`}>{item.label}</Link>
            : <span key={item.label} className={styles.navItem} aria-disabled="true" title="Chưa có trong phiên bản này">{item.label}</span>)}
        </div>)}
      </nav>
    </aside>
    <div className={styles.mainColumn}>
      {topbar ?? <header className={styles.topbar}>
        <p className={styles.context}>Khu vực quản trị</p>
      </header>}
      <main id="admin-v3-main" tabIndex={-1} className={styles.main}>{children}</main>
    </div>
  </div>
}
