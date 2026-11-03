import { PermissionLink as Link } from '@/shared/ui'
import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

import { Badge, Field, Loading, Notice, RecordFacts } from '@/shared/ui'
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
  return <Badge label={status in shipStatuses ? shipStatuses[status as ShipStatus] : cabinStatuses[status as CabinStatus]}
    tone={status === 'READY' || status === 'IN_SERVICE' || status === 'AVAILABLE' ? 'success' : status === 'MAINTENANCE' ? 'warning' : status === 'OCCUPIED' ? 'info' : 'neutral'} />
}
export function Definition({ rows }: { rows: Array<[string, ReactNode]> }) {
  return <RecordFacts entries={rows} />
}
export function DataState({ loading, error }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <Loading />
  if (error) return <Notice title="Không tải được dữ liệu" tone="error"><p>{error}</p></Notice>
  return null
}
export function NotFound({ back }: { back: string }) {
  return <Notice title="Không tìm thấy dữ liệu" tone="error"><p>Đối tượng không tồn tại hoặc đã được xóa khỏi hệ thống.</p><Link to={back} className={styles.link}>Về danh sách</Link></Notice>
}
