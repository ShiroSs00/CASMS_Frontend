import { PermissionLink as Link } from '@/shared/ui'
import { Button, Empty, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useShipList } from '../model/useShipList'
import { ShipListMetrics } from '../components/ShipListMetrics'
import { StatusBadge } from '../components/Common'
import styles from './FleetDashboard.module.css'

const repository = { load: shipDeckCabinApi.loadShipList, loadField: shipDeckCabinApi.loadShipListField }
export function FleetDashboardPage() {
  const { state, retry } = useShipList(repository)
  const attention = state.status === 'data' ? state.data.items.filter(ship=>ship.readiness.status==='loaded'&&ship.readiness.data!=='READY') : []
  return <AdminShell><div className={styles.stack}>
    <PageHeader breadcrumb="VẬN HÀNH / ĐỘI TÀU" title="Điều hành đội tàu" description="Một góc nhìn về trạng thái tàu và cấu trúc không gian trên tàu." actions={<Link className={styles.allShips} to="/admin/ships">Quản lý danh sách <span aria-hidden="true">↗</span></Link>} />
    <section className={styles.overview} aria-label="Tình hình đội tàu"><div className={styles.overviewIntro}><span>FLEET OVERVIEW</span><h2>Sẵn sàng cho <br />hải trình tiếp theo.</h2><p>Số liệu từ hồ sơ đội tàu hiện có.</p></div><div className={styles.metricSummary}><ShipListMetrics metrics={state.status === 'data' ? state.data.metrics : undefined} /></div></section>
    {state.status === 'loading' && <Loading label="Đang tải tổng quan tàu…" />}
    {state.status === 'error' && <Notice title="Chưa tải được tổng quan" tone="error">{state.message}<Button onClick={retry}>Thử lại</Button></Notice>}
    {state.status === 'data' && <div className={styles.workspace}>
      <section aria-labelledby="fleet-vessels"><div className={styles.sectionHeading}><div><span>ĐỘI TÀU OCEVIE</span><h2 id="fleet-vessels">Không gian vận hành</h2></div><Link to="/admin/decks">Boong & Cabin ↗</Link></div>
      {state.data.items.length ? <div className={styles.vessels}>{state.data.items.map((ship,index)=><article key={ship.id} className={styles.vessel}>
        <div className={styles.vesselTop}><span className={styles.vesselNumber}>{String(index+1).padStart(2,'0')}</span><StatusBadge status={ship.status}/></div>
        <svg className={styles.shipDrawing} viewBox="0 0 240 80" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M18 52h204l-24 19H47L18 52Zm30 0 9-18h124l13 18M72 34V21h84v13m-62-13V12h34v9M57 43h112M8 76h224"/><path d="M65 58h6m11 0h6m11 0h6m11 0h6m11 0h6m11 0h6m11 0h6"/></svg>
        <p className={styles.shipCode}>{ship.code}</p><h3>{ship.name}</h3>
        <dl className={styles.shipFacts}>{(['deckCount','cabinCount'] as const).map((key,index)=><div key={key}><dt>{index===0?'Boong':'Cabin'}</dt><dd>{ship.capacity.status==='loaded'?ship.capacity.data[key]:<span aria-label={ship.capacity.status==='loading'?'Đang tải số liệu':'Chưa có số liệu'}>—</span>}</dd></div>)}</dl>
        <Link className={styles.vesselAction} to={`/admin/ships/${ship.id}`} aria-label={`Quản lý ${ship.name}`}>Mở hồ sơ tàu <span aria-hidden="true">→</span></Link>
      </article>)}</div>:<Empty title="Chưa có tàu để quản lý"><p>Tàu sẽ xuất hiện sau khi quản trị viên hoàn tất nhập dữ liệu.</p></Empty>}</section>
      <aside className={styles.attention}><span>THEO DÕI SẴN SÀNG</span><h2>Cần kiểm tra</h2><p>Các tàu có kết quả kiểm tra khác trạng thái sẵn sàng.</p>{attention.length ? <ul>{attention.map(ship=><li key={ship.id}><Link to={`/admin/ships/${ship.id}`}>{ship.name}<span aria-hidden="true">↗</span></Link></li>)}</ul>:<p className={styles.noAttention}>Chưa ghi nhận tàu cần kiểm tra trong các kết quả đã tải. Hồ sơ chưa tải được mức sẵn sàng không nằm trong danh sách này.</p>}<Panel title="Cấu trúc đội tàu"><Link to="/admin/ships">Hồ sơ tàu →</Link><Link to="/admin/decks">Boong và cabin →</Link></Panel></aside>
    </div>}
  </div></AdminShell>
}
