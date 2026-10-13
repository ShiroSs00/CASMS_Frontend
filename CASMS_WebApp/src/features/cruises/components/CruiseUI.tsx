import { Link } from 'react-router'

import { Badge, Button, DataTable, Empty, Field, Loading, Notice } from '@/shared/ui'

import type { CruiseQuery } from '../model/cruise-query'
import type { CruiseStatus, CruiseType, ShipRecord } from '../model/cruise-record'
import type { CruiseListState } from '../hooks/useCruiseList'
import {
  cruiseStatusLabels,
  cruiseTypeLabels,
  itineraryStatusLabels,
  type CruiseListItem,
  type CruiseListResult,
} from '../model/cruise-view'
import styles from './Cruises.module.css'

export function CruiseTopbar() {
  return <><span>Chuyến được phân công: CASMS Aurora · 20/11/2026</span><span>Nhân viên vận hành &nbsp;&nbsp; Tài khoản ▾</span></>
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

export function CruiseMetrics({ result }: { result: CruiseListResult }) {
  const metrics = [
    ['CHUYẾN NHÁP', result.metrics.draft, 'neutral'],
    ['CHỜ DUYỆT', result.metrics.pendingApproval, 'warning'],
    ['MỞ BÁN', result.metrics.openForSale, 'success'],
    ['ĐANG VẬN HÀNH', result.metrics.inProgress, 'info'],
  ] as const
  return <section className={styles.metrics} aria-label="Tổng quan cruise">
    {metrics.map(([label, value, tone]) => <div className={styles.metric} key={label}><span>{label}</span><Badge label={String(value)} tone={tone} /></div>)}
  </section>
}

export function CruiseFilters({ query, ships, onChange, onReset }: {
  query: CruiseQuery
  ships: ShipRecord[]
  onChange: (patch: Partial<CruiseQuery>) => void
  onReset: () => void
}) {
  return <section className={styles.filters} aria-label="Bộ lọc cruise">
    <Field htmlFor="cruise-search" label="Tìm chuyến"><input id="cruise-search" value={query.search} placeholder="Mã hoặc tên cruise" onChange={(event) => onChange({ search: event.target.value })} /></Field>
    <Field htmlFor="cruise-status" label="Trạng thái"><select id="cruise-status" value={query.status} onChange={(event) => onChange({ status: event.target.value as CruiseStatus | '' })}><option value="">Tất cả</option>{Object.entries(cruiseStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
    <Field htmlFor="cruise-type" label="Loại chuyến"><select id="cruise-type" value={query.cruiseType} onChange={(event) => onChange({ cruiseType: event.target.value as CruiseType | '' })}><option value="">Tất cả</option>{Object.entries(cruiseTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
    <Field htmlFor="cruise-ship" label="Tàu"><select id="cruise-ship" value={query.shipId} onChange={(event) => onChange({ shipId: event.target.value })}><option value="">Tất cả</option><option value="UNASSIGNED">Chưa phân công</option>{ships.map((ship) => <option value={ship.shipId} key={ship.shipId}>{ship.shipName}</option>)}</select></Field>
    <Field htmlFor="departure-date" label="Ngày khởi hành"><input id="departure-date" type="date" value={query.departureDate} onChange={(event) => onChange({ departureDate: event.target.value })} /></Field>
    <div className={styles.filterActions}><Button onClick={() => onChange({ ...query })}>Áp dụng</Button><Button tone="secondary" onClick={onReset}>Xóa lọc</Button></div>
  </section>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}

export function CruiseTable({ items }: { items: CruiseListItem[] }) {
  return <DataTable label="Danh sách cruise" headers={['Cruise', 'Ngày', 'Loại', 'Tàu', 'Hải trình', 'Trạng thái', 'Bán', '']}>
    {items.map((item) => <tr key={item.cruise.cruiseId}>
      <td><strong>{item.cruise.cruiseCode}</strong><div className={styles.muted}>{item.cruise.cruiseName}</div></td>
      <td>{formatDate(item.cruise.departureDatetime)}–{formatDate(item.cruise.returnDatetime)}</td>
      <td>{cruiseTypeLabels[item.cruise.cruiseType]}</td>
      <td>{item.ship?.shipName ?? 'Chưa phân công'}</td>
      <td>{item.itinerary?.itineraryName ?? 'Chưa có'} </td>
      <td><CruiseStatusBadge status={item.cruise.status} /></td>
      <td>{item.itinerary ? <Badge label={itineraryStatusLabels[item.itinerary.status]} tone={item.itinerary.status === 'OPEN_FOR_SALE' ? 'success' : 'neutral'} /> : '—'}</td>
      <td><Link className={styles.rowLink} to={`/admin/cruises/${item.cruise.cruiseId}`}>Mở →</Link></td>
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
