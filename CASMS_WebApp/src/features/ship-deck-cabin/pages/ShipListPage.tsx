import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { ShipListMetrics } from '../components/ShipListMetrics'
import { ShipListFilters } from '../components/ShipListFilters'
import { ShipListTable } from '../components/ShipListTable'
import { createShipListRepository, type ShipListScenario } from '../mocks/ship-list-repository'
import { emptyShipFilters, filterShips } from '../model/ship-list-types'
import { useShipList } from '../model/useShipList'
import styles from '../components/ShipList.module.css'

export function ShipListPage() {
  const [repository] = useState(() => {
    // Development QA states never change authentication or enable a live API.
    const requested = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('shipListState') : null
    const scenario: ShipListScenario = requested === 'empty' || requested === 'error' || requested === 'loading' ? requested : 'data'
    return createShipListRepository(scenario)
  })
  const { state, retry } = useShipList(repository)
  const [pending, setPending] = useState(emptyShipFilters)
  const [applied, setApplied] = useState(emptyShipFilters)
  const reset = () => { setPending(emptyShipFilters); setApplied(emptyShipFilters) }
  const hasFilters = (value: typeof pending) => Boolean(value.search.trim() || value.status !== 'ALL' || value.readiness !== 'ALL')
  const items = state.status === 'data' ? filterShips(state.data.items, applied) : []
  return <AdminShell>
    <div className={styles.content}>
      <header className={styles.titleRow}>
        <div><h1>Fleet &amp; ships</h1><p>Theo dõi trạng thái tàu, deck/cabin và mức sẵn sàng vận hành.</p></div>
        <Link to="/admin/ships/new" className={styles.createButton}>Tạo tàu</Link>
      </header>
      <ShipListMetrics metrics={state.status === 'data' ? state.data.metrics : undefined} />
      <ShipListFilters value={pending} onChange={setPending} onApply={() => setApplied({ ...pending })} onReset={reset} disabled={state.status !== 'data'} canReset={hasFilters(pending) || hasFilters(applied)} />
      {state.status === 'loading' && <div className={styles.statePanel} role="status" aria-live="polite">Đang tải danh sách tàu…</div>}
      {state.status === 'error' && <div className={`${styles.statePanel} ${styles.error}`} role="alert"><p>{state.message}</p><Button className={styles.button} onClick={retry}>Thử lại</Button></div>}
      {state.status === 'data' && <><ShipListTable items={items} filtered={state.data.items.length > 0 && hasFilters(applied)} onReset={reset} /><p className={styles.srOnly} role="status">{items.length} tàu trong danh sách.</p></>}
    </div>
  </AdminShell>
}
