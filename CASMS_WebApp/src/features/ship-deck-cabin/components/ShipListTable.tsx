import { PermissionLink as Link } from '@/shared/ui'

import { Button } from '@/shared/ui'
import type { ShipListItem, ShipReadiness, Supplement, SupplementField } from '../model/ship-list-types'
import type { ReactNode } from 'react'
import { shipStatuses } from '../model/types'
import styles from './ShipList.module.css'

const readinessLabels: Record<ShipReadiness, string> = { READY: 'Sẵn sàng', ATTENTION: 'Cần chú ý', BLOCKED: 'Chưa sẵn sàng' }

function SupplementValue<T>({ value, children }: { value: Supplement<T>; children: (data: T) => ReactNode; retry: () => void; label: string }) {
  if (value.status === 'loaded') return children(value.data)
  if (value.status === 'loading') return <span role="status">Đang tải…</span>
  return <span title={value.message}>{value.status === 'denied' ? 'Không có quyền' : 'Không khả dụng'}</span>
}

export function ShipListTable({ items, filtered, onReset, onRetry }: { items: ShipListItem[]; filtered: boolean; onReset: () => void; onRetry: (id: string, field: SupplementField) => void }) {
  return <div className={styles.tableContainer} role="region" aria-label="Bảng thông tin đội tàu" tabIndex={0}>
    <table className={styles.table} aria-label="Danh sách tàu">
      <colgroup>{['name', 'code', 'status', 'deck', 'cabin', 'readiness', 'cruise'].map(column => <col key={column} className={styles[`column_${column}`]} />)}</colgroup>
      <thead><tr>{['Tàu', 'Mã', 'Trạng thái', 'Boong', 'Phòng', 'Sẵn sàng', 'Chuyến hiện tại'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{items.map(item => <tr key={item.id}>
        <td><Link className={styles.shipLink} to={`/admin/ships/${item.id}`} aria-label={`Xem tàu ${item.name}`}>{item.name}</Link></td>
        <td>{item.code}</td><td>{shipStatuses[item.status]}</td>
        <td><SupplementValue value={item.capacity} retry={() => onRetry(item.id, 'capacity')} label={`boong ${item.code}`}>{data => data.deckCount}</SupplementValue></td>
        <td><SupplementValue value={item.capacity} retry={() => onRetry(item.id, 'capacity')} label={`phòng ${item.code}`}>{data => data.cabinCount}</SupplementValue></td>
        <td><SupplementValue value={item.readiness} retry={() => onRetry(item.id, 'readiness')} label={`sẵn sàng ${item.code}`}>{data => readinessLabels[data]}</SupplementValue></td>
        <td><SupplementValue value={item.currentCruise} retry={() => onRetry(item.id, 'currentCruise')} label={`chuyến ${item.code}`}>{data => data?.code ?? <span aria-label="Không có chuyến hiện tại">—</span>}</SupplementValue></td>
      </tr>)}</tbody>
    </table>
    {!items.length && <div className={styles.statePanel} role="status">
      <p>{filtered ? 'Không có tàu phù hợp với bộ lọc.' : 'Chưa có tàu trong danh sách.'}</p>
      {filtered ? <Button tone="secondary" className={styles.button} onClick={onReset}>Xóa bộ lọc</Button> : null}
    </div>}
  </div>
}
