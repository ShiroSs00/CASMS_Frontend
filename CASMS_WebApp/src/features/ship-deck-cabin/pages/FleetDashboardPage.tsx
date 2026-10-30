import { PermissionLink as Link } from '@/shared/ui'
import { Empty, Loading, Notice, PageHeader } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useShipList } from '../model/useShipList'
import { ShipListMetrics } from '../components/ShipListMetrics'
import { StatusBadge } from '../components/Common'
import styles from './FleetDashboard.module.css'

const repository = { load: shipDeckCabinApi.loadShipList, loadField: shipDeckCabinApi.loadShipListField }
export function FleetDashboardPage() {
  const { state } = useShipList(repository)
  return <AdminShell><div className={styles.stack}>
    <PageHeader breadcrumb="VẬN HÀNH / ĐỘI TÀU" title="Điều hành đội tàu"  actions={<Link className={styles.allShips} to="/admin/ships">Quản lý danh sách <span aria-hidden="true">↗</span></Link>} />
    <section className={styles.overview} aria-label="Tình hình đội tàu"><div className={styles.metricSummary}><ShipListMetrics showNotes={false} metrics={state.status === 'data' ? state.data.metrics : undefined} /></div></section>
    {state.status === 'loading' && <Loading label="Đang tải tổng quan tàu…" />}
    {state.status === 'error' && <Notice title="Chưa tải được tổng quan" tone="error">{state.message}</Notice>}
    {state.status === 'data' && <div className={styles.workspace}>
      <section aria-labelledby="fleet-vessels"><div className={styles.sectionHeading}><div><h2 id="fleet-vessels">Danh sách tàu</h2></div><Link to="/admin/decks">Boong và phòng ↗</Link></div>
      {state.data.items.length ? <div className={styles.vessels}>{state.data.items.map((ship,index)=><article key={ship.id} className={styles.vessel}>
        <div className={styles.vesselTop}><span className={styles.vesselNumber}>{String(index+1).padStart(2,'0')}</span><StatusBadge status={ship.status}/></div>
        <svg className={styles.shipDrawing} viewBox="0 0 240 80" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M18 52h204l-24 19H47L18 52Zm30 0 9-18h124l13 18M72 34V21h84v13m-62-13V12h34v9M57 43h112M8 76h224"/><path d="M65 58h6m11 0h6m11 0h6m11 0h6m11 0h6m11 0h6m11 0h6"/></svg>
        <p className={styles.shipCode}>{ship.code}</p><h3>{ship.name}</h3>
        <dl className={styles.shipFacts}>{(['deckCount','cabinCount'] as const).map((key,index)=><div key={key}><dt>{index===0?'Boong':'Phòng'}</dt><dd>{ship.capacity.status==='loaded'?ship.capacity.data[key]:<span aria-label={ship.capacity.status==='loading'?'Đang tải số liệu':'Chưa có số liệu'}>—</span>}</dd></div>)}</dl>
        <Link className={styles.vesselAction} to={`/admin/ships/${ship.id}`} aria-label={`Quản lý ${ship.name}`}>Mở hồ sơ tàu <span aria-hidden="true">→</span></Link>
      </article>)}</div>:<Empty title="Chưa có tàu để quản lý"></Empty>}</section>
    </div>}
  </div></AdminShell>
}
