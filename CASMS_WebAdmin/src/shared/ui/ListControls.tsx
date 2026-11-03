import type { FormEventHandler, ReactNode } from 'react'
import styles from './ListControls.module.css'

export function ListFilters({ children, actions, onSubmit, label = 'Bộ lọc danh sách', className = '' }: {
  children: ReactNode
  actions: ReactNode
  onSubmit?: FormEventHandler<HTMLFormElement>
  label?: string
  className?: string
}) {
  return <form className={`${styles.filters} ${className}`.trim()} aria-label={label} onSubmit={event => { event.preventDefault(); onSubmit?.(event) }}>
    <div className={styles.fields}>{children}</div>
    <div className={styles.actions}>{actions}</div>
  </form>
}

export function ListFooter({ summary, children }: { summary: ReactNode; children?: ReactNode }) {
  return <div className={styles.footer}>
    <p className={styles.summary} role="status">{summary}</p>
    {children && <nav className={styles.pagination} aria-label="Phân trang danh sách">{children}</nav>}
  </div>
}
