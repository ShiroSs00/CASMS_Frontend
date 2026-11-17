import {ShipAreas} from '../components/ShipAreas'
import {ShipOverview} from '../components/ShipOverview'
import { CruisePackageCabinMapping } from '@/domain/cruise-package'
import { Suspense, useCallback, useContext, useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import { PermissionLink as Link } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { ApiError } from '@/shared/api'
import { Button, Empty, Loading, Notice, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useFleetQuery } from '../hooks/useFleetQuery'
import { FleetDialogs, type FleetDialog } from '../components/FleetDialogs'
import { ShipInventory } from '../components/ShipInventory'
import { StatusBadge } from '../components/Common'
import { type Ship } from '../model/types'
import { ShipSchedule } from '../components/ShipSchedule'
import { ShipProfilePanel, ShipRenameDialog } from '../ship-types/ShipProfilePanel'
import { ShipViewerContext } from '../ship-types/viewer-context'
import styles from '../components/ShipManagement.module.css'

function ShipManagementContent({ id }: { id: string }) {
  const access = useSessionAccess()
  const ShipRecordViewer = useContext(ShipViewerContext)?.RecordViewer
  const [params] = useSearchParams()
  const { state } = useLocation()
  const listQuery = typeof state?.listQuery === 'string' ? state.listQuery : null
  const fleetPath = listQuery ? '/admin/ships?' + listQuery : '/admin/ships'
  const [dialog, setDialog] = useState<FleetDialog | null>(null)
  const [saved, setSaved] = useState('')
  const [renaming, setRenaming] = useState(false)
  const load = useCallback(async (signal: AbortSignal): Promise<Ship | null> => {
    try {
      const value = await shipDeckCabinApi.get('ships', id, signal)
      if (!('code' in value)) throw new Error('Thông tin trả về không phải dữ liệu tàu.')
      return value
    } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error }
  }, [id])
  const query = useFleetQuery(`ship-workspace:${access.userId}:${id}`, load, access.canDo('SHIP_READ'))
  const ship = query.data
  if (!ship) return <>{query.loading ? <Loading label="Đang tải thông tin tàu…" /> : query.error ? <Notice title="Không tải được tàu" tone="error">
    {query.error} <Button tone="text" onClick={query.retry}>Thử lại</Button>
  </Notice> : <Empty title="Không tìm thấy tàu"><Link to={fleetPath}>Về danh sách tàu</Link></Empty>}</>
  const requested = params.get('tab')
  const canViewModel = Boolean(ShipRecordViewer) && access.canDo('SHIP_MODEL_READ')
  const canViewSchedule = ['SHIP_CURRENT_CRUISE', 'SHIP_SCHEDULE_CHECK', 'SHIP_AFFECTED_CRUISES'].some(access.canDo)
  const manager = access.roles.includes('SHIP_MANAGER')
  const admin = access.roles.includes('ADMIN')
  const availableTabs: Record<string, boolean> = {
    areas: access.canDo('SHIP_CONFIGURATION_READ'), decks: access.canDo('DECK_READ'),
    cabins: access.canDo('CABIN_READ'), model: canViewModel, schedule: canViewSchedule,
  }
  const tab = requested && availableTabs[requested] ? requested : 'overview'
  const backToDesign = admin && listQuery === null
  const back = backToDesign ? (ship.shipTypeId ? '/admin/ship-types/' + ship.shipTypeId : '/admin/ship-models') : fleetPath
  return <div className={styles.stack}>
    <header className={styles.shipDetailHeading}>
      <div className={styles.detailToolbar}>
        <Link className={styles.backToFleet} to={back}><span aria-hidden="true">←</span> {backToDesign && ship.shipTypeId ? 'Chi tiết loại tàu' : backToDesign ? 'Sơ đồ tàu 3D' : 'Danh sách tàu'}</Link>
        <div className={styles.shipActions}>
          {access.canDo('SHIP_STATUS_CHANGE')&&<Button tone="secondary" autoWidth disabled={query.loading} onClick={()=>setDialog({type:'operation',kind:'ships',item:ship,operation:'status'})}>Cập nhật trạng thái</Button>}
          {manager && ship.shipTypeId && !access.canDo('SHIP_UPDATE') && <Button autoWidth onClick={() => setRenaming(true)}>Đổi tên tàu</Button>}
          {access.canDo('SHIP_UPDATE')&&<Button autoWidth disabled={query.loading} onClick={()=>{setSaved('');setDialog({type:'edit',target:{kind:'ships',item:ship}})}}>Chỉnh sửa thông tin</Button>}
        </div>
      </div>
      <div className={styles.detailIdentity}><div><span>{ship.code}</span><h1>{ship.name}</h1></div><StatusBadge status={ship.status}/></div>
    </header>
    {query.error && <Notice title="Chưa cập nhật được dữ liệu tàu" tone="error">{query.error}</Notice>}
    {saved && <Notice title="Đã lưu thay đổi" tone="success">{saved}</Notice>}
    <nav className={styles.tabs} aria-label="Thông tin trong tàu">
      <Link to={`/admin/ships/${id}`} state={state} aria-current={tab === 'overview' ? 'page' : undefined}>Thông tin chung</Link>
      {access.canDo('DECK_READ')&&<Link to={`/admin/ships/${id}?tab=decks`} state={state} aria-current={tab==='decks'?'page':undefined}>Boong</Link>}
      {access.canDo('SHIP_CONFIGURATION_READ')&&<Link to={`/admin/ships/${id}?tab=areas`} state={state} aria-current={tab==='areas'?'page':undefined}>Khu vực dịch vụ</Link>}
      {access.canDo('CABIN_READ')&&<Link to={`/admin/ships/${id}?tab=cabins`} state={state} aria-current={tab==='cabins'?'page':undefined}>Cabin</Link>}
      {canViewModel && <Link to={`/admin/ships/${id}?tab=model`} state={state} aria-current={tab === 'model' ? 'page' : undefined}>Mô hình 2D/3D</Link>}
      {canViewSchedule && <Link to={`/admin/ships/${id}?tab=schedule`} state={state} aria-current={tab === 'schedule' ? 'page' : undefined}>Lịch khai thác</Link>}
    </nav>
    {tab === 'overview' && <>
      <Panel title="Loại tàu">
        {ship.shipTypeId ? <Link to={'/admin/ship-types/' + ship.shipTypeId}>{ship.shipTypeName || ship.shipTypeCode || 'Xem loại tàu'}</Link> : 'Chưa phân loại'}
      </Panel>
      <ShipOverview ship={ship}/>
      {ship.status === 'DRAFT' && ship.shipTypeId && <Notice title="Giữ tàu ở bản nháp nếu tạo nhầm">
        Tàu tạo từ loại tàu có boong, cabin và mô hình riêng. Cấu hình này chặn thao tác xóa tàu chưa sử dụng.
        Giữ trạng thái Bản nháp và tránh gán chuyến. Nếu chỉ sai tên, dùng thao tác đổi tên khi tài khoản có quyền.
      </Notice>}
      {manager && ship.shipTypeId && <ShipProfilePanel id={id} />}
    </>}
    {tab === 'model' && ShipRecordViewer && <Suspense fallback={<Loading label="Đang mở khung xem mô hình…" />}><ShipRecordViewer key={id} ship={id} /></Suspense>}
    {tab === 'schedule' && <ShipSchedule key={id} ship={ship} onDialog={setDialog} />}
    {tab === 'areas' && <ShipAreas key={id} shipId={id} initialDeck={params.get('deck') ?? ''} />}
    {(tab === 'decks' || tab === 'cabins') && <ShipInventory key={`${id}:${tab}:${params.get('deck')??''}`} ship={ship} view={tab} initialDeck={params.get('deck')??''} onDialog={setDialog}/>}
    {tab==='cabins'&&<CruisePackageCabinMapping shipId={id}/>}
    {renaming && <ShipRenameDialog id={id} initial={ship.name} onClose={() => setRenaming(false)} />}
    <FleetDialogs dialog={dialog} ship={ship} onChange={setDialog} onSaved={setSaved} />
  </div>
}
export function ShipManagementPage() { const { id = '' } = useParams(); return <AdminShell><ShipManagementContent key={id} id={id} /></AdminShell> }
