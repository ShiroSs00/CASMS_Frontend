import { useId } from 'react'
import { Button } from '@/shared/ui'
import type { ShipListFilters as Filters } from '../model/ship-list-types'
import { shipStatuses } from '../model/types'
import styles from './ShipList.module.css'

export function ShipListFilters({ value, onChange, onApply, onReset, disabled, canReset }: {
  value: Filters; onChange: (value: Filters) => void; onApply: () => void; onReset: () => void; disabled: boolean; canReset: boolean
}) {
  const id = useId()
  return <form className={styles.filters} aria-label="Bộ lọc tàu" onSubmit={event => { event.preventDefault(); onApply() }}>
    <label className={`${styles.field} ${styles.search}`}>Tìm tàu
      <input type="search" placeholder="Tên hoặc mã" value={value.search} disabled={disabled} onChange={event => onChange({ ...value, search: event.target.value })} />
    </label>
    <label className={styles.field}><span id={`${id}-status`}>Trạng thái</span>
      <select aria-labelledby={`${id}-status`} value={value.status} disabled={disabled} onChange={event => onChange({ ...value, status: event.target.value as Filters['status'] })}>
        <option value="ALL">Tất cả</option><option value="ACTIVE">{shipStatuses.ACTIVE}</option><option value="MAINTENANCE">{shipStatuses.MAINTENANCE}</option><option value="INACTIVE">{shipStatuses.INACTIVE}</option>
      </select>
    </label>
    <label className={styles.field}><span id={`${id}-readiness`}>Sẵn sàng</span>
      <select aria-labelledby={`${id}-readiness`} value={value.readiness} disabled={disabled} onChange={event => onChange({ ...value, readiness: event.target.value as Filters['readiness'] })}>
        <option value="ALL">Tất cả</option><option value="READY">Sẵn sàng</option><option value="ATTENTION">Cần chú ý</option><option value="BLOCKED">Chưa sẵn sàng</option>
      </select>
    </label>
    <Button className={`${styles.button} ${styles.filterButton}`} type="submit" disabled={disabled}>Lọc</Button>
    {canReset && <Button className={`${styles.button} ${styles.resetButton}`} tone="text" onClick={onReset}>Xóa bộ lọc</Button>}
  </form>
}
