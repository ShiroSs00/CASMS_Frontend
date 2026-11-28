import { useCallback, useState } from 'react'
import { useLocation } from 'react-router'
import { PermissionLink as Link } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Field, Loading, Notice, Panel, ListFooter } from '@/shared/ui'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useFleetQuery } from '../hooks/useFleetQuery'
import { emptyRoomFilters, filterRooms, roomCounts, roomTypeLabels } from '../model/ship-management'
import { cabinStatuses } from '../model/types'
import type { CabinStatus, CabinType, Ship } from '../model/types'
import {paginateFleet} from '../model/fleet-pagination'
import {FleetPagination} from './FleetPagination'
import { StatusBadge } from './Common'
import type { FleetDialog } from './FleetDialogs'
import styles from './ShipManagement.module.css'

const ROOMS_PER_PAGE = 10

export function ShipInventory({ ship, view, initialDeck = '', onDialog }: { ship: Ship; view: 'decks' | 'cabins'; initialDeck?: string; onDialog: (value: FleetDialog) => void }) {
  const access = useSessionAccess()
  const { state } = useLocation()
  const [filters, setFilters] = useState({ ...emptyRoomFilters, deck: initialDeck })
  const [page, setPage] = useState(1)
  const canReadDecks = access.canDo('DECK_READ')
  const loadDecks = useCallback((signal: AbortSignal) => shipDeckCabinApi.listShipDecks(ship.id, signal), [ship.id])
  const decks = useFleetQuery(`inventory-decks:${ship.id}`, loadDecks, canReadDecks)
  const selectedDeck = decks.data?.find(deck => deck.id === filters.deck) ?? decks.data?.[0]
  const loadRooms=useCallback((signal:AbortSignal)=>view==='cabins'&&selectedDeck?shipDeckCabinApi.listDeckCabins(ship.id,selectedDeck.id,signal):shipDeckCabinApi.listShipCabins(ship.id,signal),[ship.id,view,selectedDeck])
  const rooms=useFleetQuery(`inventory-rooms:${ship.id}:${view}:${selectedDeck?.id??''}:${canReadDecks}`,loadRooms,access.canDo('CABIN_READ')&&(view==='decks'||Boolean(selectedDeck)||!canReadDecks))
  const deckPagination=paginateFleet(decks.data??[],page,12)
  const counts = decks.data && rooms.data ? roomCounts(decks.data, rooms.data) : null
  const filtered = filterRooms(rooms.data ?? [], filters)
  const pageCount = Math.max(1, Math.ceil(filtered.length / ROOMS_PER_PAGE))
  const currentPage = Math.min(page, pageCount)
  const visibleRooms = filtered.slice((currentPage - 1) * ROOMS_PER_PAGE, currentPage * ROOMS_PER_PAGE)
  const deckLabel = (id: string) => { const deck = decks.data?.find(value => value.id === id); return deck ? `Boong ${deck.number}${deck.name ? ` · ${deck.name}` : ''}` : 'Chưa tải thông tin boong' }
  const changeFilters = (next: typeof filters) => { setFilters(next); setPage(1) }
  const hasFilters = Boolean(filters.search || filters.status || filters.type)
  const primary = view === 'decks' ? decks : rooms
  return <Panel className={view==='cabins'?styles.cabinInventory:styles.deckInventory} title={view === 'decks' ? 'Cấu trúc boong trên tàu' : 'Cabin vật lý trên tàu'}>
    <div className={styles.stack}>
      {view==='cabins'&&canReadDecks&&<div className={styles.roomDeckPicker}><Field htmlFor="fleet-room-deck" label="Boong"><select id="fleet-room-deck" value={selectedDeck?.id??''} disabled={!decks.data?.length||decks.loading} onChange={event=>changeFilters({...emptyRoomFilters,deck:event.target.value})}>{!decks.data?.length&&<option value="">{decks.loading?'Đang tải boong…':'Chưa có boong'}</option>}{decks.data?.map(deck=><option key={deck.id} value={deck.id}>Boong {deck.number} · {deck.name}</option>)}</select></Field></div>}

      {primary.loading && !primary.data && <Loading label={view === 'decks' ? 'Đang tải boong…' : 'Đang tải cabin…'} />}
      {primary.loading && primary.data && <p className={styles.muted} role="status">Đang cập nhật dữ liệu…</p>}
      {primary.error && <Notice title="Chưa tải được dữ liệu" tone="error">{primary.error}</Notice>}
      {decks.error && view === 'cabins' && canReadDecks && <Notice title="Chưa tải được danh sách boong" tone="warning">{decks.error}</Notice>}
      {rooms.error && view === 'decks' && <Notice title="Chưa tải được số cabin theo boong" tone="warning">{rooms.error}</Notice>}
      {view === 'decks' && !canReadDecks && <Notice title="Chưa có quyền xem boong" tone="warning">Tài khoản cần được cấp quyền đọc boong.</Notice>}
      {view === 'cabins' && !access.canDo('CABIN_READ') && <Notice title="Chưa có quyền xem cabin" tone="warning">Tài khoản cần được cấp quyền đọc cabin.</Notice>}
      {view === 'decks' && decks.data && (decks.data.length ? <>
        <div className={styles.inventoryTable}><DataTable label="Danh sách boong" headers={['Boong số', 'Tên boong', 'Tổng cabin', 'Cabin sẵn sàng', 'Thao tác']}>
          {deckPagination.items.map(deck => <tr key={deck.id}>
            <td className={styles.inventoryNumber}>{deck.number}</td><th scope="row">{deck.name || 'Chưa đặt tên'}</th>
            <td className={styles.inventoryNumber}>{counts?.get(deck.id)?.total ?? '—'}</td><td className={styles.inventoryNumber}>{counts?.get(deck.id)?.available ?? '—'}</td>
            <td><div className={styles.inventoryRowActions}>
              {access.canDo('CABIN_READ') && <Link state={state} className={styles.textLink} to={`/admin/ships/${ship.id}?${new URLSearchParams({tab:'cabins',deck:deck.id})}`}>Cabin</Link>}
              {access.canDo('SHIP_CONFIGURATION_READ') && <Link state={state} className={styles.textLink} to={`/admin/ships/${ship.id}?${new URLSearchParams({tab:'areas',deck:deck.id})}`}>Khu vực dịch vụ</Link>}
              {!ship.archivedAt && access.canDo('DECK_UPDATE') && <Button tone="text" size="compact" disabled={decks.loading} onClick={() => onDialog({ type: 'edit', target: { kind: 'decks', item: deck } })}>Chỉnh sửa</Button>}
            </div></td>
          </tr>)}
        </DataTable></div>
        {deckPagination.pages > 1 && <FleetPagination pagination={deckPagination} onChange={setPage} label="boong" />}
      </> : <Empty title="Tàu chưa có boong" />)}
      {view === 'cabins' && (selectedDeck || !canReadDecks) && rooms.data && <>
        <div className={styles.roomFilters} style={{ alignItems: 'end' }}>
          <Field htmlFor="fleet-room-search" label="Tìm cabin"><input id="fleet-room-search" value={filters.search} placeholder="Nhập số cabin…" onChange={event => changeFilters({ ...filters, search: event.target.value })} /></Field>
          <Field htmlFor="fleet-room-status" label="Trạng thái vật lý"><select id="fleet-room-status" value={filters.status} onChange={event => changeFilters({ ...filters, status: event.target.value as CabinStatus | '' })}><option value="">Tất cả trạng thái</option>{Object.entries(cabinStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field htmlFor="fleet-room-type" label="Hạng cabin"><select id="fleet-room-type" value={filters.type} onChange={event => changeFilters({ ...filters, type: event.target.value as CabinType | '' })}><option value="">Tất cả hạng cabin</option>{Object.entries(roomTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          {hasFilters && <Button tone="secondary" size="compact" autoWidth onClick={() => changeFilters({ ...emptyRoomFilters, deck: filters.deck })}>Xóa lọc</Button>}
        </div>
        {visibleRooms.length ? <div className={styles.inventoryTable}><DataTable label="Danh sách cabin vật lý" headers={['Số cabin', 'Hạng cabin', 'Sức chứa', 'Hỗ trợ tiếp cận', 'Trạng thái vật lý', 'Thao tác']}>
          {visibleRooms.map(room => <tr key={room.id}><th scope="row">{room.number}</th><td>{roomTypeLabels[room.type]}</td><td className={styles.inventoryNumber}>{room.capacity}</td><td>{room.accessible ? 'Có' : 'Không'}</td><td><StatusBadge status={room.status} /></td><td><div className={styles.inventoryRowActions}>
            <Button tone="secondary" size="compact" autoWidth onClick={() => onDialog({ type: 'room', room, deckName: deckLabel(room.deckId) })}>Chi tiết</Button>
            {!ship.archivedAt && access.canDo('CABIN_UPDATE') && <Button tone="secondary" size="compact" autoWidth disabled={rooms.loading} onClick={() => onDialog({ type: 'edit', target: { kind: 'cabins', item: room } })}>Chỉnh sửa</Button>}
            {!ship.archivedAt && room.status === 'AVAILABLE' && access.canDo('CABIN_BLOCK') && <Button tone="secondary" size="compact" autoWidth disabled={rooms.loading} onClick={() => onDialog({ type: 'operation', kind: 'cabins', item: room, operation: 'block' })}>Khóa cabin</Button>}
            {!ship.archivedAt && ['MAINTENANCE', 'OUT_OF_SERVICE'].includes(room.status) && access.canDo('CABIN_RELEASE') && <Button tone="secondary" size="compact" autoWidth disabled={rooms.loading} onClick={() => onDialog({ type: 'operation', kind: 'cabins', item: room, operation: 'release' })}>Mở cabin</Button>}
          </div></td></tr>)}
        </DataTable></div> : <Empty title={rooms.data.length ? 'Không có cabin phù hợp' : canReadDecks ? 'Boong này chưa có cabin' : 'Tàu chưa có cabin'} />}
        {filtered.length > 0 && <ListFooter summary={`${((currentPage-1)*ROOMS_PER_PAGE+1)}–${Math.min(currentPage*ROOMS_PER_PAGE,filtered.length)} / ${filtered.length} cabin`}><Button tone="secondary" size="compact" autoWidth disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>← Trước</Button><span aria-live="polite">{currentPage} / {pageCount}</span><Button tone="secondary" size="compact" autoWidth disabled={currentPage>=pageCount} onClick={()=>setPage(currentPage+1)}>Sau →</Button></ListFooter>}
      </>}
    </div>
  </Panel>
}
