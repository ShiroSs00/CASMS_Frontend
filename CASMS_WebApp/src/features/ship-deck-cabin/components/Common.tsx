import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge, Button, Field, Loading, Notice } from '@/shared/ui'
import type { CabinStatus, ShipStatus } from '../model/types'
import { cabinStatuses, shipStatuses } from '../model/types'
import styles from './Management.module.css'

export function InputField({ label, error, hint, ...props }:
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = useId()
  return <Field htmlFor={id} label={label} error={error} hint={hint}><input id={id} aria-invalid={Boolean(error)}
    aria-describedby={error || hint ? `${id}-hint` : undefined} {...props} /></Field>
}
export function SelectField({ label, value, onChange, children, error, disabled, hint }:
  { label: string; value: string; onChange: (value: string) => void; children: ReactNode; error?: string; disabled?: boolean; hint?: string }) {
  const id = useId()
  return <Field htmlFor={id} label={label} error={error} hint={hint}><select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}
    aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${id}-hint` : undefined}>{children}</select></Field>
}
export function StatusBadge({ status }: { status: ShipStatus | CabinStatus }) {
  return <Badge label={status === 'ACTIVE' || status === 'INACTIVE' ? shipStatuses[status] : cabinStatuses[status]}
    tone={status === 'ACTIVE' || status === 'AVAILABLE' ? 'success' : status === 'MAINTENANCE' ? 'warning' : status === 'OCCUPIED' ? 'info' : 'neutral'} />
}
export function Definition({ rows }: { rows: Array<[string, ReactNode]> }) {
  return <dl className={styles.definition}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}
export function DataState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <Loading />
  if (error) return <Notice title="Không tải được dữ liệu" tone="error"><p>{error}</p><Button tone="secondary" onClick={retry}>Thử lại</Button></Notice>
  return null
}
export function NotFound({ back }: { back: string }) {
  return <Notice title="Không tìm thấy dữ liệu" tone="error"><p>Đối tượng không tồn tại hoặc đã được xóa khỏi hệ thống.</p><Link to={back} className={styles.link}>Về danh sách</Link></Notice>
}
