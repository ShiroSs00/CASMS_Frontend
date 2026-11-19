import {ShipAreas} from '../components/ShipAreas'
import {ShipOverview} from '../components/ShipOverview'
import { CruisePackageCabinMapping } from '@/domain/cruise-package'
import { Suspense, useCallback, useContext, useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import { PermissionLink as Link } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { ApiError } from '@/shared/api'
import { Badge, Button, Empty, Loading, Notice } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useFleetQuery } from '../hooks/useFleetQuery'
import { FleetDialogs, type FleetDialog } from '../components/FleetDialogs'
import { ShipArchiveAction } from '../components/ShipArchiveAction'
import { ShipInventory } from '../components/ShipInventory'
import { StatusBadge } from '../components/Common'
import { formatDate, type Ship } from '../model/types'
import { ShipSchedule } from '../components/ShipSchedule'
import { ShipProfilePanel, ShipRenameDialog } from '../ship-types/ShipProfilePanel'
import { DesignVersionFacts } from '../ship-types/DesignVersionFacts'
import { manufacturingFields } from '../ship-types/design-metadata'
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
  if (!ship) return <AdminShell>{query.loading ? <Loading label="Đang tải thông tin tàu…" /> : query.error ? <Notice title="Không tải được tàu" tone="error">
    {query.error} <Button tone="text" onClick={query.retry}>Thử lại</Button>
  </Notice> : <Empty title="Không tìm thấy tàu"><Link to={fleetPath}>Về danh sách tàu</Link></Empty>}</AdminShell>
  const requested = params.get('tab')
  const canViewModel = Boolean(ShipRecordViewer) && access.canDo('SHIP_MODEL_READ')
  const canViewSchedule = ['SHIP_CURRENT_CRUISE', 'SHIP_SCHEDULE_CHECK', 'SHIP_AFFECTED_CRUISES'].some(access.canDo)
  const manager = access.roles.includes('SHIP_MANAGER')
  const admin = access.roles.includes('ADMIN')
  const archived = Boolean(ship.archivedAt)
  const availableTabs: Record<string, boolean> = {
    areas: !archived && access.canDo('SHIP_CONFIGURATION_READ'), decks: access.canDo('DECK_READ'),
    cabins: access.canDo('CABIN_READ'), model: canViewModel, schedule: !archived && canViewSchedule,
  }
  const tab = requested && availableTabs[requested] ? requested : 'overview'
  const backToDesign = admin && listQuery === null
  const back = backToDesign ? (ship.shipTypeId ? '/admin/ship-types/' + ship.shipTypeId : '/admin/ship-models') : fleetPath
  const sections = [
    { key: 'overview', label: 'Thông tin chung', visible: true },
    { key: 'decks', label: 'Boong', visible: availableTabs.decks },
    { key: 'areas', label: 'Khu vực dịch vụ', visible: availableTabs.areas },
    { key: 'cabins', label: 'Cabin', visible: availableTabs.cabins },
    { key: 'model', label: 'Mô hình 2D/3D', visible: availableTabs.model },
    { key: 'schedule', label: 'Lịch hoạt động', visible: availableTabs.schedule },
  ].filter(section => section.visible)
  return <AdminShell contextNavigation={{ ariaLabel: 'Thông tin trong tàu', label: ship.name, description: ship.code, parentTo: '/admin/ships', parentHref: fleetPath, parentState: state, items: sections.map(section => ({
    label: section.label, to: `/admin/ships/${id}` + (section.key === 'overview' ? '' : `?tab=${section.key}`), active: tab === section.key, state,
  })) }}><div className={`${styles.stack} ${styles.shipDetailPage}`}>
    <header className={styles.shipDetailHeading}>
      <div className={styles.detailToolbar}>
        <Link className={styles.backToFleet} to={back}><span aria-hidden="true">←</span> {backToDesign && ship.shipTypeId ? 'Chi tiết loại tàu' : backToDesign ? 'Thiết lập định vị' : 'Danh sách tàu'}</Link>
        <div className={styles.shipActions}>
          {!archived && manager && !admin && ship.status === 'DRAFT' && access.canDo('SHIP_ARCHIVE') && <ShipArchiveAction ship={ship} />}
          {!archived && access.canDo('SHIP_STATUS_CHANGE')&&<Button tone="secondary" autoWidth disabled={query.loading} onClick={()=>setDialog({type:'operation',kind:'ships',item:ship,operation:'status'})}>Cập nhật trạng thái</Button>}
          {!archived && manager && ship.shipTypeId && !access.canDo('SHIP_UPDATE') && <Button autoWidth onClick={() => setRenaming(true)}>Đổi tên tàu</Button>}
          {!archived && access.canDo('SHIP_UPDATE')&&<Button autoWidth disabled={query.loading} onClick={()=>{setSaved('');setDialog({type:'edit',target:{kind:'ships',item:ship}})}}>Chỉnh sửa thông tin</Button>}
        </div>
      </div>
      <div className={styles.detailIdentity}><div><span>{ship.code}</span><h1>{ship.name}</h1></div>{archived ? <Badge label="Đã lưu trữ" /> : <StatusBadge status={ship.status}/>}</div>
    </header>
    {query.error && <Notice title="Chưa cập nhật được dữ liệu tàu" tone="error">{query.error}</Notice>}
    {saved && <Notice title="Đã lưu thay đổi" tone="success">{saved}</Notice>}
    {archived && <Notice title="Hồ sơ lưu trữ">Tàu được lưu trữ ngày {formatDate(ship.archivedAt)}. Hồ sơ ở chế độ tra cứu.</Notice>}
    <h2 className={styles.currentSectionHeading}>{sections.find(section => section.key === tab)?.label}</h2>
    {tab === 'overview' && <>
      <section className={styles.typeInformation} aria-labelledby="ship-type-information-heading">
        <div className={styles.sectionHeading}><h3 id="ship-type-information-heading">Thông tin loại tàu</h3>
        {ship.shipTypeId ? <Link to={'/admin/ship-types/' + ship.shipTypeId}>{ship.shipTypeName || ship.shipTypeCode || 'Xem loại tàu'}</Link> : 'Chưa phân loại'}
        </div>
        {ship.designReference && (manufacturingFields.some(({ key }) => ship.designReference?.manufacturingMetadata?.[key] != null)
          ? <DesignVersionFacts design={ship.designReference} showReference={false} />
          : <p>Tệp thiết kế chưa cung cấp thông tin đóng tàu.</p>)}
      </section>
      <ShipOverview ship={ship}/>
      {manager && ship.shipTypeId && <ShipProfilePanel id={id} readOnly={archived} />}
    </>}
    {tab === 'model' && ShipRecordViewer && <Suspense fallback={<Loading label="Đang mở khung xem mô hình…" />}><ShipRecordViewer key={id} ship={id} /></Suspense>}
    {tab === 'schedule' && <ShipSchedule key={id} ship={ship} onDialog={setDialog} />}
    {tab === 'areas' && <ShipAreas key={id} shipId={id} initialDeck={params.get('deck') ?? ''} />}
    {(tab === 'decks' || tab === 'cabins') && <ShipInventory key={`${id}:${tab}:${params.get('deck')??''}`} ship={ship} view={tab} initialDeck={params.get('deck')??''} onDialog={setDialog}/>}
    {tab==='cabins'&&!archived&&<CruisePackageCabinMapping shipId={id}/>}
    {renaming && !archived && <ShipRenameDialog id={id} initial={ship.name} onClose={() => setRenaming(false)} />}
    <FleetDialogs dialog={dialog} ship={ship} onChange={setDialog} onSaved={setSaved} />
  </div></AdminShell>
}
export function ShipManagementPage() { const { id = '' } = useParams(); return <ShipManagementContent key={id} id={id} /> }
