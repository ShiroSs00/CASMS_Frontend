import {
  useId,
  type ReactNode,
} from 'react'
import { AdminShell } from '@/shared/ui/admin-v3'
import { Badge, Button, Loading, Notice, Panel, PageHeader as SharedPageHeader, Field as SharedField, Modal as SharedModal } from '@/shared/ui'
export { Button, Notice, Panel }

import type {
  ConflictResult,
  EffectiveStatus,
  RegulationStatus,
} from '../model/regulation'
import {
  effectiveLabels,
  statusLabels,
} from '../model/regulation'
import styles from './Regulations.module.css'
export function AdminFrame({ children }: { children: ReactNode }) {
  return <AdminShell className={styles.appShell}>{children}</AdminShell>
}
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return <SharedPageHeader title={title} description={description} actions={actions} breadcrumb="VẬN HÀNH / QUY ĐỊNH" />
}

export function Field({ htmlFor, ...props }: { label: string; htmlFor?: string; hint?: string; error?: string; children: ReactNode }) {
  const fallbackId = useId()
  return <div className={styles.field}><SharedField htmlFor={htmlFor ?? fallbackId} {...props} /></div>
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
  const tone = status === 'ACTIVE' || status === 'EFFECTIVE' ? 'success'
    : status === 'DRAFT' || status === 'UPCOMING' ? 'info' : 'neutral'
  return <Badge label={label??'Chưa xác định'} tone={tone} />
}

export function TableScroll({ children }: { children: ReactNode }) {
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Danh sách quy định">{children}</div>
}

export function LoadingPanel({ label = 'Đang tải quy định…' }: { label?: string }) {
  return <Loading label={label} />
}

export const Modal = SharedModal

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
