import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import styles from './AdminShell.module.css'

const navigation: { label: string; items: { label: string; to?: string }[] }[] = [
  { label: 'TỔNG QUAN', items: [{ label: 'Tổng quan' }, { label: 'Quy trình vận hành', to: '/admin/workflow' }] },
  { label: 'ĐẶT CHỖ', items: [{ label: 'Đặt chỗ', to: '/admin/bookings' }, { label: 'Làm thủ tục' }] },
  { label: 'DỮ LIỆU NỀN TẢNG', items: [
    { label: 'Điểm đến', to: '/admin/destinations' }, { label: 'Cảng', to: '/admin/ports' },
    { label: 'Tàu', to: '/admin/ships' }, { label: 'Boong', to: '/admin/decks' }, { label: 'Cabin', to: '/admin/cabins' },
  ] },
  { label: 'LẬP KẾ HOẠCH CHUYẾN', items: [
    { label: 'Chuyến du lịch', to: '/admin/cruises' }, { label: 'Hải trình', to: '/admin/itineraries' },
  ] },
  { label: 'VẬN HÀNH & TUÂN THỦ', items: [
    { label: 'Quy định', to: '/admin/regulations' }, { label: 'Sự cố vận hành', to: '/admin/issues' },
  ] },
  { label: 'DỊCH VỤ BỜ', items: [
    { label: 'Nhà cung cấp', to: '/admin/suppliers' }, { label: 'Chuyến tham quan bờ', to: '/admin/shore-excursions' }, { label: 'Nhóm tour', to: '/admin/tour-groups' },
  ] },
  { label: 'DỊCH VỤ TÀU', items: [
    { label: 'Hoạt động trên tàu', to: '/admin/activities' }, { label: 'Dịch vụ', to: '/admin/services' },
    { label: 'Sản phẩm', to: '/admin/products' }, { label: 'Gói dịch vụ', to: '/admin/service-packages' },
    { label: 'Yêu cầu dịch vụ', to: '/admin/service-requests' },
    { label: 'Phân bổ gói', to: '/admin/package-assignments' },
  ] },
  { label: 'TÀI CHÍNH', items: [{ label: 'Thanh toán' }, { label: 'Hoàn tiền' }, { label: 'Báo cáo' }] },
  { label: 'HỆ THỐNG', items: [{ label: 'Người dùng & quyền' }] },
]

export function AdminShell({ children, className = '', topbar }: { children: ReactNode; className?: string; topbar?: ReactNode }) {
  const { pathname } = useLocation()
  const section = pathname.split('/')[2] ?? ''
  const activeTo = /\/regulations(?:\/|$)/.test(pathname) ? '/admin/regulations'
    : `/admin/${section}`
  const sidebar = useRef<HTMLElement>(null)
  useEffect(() => { sidebar.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' }) }, [activeTo])

  return <div className={className ? `${styles.shell} ${className}` : styles.shell}>
    <a href="#admin-v3-main" className={styles.skipLink}>Chuyển đến nội dung chính</a>
    <aside ref={sidebar} className={styles.sidebar} aria-label="Điều hướng quản trị">
      {/* ASSET_PENDING: replace this text fallback when the official OceVie logo is supplied. */}
      <div className={styles.brand}>OceVie</div>
      <p className={styles.subtitle}>ĐIỀU PHỐI &amp; VẬN HÀNH</p>
      <nav aria-label="Vận hành" className={styles.navigation}>
        {navigation.map(group => <div key={group.label} className={styles.navGroup}>
          <p className={styles.groupLabel}>{group.label}</p>
          {group.items.map(item => item.to
            ? <Link key={item.label} to={item.to} aria-current={item.to === activeTo ? 'page' : undefined} className={`${styles.navItem} ${item.to === activeTo ? styles.active : ''}`}>{item.label}</Link>
            : <span key={item.label} className={styles.navItem} aria-disabled="true">{item.label}</span>)}
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
