import { PermissionLink as Link } from '@/shared/ui'
import type { ReactNode } from 'react'


import { Badge, Button, DataTable, Empty, Field, Loading, Notice } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { useSessionAccess } from '@/shared/auth'
import managerStyles from './ManagerWorkspace.module.css'

import { serializeCruiseQuery } from '../model/cruise-query'
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
  const access = useSessionAccess()
  const manager = access.roles.includes('CRUISE_MANAGER') && !access.roles.includes('OPERATIONS_MANAGER')
  return <AdminShell><div className={`${styles.cruiseShell} ${manager ? managerStyles.managerRoot : ''}`}>{children}</div></AdminShell>
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
    [cruiseStatusLabels.PUBLISHED, result?.metrics.published, 'đã phát hành lần khởi hành'],
    [cruiseStatusLabels.IN_PROGRESS, result?.metrics.inProgress, 'đang chạy'],
    ['Cần xử lý', result?.metrics.conflict, 'chưa đạt kiểm tra vận hành'],
  ] as const
  return <div className={styles.metrics} aria-label="Tổng quan chuyến trong trang hiện tại">
    {metrics.map(([label, value, hint]) => <div className={styles.metric} key={label}><span>{label}</span><strong className={styles.metricValue}>{value === undefined ? '—' : String(value)}</strong><span>{hint}</span></div>)}
  </div>
}

export function CruiseFilters({ query, ships, onChange, onReset, bookingOnly=false }: {
  bookingOnly?: boolean
  query: CruiseQuery
  ships: ShipRecord[]
  onChange: (patch: Partial<CruiseQuery>) => void
  onReset: () => void
}) {
  return <section className={styles.filters} aria-label="Bộ lọc chuyến">
    {bookingOnly ? <Field htmlFor="cruise-status" label="Trạng thái bán"><select id="cruise-status" value="OPEN_FOR_SALE" disabled><option value="OPEN_FOR_SALE">Đang mở bán</option></select></Field> : <Field htmlFor="cruise-status" label="Trạng thái"><select id="cruise-status" value={query.status} onChange={(event) => onChange({ status: event.target.value as CruiseStatus | '' })}><option value="">Tất cả</option>{Object.entries(cruiseStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>}
    <Field htmlFor="cruise-type" label="Loại chuyến"><select id="cruise-type" value={query.cruiseType} onChange={(event) => onChange({ cruiseType: event.target.value as CruiseType | '' })}><option value="">Tất cả</option>{Object.entries(cruiseTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
    <Field htmlFor="cruise-ship" label="Tàu"><select id="cruise-ship" value={query.shipId} onChange={(event) => onChange({ shipId: event.target.value })}><option value="">Tất cả</option><option value="UNASSIGNED">Chưa phân công tàu</option>{ships.map((ship) => <option value={ship.shipId} key={ship.shipId}>{ship.shipName}</option>)}</select></Field>
    <div className={styles.filterActions}><Button tone="secondary" onClick={onReset}>Xóa lọc</Button></div>
  </section>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone:'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}

export function CruiseTable({ items, returnTo='/admin/cruises', bookingOnly=false }: { items: CruiseListItem[]; returnTo?:string; bookingOnly?:boolean }) {
  return <DataTable label="Danh sách lần khởi hành" headers={['Mã lần khởi hành', 'Tên lần khởi hành', 'Tàu', 'Khởi hành', ...(bookingOnly?['Trạng thái bán']:['Trạng thái', 'Kiểm tra vận hành'])]}>
    {items.map((item) => <tr key={item.cruise.cruiseId}>
      <td><Link className={styles.rowLink} to={`/admin/cruises/${item.cruise.cruiseId}?${new URLSearchParams({returnTo})}`}>{item.cruise.cruiseCode}</Link></td>
      <td>{item.cruise.cruiseName}</td>
      <td>{item.ship?.shipName ?? (item.cruise.shipId ? 'Chưa tải được thông tin tàu' : 'Chưa phân công')}</td>
      <td>{formatDate(item.cruise.departureDatetime)}</td>
      <td>{bookingOnly?<Badge label="Đang mở bán" tone="success"/>:<CruiseStatusBadge status={item.cruise.status} />}</td>
      {!bookingOnly&&<td>{item.readinessSummary ? <span title={item.readinessSummary.issues.join(' · ')}>{item.readinessSummary.ready ? 'Đạt kiểm tra vận hành' : `${item.readinessSummary.issues.length} điều kiện cần xử lý`}</span> : 'Chưa kiểm tra'}</td>}
    </tr>)}
  </DataTable>
}

export function CruiseListContent({ state, query, onPage, onReset, onRetry, bookingOnly=false }: {
  bookingOnly?: boolean
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
    <CruiseTable items={state.data.items} returnTo={'/admin/cruises?'+serializeCruiseQuery(query)} bookingOnly={bookingOnly} />
    <div className={styles.pagination}><span>Hiển thị {(state.data.page - 1) * state.data.pageSize + 1}–{Math.min(state.data.page * state.data.pageSize, state.data.total)} trong {state.data.total} chuyến</span><div><Button tone="secondary" disabled={state.data.page <= 1} onClick={() => onPage(state.data.page - 1)}>Trước</Button><span className={styles.pageNumber}>{state.data.page}/{state.data.pageCount}</span><Button tone="secondary" disabled={state.data.page >= state.data.pageCount} onClick={() => onPage(state.data.page + 1)}>Sau</Button></div></div>
  </>
}
