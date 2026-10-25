import { PermissionLink as Link } from '@/shared/ui'
import { Button, Empty } from '@/shared/ui'
import type { ShipListItem, SupplementField } from '../model/ship-list-types'
import { StatusBadge } from './Common'
import styles from './ShipManagement.module.css'

export function FleetShipCards({ items, filtered, onReset, onRetry }: { items: ShipListItem[]; filtered: boolean; onReset: () => void; onRetry: (id: string, field: SupplementField) => void }) {
  if (!items.length) return <Empty title={filtered ? 'Không có tàu phù hợp' : 'Chưa có tàu'}>{filtered ? <Button tone="secondary" onClick={onReset}>Xóa bộ lọc</Button> : <p>Tàu sẽ xuất hiện sau khi quản trị viên hoàn tất nhập dữ liệu.</p>}</Empty>
  return <div className={styles.fleetCards}>{items.map(ship => <article key={ship.id} className={styles.fleetShip}>
    <div className={styles.fleetShipHeading}><span className={styles.shipCode}>{ship.code}</span><StatusBadge status={ship.status} /></div>
    <h2><Link to={`/admin/ships/${ship.id}`}>{ship.name}</Link></h2>
    <dl className={styles.fleetShipNumbers}>
      {(['deckCount', 'cabinCount'] as const).map((key, index)=><div key={key}><dt>{index ? 'Cabin' : 'Boong'}</dt><dd>{ship.capacity.status==='loaded'?ship.capacity.data[key]:'—'}</dd></div>)}
    </dl>
    {ship.capacity.status!=='loaded' && <div className={styles.supplementLine}>{ship.capacity.status==='loading'?<span role="status">Đang tải số liệu…</span>:<Button tone="text" size="compact" onClick={()=>onRetry(ship.id,'capacity')}>Tải lại số liệu</Button>}</div>}
    <div className={styles.fleetShipState}><span>Chuyến hiện tại</span>{ship.currentCruise.status==='loaded'?<strong>{ship.currentCruise.data?.code??'—'}</strong>:ship.currentCruise.status==='loading'?<span role="status">Đang tải…</span>:<Button tone="text" size="compact" onClick={()=>onRetry(ship.id,'currentCruise')}>Thử lại</Button>}</div>
    <div className={styles.fleetShipActions}><Link className={styles.manageLink} to={`/admin/ships/${ship.id}`}>Thông tin tàu</Link><Link className={styles.structureAction} to={`/admin/decks?${new URLSearchParams({ship:ship.id})}`}>Boong & Cabin <span aria-hidden="true">→</span></Link></div>
  </article>)}</div>
}
