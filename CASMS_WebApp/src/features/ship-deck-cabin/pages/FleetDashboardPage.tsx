import { PermissionLink as Link } from '@/shared/ui'
import { Button, Empty, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useShipList } from '../model/useShipList'
import { ShipListMetrics } from '../components/ShipListMetrics'
import { StatusBadge } from '../components/Common'
import styles from '../components/ShipManagement.module.css'

const repository = { load: shipDeckCabinApi.loadShipList, loadField: shipDeckCabinApi.loadShipListField }
export function FleetDashboardPage() {
  const { state, retry } = useShipList(repository)
  const attention = state.status === 'data' ? state.data.items.filter(ship=>ship.readiness.status==='loaded'&&ship.readiness.data!=='READY') : []
  return <AdminShell><div className={styles.stack}>
    <div className={styles.fleetPageHeading}><div className={styles.dashboardHeading}><PageHeader breadcrumb="Dashboard" title="Tổng quan đội tàu" description="" /></div><Link className={styles.manageLink} to="/admin/ships">Danh sách tàu <span aria-hidden="true">↗</span></Link></div>
    <div className={styles.dashboardMetrics}><ShipListMetrics metrics={state.status === 'data' ? state.data.metrics : undefined} showNotes={false} /></div>
    {attention.length>0 && <section className={styles.attentionStrip} aria-label="Tàu cần chú ý"><strong>Cần kiểm tra <span>{attention.length}</span></strong><div>{attention.map(ship=><Link key={ship.id} to={`/admin/ships/${ship.id}`}>{ship.name} <span aria-hidden="true">→</span></Link>)}</div></section>}
    {state.status === 'loading' && <Loading label="Đang tải tổng quan tàu…" />}
    {state.status === 'error' && <Notice title="Chưa tải được tổng quan" tone="error">{state.message}<Button onClick={retry}>Thử lại</Button></Notice>}
    {state.status === 'data' && <Panel><div className={styles.sectionHeading}><h2>Tàu trong hệ thống</h2><Link className={styles.textLink} to="/admin/decks">Boong & Cabin <span aria-hidden="true">↗</span></Link></div>{state.data.items.length ? <div className={styles.fleetTableScroll} role="region" aria-label="Tàu trong hệ thống" tabIndex={0}>
      <table className={styles.fleetTable}>
        <thead><tr><th scope="col">Tên tàu</th><th scope="col">Mã tàu</th><th scope="col">Trạng thái</th><th scope="col">Boong</th><th scope="col">Phòng</th><th scope="col"><span className={styles.srOnly}>Thao tác</span></th></tr></thead>
        <tbody>{state.data.items.map(ship => <tr key={ship.id}>
          <th scope="row"><Link to={`/admin/ships/${ship.id}`} className={styles.shipName}>{ship.name}</Link></th>
          <td className={styles.shipCode}>{ship.code}</td>
          <td><StatusBadge status={ship.status} /></td>
          {(['deckCount', 'cabinCount'] as const).map(key => <td key={key} className={styles.fleetCount}>{ship.capacity.status === 'loaded' ? ship.capacity.data[key] : <span aria-label={ship.capacity.status === 'loading' ? 'Đang tải số liệu' : 'Chưa có số liệu'}>—</span>}</td>)}
          <td><Link to={`/admin/ships/${ship.id}`} className={styles.manageLink} aria-label={`Quản lý ${ship.name}`}>Quản lý <span aria-hidden="true">→</span></Link></td>
        </tr>)}</tbody>
      </table>
    </div> : <Empty title="Chưa có tàu để quản lý"><p>Tàu sẽ xuất hiện sau khi quản trị viên hoàn tất nhập dữ liệu.</p></Empty>}</Panel>}
  </div></AdminShell>
}
