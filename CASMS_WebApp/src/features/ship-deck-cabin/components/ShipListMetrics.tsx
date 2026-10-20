import type { ShipListMetrics as Metrics } from '../model/ship-list-types'
import styles from './ShipList.module.css'

const cards = [
  { key: 'activeCount', label: 'Đang hoạt động', note: 'đội tàu đang hoạt động', tone: 'success' },
  { key: 'maintenanceCount', label: 'Bảo trì', note: 'tàu đang bảo trì', tone: 'warning' },
  { key: 'configuredCabinCount', label: 'Phòng', note: 'đã cấu hình', tone: 'brand' },
  { key: 'attentionCount', label: 'Cần chú ý', note: 'liên kết / cấu hình', tone: 'danger' },
] as const

export function ShipListMetrics({ metrics }: { metrics?: Metrics }) {
  return <dl className={styles.metrics} aria-label="Tổng hợp đội tàu">
    {cards.map(card => <div key={card.key} className={styles.metric}>
      <dt>{card.label}</dt>
      <dd className={`${styles.metricValue} ${styles[card.tone]}`}>{metrics && metrics[card.key] !== null ? String(metrics[card.key]).padStart(2, '0') : <span aria-label="Chưa có dữ liệu">—</span>}</dd>
      <dd className={styles.metricNote}>{card.note}</dd>
    </div>)}
  </dl>
}
