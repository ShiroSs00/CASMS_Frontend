import { Children, Fragment, cloneElement, isValidElement, useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { PermissionLink } from './PermissionLink'
import styles from './Primitives.module.css'
export { Modal } from './Overlay'

export function Button({ tone = 'primary', size = 'regular', autoWidth = false, fullWidth = false, className = '', type = 'button', busy = false, disabled, children, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: 'primary' | 'secondary' | 'danger' | 'text'
    busy?: boolean
    size?: 'regular' | 'compact'
    autoWidth?: boolean
    fullWidth?: boolean
  }) {
  const sizeClass = size === 'compact' ? styles.compact : ''
  const widthClass = fullWidth ? styles.fullWidth : autoWidth ? styles.autoWidth : ''
  return <button type={type} className={`${styles.button} ${styles[tone]} ${sizeClass} ${widthClass} ${className}`.trim()} {...props} disabled={disabled || busy} aria-busy={busy || props['aria-busy']}>
    {busy && <span className={styles.btnSpinner} aria-hidden="true" />}
    {children}
  </button>
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
  return <PermissionLink hideWhenDenied to={to} className={`${styles.button} ${styles[tone]} ${styles.buttonLink} ${sizeClass} ${widthClass} ${className}`.trim()}>{children}</PermissionLink>
}
export function PageHeader({ title, description, breadcrumb, breadcrumbItems, actions }:
  { title: string; description?: string; breadcrumb: string; breadcrumbItems?: ReadonlyArray<{ label: string; to?: string }>; actions?: ReactNode }) {
  const items: ReadonlyArray<{ label: string; to?: string }> = breadcrumbItems ?? breadcrumb.split('/').map(segment => segment.trim()).filter(Boolean).map(label => ({ label }))
  return <header className={styles.header}>
    {items.length > 0 && <nav className={styles.breadcrumb} aria-label="Đường dẫn trang"><ol>{items.map((item, index) => {
      const isLast = index === items.length - 1
      return <li key={`${item.label}-${index}`} aria-current={isLast ? 'page' : undefined}>{!isLast && item.to ? <Link to={item.to}>{item.label}</Link> : item.label}</li>
    })}</ol></nav>}
    <div className={styles.headerBody}><div className={styles.headerCopy}><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  </header>
}
export function Panel({ title, subtitle, children, className = '', id }: { title?: string; subtitle?: string; children: ReactNode; className?: string; id?: string }) {
  const titleId = useId()
  return <section id={id} className={`${styles.panel} ${className}`.trim()} aria-labelledby={title ? titleId : undefined}>{(title || subtitle) && <div className={styles.panelHeading}>{title && <h2 id={titleId}>{title}</h2>}{subtitle && <p className={styles.muted}>{subtitle}</p>}</div>}{children}</section>
}
export function Notice({ title, children, tone = 'neutral', role }:
  { title: string; children: ReactNode; tone?: 'info' | 'success' | 'warning' | 'error' | 'neutral'; role?: 'alert' | 'status' }) {
  return <div className={`${styles.notice} ${styles[`notice_${tone}`]}`} role={role ?? (tone === 'error' ? 'alert' : 'status')}>
    <span className={styles.noticeIcon} aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {tone === 'warning'
        ? <><path d="M12 3.5 2.8 19a1.2 1.2 0 0 0 1 1.8h16.4a1.2 1.2 0 0 0 1-1.8L12 3.5Z" /><path d="M12 9.5v4.5m0 3.2h.01" /></>
        : <><circle cx="12" cy="12" r="9" />{tone === 'success' ? <path d="m8 12 3 3 5-6" /> : tone === 'error' ? <path d="m9 9 6 6m0-6-6 6" /> : <path d="M12 11v5m0-8h.01" />}</>}
    </svg></span>
    <div className={styles.noticeContent}><strong>{title}</strong><div>{children}</div></div>
  </div>
}
function connectFieldControls(nodes: ReactNode, htmlFor: string, label: string, hint: string | undefined, error: string | undefined, state: { bound: boolean }): ReactNode {
  return Children.map(nodes, child => {
    if (!isValidElement<{ id?: string; children?: ReactNode; 'aria-describedby'?: string; 'aria-errormessage'?: string; 'aria-invalid'?: boolean | 'true' | 'false'; 'aria-required'?: boolean; required?: boolean }>(child)) return child
    if (child.type === Fragment || (typeof child.type === 'string' && !['input', 'select', 'textarea'].includes(child.type) && child.props.children !== undefined)) {
      return cloneElement(child, undefined, connectFieldControls(child.props.children, htmlFor, label, hint, error, state))
    }
    if (typeof child.type !== 'string' || !['input', 'select', 'textarea'].includes(child.type)) return child
    const describedBy = new Set((child.props['aria-describedby'] ?? '').split(/\s+/).filter(Boolean))
    if (hint) describedBy.add(`${htmlFor}-hint`)
    else describedBy.delete(`${htmlFor}-hint`)
    if (error) describedBy.add(`${htmlFor}-error`)
    else describedBy.delete(`${htmlFor}-error`)
    const assignId = !state.bound ? (child.props.id ?? htmlFor) : child.props.id
    state.bound = true
    return cloneElement(child, {
      id: assignId,
      'aria-invalid': error ? true : child.props['aria-invalid'],
      'aria-describedby': [...describedBy].join(' ') || undefined,
      'aria-required': child.props['aria-required'] ?? (child.props.required || label.trim().endsWith('*') || undefined),
    })
  })
}
export function Field({ htmlFor, label, error, hint, children }:
  { htmlFor: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return <div className={styles.field} data-invalid={Boolean(error)}><label htmlFor={htmlFor}>{label}</label>{connectFieldControls(children, htmlFor, label, hint, error, { bound: false })}
    {(hint || error) && <div className={styles.fieldMessages}>
      {hint && <span id={`${htmlFor}-hint`} className={styles.muted}>{hint}</span>}
      {error && <span id={`${htmlFor}-error`} className={styles.error}>{error}</span>}
    </div>}
  </div>
}
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'info' | 'error' }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{label}</span>
}
export function FormErrorSummary({ errors }: { errors: Record<string, string | undefined> }) {
  const issues = Object.values(errors).filter((message): message is string => Boolean(message))
  const messages = [...new Set(issues)]
  if (issues.length === 0) return null
  return <section className={styles.errorSummary} role="alert" tabIndex={-1} aria-label="Thông tin cần kiểm tra">
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
  return <div className={`${styles.empty} ${styles.loadingState}`} role="status"><span className={styles.spinner} aria-hidden="true" /><strong>{label}</strong><div className={styles.loadingLines} aria-hidden="true"><span /><span /></div></div>
}
export function Empty({ title = 'Không có kết quả phù hợp', children }: { title?: string; children?: ReactNode }) {
  return <div className={styles.empty}><span className={styles.emptyMark} aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4zM4 14h5l2 3h2l2-3h5M8 8h8" /></svg></span><strong>{title}</strong>{children}</div>
}
