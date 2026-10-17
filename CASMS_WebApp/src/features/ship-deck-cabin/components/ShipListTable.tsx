import { Link } from 'react-router'
import { Button } from '@/shared/ui'
import type { ShipListItem } from '../model/ship-list-types'
import styles from './ShipList.module.css'

export function ShipListTable({ items, filtered, onReset }: { items: ShipListItem[]; filtered: boolean; onReset: () => void }) {
  return <div className={styles.tableContainer}>
    <table className={styles.table} aria-label="Danh sách tàu">
      <colgroup>{['name', 'code', 'status', 'deck', 'cabin', 'readiness', 'cruise'].map(column => <col key={column} className={styles[`column_${column}`]} />)}</colgroup>
      <thead><tr>{['Tàu', 'Mã', 'Trạng thái', 'Deck', 'Cabin', 'Sẵn sàng', 'Chuyến hiện tại'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{items.map(item => <tr key={item.id}>
        <td><Link className={styles.shipLink} to={`/admin/ships/${item.id}`} aria-label={`Xem tàu ${item.name}`}>{item.name}</Link></td>
        <td>{item.code}</td><td>{item.status}</td><td>{item.deckCount}</td><td>{item.cabinCount}</td><td>{item.readiness}</td><td>{item.currentCruise?.code ?? '—'}</td>
      </tr>)}</tbody>
    </table>
    {!items.length && <div className={styles.statePanel} role="status">
      <p>{filtered ? 'Không có tàu phù hợp với bộ lọc.' : 'Chưa có tàu trong danh sách.'}</p>
      {filtered ? <Button tone="secondary" className={styles.button} onClick={onReset}>Xóa bộ lọc</Button> : <p>Tạo tàu để bắt đầu quản lý đội tàu.</p>}
    </div>}
  </div>
}
