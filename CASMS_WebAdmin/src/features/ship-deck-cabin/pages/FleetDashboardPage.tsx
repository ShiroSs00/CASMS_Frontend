import {FleetPagination} from '../components/FleetPagination'
import {paginateFleet} from '../model/fleet-pagination'
import {ShipAreaCount} from '../components/ShipAreaCount'
import {useState} from 'react'
import {shipStatuses,type ShipStatus} from '../model/types'
import { PermissionLink as Link } from '@/shared/ui'
import { Button, ButtonLink, Empty, Loading, Notice, PageHeader } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useShipList } from '../model/useShipList'
import { ShipListMetrics } from '../components/ShipListMetrics'
import { StatusBadge } from '../components/Common'
import styles from './FleetDashboard.module.css'

const repository = { load: shipDeckCabinApi.loadShipList, loadField: shipDeckCabinApi.loadShipListField }
export function FleetDashboardPage() {
  const { state } = useShipList(repository)
  const [page,setPage]=useState(1)
  const [status,setStatus]=useState<ShipStatus|'ALL'>('ALL')
  const ships=state.status==='data'?state.data.items.filter(ship=>status==='ALL'||ship.status===status):[]
  const pagination=paginateFleet(ships,page,6)
  return <AdminShell><div className={styles.stack}>
    <PageHeader breadcrumb="QUẢN LÝ TÀU" title="Tàu được phân công"
      actions={<ButtonLink to="/admin/ships">Danh sách tàu</ButtonLink>} />
    <section className={styles.overview} aria-label="Tình hình đội tàu"><div className={styles.metricSummary}><ShipListMetrics selected={status} onSelect={value=>{setStatus(current=>current===value?'ALL':value);setPage(1)}} metrics={state.status === 'data' ? state.data.metrics : undefined} /></div></section>
    {state.status === 'loading' && <Loading label="Đang tải tổng quan tàu…" />}
    {state.status === 'error' && <Notice title="Chưa tải được tổng quan" tone="error">{state.message}</Notice>}
    {state.status === 'data' && <div className={styles.workspace}>
      <section aria-labelledby="fleet-vessels"><div className={styles.sectionHeading}><div><h2 id="fleet-vessels">{status==='ALL'?'Tàu được phân công':shipStatuses[status]} <span className={styles.resultCount} aria-live="polite">{ships.length}</span></h2></div><div className={styles.listActions}>{status!=='ALL'&&<Button tone="text" onClick={()=>{setStatus('ALL');setPage(1)}}>Xem tất cả tàu được phân công</Button>}</div></div>
      {ships.length ? <div className={styles.vessels}>{pagination.items.map((ship)=><article key={ship.id} className={styles.vessel}>
        <div className={styles.vesselTop}><span className={styles.shipCode}>{ship.code}</span><StatusBadge status={ship.status}/></div>

        <h3>{ship.name}</h3>
        <dl className={styles.shipFacts}>{(['deckCount','cabinCount'] as const).map((key,index)=><div key={key}><dt>{index===0?'Boong':'Phòng'}</dt><dd>{ship.capacity.status==='loaded'?ship.capacity.data[key]:<span aria-label={ship.capacity.status==='loading'?'Đang tải số liệu':'Chưa có số liệu'}>—</span>}</dd></div>)}<ShipAreaCount count={ship.capacity.status==='loaded'?ship.capacity.data.serviceAreaCount:undefined}/></dl>
        <Link className={styles.vesselAction} to={`/admin/ships/${ship.id}`} aria-label={`Quản lý ${ship.name}`}>Chi tiết tàu <span aria-hidden="true">→</span></Link>
      </article>)}</div>:<Empty title={state.data.items.length?'Không có tàu ở trạng thái này':'Chưa có tàu được phân công'}/>}<FleetPagination pagination={pagination} onChange={setPage}/></section>
    </div>}
  </div></AdminShell>
}
