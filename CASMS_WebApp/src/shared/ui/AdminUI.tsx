import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import styles from './AdminUI.module.css'

// The existing Regulations AdminFrame is shared here without changing page APIs.
export function AdminFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { pathname } = useLocation()
  const isRegulation = pathname.includes('/regulations')
  const [expanded, setExpanded] = useState(!isRegulation)
  return <div className={`${styles.appShell} ${className}`}>
    <a className={styles.skipLink} href="#regulation-main">Chuyển đến nội dung chính</a>
    <aside className={styles.sidebar} aria-label="Điều hướng quản trị">
      <div className={styles.brand}>CASMS</div>
      <div className={styles.navHeading}>QUẢN TRỊ VẬN HÀNH</div>
      <nav className={styles.navList}>
        <span className={styles.navItem} aria-disabled="true">Tổng quan</span>
        <div>
          <button className={styles.navParent} aria-expanded={expanded} aria-controls="ship-deck-cabin-menu" onClick={() => setExpanded((value) => !value)}><span>Tàu & đội tàu</span><span aria-hidden="true">{expanded ? '⌄' : '›'}</span></button>
          <div id="ship-deck-cabin-menu" className={styles.children} hidden={!expanded}>
            {([['ships', 'Ship'], ['decks', 'Deck'], ['cabins', 'Cabin']] as const).map(([path, label]) => <NavLink key={path} to={`/admin/${path}`} className={({ isActive }) => `${styles.child} ${isActive && !isRegulation ? styles.childActive : ''}`}>{label}</NavLink>)}
          </div>
        </div>
        <span className={styles.navItem} aria-disabled="true">Chuyến hải trình</span>
        <NavLink className={isRegulation ? styles.navActive : styles.navItem} to="/admin/regulations">Quy định vận hành</NavLink>
        <span className={styles.navItem} aria-disabled="true">Sự cố vận hành</span>
      </nav>
    </aside>
    <main className={styles.main} id="regulation-main" tabIndex={-1}>{children}</main>
  </div>
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
export function Modal({ title, onClose, busy = false, children }:
  { title: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
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
  return <dialog ref={dialog} aria-labelledby={titleId} className={styles.modal}
    onCancel={(event) => { event.preventDefault(); if (!busyRef.current) close.current() }}>
    <div className={styles.modalHeader}><h2 id={titleId}>{title}</h2><button autoFocus aria-label="Đóng hộp thoại" disabled={busy} className={styles.close} onClick={onClose}>×</button></div>
    {children}
  </dialog>
}
