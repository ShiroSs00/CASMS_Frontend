import { useState } from 'react'
import { Button, Notice, Panel } from '@/shared/ui'
import { tourGroupApi } from '../api/tour-group-api'
import { useTourMutation } from '../hooks/useTourResource'
import type { GroupCapacity as Capacity, TourGroup } from '../model/tour-group'
import { TourError } from './TourUI'
import styles from './TourGroups.module.css'

export function GroupCapacity({ group }: { group: TourGroup }) {
  const request = useTourMutation()
  const [checked, setChecked] = useState<Capacity | null>(null)
  async function check() {
    setChecked(null)
    const result = await request.run((signal) => tourGroupApi.capacity(group.tourGroupId, signal))
    if (result.ok) setChecked(result.value)
  }
  return <Panel title="Sức chứa nhóm">
    <div className={styles.capacity}><span>Đã phân công: <strong>{group.assignedPassengers}</strong></span><span>Tối đa: <strong>{group.maximumCapacity}</strong></span><span>Chỗ còn lại: <strong>{group.availableCapacity}</strong></span></div>
    <progress className={styles.meter} max={group.maximumCapacity} value={Math.min(group.assignedPassengers, group.maximumCapacity)} aria-label="Số hành khách đã phân công" aria-valuetext={`${group.assignedPassengers} trên ${group.maximumCapacity}`} />
    {group.availableCapacity === 0 && <p>Nhóm không còn chỗ trống.</p>}
    {group.assignedPassengers > group.maximumCapacity && <Notice tone="warning" title="Vượt sức chứa">Số hành khách được phân công đang vượt sức chứa tối đa của nhóm.</Notice>}
    <div className={styles.actions}><Button tone="secondary" disabled={request.busy} onClick={() => void check()}>{request.busy ? 'Đang kiểm tra…' : 'Kiểm tra sức chứa'}</Button></div>
    {request.error != null && <TourError error={request.error} onRetry={() => void check()} />}
    {checked && <Notice title="Kết quả kiểm tra sức chứa">Còn {checked.availableCapacity} chỗ trên sức chứa tối đa {checked.maximumCapacity}.</Notice>}
  </Panel>
}
