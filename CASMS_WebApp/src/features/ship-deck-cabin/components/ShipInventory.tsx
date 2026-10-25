import { useCallback, useState } from 'react'
import { PermissionLink as Link } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Field, Loading, Notice, Panel } from '@/shared/ui'
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
  return <Panel className={view==='cabins'?styles.cabinInventory:styles.deckInventory} title={view === 'decks' ? 'Danh sách boong' : 'Danh sách cabin'}>
    <div className={styles.stack}>
      {primary.loading && !primary.data && <Loading label={view === 'decks' ? 'Đang tải boong…' : 'Đang tải phòng…'} />}
      {primary.loading && primary.data && <p className={styles.muted} role="status">Đang cập nhật dữ liệu…</p>}
      {primary.error && <Notice title="Chưa tải được dữ liệu" tone="error">{primary.error}<Button tone="text" onClick={primary.retry}>Thử lại</Button></Notice>}
      {decks.error && view === 'cabins' && <Notice title="Chưa tải được danh sách boong" tone="warning">{decks.error}<Button tone="text" onClick={decks.retry}>Tải lại boong</Button></Notice>}
      {rooms.error && view === 'decks' && <Notice title="Chưa tải được số phòng theo boong" tone="warning">{rooms.error}<Button tone="text" onClick={rooms.retry}>Tải lại số phòng</Button></Notice>}
      {view === 'decks' && !access.canDo('DECK_READ') && <Notice title="Chưa có quyền xem boong" tone="warning">Tài khoản cần được cấp quyền đọc boong.</Notice>}
      {view === 'cabins' && !access.canDo('CABIN_READ') && <Notice title="Chưa có quyền xem phòng" tone="warning">Tài khoản cần được cấp quyền đọc phòng.</Notice>}
      {view === 'decks' && decks.data && (decks.data.length ? <DataTable label={`Boong của ${ship.name}`} headers={['Boong', 'Tên boong', 'Số phòng', 'Phòng sẵn sàng', 'Hệ số giá', 'Thao tác']}>
        {decks.data.map(deck => <tr key={deck.id}>
          <td><strong>Boong {deck.number}</strong></td><td>{deck.name || 'Chưa đặt tên'}</td><td>{counts?.get(deck.id)?.total ?? '—'}</td><td>{counts?.get(deck.id)?.available ?? '—'}</td><td>{(deck.priceMultiplier ?? 1).toLocaleString('vi-VN', { minimumFractionDigits: 2 })}×</td>
          <td><div className={styles.rowActions}>{access.canDo('CABIN_READ') && <Link className={styles.textLink} to={`/admin/decks?${new URLSearchParams({ship:ship.id,view:'cabins',deck:deck.id})}`}>Xem cabin</Link>}{access.canDo('DECK_UPDATE') && <Button tone="text" size="compact" disabled={decks.loading} onClick={() => onDialog({ type: 'edit', target: { kind: 'decks', item: deck } })}>Chỉnh sửa</Button>}</div></td>
        </tr>)}
      </DataTable> : <Empty title="Tàu chưa có boong"><p>Hoàn tất nhập cấu trúc mô hình để boong của tàu xuất hiện tại đây.</p></Empty>)}
      {view === 'cabins' && rooms.data && <>
        <div className={styles.filters}>
          <Field htmlFor="fleet-room-search" label="Tìm phòng"><input id="fleet-room-search" value={filters.search} placeholder="Nhập số phòng…" onChange={event => changeFilters({ ...filters, search: event.target.value })} /></Field>
          <Field htmlFor="fleet-room-deck" label="Boong"><select id="fleet-room-deck" value={filters.deck} disabled={!decks.data} onChange={event => changeFilters({ ...filters, deck: event.target.value })}><option value="">Tất cả boong</option>{decks.data?.map(deck => <option key={deck.id} value={deck.id}>Boong {deck.number} · {deck.name}</option>)}</select></Field>
          <Field htmlFor="fleet-room-status" label="Trạng thái"><select id="fleet-room-status" value={filters.status} onChange={event => changeFilters({ ...filters, status: event.target.value as CabinStatus | '' })}><option value="">Tất cả trạng thái</option>{Object.entries(cabinStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field htmlFor="fleet-room-type" label="Loại phòng"><select id="fleet-room-type" value={filters.type} onChange={event => changeFilters({ ...filters, type: event.target.value as CabinType | '' })}><option value="">Tất cả loại phòng</option>{Object.entries(roomTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        </div>
        {hasFilters && <div><Button tone="text" onClick={() => changeFilters({ ...emptyRoomFilters })}>Xóa bộ lọc</Button></div>}
        {visibleRooms.length ? <DataTable label={`Phòng của ${ship.name}`} headers={['Phòng', 'Boong', 'Loại phòng', 'Sức chứa', 'Trạng thái', 'Hỗ trợ tiếp cận', 'Thao tác']}>
          {visibleRooms.map(room => <tr key={room.id}><td><strong>{room.number}</strong></td><td>{deckLabel(room.deckId)}</td><td>{roomTypeLabels[room.type]}</td><td>{room.capacity} khách</td><td><StatusBadge status={room.status} /></td><td>{room.accessible ? 'Có' : 'Không'}</td><td><div className={styles.rowActions}>
            <Button tone="text" size="compact" onClick={() => onDialog({ type: 'room', room, deckName: deckLabel(room.deckId) })}>Chi tiết</Button>
            {access.canDo('CABIN_UPDATE') && <Button tone="text" size="compact" disabled={rooms.loading} onClick={() => onDialog({ type: 'edit', target: { kind: 'cabins', item: room } })}>Chỉnh sửa</Button>}
            {room.status === 'AVAILABLE' && access.canDo('CABIN_BLOCK') && <Button tone="text" size="compact" disabled={rooms.loading} onClick={() => onDialog({ type: 'operation', kind: 'cabins', item: room, operation: 'block' })}>Khóa phòng</Button>}
            {['MAINTENANCE', 'OUT_OF_SERVICE'].includes(room.status) && access.canDo('CABIN_RELEASE') && <Button tone="text" size="compact" disabled={rooms.loading} onClick={() => onDialog({ type: 'operation', kind: 'cabins', item: room, operation: 'release' })}>Mở phòng</Button>}
          </div></td></tr>)}
        </DataTable> : <Empty title={rooms.data.length ? 'Không có phòng phù hợp' : 'Tàu chưa có phòng'}><p>{rooms.data.length ? 'Điều chỉnh hoặc xóa bộ lọc để xem lại danh sách.' : 'Hoàn tất nhập boong và phòng để bắt đầu quản lý.'}</p></Empty>}
        <div className={styles.pagination}><p className={styles.muted} role="status">{filtered.length} phòng · Trang {currentPage}/{pageCount}</p><div className={styles.rowActions}><Button tone="secondary" size="compact" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trang trước</Button><Button tone="secondary" size="compact" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Trang sau</Button></div></div>
      </>}
    </div>
  </Panel>
}
