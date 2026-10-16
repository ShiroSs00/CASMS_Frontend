import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import styles from './AdminUI.module.css'

const navigation = [
  { label: 'Tổng quan' },
  { label: 'Bookings' },
  { label: 'Check-In' },
  { label: 'Yêu cầu dịch vụ' },
  { label: 'Tài khoản' },
  {
    label: 'Tàu',
    to: '/admin/ships',
    subItems: [
      { label: 'Tàu', to: '/admin/ships' },
      { label: 'Boong (Deck)', to: '/admin/decks' },
      { label: 'Cabin (Phòng)', to: '/admin/cabins' },
    ],
  },
  { label: 'Chuyến', to: '/admin/cruises' },
  { label: 'Hải trình', to: '/admin/itineraries' },
  { label: 'Cảng', to: '/admin/ports' },
  { label: 'Điểm đến', to: '/admin/destinations' },
  { label: 'Quy định', to: '/admin/regulations' },
  { label: 'Sự cố', to: '/admin/issues' },
  { label: 'Người dùng' },
  { label: 'Báo cáo' },
]

export function AdminFrame({ children, className = '', topbar }: { children: ReactNode; className?: string; topbar?: ReactNode }) {
  const { pathname } = useLocation()
  const isShipArea = pathname.startsWith('/admin/ships') || pathname.startsWith('/admin/decks') || pathname.startsWith('/admin/cabins')

  return (
    <div className={`${styles.appShell} ${className}`}>
      <a className={styles.skipLink} href="#regulation-main">Chuyển đến nội dung chính</a>
      <aside className={styles.sidebar} aria-label="Điều hướng quản trị">
        <Link to="/admin/ships" className={styles.brandLink}>
          <div className={styles.brand}>AURORA</div>
        </Link>
        <div className={styles.brandCaption}>Trung tâm vận hành</div>
        <nav className={styles.navList}>
          {navigation.map((item) => {
            if (!item.to) {
              return (
                <span
                  key={item.label}
                  className={styles.navDisabled}
                  title="Chức năng đang phát triển"
                  aria-disabled="true"
                >
                  {item.label}
                </span>
              )
            }
            if (item.subItems) {
              return (
                <div key={item.label} className={styles.navGroup}>
                  <NavLink
                    to={item.to}
                    className={() => `${styles.navLink} ${isShipArea ? styles.navActive : ''}`}
                  >
                    {item.label}
                  </NavLink>
                  {isShipArea && (
                    <div className={styles.subList}>
                      {item.subItems.map((sub) => (
                        <NavLink
                          key={sub.to}
                          to={sub.to}
                          className={({ isActive }) => `${styles.subItem} ${isActive ? styles.subActive : ''}`}
                        >
                          {sub.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
            return (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navActive : ''}`}
              >
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>
      <header className={styles.topbar}>
        <span className={styles.globalSearch}>Tìm kiếm hoặc chạy lệnh…</span>
        <span className={styles.signedIn}>Đã đăng nhập</span>
      </header>
      <main className={`${styles.main} ${styles.mainWithTopbar}`} id="regulation-main" tabIndex={-1}>
        {topbar && <div className={styles.customTopbar}>{topbar}</div>}
        {children}
      </main>
    </div>
  )
}

export function Button({ tone = 'primary', className = '', type = 'button', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'danger' | 'text' }) {
  return <button type={type} className={`${styles.button} ${styles[tone]} ${className}`} {...props} />
}
export function ButtonLink({ to, children, tone = 'primary' }: { to: string; children: ReactNode; tone?: 'primary' | 'secondary' }) {
  return <Link to={to} className={`${styles.button} ${styles[tone]} ${styles.buttonLink}`}>{children}</Link>
}
export function PageHeader({ title, description, breadcrumb, actions }:
  { title: string; description: string; breadcrumb: string; actions?: ReactNode }) {
  return <header className={styles.header}>
    <div className={styles.breadcrumb}>{breadcrumb}</div><h1>{title}</h1><p>{description}</p>
    {actions && <div className={styles.actions}>{actions}</div>}
  </header>
}
export function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <section className={styles.panel}><h2>{title}</h2>{subtitle && <p className={styles.muted}>{subtitle}</p>}{children}</section>
}
export function Notice({ title, children, tone = 'info' }:
  { title: string; children: ReactNode; tone?: 'info' | 'success' | 'warning' | 'error' }) {
  return <div className={`${styles.notice} ${styles[`notice_${tone}`]}`} role={tone === 'error' ? 'alert' : 'status'}>
    <strong>{title}</strong><div>{children}</div>
  </div>
}
export function Field({ htmlFor, label, error, hint, children }:
  { htmlFor: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return <div className={styles.field}><label htmlFor={htmlFor}>{label}</label>{children}
    {error ? <span id={`${htmlFor}-hint`} className={styles.error} role="alert">{error}</span>
      : hint ? <span id={`${htmlFor}-hint`} className={styles.muted}>{hint}</span> : null}
  </div>
}
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'info' | 'error' }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{label}</span>
}
export function DataTable({ headers, children, label }: { headers: string[]; children: ReactNode; label: string }) {
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={label}>
    <table className={styles.table}><thead><tr>{headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table>
  </div>
}
export function Loading({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return <div className={styles.empty} role="status"><span className={styles.spinner} aria-hidden="true" /><strong>{label}</strong></div>
}
export function Empty({ title = 'Không có kết quả phù hợp', children }: { title?: string; children?: ReactNode }) {
  return <div className={styles.empty}><strong>{title}</strong>{children}</div>
}
export function Modal({ title, onClose, busy = false, wide = false, children }:
  { title: string; onClose: () => void; busy?: boolean; wide?: boolean; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useRef(onClose)
  const busyRef = useRef(busy)
  const titleId = useId()
  useEffect(() => { close.current = onClose; busyRef.current = busy }, [onClose, busy])
  useEffect(() => {
    const element = dialog.current!
    const trigger = document.activeElement as HTMLElement | null
    element.showModal()
    return () => { element.close(); trigger?.focus() }
  }, [])
  return <dialog ref={dialog} aria-labelledby={titleId} className={`${styles.modal} ${wide ? styles.modalWide : ''}`}
    onCancel={(event) => { event.preventDefault(); if (!busyRef.current) close.current() }}>
    <div className={styles.modalHeader}><h2 id={titleId}>{title}</h2><button autoFocus aria-label="Đóng hộp thoại" disabled={busy} className={styles.close} onClick={onClose}>×</button></div>
    {children}
  </dialog>
}
