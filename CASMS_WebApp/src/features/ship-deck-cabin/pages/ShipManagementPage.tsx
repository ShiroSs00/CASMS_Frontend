import { useCallback, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { PermissionLink as Link } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { ApiError } from '@/shared/api'
import { Button, Empty, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useFleetQuery } from '../hooks/useFleetQuery'
import { FleetDialogs, type FleetDialog } from '../components/FleetDialogs'
import { ShipInventory } from '../components/ShipInventory'
import {ShipAreas} from '../components/ShipAreas'
import { StatusBadge } from '../components/Common'
import { operationPermission } from '../model/permissions'
import { formatDate, type Ship } from '../model/types'
import type { Operation } from '../components/OperationDialog'
import styles from '../components/ShipManagement.module.css'

function ShipOverview({ ship }: { ship: Ship }) {
  const access = useSessionAccess()
  const loadCapacity = useCallback((signal: AbortSignal) => shipDeckCabinApi.getShipCapacity(ship.id, signal), [ship.id])
  const loadCruise = useCallback((signal: AbortSignal) => shipDeckCabinApi.getCurrentCruise(ship.id, signal), [ship.id])
  const capacity = useFleetQuery(`overview-capacity:${ship.id}`, loadCapacity, access.canDo('SHIP_CAPACITY_SUMMARY'))
  const cruise = useFleetQuery(`overview-cruise:${ship.id}`, loadCruise, access.canDo('SHIP_CURRENT_CRUISE'))
  return <div className={styles.stack}>
    <dl className={styles.metrics}>
      <div><dt>Sức chứa hành khách</dt><dd>{ship.capacity.toLocaleString('vi-VN')}</dd></div>
      <div><dt>Boong đã ghi nhận</dt><dd>{capacity.data?.actualDeckCount ?? '—'}</dd></div>
      <div><dt>Tổng số phòng</dt><dd>{capacity.data?.actualCabinCount ?? '—'}</dd></div>
      <div><dt>Phòng sẵn sàng</dt><dd>{capacity.data?.availableCabinCount ?? '—'}</dd></div>
    </dl>
    {capacity.loading && <p role="status" className={styles.muted}>Đang cập nhật số liệu boong và phòng…</p>}
    {capacity.error && <Notice title="Chưa tải được tổng hợp sức chứa" tone="error">{capacity.error}<Button tone="text" onClick={capacity.retry}>Tải lại số liệu</Button></Notice>}
    <Panel title="Thông tin tàu"><dl className={styles.readonly}>
      <div><dt>Mã tàu</dt><dd>{ship.code}</dd></div><div><dt>Tên tàu</dt><dd>{ship.name}</dd></div>
      <div><dt>Trạng thái</dt><dd><StatusBadge status={ship.status} /></dd></div><div><dt>Tổng số boong cấu hình</dt><dd>{ship.totalDecks}</dd></div>
      <div><dt>Chiều dài</dt><dd>{ship.lengthMeters != null ? `${ship.lengthMeters.toLocaleString('vi-VN')} m` : 'Chưa cập nhật'}</dd></div>
      <div><dt>Chiều rộng</dt><dd>{ship.beamMeters != null ? `${ship.beamMeters.toLocaleString('vi-VN')} m` : 'Chưa cập nhật'}</dd></div>
      <div><dt>Mã mô hình liên kết</dt><dd>{ship.manifestModelId || 'Chưa liên kết mô hình'}</dd></div><div><dt>Ngày đưa vào hoạt động</dt><dd>{formatDate(ship.commissionDate)}</dd></div>
      <div><dt>Cập nhật gần nhất</dt><dd>{formatDate(ship.updatedAt)}</dd></div>
    </dl></Panel>
    {access.canDo('SHIP_CURRENT_CRUISE') && <Panel title="Chuyến đang vận hành">
      {cruise.loading && !cruise.data && <Loading label="Đang tải chuyến hiện tại…" />}
      {cruise.error && <Notice title="Chưa tải được chuyến hiện tại" tone="error">{cruise.error}<Button tone="text" onClick={cruise.retry}>Thử lại</Button></Notice>}
      {cruise.data && <dl className={styles.readonly}><div><dt>Mã chuyến</dt><dd>{cruise.data.code}</dd></div><div><dt>Tên chuyến</dt><dd>{cruise.data.name}</dd></div><div><dt>Khởi hành</dt><dd>{formatDate(cruise.data.departure)}</dd></div><div><dt>Kết thúc</dt><dd>{formatDate(cruise.data.returnAt)}</dd></div></dl>}
      {!cruise.loading && !cruise.error && !cruise.data && <p className={styles.muted}>Chưa có chuyến đang vận hành.</p>}
    </Panel>}
  </div>
}

function ShipManagementContent({ id }: { id: string }) {
  const access = useSessionAccess()
  const [params] = useSearchParams()
  const [dialog, setDialog] = useState<FleetDialog | null>(null)
  const [saved, setSaved] = useState('')
  const load = useCallback(async (signal: AbortSignal): Promise<Ship | null> => {
    try {
      const value = await shipDeckCabinApi.get('ships', id, signal)
      if (!('code' in value)) throw new Error('Thông tin trả về không phải dữ liệu tàu.')
      return value
    } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error }
  }, [id])
  const query = useFleetQuery(`ship-workspace:${id}`, load, access.canDo('SHIP_READ'))
  const ship = query.data
  if (!ship) return <>{query.loading ? <Loading label="Đang tải thông tin tàu…" /> : query.error ? <Notice title="Không tải được tàu" tone="error">{query.error}<Button onClick={query.retry}>Thử lại</Button></Notice> : <Empty title="Không tìm thấy tàu"><Link to="/admin/ships">Về danh sách tàu</Link></Empty>}</>
  const requested = params.get('tab')
  const tab = requested === 'areas' && access.canDo('SHIP_CONFIGURATION_READ') ? 'areas' : requested === 'decks' && access.canDo('DECK_READ') ? 'decks' : requested === 'cabins' && access.canDo('CABIN_READ') ? 'cabins' : 'overview'
  const operationChoices: Array<[Operation, string]> = [['ready', 'Kiểm tra sẵn sàng'], ['schedule', 'Kiểm tra lịch trống'], ['affected', 'Chuyến bị ảnh hưởng'], ['validate', 'Kiểm tra cấu hình']]
  const operations = operationChoices.filter(([operation]) => access.canDo(operationPermission('ships', operation)))
  return <div className={styles.stack}>
    <div className={styles.shipDetailHeading}><PageHeader breadcrumb="Ship / Chi tiết" title={ship.name} description={ship.code} actions={<>
      <Link className={styles.textLink} to="/admin/ships">Về danh sách tàu</Link>
      {access.canDo('SHIP_UPDATE') && <Button size="compact" autoWidth disabled={query.loading} onClick={() => { setSaved(''); setDialog({ type: 'edit', target: { kind: 'ships', item: ship } }) }}>Chỉnh sửa</Button>}
      {access.canDo('SHIP_STATUS_CHANGE') && <Button tone="secondary" size="compact" autoWidth disabled={query.loading} onClick={() => setDialog({ type: 'operation', kind: 'ships', item: ship, operation: 'status' })}>Đổi trạng thái</Button>}
      {(operations.length > 0 || access.canDo('SHIP_DELETE')) && <select aria-label="Thao tác khác với tàu" className={styles.operationSelect} value="" disabled={query.loading} onChange={event => { if (event.target.value === 'delete') setDialog({ type: 'deleteShip' }); else if (event.target.value) setDialog({ type: 'operation', kind: 'ships', item: ship, operation: event.target.value as Operation }) }}><option value="">Thao tác khác</option>{operations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{access.canDo('SHIP_DELETE') && <option value="delete">Xóa tàu chưa sử dụng</option>}</select>}
    </>} /></div>
    {query.error && <Notice title="Chưa cập nhật được dữ liệu tàu" tone="error">{query.error}<Button tone="text" onClick={query.retry}>Thử lại</Button></Notice>}
    {saved && <Notice title="Đã lưu thay đổi" tone="success">{saved}</Notice>}
    <nav className={styles.tabs} aria-label="Thông tin trong tàu">
      <Link to={`/admin/ships/${id}`} aria-current={tab === 'overview' ? 'page' : undefined}>Tổng quan</Link>
      {access.canDo('SHIP_CONFIGURATION_READ')&&<Link to={`/admin/ships/${id}?tab=areas`} aria-current={tab==='areas'?'page':undefined}>Khu vực (Areas)</Link>}
      {(access.canDo('DECK_READ') || access.canDo('CABIN_READ')) && <Link to={`/admin/decks?${new URLSearchParams({ship:id})}`}>Boong & Cabin <span aria-hidden="true">↗</span></Link>}
    </nav>
    {tab==='areas'?<ShipAreas key={id} shipId={id} initialDeck={params.get('deck')??''}/>:tab === 'overview' ? <ShipOverview ship={ship} /> : <ShipInventory key={`${id}:${tab}:${params.get('deck') ?? ''}`} ship={ship} view={tab} initialDeck={params.get('deck') ?? ''} onDialog={setDialog} />}
    <FleetDialogs dialog={dialog} ship={ship} onChange={setDialog} onSaved={setSaved} />
  </div>
}
export function ShipManagementPage() { const { id = '' } = useParams(); return <AdminShell><ShipManagementContent key={id} id={id} /></AdminShell> }
