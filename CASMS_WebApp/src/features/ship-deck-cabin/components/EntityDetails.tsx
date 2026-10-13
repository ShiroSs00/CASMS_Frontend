import { useCallback, type ReactNode } from 'react'
import { Link } from 'react-router'
import { DataTable, Empty, Notice, Panel } from '@/shared/ui'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useApiQuery } from '../hooks/useAdminData'
import { cabinTypes, formatDate } from '../model/types'
import type { Cabin, DataSnapshot, Deck, Ship } from '../model/types'
import { DataState, Definition, StatusBadge } from './Common'
import styles from './Management.module.css'

function ServicePanel<T>({ title, query, children }: {
  title: string; query: ReturnType<typeof useApiQuery<T>>; children: (data: T | null) => ReactNode
}) {
  return <Panel title={title}><DataState loading={query.loading} error={query.error} retry={query.retry} />
    {!query.loading && !query.error && children(query.data)}
  </Panel>
}
export function ShipInfo({ ship }: { ship: Ship }) {
  const loadCapacity = useCallback((signal: AbortSignal) => shipDeckCabinApi.getShipCapacity(ship.id, signal), [ship.id])
  const loadCruise = useCallback((signal: AbortSignal) => shipDeckCabinApi.getCurrentCruise(ship.id, signal), [ship.id])
  const capacity = useApiQuery(`ship-capacity:${ship.id}`, loadCapacity)
  const current = useApiQuery(`current-cruise:${ship.id}`, loadCruise)
  return <>
    <Panel title="Thông tin tàu"><Definition rows={[
      ['Mã tàu', ship.code], ['Tên tàu', ship.name], ['Trạng thái', <StatusBadge status={ship.status} />],
      ['Sức chứa cấu hình', `${ship.capacity} khách`], ['Tổng số boong cấu hình', ship.totalDecks], ['Ngày đưa vào hoạt động', formatDate(ship.commissionDate)],
      ['Ngày tạo', formatDate(ship.createdAt)], ['Cập nhật gần nhất', formatDate(ship.updatedAt)],
    ]} /></Panel>
    <ServicePanel title="Tổng hợp sức chứa" query={capacity}>{(value) => value ? <>
      <Definition rows={[
        ['Sức chứa cấu hình', `${value.configuredTotalCapacity} khách`], ['Boong thực tế / cấu hình', `${value.actualDeckCount} / ${value.configuredTotalDecks}`],
        ['Số cabin thực tế', value.actualCabinCount], ['Cabin sẵn sàng', value.availableCabinCount],
      ]} />
      <div className={styles.actions}><Link className={styles.link} to={`/admin/decks?ship=${ship.id}`}>Quản lý boong</Link><Link className={styles.link} to={`/admin/cabins?ship=${ship.id}`}>Quản lý cabin</Link></div>
    </> : <Notice title="Chưa nhận được thông tin tổng hợp" tone="warning">Hệ thống chưa trả báo cáo sức chứa.</Notice>}</ServicePanel>
    <ServicePanel title="Chuyến hiện tại" query={current}>{(value) => value ? <Definition rows={[
      ['Mã chuyến', value.code], ['Hành trình', value.name], ['Trạng thái', value.status], ['Khoảng thời gian', `${formatDate(value.departure)} → ${formatDate(value.returnAt)}`],
    ]} /> : <Empty title="Tàu chưa có chuyến đang vận hành" />}</ServicePanel>
  </>
}
export function DeckInfo({ deck, data }: { deck: Deck; data: DataSnapshot }) {
  const ship = data.ships.find((row) => row.id === deck.shipId)
  const loadCapacity = useCallback((signal: AbortSignal) => shipDeckCabinApi.getDeckCapacity(deck.id, signal), [deck.id])
  const loadCabins = useCallback((signal: AbortSignal) => shipDeckCabinApi.getDeckCabins(deck.id, signal), [deck.id])
  const capacity = useApiQuery(`deck-capacity:${deck.id}`, loadCapacity)
  const cabins = useApiQuery(`deck-cabins:${deck.id}`, loadCabins)
  return <>
    <Panel title="Thông tin boong"><Definition rows={[
      ['Số boong', deck.number], ['Tên boong', deck.name || 'Chưa đặt tên'],
      ['Tàu', <Link className={styles.link} to={`/admin/ships/${deck.shipId}`}>{ship ? `${ship.code} · ${ship.name}` : deck.shipId}</Link>],
      ['Ngày tạo', formatDate(deck.createdAt)], ['Cập nhật gần nhất', formatDate(deck.updatedAt)],
    ]} /></Panel>
    <ServicePanel title="Sức chứa boong" query={capacity}>{(value) => value ? <Definition rows={[
      ['Tổng số cabin', value.totalCabins], ['Cabin sẵn sàng', value.availableCabins], ['Tổng sức chứa hành khách', `${value.totalPassengerCapacity} khách`],
    ]} /> : <Notice title="Chưa nhận được thông tin sức chứa" tone="warning">Hệ thống chưa trả báo cáo boong.</Notice>}</ServicePanel>
    <ServicePanel title={`Cabin trên boong ${deck.number}`} query={cabins}>{(rows) => rows?.length ? <DataTable label="Cabin trên boong" headers={['SỐ CABIN', 'LOẠI', 'SỨC CHỨA', 'TRẠNG THÁI', 'THAO TÁC']}>
      {rows.map((row) => <tr key={row.id}><td>{row.number}</td><td>{cabinTypes[row.type]}</td><td>{row.capacity} khách</td><td><StatusBadge status={row.status} /></td><td><Link className={styles.link} to={`/admin/cabins/${row.id}`}>Xem chi tiết</Link></td></tr>)}
    </DataTable> : <Empty title="Boong chưa có cabin"><Link className={styles.link} to={`/admin/cabins/new?ship=${deck.shipId}&deck=${deck.id}`}>Thêm cabin</Link></Empty>}</ServicePanel>
  </>
}
export function CabinInfo({ cabin, data }: { cabin: Cabin; data: DataSnapshot }) {
  const ship = data.ships.find((row) => row.id === cabin.shipId)
  const deck = data.decks.find((row) => row.id === cabin.deckId)
  const load = useCallback((signal: AbortSignal) => shipDeckCabinApi.getHistory(cabin.id, signal), [cabin.id])
  const history = useApiQuery(`assignments:${cabin.id}`, load)
  return <>
    <Panel title="Thông tin cabin"><Definition rows={[
      ['Số cabin', cabin.number], ['Loại cabin', cabinTypes[cabin.type]], ['Trạng thái', <StatusBadge status={cabin.status} />],
      ['Tàu', <Link className={styles.link} to={`/admin/ships/${cabin.shipId}`}>{ship ? `${ship.code} · ${ship.name}` : cabin.shipId}</Link>],
      ['Boong', <Link className={styles.link} to={`/admin/decks/${cabin.deckId}`}>{deck ? `Boong ${deck.number} · ${deck.name}` : cabin.deckId}</Link>],
      ['Sức chứa', `${cabin.capacity} khách`], ['Hỗ trợ tiếp cận', cabin.accessible ? 'Có' : 'Không'],
    ]} /></Panel>
    <ServicePanel title="Lịch sử gán cabin" query={history}>{(rows) => rows?.length ? <DataTable label="Lịch sử gán cabin" headers={['HÀNH KHÁCH ĐẶT CHỖ', 'BẮT ĐẦU', 'KẾT THÚC', 'NGƯỜI GÁN', 'LÝ DO']}>
      {rows.map((row) => <tr key={row.id}><td>{row.passengerId}</td><td>{formatDate(row.from)}</td><td>{row.to ? formatDate(row.to) : 'Đang hiệu lực'}</td><td>{row.actorId || 'Chưa cập nhật'}</td><td>{row.reason || '—'}</td></tr>)}
    </DataTable> : <Empty title="Chưa có lịch sử gán cabin" />}</ServicePanel>
  </>
}
