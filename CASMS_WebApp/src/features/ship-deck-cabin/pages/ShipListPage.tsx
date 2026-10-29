import { useState } from 'react'
import { PermissionLink as Link, Button, PageHeader, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { ShipListFilters } from '../components/ShipListFilters'
import { FleetShipCards } from '../components/FleetShipCards'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { emptyShipFilters, filterShips } from '../model/ship-list-types'
import { useShipList } from '../model/useShipList'
import styles from '../components/ShipManagement.module.css'

const repository = { load: shipDeckCabinApi.loadShipList, loadField: shipDeckCabinApi.loadShipListField }

export function ShipListPage() {
  const { state, retry, retrySupplement } = useShipList(repository)
  const [pending, setPending] = useState(emptyShipFilters)
  const [applied, setApplied] = useState(emptyShipFilters)
  const reset = () => { setPending(emptyShipFilters); setApplied(emptyShipFilters) }
  const hasFilters = (value: typeof pending) => Boolean(value.search.trim() || value.status !== 'ALL')
  const items = state.status === 'data' ? filterShips(state.data.items, applied) : []
  return <AdminShell>
    <div className={styles.stack}>
      <PageHeader breadcrumb="ĐỘI TÀU / HỒ SƠ TÀU" title="Quản lý tàu"  actions={<Link className={styles.manageLink} to="/admin/decks">Boong & Cabin <span aria-hidden="true">↗</span></Link>} />
      <Panel className={styles.fleetFilterPanel}><ShipListFilters value={pending} onChange={setPending} onApply={() => setApplied({ ...pending })} onReset={reset} disabled={state.status !== 'data'} canReset={hasFilters(pending) || hasFilters(applied)} /></Panel>
      {state.status === 'loading' && <Panel><p role="status">Đang tải danh sách tàu…</p></Panel>}
      {state.status === 'error' && <Panel><div role="alert"><p>{state.message}</p><Button onClick={retry}>Thử lại</Button></div></Panel>}
      {state.status === 'data' && <><div className={styles.sectionHeading}><h2>Danh sách tàu</h2><span role="status">{items.length} tàu</span></div><FleetShipCards items={items} filtered={state.data.items.length > 0 && hasFilters(applied)} onReset={reset} onRetry={retrySupplement} /></>}
    </div>
  </AdminShell>
}
