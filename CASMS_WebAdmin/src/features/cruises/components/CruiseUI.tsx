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
  return <AdminShell><div className={`${styles.cruiseShell} ${manager ? managerStyles.managerRoot : access.roles.includes('OPERATIONS_MANAGER')?managerStyles.operationsRoot:''}`}>{children}</div></AdminShell>
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
    [cruiseStatusLabels.PUBLISHED, result?.metrics.published, 'đã phát hành chuyến khởi hành'],
    [cruiseStatusLabels.IN_PROGRESS, result?.metrics.inProgress, 'đang chạy'],
    ['Cần xử lý', result?.metrics.conflict, 'chưa đạt kiểm tra vận hành'],
  ] as const
  return <div className={styles.metrics} aria-label="Tổng quan chuyến trong trang hiện tại">
    {metrics.map(([label, value, hint]) => <div className={styles.metric} key={label}><span>{label}</span><strong className={styles.metricValue}>{value === undefined ? '—' : String(value)}</strong><span>{hint}</span></div>)}
  </div>
}

function effectiveCruiseBadge(item: CruiseListItem): { label: string; tone: 'neutral' | 'success' | 'warning' | 'info' | 'error' } {
  const { cruise, itinerary, planStatus, readyStatus } = item
  if (cruise.status === 'PUBLISHED') {
    if (cruise.stoppedAt) return { label: 'Đã dừng bán', tone: 'error' }
    if (cruise.openedForSaleAt) return { label: 'Đang mở bán', tone: 'success' }
    return { label: 'Đã công bố', tone: 'success' }
  }
  if (cruise.status === 'DRAFT') {
    if (readyStatus === 'READY') return { label: 'Sẵn sàng mở bán', tone: 'success' }
    if (planStatus === 'SUBMITTED' || itinerary?.status === 'PENDING_APPROVAL') return { label: 'Chờ OPS xét duyệt', tone: 'info' }
    if (planStatus === 'APPROVED' || itinerary?.status === 'APPROVED') return { label: 'Đã duyệt · Chờ mở bán', tone: 'success' }
    if (planStatus === 'REVISION_REQUESTED') return { label: 'Cần bổ sung hồ sơ', tone: 'warning' }
    if (planStatus === 'REJECTED' || itinerary?.status === 'REJECTED') return { label: 'Hồ sơ bị từ chối', tone: 'error' }
    if (itinerary?.status === 'OPEN_FOR_SALE') return { label: 'Đang mở bán', tone: 'success' }
  }
  return { label: cruiseStatusLabels[cruise.status], tone: statusTone(cruise.status) }
}

export function CruiseFilters({ query, ships, onChange, onReset, bookingOnly=false }: {
  bookingOnly?: boolean
  query: CruiseQuery
  ships: ShipRecord[]
  onChange: (patch: Partial<CruiseQuery>) => void
  onReset: () => void
}) {
  const hasFilters = Boolean(query.search || query.status || query.cruiseType || query.departureDate || query.shipId)
  return <section className={styles.filters} aria-label="Bộ lọc chuyến">
    {bookingOnly ? <div className={styles.saleFilterState}><span>Trạng thái bán</span><Badge label="Đang nhận đặt chỗ" tone="success"/></div> : <Field htmlFor="cruise-status" label="Trạng thái chuyến"><select id="cruise-status" value={query.status} onChange={(event) => onChange({ status: event.target.value as CruiseStatus | '' })}><option value="">Tất cả</option>{Object.entries(cruiseStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>}
    <Field htmlFor="cruise-type" label="Loại chuyến"><select id="cruise-type" value={query.cruiseType} onChange={(event) => onChange({ cruiseType: event.target.value as CruiseType | '' })}><option value="">Tất cả</option>{Object.entries(cruiseTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
    <Field htmlFor="cruise-ship" label="Tàu"><select id="cruise-ship" value={query.shipId} onChange={(event) => onChange({ shipId: event.target.value })}><option value="">Tất cả</option><option value="UNASSIGNED">Chưa phân công tàu</option>{ships.map((ship) => <option value={ship.shipId} key={ship.shipId}>{ship.shipName}</option>)}</select></Field>
    <div className={styles.filterActions}><Button tone="secondary" disabled={!hasFilters} onClick={onReset}>Xóa bộ lọc</Button></div>
  </section>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone:'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}

function CruiseRoute({ item }: { item: CruiseListItem }) {
  return <div className={styles.listRoute}>
    <div><span>Đi</span> {item.departurePort.portName || 'Chưa rõ cảng đi'}</div>
    <div><span>Đến</span> {item.returnPort.portName || 'Chưa rõ cảng cuối'}</div>
  </div>
}

export function CruiseTable({ items, returnTo='/admin/cruises', bookingOnly=false }: { items: CruiseListItem[]; returnTo?:string; bookingOnly?:boolean }) {
  return <div className={styles.cruiseResults}>
    <DataTable label="Danh sách chuyến khởi hành" headers={['Chuyến khởi hành', 'Tuyến đi', 'Ngày khởi hành', 'Tàu', bookingOnly?'Trạng thái bán':'Trạng thái']}>
      {items.map((item) => {
        const shipName = item.ship?.shipName ?? (item.cruise.shipId ? 'Chưa tải được thông tin tàu' : 'Chưa chọn tàu')
        const departure = <time dateTime={item.cruise.departureDatetime}>{formatDate(item.cruise.departureDatetime)}</time>
        const badge = effectiveCruiseBadge(item)
        return <tr key={item.cruise.cruiseId}>
          <td>
            <div className={styles.tripCell}><Link className={styles.rowLink} to={`/admin/cruises/${item.cruise.cruiseId}?${new URLSearchParams({returnTo})}`}>{item.cruise.cruiseName}</Link><span>{item.cruise.cruiseCode}</span></div>
            <div className={styles.compactTourInfo}>
              <CruiseRoute item={item} />
              <span>Khởi hành {departure}</span>
              <span>{shipName}</span>
            </div>
          </td>
          <td><CruiseRoute item={item} /></td>
          <td><div className={styles.tripDates}>{departure}<span>Kết thúc <time dateTime={item.cruise.returnDatetime}>{formatDate(item.cruise.returnDatetime)}</time></span></div></td>
          <td>{shipName}</td>
          <td>{bookingOnly?<Badge label="Đang nhận đặt chỗ" tone="success"/>:<Badge label={badge.label} tone={badge.tone} />}</td>
        </tr>
      })}
    </DataTable>
  </div>
}

export function CruiseListContent({ state, query, onPage, onRetry, bookingOnly=false }: {
  bookingOnly?: boolean
  state: CruiseListState
  query: CruiseQuery
  onPage: (page: number) => void
  onRetry: () => void
}) {
  if (state.status === 'loading') return <Loading label="Đang tải danh sách chuyến…" />
  if (state.status === 'error') return <Notice title="Không tải được dữ liệu" tone="error"><p>{state.error}</p><Button onClick={onRetry}>Thử lại</Button></Notice>
  if (!state.data.total) return query.search || query.status || query.cruiseType || query.departureDate || query.shipId
    ? <Empty title="Không có chuyến khởi hành phù hợp với bộ lọc" />
    : <Empty title={bookingOnly ? 'Chưa có chuyến đang nhận đặt chỗ' : 'Chưa có chuyến khởi hành'} />
  return <>
    <CruiseTable items={state.data.items} returnTo={'/admin/cruises?'+serializeCruiseQuery(query)} bookingOnly={bookingOnly} />
    <div className={styles.pagination}><span>Hiển thị {(state.data.page - 1) * state.data.pageSize + 1}–{Math.min(state.data.page * state.data.pageSize, state.data.total)} trong {state.data.total} chuyến</span><div><Button tone="secondary" disabled={state.data.page <= 1} onClick={() => onPage(state.data.page - 1)}>Trước</Button><span className={styles.pageNumber}>{state.data.page}/{state.data.pageCount}</span><Button tone="secondary" disabled={state.data.page >= state.data.pageCount} onClick={() => onPage(state.data.page + 1)}>Sau</Button></div></div>
  </>
}
