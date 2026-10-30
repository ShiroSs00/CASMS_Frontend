import { useCallback, useState } from 'react'
import { PermissionLink as Link } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { Button, Empty, Field, Loading, Notice, Panel } from '@/shared/ui'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useFleetQuery } from '../hooks/useFleetQuery'
import { emptyRoomFilters, filterRooms, roomCounts, roomTypeLabels } from '../model/ship-management'
import { cabinStatuses } from '../model/types'
import type { CabinStatus, CabinType, Ship } from '../model/types'
import { StatusBadge } from './Common'
import type { FleetDialog } from './FleetDialogs'
import styles from './ShipManagement.module.css'

export function ShipInventory({ ship, view, initialDeck = '', onDialog }: { ship: Ship; view: 'decks' | 'cabins'; initialDeck?: string; onDialog: (value: FleetDialog) => void }) {
  const access = useSessionAccess()
  const [filters, setFilters] = useState({ ...emptyRoomFilters, deck: initialDeck })
  const [page, setPage] = useState(1)
  const loadDecks = useCallback((signal: AbortSignal) => shipDeckCabinApi.listShipDecks(ship.id, signal), [ship.id])
  const loadRooms = useCallback((signal: AbortSignal) => shipDeckCabinApi.listShipCabins(ship.id, signal), [ship.id])
  const decks = useFleetQuery(`inventory-decks:${ship.id}`, loadDecks, access.canDo('DECK_READ'))
  const rooms = useFleetQuery(`inventory-rooms:${ship.id}`, loadRooms, access.canDo('CABIN_READ'))
  const counts = decks.data && rooms.data ? roomCounts(decks.data, rooms.data) : null
  const filtered = filterRooms(rooms.data ?? [], filters)
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20))
  const currentPage = Math.min(page, pageCount)
  const visibleRooms = filtered.slice((currentPage - 1) * 20, currentPage * 20)
  const deckLabel = (id: string) => { const deck = decks.data?.find(value => value.id === id); return deck ? `Boong ${deck.number}${deck.name ? ` · ${deck.name}` : ''}` : 'Chưa tải thông tin boong' }
  const changeFilters = (next: typeof filters) => { setFilters(next); setPage(1) }
  const hasFilters = Boolean(filters.search || filters.deck || filters.status || filters.type)
  const primary = view === 'decks' ? decks : rooms
  return <Panel className={view==='cabins'?styles.cabinInventory:styles.deckInventory} title={view === 'decks' ? 'Danh sách boong' : 'Danh sách phòng'}>
    <div className={styles.stack}>
      {primary.loading && !primary.data && <Loading label={view === 'decks' ? 'Đang tải boong…' : 'Đang tải phòng…'} />}
      {primary.loading && primary.data && <p className={styles.muted} role="status">Đang cập nhật dữ liệu…</p>}
      {primary.error && <Notice title="Chưa tải được dữ liệu" tone="error">{primary.error}</Notice>}
      {decks.error && view === 'cabins' && <Notice title="Chưa tải được danh sách boong" tone="warning">{decks.error}</Notice>}
      {rooms.error && view === 'decks' && <Notice title="Chưa tải được số phòng theo boong" tone="warning">{rooms.error}</Notice>}
      {view === 'decks' && !access.canDo('DECK_READ') && <Notice title="Chưa có quyền xem boong" tone="warning">Tài khoản cần được cấp quyền đọc boong.</Notice>}
      {view === 'cabins' && !access.canDo('CABIN_READ') && <Notice title="Chưa có quyền xem phòng" tone="warning">Tài khoản cần được cấp quyền đọc phòng.</Notice>}
      {view === 'decks' && decks.data && (decks.data.length ? <ul className={styles.inventoryCards}>{decks.data.map(deck=><li key={deck.id}><div className={styles.inventoryHeading}><h3>Boong {deck.number} · {deck.name||'Chưa đặt tên'}</h3></div><dl className={styles.inventoryFacts}><div><dt>Số phòng</dt><dd>{counts?.get(deck.id)?.total??'—'}</dd></div><div><dt>Phòng sẵn sàng</dt><dd>{counts?.get(deck.id)?.available??'—'}</dd></div><div><dt>Hệ số giá</dt><dd>{(deck.priceMultiplier??1).toLocaleString('vi-VN')}×</dd></div></dl><div className={styles.rowActions}>{access.canDo('CABIN_READ') && <Link className={styles.textLink} to={`/admin/ships/${ship.id}?${new URLSearchParams({tab:'cabins',deck:deck.id})}`}>Xem phòng</Link>}{access.canDo('DECK_UPDATE') && <Button tone="text" size="compact" disabled={decks.loading} onClick={() => onDialog({ type: 'edit', target: { kind: 'decks', item: deck } })}>Chỉnh sửa</Button>}</div></li>)}</ul> : <Empty title="Tàu chưa có boong"></Empty>)}
      {view === 'cabins' && rooms.data && <>
        <div className={styles.filters}>
          <Field htmlFor="fleet-room-search" label="Tìm phòng"><input id="fleet-room-search" value={filters.search} placeholder="Nhập số phòng…" onChange={event => changeFilters({ ...filters, search: event.target.value })} /></Field>
          <Field htmlFor="fleet-room-deck" label="Boong"><select id="fleet-room-deck" value={filters.deck} disabled={!decks.data} onChange={event => changeFilters({ ...filters, deck: event.target.value })}><option value="">Tất cả boong</option>{decks.data?.map(deck => <option key={deck.id} value={deck.id}>Boong {deck.number} · {deck.name}</option>)}</select></Field>
          <Field htmlFor="fleet-room-status" label="Trạng thái"><select id="fleet-room-status" value={filters.status} onChange={event => changeFilters({ ...filters, status: event.target.value as CabinStatus | '' })}><option value="">Tất cả trạng thái</option>{Object.entries(cabinStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field htmlFor="fleet-room-type" label="Loại phòng"><select id="fleet-room-type" value={filters.type} onChange={event => changeFilters({ ...filters, type: event.target.value as CabinType | '' })}><option value="">Tất cả loại phòng</option>{Object.entries(roomTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        </div>
        {hasFilters && <div><Button tone="text" onClick={() => changeFilters({ ...emptyRoomFilters })}>Xóa bộ lọc</Button></div>}
        {visibleRooms.length ? <ul className={styles.inventoryCards}>{visibleRooms.map(room=><li key={room.id}><div className={styles.inventoryHeading}><h3>Phòng {room.number}</h3><StatusBadge status={room.status}/></div><dl className={styles.inventoryFacts}><div><dt>Boong</dt><dd>{deckLabel(room.deckId)}</dd></div><div><dt>Loại phòng</dt><dd>{roomTypeLabels[room.type]}</dd></div><div><dt>Sức chứa</dt><dd>{room.capacity} khách</dd></div><div><dt>Hỗ trợ người khuyết tật</dt><dd>{room.accessible?'Có':'Không'}</dd></div></dl><div className={styles.rowActions}>
            <Button tone="text" size="compact" onClick={() => onDialog({ type: 'room', room, deckName: deckLabel(room.deckId) })}>Chi tiết</Button>
            {access.canDo('CABIN_UPDATE') && <Button tone="text" size="compact" disabled={rooms.loading} onClick={() => onDialog({ type: 'edit', target: { kind: 'cabins', item: room } })}>Chỉnh sửa</Button>}
            {room.status === 'AVAILABLE' && access.canDo('CABIN_BLOCK') && <Button tone="text" size="compact" disabled={rooms.loading} onClick={() => onDialog({ type: 'operation', kind: 'cabins', item: room, operation: 'block' })}>Khóa phòng</Button>}
            {['MAINTENANCE', 'OUT_OF_SERVICE'].includes(room.status) && access.canDo('CABIN_RELEASE') && <Button tone="text" size="compact" disabled={rooms.loading} onClick={() => onDialog({ type: 'operation', kind: 'cabins', item: room, operation: 'release' })}>Mở phòng</Button>}
          </div></li>)}</ul> : <Empty title={rooms.data.length ? 'Không có phòng phù hợp' : 'Tàu chưa có phòng'}></Empty>}
        <div className={styles.pagination}><p className={styles.muted} role="status">{filtered.length} phòng · Trang {currentPage}/{pageCount}</p><div className={styles.rowActions}><Button tone="secondary" size="compact" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trang trước</Button><Button tone="secondary" size="compact" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Trang sau</Button></div></div>
      </>}
    </div>
  </Panel>
}
