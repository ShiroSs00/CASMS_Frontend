import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'

import { Badge, Button, DataTable, Empty, Field, Loading, Notice } from '@/shared/ui'

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

const navigation = [
  ['Tổng quan', ''], ['Bookings', ''], ['Check-in', ''], ['Yêu cầu dịch vụ', ''],
  ['Tài khoản', ''], ['Tàu', '/admin/ships'], ['Chuyến', '/admin/cruises'],
  ['Hải trình', '/admin/itineraries'], ['Cảng', '/admin/ports'], ['Điểm đến', '/admin/destinations'],
  ['Quy định', '/admin/regulations'], ['Sự cố', '/admin/issues'], ['Người dùng', ''], ['Báo cáo', ''],
] as const

export function CruiseFrame({ children }: { children: ReactNode }) {
  return <div className={styles.auroraShell}>
    <aside className={styles.auroraSidebar}>
      <Link className={styles.auroraBrand} to="/admin/cruises"><strong>AURORA</strong></Link>
      <span className={styles.brandCaption}>Trung tâm vận hành</span><nav aria-label="Điều hướng quản trị">{navigation.map(([label, href]) => href ? <NavLink className={({ isActive }) => isActive ? styles.auroraNavActive : styles.auroraNav} key={label} to={href}>{label}</NavLink> : <span key={label} className={styles.auroraNav} aria-disabled="true">{label}</span>)}</nav>
    </aside>
    <main className={styles.auroraMain}>
      <header className={styles.auroraTopbar}><span>Tìm kiếm hoặc chạy lệnh…</span><b>Đã đăng nhập</b></header>
      <div className={styles.auroraCanvas}>{children}</div>
    </main>
  </div>
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
    ['DRAFT', result?.metrics.draft, 'chưa publish'],
    ['PUBLISHED', result?.metrics.pendingApproval, 'đang mở'],
    ['IN PROGRESS', result?.metrics.inProgress, 'đang chạy'],
    ['Conflict', result?.metrics.conflict, 'schedule / config'],
  ] as const
  return <div className={styles.metrics} aria-label="Tổng quan cruise trong trang hiện tại">
    {metrics.map(([label, value, hint]) => <div className={styles.metric} key={label}><span>{label}</span><strong className={styles.metricValue}>{value === undefined ? '—' : String(value).padStart(2, '0')}</strong><span>{hint}</span></div>)}
  </div>
}

export function CruiseFilters({ query, ships, onChange, onReset }: {
  query: CruiseQuery
  ships: ShipRecord[]
  onChange: (patch: Partial<CruiseQuery>) => void
  onReset: () => void
}) {
  return <section className={styles.filters} aria-label="Bộ lọc cruise">
    <Field htmlFor="cruise-search" label="Tìm chuyến"><input id="cruise-search" value={query.search} placeholder="Mã / route" disabled title="API danh sách cruise chưa có tham số search" onChange={(event) => onChange({ search: event.target.value })} /></Field>
    <Field htmlFor="cruise-status" label="Trạng thái"><select id="cruise-status" value={query.status} onChange={(event) => onChange({ status: event.target.value as CruiseStatus | '' })}><option value="">Tất cả</option>{Object.entries(cruiseStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
    <Field htmlFor="cruise-type" label="Loại chuyến"><select id="cruise-type" value={query.cruiseType} onChange={(event) => onChange({ cruiseType: event.target.value as CruiseType | '' })}><option value="">Tất cả</option>{Object.entries(cruiseTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
    <Field htmlFor="cruise-ship" label="Tàu"><select id="cruise-ship" value={query.shipId} onChange={(event) => onChange({ shipId: event.target.value })}><option value="">Tất cả</option>{ships.map((ship) => <option value={ship.shipId} key={ship.shipId}>{ship.shipName}</option>)}</select></Field>
    <Field htmlFor="departure-date" label="Ngày khởi hành"><input id="departure-date" type="date" value={query.departureDate} disabled title="API danh sách cruise chưa có bộ lọc ngày" onChange={(event) => onChange({ departureDate: event.target.value })} /></Field>
    <div className={styles.filterActions}><Button onClick={() => onChange({ ...query })}>Áp dụng</Button><Button tone="secondary" onClick={onReset}>Xóa lọc</Button></div>
  </section>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}

export function CruiseTable({ items }: { items: CruiseListItem[] }) {
  return <DataTable label="Danh sách cruise" headers={['Cruise', 'Route', 'Ship', 'Departure', 'Status', 'Readiness']}>
    {items.map((item) => <tr key={item.cruise.cruiseId}>
      <td><Link className={styles.rowLink} to={`/admin/cruises/${item.cruise.cruiseId}`}>{item.cruise.cruiseCode}</Link></td>
      <td>{item.cruise.cruiseName}</td>
      <td>{item.ship?.shipName ?? 'Chưa phân công'}</td>
      <td>{formatDate(item.cruise.departureDatetime)}</td>
      <td><CruiseStatusBadge status={item.cruise.status} /></td>
      <td>{item.readinessSummary ? <span title={item.readinessSummary.issues.join(' · ')}>{item.readinessSummary.ready ? 'READY' : `${item.readinessSummary.issues.length} CẦN KIỂM TRA`}</span> : 'Chưa kiểm tra'}</td>
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
  if (state.status === 'loading') return <Loading label="Đang tải danh sách cruise…" />
  if (state.status === 'error') return <Notice title="Không tải được dữ liệu" tone="error"><p>{state.error}</p><Button onClick={onRetry}>Thử lại</Button></Notice>
  if (!state.data.total) return <Empty title={query.search || query.status || query.cruiseType || query.departureDate || query.shipId ? 'Không có kết quả phù hợp' : 'Chưa có cruise'}><Button tone="secondary" onClick={onReset}>Xóa bộ lọc</Button></Empty>
  return <>
    <CruiseTable items={state.data.items} />
    <div className={styles.pagination}><span>Hiển thị {(state.data.page - 1) * state.data.pageSize + 1}–{Math.min(state.data.page * state.data.pageSize, state.data.total)} trong {state.data.total} chuyến</span><div><Button tone="secondary" disabled={state.data.page <= 1} onClick={() => onPage(state.data.page - 1)}>Trước</Button><span className={styles.pageNumber}>{state.data.page}/{state.data.pageCount}</span><Button tone="secondary" disabled={state.data.page >= state.data.pageCount} onClick={() => onPage(state.data.page + 1)}>Sau</Button></div></div>
  </>
}
