import type {ShipListMetrics as Metrics} from '../model/ship-list-types'
import {shipStatuses,type ShipStatus} from '../model/types'
import styles from './ShipListMetrics.module.css'

const cards = [
  ['DRAFT','draftCount'],['READY','readyCount'],['IN_SERVICE','inServiceCount'],
  ['MAINTENANCE','maintenanceCount'],['SUSPENDED','suspendedCount'],['RETIRED','retiredCount'],
] as const
export function ShipListMetrics({metrics,selected,onSelect}:{metrics?:Metrics;selected:ShipStatus|'ALL';onSelect:(status:ShipStatus)=>void}) {
  return <div className={styles.metrics} role="group" aria-label="Lọc tàu theo trạng thái">
    {cards.map(([status,key])=><button type="button" key={status} className={styles.metric} data-status={status} aria-pressed={selected===status} disabled={!metrics} onClick={()=>onSelect(status)}>
      <span className={styles.label}><i aria-hidden="true"/>{shipStatuses[status]}</span>
      <strong>{metrics?metrics[key].toLocaleString('vi-VN'):'—'}</strong>
    </button>)}
  </div>
}
