import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useFleetQuery } from '../hooks/useFleetQuery'
import { ShipInventory } from '../components/ShipInventory'
import { FleetDialogs, type FleetDialog } from '../components/FleetDialogs'
import { StatusBadge } from '../components/Common'
import type { Ship } from '../model/types'
import styles from '../components/ShipManagement.module.css'

function SelectedInventory({ ship, view, deck }: { ship: Ship; view: 'decks' | 'cabins'; deck: string }) {
  const [dialog, setDialog] = useState<FleetDialog | null>(null)
  const [saved, setSaved] = useState('')
  return <>{saved && <Notice title="Đã lưu thay đổi" tone="success">{saved}</Notice>}<ShipInventory ship={ship} view={view} initialDeck={deck} onDialog={setDialog} /><FleetDialogs dialog={dialog} ship={ship} onChange={setDialog} onSaved={setSaved} /></>
}
function StructurePage({ view: initialView }: { view: 'decks' | 'cabins' }) {
  const access = useSessionAccess()
  const [params, setParams] = useSearchParams()
  const requestedView = params.get('view') === 'cabins' ? 'cabins' : params.get('view') === 'decks' ? 'decks' : initialView
  const view = requestedView === 'decks' && !access.has('DECK_READ') && access.has('CABIN_READ') ? 'cabins' : requestedView
  const load = useCallback((signal: AbortSignal) => shipDeckCabinApi.listShips(signal), [])
  const ships = useFleetQuery('structure-ship-choices', load, access.has('SHIP_READ'))
  const selectedId = params.get('ship') ?? ''
  const selected = ships.data?.find(ship => ship.id === selectedId)
  return <AdminShell><div className={styles.stack}>
    <div className={styles.dashboardHeading}><PageHeader breadcrumb="Boong & Cabin" title="Boong & Cabin" description="" /></div>
    {selected && <Panel className={styles.structureToolbar}><div className={styles.shipPicker}>
      <Field htmlFor="structure-ship" label="Tàu"><select id="structure-ship" value={selectedId} disabled={!ships.data?.length || ships.loading} onChange={event => { const next = new URLSearchParams({ view }); if (event.target.value) next.set('ship', event.target.value); setParams(next) }}><option value="">Chọn tàu</option>{ships.data?.map(ship => <option key={ship.id} value={ship.id}>{ship.name} · {ship.code}</option>)}</select></Field>
      <Link className={styles.textLink} to="/admin/decks">Tất cả tàu <span aria-hidden="true">↗</span></Link>
    </div>
    </Panel>}
    {!access.has('SHIP_READ') && <Notice title="Chưa có quyền xem tàu" tone="warning">Tài khoản cần quyền đọc tàu để chọn dữ liệu quản lý.</Notice>}
    {ships.loading && !ships.data && <Loading label="Đang tải danh sách tàu…" />}
    {ships.error && <Notice title="Không tải được danh sách tàu" tone="error">{ships.error}<Button tone="text" onClick={ships.retry}>Thử lại</Button></Notice>}
    {!ships.loading && !ships.error && ships.data?.length === 0 && <Notice title="Chưa có tàu" tone="info">Tàu sẽ xuất hiện sau khi quản trị viên hoàn tất nhập dữ liệu.</Notice>}
    {!ships.loading && !ships.error && selectedId && ships.data && !selected && <Notice title="Không tìm thấy tàu đã chọn" tone="warning">Vui lòng chọn lại tàu trong danh sách.</Notice>}
    {!selected && Boolean(ships.data?.length) && <Panel className={styles.shipSelection} title="Danh sách tàu">
      <div className={styles.shipChoiceGrid}>{ships.data?.map(ship => <Link key={ship.id} to={`/admin/decks?${new URLSearchParams({ ship: ship.id, view })}`} className={styles.shipChoice} aria-label={`Xem boong và cabin của ${ship.name}`}>
        <div className={styles.shipChoiceTop}>
          <span className={styles.shipIcon} aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12 12 9l8 3-2 6H6l-2-6Z"/><path d="M7 11V5h10v6M10 5V2h4v3M12 9v9M3 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1"/></svg></span>
          <StatusBadge status={ship.status} />
        </div>
        <div className={styles.shipChoiceIdentity}><h3>{ship.name}</h3><span>{ship.code}</span></div>
        <dl className={styles.shipChoiceFacts}>
          <div><dt>Boong</dt><dd>{ship.totalDecks}</dd></div>
          <div><dt>Sức chứa</dt><dd>{ship.capacity.toLocaleString('vi-VN')} <span>khách</span></dd></div>
        </dl>
        <span className={styles.shipChoiceAction}>Quản lý boong & cabin <span aria-hidden="true">→</span></span>
      </Link>)}</div>
    </Panel>}
    {selected && <nav className={styles.structureTabs} aria-label="Cấu trúc tàu">
      {([['decks', 'Boong', 'DECK_READ'], ['cabins', 'Cabin', 'CABIN_READ']] as const).filter(([, , permission])=>access.has(permission)).map(([tab, label])=><Link key={tab} to={`/admin/decks?${new URLSearchParams({ ship:selected.id, view:tab })}`} aria-current={view===tab?'page':undefined}>{label}</Link>)}
    </nav>}
    {selected ? <SelectedInventory key={`${view}:${selected.id}:${params.get('deck') ?? ''}`} ship={selected} view={view} deck={params.get('deck') ?? ''} />
      : null}
  </div></AdminShell>
}
export function ShipDeckListPage() { return <StructurePage view="decks" /> }
export function ShipCabinListPage() { return <StructurePage view="cabins" /> }
