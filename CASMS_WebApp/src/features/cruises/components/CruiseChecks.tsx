import { useRef, useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Button, Notice, Panel } from '@/shared/ui'
import { cruiseApi } from '../api/cruise-api'
import type { CapacityDto } from '../api/dto'

export function CruiseChecks({ cruiseId }: { cruiseId: string }) {
  const access = useSessionAccess()
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [schedule, setSchedule] = useState<boolean | null>(null)
  const [capacity, setCapacity] = useState<CapacityDto | null>(null)
  const lock = useRef(false)
  async function check(kind: 'schedule' | 'capacity') {
    if (lock.current || !access.canDo('CRUISE_VALIDATE')) return
    lock.current = true; setBusy(true); setError('')
    try {
      if (kind === 'schedule') {
        setSchedule(null)
        const result = await cruiseApi.validateSchedule(cruiseId)
        if (typeof result !== 'boolean') throw new Error('Kết quả kiểm tra lịch không đúng định dạng.')
        setSchedule(result)
      } else {
        setCapacity(null)
        const result = await cruiseApi.validateCapacity(cruiseId)
        if (!result || typeof result.capacitySufficient !== 'boolean' || !Number.isFinite(result.bookedPassengersCount)) throw new Error('Kết quả kiểm tra sức chứa không đầy đủ.')
        setCapacity(result)
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thực hiện được kiểm tra.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Kiểm tra kế hoạch chuyến" >
    {access.canDo('CRUISE_VALIDATE') && <Button tone="secondary" disabled={busy || !access.canDo('CRUISE_VALIDATE')} onClick={() => void check('schedule')}>Kiểm tra lịch tàu</Button>}{' '}
    {access.canDo('CRUISE_VALIDATE') && <Button tone="secondary" disabled={busy || !access.canDo('CRUISE_VALIDATE')} onClick={() => void check('capacity')}>Kiểm tra sức chứa</Button>}
    {!access.canDo('CRUISE_VALIDATE') && <p>Chưa có quyền kiểm tra chuyến.</p>}
    {error && <Notice tone="error" title="Không kiểm tra được">{error}</Notice>}
    {schedule !== null && <Notice tone={schedule ? 'success' : 'warning'} title="Kết quả lịch tàu">{schedule ? 'Lịch tàu đáp ứng kiểm tra hiện tại.' : 'Lịch tàu chưa đáp ứng điều kiện, cần rà soát phân công.'}</Notice>}
    {capacity && <Notice tone={capacity.capacitySufficient ? 'success' : 'warning'} title="Kết quả sức chứa"><p>{capacity.capacitySufficient ? 'Đáp ứng sức chứa.' : 'Chưa đáp ứng sức chứa.'}</p><p>Đã đặt: {capacity.bookedPassengersCount} · Sức chứa: {capacity.shipTotalCapacity ?? 'Chưa xác định'} · Còn: {capacity.availableCapacity ?? 'Chưa xác định'}.</p></Notice>}
  </Panel>
}
