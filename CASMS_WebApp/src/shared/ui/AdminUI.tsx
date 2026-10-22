import { Children, Fragment, cloneElement, isValidElement, useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AdminShell } from './admin-v3'
import styles from './AdminUI.module.css'
export { Modal } from './Overlay'

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
  const segments = breadcrumb.split('/').map(segment => segment.trim()).filter(Boolean)
  return <header className={styles.header}>
    {segments.length > 0 && <nav className={styles.breadcrumb} aria-label="Đường dẫn trang"><ol>{segments.map((segment, index) => <li key={`${segment}-${index}`} aria-current={index === segments.length - 1 ? 'page' : undefined}>{segment}</li>)}</ol></nav>}
    <h1>{title}</h1><p>{description}</p>
    {actions && <div className={styles.actions}>{actions}</div>}
  </header>
}
export function Panel({ title, subtitle, children, className = '', id }: { title?: string; subtitle?: string; children: ReactNode; className?: string; id?: string }) {
  const titleId = useId()
  return <section id={id} className={`${styles.panel} ${className}`.trim()} aria-labelledby={title ? titleId : undefined}>{title && <h2 id={titleId}>{title}</h2>}{subtitle && <p className={styles.muted}>{subtitle}</p>}{children}</section>
}
export function Notice({ title, children, tone = 'info', role }:
  { title: string; children: ReactNode; tone?: 'info' | 'success' | 'warning' | 'error' | 'neutral'; role?: 'alert' | 'status' }) {
  return <div className={`${styles.notice} ${styles[`notice_${tone}`]}`} role={role ?? (tone === 'error' ? 'alert' : 'status')}>
    <strong>{title}</strong><div>{children}</div>
  </div>
}
export function Field({ htmlFor, label, error, hint, children }:
  { htmlFor: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  function connectControls(nodes: ReactNode): ReactNode {
    return Children.map(nodes, child => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) return cloneElement(child, undefined, connectControls(child.props.children))
    if (!isValidElement<{ id?: string; 'aria-describedby'?: string; 'aria-errormessage'?: string; 'aria-invalid'?: boolean | 'true' | 'false'; 'aria-required'?: boolean; required?: boolean }>(child)
      || typeof child.type !== 'string' || !['input', 'select', 'textarea'].includes(child.type)) return child
    const describedBy = new Set((child.props['aria-describedby'] ?? '').split(/\s+/).filter(Boolean))
    if (error || hint) describedBy.add(`${htmlFor}-hint`)
    else describedBy.delete(`${htmlFor}-hint`)
    return cloneElement(child, {
      id: child.props.id ?? htmlFor,
      'aria-invalid': error ? true : child.props['aria-invalid'],
      'aria-describedby': [...describedBy].join(' ') || undefined,
      'aria-errormessage': error ? `${htmlFor}-error` : child.props['aria-errormessage'],
      'aria-required': child.props['aria-required'] ?? (child.props.required || label.trim().endsWith('*') || undefined),
    })
    })
  }
  return <div className={styles.field} data-invalid={Boolean(error)}><label htmlFor={htmlFor}>{label}</label>{connectControls(children)}
    {(hint || error) && <div id={`${htmlFor}-hint`} className={styles.fieldMessages}>
      {hint && <span className={styles.muted}>{hint}</span>}
      {error && <span id={`${htmlFor}-error`} className={styles.error} role="alert">{error}</span>}
    </div>}
  </div>
}
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'info' | 'error' }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{label}</span>
}
export function FormErrorSummary({ errors }: { errors: Record<string, string | undefined> }) {
  const issues = Object.values(errors).filter((message): message is string => Boolean(message))
  const messages = [...new Set(issues)]
  if (issues.length < 2) return null
  return <section className={styles.errorSummary} aria-label="Thông tin cần kiểm tra">
    <strong>Kiểm tra {issues.length} thông tin trước khi lưu</strong>
    <ul>{messages.map(message => <li key={message}>{message}</li>)}</ul>
    <Button tone="text" onClick={event => event.currentTarget.closest('form')?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()}>Đến trường cần kiểm tra</Button>
  </section>
}
export function DataTable({ headers, children, label }: { headers: string[]; children: ReactNode; label: string }) {
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={label}>
    <table className={styles.table}><caption className={styles.srOnly}>{label}</caption><thead><tr>{headers.map((header, index) => <th scope="col" key={`${header}-${index}`}>{header || <span className={styles.srOnly}>Thao tác</span>}</th>)}</tr></thead><tbody>{children}</tbody></table>
  </div>
}
export function Loading({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return <div className={styles.empty} role="status"><span className={styles.spinner} aria-hidden="true" /><strong>{label}</strong></div>
}
export function Empty({ title = 'Không có kết quả phù hợp', children }: { title?: string; children?: ReactNode }) {
  return <div className={styles.empty}><strong>{title}</strong>{children}</div>
}
