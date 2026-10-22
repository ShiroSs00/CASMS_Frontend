import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Badge, Button, DataTable, Empty, Field, Loading, Notice } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'

import type { CruiseQuery } from '../model/cruise-query'
import type { CruiseStatus, CruiseType, ShipRecord } from '../model/cruise-record'
import type { CruiseListState } from '../hooks/useCruiseList'
import {
  cruiseStatusLabels,
  cruiseTypeLabels,
  type CruiseListItem,
  type CruiseListResult,
} from '../model/cruise-view'
import styles from './Cruises.module.css'

export function CruiseFrame({ children }: { children: ReactNode }) {
  return <AdminShell><div className={styles.cruiseShell}>{children}</div></AdminShell>
}

function statusTone(status: CruiseStatus) {
  if (status === 'PUBLISHED' || status === 'COMPLETED') return 'success' as const
  if (status === 'IN_PROGRESS') return 'info' as const
  if (status === 'CANCELLED') return 'error' as const
  return 'warning' as const
}

export function CruiseStatusBadge({ status }: { status: CruiseStatus }) {
  return <Badge label={cruiseStatusLabels[status]} tone={statusTone(status)} />
}

export function CruiseMetrics({ result }: { result: CruiseListResult | null }) {
  const metrics = [
    [cruiseStatusLabels.DRAFT, result?.metrics.draft, 'chưa phát hành'],
    [cruiseStatusLabels.PUBLISHED, result?.metrics.published, 'đang mở'],
    [cruiseStatusLabels.IN_PROGRESS, result?.metrics.inProgress, 'đang chạy'],
    ['Xung đột', result?.metrics.conflict, 'lịch trình / cấu hình'],
  ] as const
  return <div className={styles.metrics} aria-label="Tổng quan chuyến trong trang hiện tại">
    {metrics.map(([label, value, hint]) => <div className={styles.metric} key={label}><span>{label}</span><strong className={styles.metricValue}>{value === undefined ? '—' : String(value).padStart(2, '0')}</strong><span>{hint}</span></div>)}
  </div>
}

export function CruiseFilters({ query, ships, onChange, onReset }: {
  query: CruiseQuery
  ships: ShipRecord[]
  onChange: (patch: Partial<CruiseQuery>) => void
  onReset: () => void
}) {
  return <section className={styles.filters} aria-label="Bộ lọc chuyến">
    <Field htmlFor="cruise-search" label="Tìm chuyến"><input id="cruise-search" value={query.search} placeholder="Mã / hành trình" disabled title="Chưa hỗ trợ tìm chuyến theo tên hoặc mã." onChange={(event) => onChange({ search: event.target.value })} /></Field>
    <Field htmlFor="cruise-status" label="Trạng thái"><select id="cruise-status" value={query.status} onChange={(event) => onChange({ status: event.target.value as CruiseStatus | '' })}><option value="">Tất cả</option>{Object.entries(cruiseStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
    <Field htmlFor="cruise-type" label="Loại chuyến"><select id="cruise-type" value={query.cruiseType} onChange={(event) => onChange({ cruiseType: event.target.value as CruiseType | '' })}><option value="">Tất cả</option>{Object.entries(cruiseTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
    <Field htmlFor="cruise-ship" label="Tàu"><select id="cruise-ship" value={query.shipId} onChange={(event) => onChange({ shipId: event.target.value })}><option value="">Tất cả</option>{ships.map((ship) => <option value={ship.shipId} key={ship.shipId}>{ship.shipName}</option>)}</select></Field>
    <Field htmlFor="departure-date" label="Ngày khởi hành"><input id="departure-date" type="date" value={query.departureDate} disabled title="Chưa hỗ trợ lọc theo ngày khởi hành." onChange={(event) => onChange({ departureDate: event.target.value })} /></Field>
    <div className={styles.filterActions}><Button onClick={() => onChange({ ...query })}>Áp dụng</Button><Button tone="secondary" onClick={onReset}>Xóa lọc</Button></div>
  </section>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone:'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}

export function CruiseTable({ items }: { items: CruiseListItem[] }) {
  return <DataTable label="Danh sách chuyến" headers={['Mã chuyến', 'Hành trình', 'Tàu', 'Khởi hành', 'Trạng thái', 'Sẵn sàng']}>
    {items.map((item) => <tr key={item.cruise.cruiseId}>
      <td><Link className={styles.rowLink} to={`/admin/cruises/${item.cruise.cruiseId}`}>{item.cruise.cruiseCode}</Link></td>
      <td>{item.cruise.cruiseName}</td>
      <td>{item.ship?.shipName ?? (item.cruise.shipId ? 'Chưa tải được thông tin tàu' : 'Chưa phân công')}</td>
      <td>{formatDate(item.cruise.departureDatetime)}</td>
      <td><CruiseStatusBadge status={item.cruise.status} /></td>
      <td>{item.readinessSummary ? <span title={item.readinessSummary.issues.join(' · ')}>{item.readinessSummary.ready ? 'Sẵn sàng' : `${item.readinessSummary.issues.length} CẦN KIỂM TRA`}</span> : 'Chưa kiểm tra'}</td>
    </tr>)}
  </DataTable>
}

export function CruiseListContent({ state, query, onPage, onReset, onRetry }: {
  state: CruiseListState
  query: CruiseQuery
  onPage: (page: number) => void
  onReset: () => void
  onRetry: () => void
}) {
  if (state.status === 'loading') return <Loading label="Đang tải danh sách chuyến…" />
  if (state.status === 'error') return <Notice title="Không tải được dữ liệu" tone="error"><p>{state.error}</p><Button onClick={onRetry}>Thử lại</Button></Notice>
  if (!state.data.total) return <Empty title={query.search || query.status || query.cruiseType || query.departureDate || query.shipId ? 'Không có kết quả phù hợp' : 'Chưa có chuyến'}><Button tone="secondary" onClick={onReset}>Xóa bộ lọc</Button></Empty>
  return <>
    <CruiseTable items={state.data.items} />
    <div className={styles.pagination}><span>Hiển thị {(state.data.page - 1) * state.data.pageSize + 1}–{Math.min(state.data.page * state.data.pageSize, state.data.total)} trong {state.data.total} chuyến</span><div><Button tone="secondary" disabled={state.data.page <= 1} onClick={() => onPage(state.data.page - 1)}>Trước</Button><span className={styles.pageNumber}>{state.data.page}/{state.data.pageCount}</span><Button tone="secondary" disabled={state.data.page >= state.data.pageCount} onClick={() => onPage(state.data.page + 1)}>Sau</Button></div></div>
  </>
}
