import {ShipAreas} from '../components/ShipAreas'
import {ShipOverview} from '../components/ShipOverview'
import { useCallback, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { PermissionLink as Link } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { ApiError } from '@/shared/api'
import { Button, Empty, Loading, Notice } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useFleetQuery } from '../hooks/useFleetQuery'
import { FleetDialogs, type FleetDialog } from '../components/FleetDialogs'
import { ShipInventory } from '../components/ShipInventory'
import { StatusBadge } from '../components/Common'
import { type Ship } from '../model/types'
import styles from '../components/ShipManagement.module.css'

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
  if (!ship) return <>{query.loading ? <Loading label="Đang tải thông tin tàu…" /> : query.error ? <Notice title="Không tải được tàu" tone="error">{query.error}</Notice> : <Empty title="Không tìm thấy tàu"><Link to="/admin/ships">Về danh sách tàu</Link></Empty>}</>
  const requested = params.get('tab')
  const tab = requested==='areas'&&access.canDo('SHIP_CONFIGURATION_READ')?'areas':requested==='decks'&&access.canDo('DECK_READ')?'decks':requested==='cabins'&&access.canDo('CABIN_READ')?'cabins':'overview'
  return <div className={styles.stack}>
    <header className={styles.shipDetailHeading}>
      <div className={styles.detailToolbar}>
        <Link className={styles.backToFleet} to="/admin/ships"><span aria-hidden="true">←</span> Danh sách tàu</Link>
        <div className={styles.shipActions}>
          {access.canDo('SHIP_STATUS_CHANGE')&&<Button tone="secondary" autoWidth disabled={query.loading} onClick={()=>setDialog({type:'operation',kind:'ships',item:ship,operation:'status'})}>Cập nhật trạng thái</Button>}
          {access.canDo('SHIP_UPDATE')&&<Button autoWidth disabled={query.loading} onClick={()=>{setSaved('');setDialog({type:'edit',target:{kind:'ships',item:ship}})}}>Chỉnh sửa thông tin</Button>}
        </div>
      </div>
      <div className={styles.detailIdentity}><div><span>{ship.code}</span><h1>{ship.name}</h1></div><StatusBadge status={ship.status}/></div>
    </header>
    {query.error && <Notice title="Chưa cập nhật được dữ liệu tàu" tone="error">{query.error}</Notice>}
    {saved && <Notice title="Đã lưu thay đổi" tone="success">{saved}</Notice>}
    <nav className={styles.tabs} aria-label="Thông tin trong tàu">
      <Link to={`/admin/ships/${id}`} aria-current={tab === 'overview' ? 'page' : undefined}>Tổng quan</Link>
      {access.canDo('DECK_READ')&&<Link to={`/admin/ships/${id}?tab=decks`} aria-current={tab==='decks'?'page':undefined}>Boong</Link>}
      {access.canDo('SHIP_CONFIGURATION_READ')&&<Link to={`/admin/ships/${id}?tab=areas`} aria-current={tab==='areas'?'page':undefined}>Khu vực dịch vụ</Link>}
      {access.canDo('CABIN_READ')&&<Link to={`/admin/ships/${id}?tab=cabins`} aria-current={tab==='cabins'?'page':undefined}>Phòng</Link>}
    </nav>
    {tab==='overview'?<ShipOverview ship={ship}/>:tab==='areas'?<ShipAreas key={id} shipId={id} initialDeck={params.get('deck')??''}/>:<ShipInventory key={`${id}:${tab}:${params.get('deck')??''}`} ship={ship} view={tab} initialDeck={params.get('deck')??''} onDialog={setDialog}/>}
    <FleetDialogs dialog={dialog} ship={ship} onChange={setDialog} onSaved={setSaved} />
  </div>
}
export function ShipManagementPage() { const { id = '' } = useParams(); return <AdminShell><ShipManagementContent key={id} id={id} /></AdminShell> }
