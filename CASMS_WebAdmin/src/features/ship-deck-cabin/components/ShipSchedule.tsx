import { useCallback } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Button, Loading, Notice } from '@/shared/ui'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useFleetQuery } from '../hooks/useFleetQuery'
import { CruiseTable } from './CruiseTable'
import type { Ship } from '../model/types'
import type { FleetDialog } from './FleetDialogs'
import styles from '../ship-types/ShipWork.module.css'

export function ShipSchedule({ ship, onDialog }: { ship: Ship; onDialog: (dialog: FleetDialog) => void }) {
  const access = useSessionAccess()
  const canReadCurrent = access.canDo('SHIP_CURRENT_CRUISE')
  const load = useCallback((signal: AbortSignal) => shipDeckCabinApi.getCurrentCruise(ship.id, signal), [ship.id])
  const query = useFleetQuery('ship-current-cruise:' + ship.id, load, canReadCurrent)
  return <div className={styles.scheduleWorkspace}>
    {canReadCurrent && <section className={styles.scheduleSection} aria-labelledby="ship-current-activity-heading">
      <h3 id="ship-current-activity-heading">Chuyến đang khai thác</h3>
      {query.loading && <Loading label="Đang tải chuyến đang khai thác…" />}
      {query.error && <Notice title="Chưa tải được chuyến đang khai thác" tone="error">{query.error} <Button tone="text" onClick={query.retry}>Thử lại</Button></Notice>}
      {!query.loading && !query.error && (query.data ? <CruiseTable rows={[query.data]} label="Chuyến đang khai thác" /> : <p className={styles.scheduleEmpty}>Hiện tàu chưa có chuyến đang khai thác.</p>)}
    </section>}
    {(access.canDo('SHIP_SCHEDULE_CHECK') || access.canDo('SHIP_AFFECTED_CRUISES')) && <section className={styles.scheduleSection} aria-labelledby="ship-activity-lookup-heading">
      <h3 id="ship-activity-lookup-heading">Tra cứu lịch hoạt động</h3>
      <div className={styles.scheduleActions}>
        {access.canDo('SHIP_SCHEDULE_CHECK') && <Button autoWidth onClick={() => onDialog({ type: 'operation', kind: 'ships', item: ship, operation: 'schedule' })}>Kiểm tra lịch trống</Button>}
        {access.canDo('SHIP_AFFECTED_CRUISES') && <Button tone={access.canDo('SHIP_SCHEDULE_CHECK') ? 'secondary' : 'primary'} autoWidth onClick={() => onDialog({ type: 'operation', kind: 'ships', item: ship, operation: 'affected' })}>Xem chuyến theo thời gian</Button>}
      </div>
    </section>}
  </div>
}
