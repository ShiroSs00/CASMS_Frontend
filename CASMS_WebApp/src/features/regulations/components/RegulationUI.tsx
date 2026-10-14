import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'

import type {
  ConflictResult,
  EffectiveStatus,
  RegulationStatus,
} from '../model/regulation'
import {
  effectiveLabels,
  statusLabels,
} from '../model/regulation'
import { buildPaginationRange } from '../../../shared/pagination.ts'
import styles from './Regulations.module.css'
import { AdminFrame as SharedAdminFrame } from '@/shared/ui'

export function AdminFrame({ children }: { children: ReactNode }) {
  return <SharedAdminFrame className={styles.appShell}>{children}</SharedAdminFrame>
}
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.breadcrumb}>VẬN HÀNH&nbsp;&nbsp; / &nbsp;&nbsp;QUY ĐỊNH</div>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </header>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'danger' | 'text'
}

export function Button({
  tone = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[`button_${tone}`]} ${className}`}
      type={type}
      {...props}
    />
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <span className={styles.fieldError} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className={styles.fieldHint}>{hint}</span>
      ) : null}
    </div>
  )
}

export function Notice({
  title,
  children,
  tone = 'info',
  role,
}: {
  title: string
  children: ReactNode
  tone?: 'info' | 'success' | 'warning' | 'error' | 'neutral'
  role?: 'alert' | 'status'
}) {
  return (
    <div className={`${styles.notice} ${styles[`notice_${tone}`]}`} role={role}>
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  )
}

export function StatusBadge({
  status,
}: {
  status: RegulationStatus | EffectiveStatus
}) {
  const label =
    status in statusLabels
      ? statusLabels[status as RegulationStatus]
      : effectiveLabels[status as EffectiveStatus]
  return (
    <span className={`${styles.badge} ${styles[`badge_${status.toLowerCase()}`]}`}>
      {label}
    </span>
  )
}

export function Panel({
  title,
  subtitle,
  children,
}: {
  title?: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className={styles.panel}>
      {title ? <h2>{title}</h2> : null}
      {subtitle ? <p className={styles.panelSubtitle}>{subtitle}</p> : null}
      {children}
    </section>
  )
}

export function TableScroll({ children }: { children: ReactNode }) {
  return <div className={styles.tableScroll}>{children}</div>
}

export function LoadingPanel({ label = 'Đang tải quy định…' }: { label?: string }) {
  return (
    <div className={styles.loadingPanel} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <strong>{label}</strong>
      <span>Vui lòng chờ trong giây lát.</span>
    </div>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  start,
  end,
  pageSizeOptions,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageSize: number
  total: number
  totalPages: number
  start: number
  end: number
  pageSizeOptions?: readonly number[]
  itemLabel: string
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}) {
  const pageRange = buildPaginationRange(page, totalPages)

  return (
    <nav className={styles.pagination} aria-label={`Phân trang ${itemLabel}`}>
      <span aria-live="polite" className={styles.paginationSummary}>
        {start}–{end} / {total} {itemLabel} · Trang {page}/{totalPages}
      </span>
      <div className={styles.paginationControls}>
        {pageSizeOptions && onPageSizeChange ? (
          <label className={styles.pageSizeControl}>
            <span>Số dòng</span>
            <select
              aria-label={`Số ${itemLabel} mỗi trang`}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              value={pageSize}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          aria-label="Trang trước"
          className={styles.paginationButton}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          Trước
        </button>
        <div className={styles.pageNumbers} aria-label="Chọn trang">
          {pageRange.map((item, index) => item === 'ellipsis' ? (
            <span aria-hidden="true" className={styles.pageEllipsis} key={`ellipsis-${index}`}>…</span>
          ) : (
            <button
              aria-current={item === page ? 'page' : undefined}
              aria-label={`Trang ${item}`}
              className={`${styles.pageNumberButton} ${item === page ? styles.pageNumberActive : ''}`}
              key={item}
              onClick={() => onPageChange(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <button
          aria-label="Trang sau"
          className={styles.paginationButton}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          Sau
        </button>
      </div>
    </nav>
  )
}

export function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className={styles.modalBackdrop} role="presentation">
      <section
        aria-describedby={description ? 'reg-dialog-description' : undefined}
        aria-labelledby="reg-dialog-title"
        aria-modal="true"
        className={`${styles.modal} ${wide ? styles.modalWide : ''}`}
        role="dialog"
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 id="reg-dialog-title">{title}</h2>
            {description ? <p id="reg-dialog-description">{description}</p> : null}
          </div>
          <button
            aria-label="Đóng hộp thoại"
            className={styles.closeButton}
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

export function ConflictCard({ result }: { result: ConflictResult }) {
  const tone =
    result.severity === 'clear'
      ? 'success'
      : result.severity === 'warning'
        ? 'warning'
        : 'error'
  return (
    <Notice title={result.title} tone={tone} role="status">
      <p>{result.message}</p>
      {result.comparedWith.length ? (
        <ul className={styles.conflictList}>
          {result.comparedWith.map((item) => (
            <li key={`${item.code}-${item.source}`}>
              <strong>{item.code}</strong> · {item.source} · {item.content}
            </li>
          ))}
        </ul>
      ) : null}
    </Notice>
  )
}
