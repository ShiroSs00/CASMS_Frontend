import { useCallback } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Button, Empty, Loading, Notice, Panel } from '@/shared/ui'
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
  return <div className={styles.stack}>
    {canReadCurrent && <Panel title="Chuyến đang khai thác">
      {query.loading && <Loading />}
      {query.error && <Notice title="Chưa tải được chuyến đang khai thác" tone="error">{query.error} <Button tone="text" onClick={query.retry}>Thử lại</Button></Notice>}
      {!query.loading && !query.error && (query.data ? <CruiseTable rows={[query.data]} /> : <Empty title="Tàu chưa có chuyến đang khai thác" />)}
    </Panel>}
    <Panel title="Tra cứu lịch theo thời gian">
      <div className={styles.actions}>
        {access.canDo('SHIP_SCHEDULE_CHECK') && <Button tone="secondary" onClick={() => onDialog({ type: 'operation', kind: 'ships', item: ship, operation: 'schedule' })}>Kiểm tra lịch trống</Button>}
        {access.canDo('SHIP_AFFECTED_CRUISES') && <Button tone="secondary" onClick={() => onDialog({ type: 'operation', kind: 'ships', item: ship, operation: 'affected' })}>Xem các chuyến trong khoảng thời gian</Button>}
      </div>
    </Panel>
  </div>
}
