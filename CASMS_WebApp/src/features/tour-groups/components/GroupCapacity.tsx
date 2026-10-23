import { Notice, Panel } from '@/shared/ui'
import type { TourGroup } from '../model/tour-group'
import styles from './TourGroups.module.css'

export function GroupCapacity({ group }: { group: TourGroup }) {
  const assigned = group.assignedPassengers
  const filled = Math.min(assigned, group.maximumCapacity)
  const percent = Math.round(filled / group.maximumCapacity * 100)
  return <Panel title="Sức chứa nhóm">
    <div className={styles.capacity}><span>Đã phân công: <strong>{assigned}/{group.maximumCapacity} khách</strong></span><span>Chỗ còn lại: <strong>{group.availableCapacity}</strong></span></div>
    {assigned > 0 ? <div className={styles.capacityProgress}>
      <div className={styles.capacityLabel}><span>Mức sử dụng sức chứa</span><strong>{percent}%</strong></div>
      <progress className={styles.meter} max={group.maximumCapacity} value={filled} aria-label="Số hành khách đã phân công" aria-valuetext={`${assigned} trên ${group.maximumCapacity} khách, ${percent}%`} />
    </div> : <p className={styles.hint}>Chưa có hành khách được phân công.</p>}
    {group.availableCapacity === 0 && <p>Nhóm không còn chỗ trống.</p>}
    {group.assignedPassengers > group.maximumCapacity && <Notice tone="warning" title="Vượt sức chứa">Số hành khách được phân công đang vượt sức chứa tối đa của nhóm.</Notice>}
  </Panel>
}
