import type { ReactNode } from 'react'
import { Badge, Notice } from './AdminUI'

/** Presentation only: callers supply the status returned or derived by their existing policy. */
export function SectionStatus({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'info' | 'error' }) {
  return <Badge label={label} tone={tone} />
}

export function ReadinessIndicator({ state }: { state: 'READY' | 'BLOCKED' | 'UNKNOWN' }) {
  const status = state === 'READY' ? { label: 'Đạt kiểm tra vận hành', tone: 'success' as const }
    : state === 'BLOCKED' ? { label: 'Còn điều kiện cần xử lý', tone: 'warning' as const }
    : { label: 'Chưa thể xác minh', tone: 'neutral' as const }
  return <SectionStatus {...status} />
}

export function ActionGuardReason({ children }: { children: ReactNode }) {
  return <Notice title="Chưa thể thực hiện" tone="warning">{children}</Notice>
}

export function UnknownData({ children = 'Chưa xác định' }: { children?: ReactNode }) {
  return <span>{children}</span>
}

export function EvidencePreview({ value }: { value: string | null | undefined }) {
  return <p>{value || <UnknownData>Chưa có bằng chứng được trả về</UnknownData>}</p>
}
