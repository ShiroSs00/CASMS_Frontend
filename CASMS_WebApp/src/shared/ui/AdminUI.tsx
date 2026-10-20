import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AdminShell } from './admin-v3'
import styles from './AdminUI.module.css'

export function AdminFrame({ children, className = '', topbar }: { children: ReactNode; className?: string; topbar?: ReactNode }) {
  return <AdminShell className={className} topbar={topbar}>{children}</AdminShell>
}

export function Button({ tone = 'primary', size = 'regular', autoWidth = false, fullWidth = false, className = '', type = 'button', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: 'primary' | 'secondary' | 'danger' | 'text'
    size?: 'regular' | 'compact'
    autoWidth?: boolean
    fullWidth?: boolean
  }) {
  const sizeClass = size === 'compact' ? styles.compact : ''
  const widthClass = fullWidth ? styles.fullWidth : autoWidth ? styles.autoWidth : ''
  return <button type={type} className={`${styles.button} ${styles[tone]} ${sizeClass} ${widthClass} ${className}`.trim()} {...props} />
}
export function ButtonLink({ to, children, tone = 'primary', size = 'regular', autoWidth = false, fullWidth = false, className = '' }: {
  to: string
  children: ReactNode
  tone?: 'primary' | 'secondary' | 'danger'
  size?: 'regular' | 'compact'
  autoWidth?: boolean
  fullWidth?: boolean
  className?: string
}) {
  const sizeClass = size === 'compact' ? styles.compact : ''
  const widthClass = fullWidth ? styles.fullWidth : autoWidth ? styles.autoWidth : ''
  return <Link to={to} className={`${styles.button} ${styles[tone]} ${styles.buttonLink} ${sizeClass} ${widthClass} ${className}`.trim()}>{children}</Link>
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
