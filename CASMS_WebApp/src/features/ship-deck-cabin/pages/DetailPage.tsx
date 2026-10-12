import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { AdminFrame, Button, DataTable, Empty, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { useAdminData, useMutation } from '../hooks/useAdminData'
import { shipDeckCabinAdapter } from '../mocks/adapter'
import { cabinTypes, entityName, formatDate, kindLabels, sectionLabels } from '../model/types'
import type { Cabin, DataSnapshot, Deck, EntityKind, Ship } from '../model/types'
import { DataState, Definition, NotFound, StatusBadge } from '../components/Common'
import { OperationDialog, type Operation } from '../components/OperationDialog'
import styles from '../components/Management.module.css'

function CabinRows({ data, shipId, deckId }: { data: DataSnapshot; shipId: string; deckId?: string }) {
  const rows = data.cabins.filter((row) => row.shipId === shipId && (!deckId || row.deckId === deckId))
  return rows.length ? <DataTable label="Cabin liên quan" headers={['SỐ CABIN', 'BOONG', 'LOẠI', 'SỨC CHỨA', 'TRẠNG THÁI', 'THAO TÁC']}>
    {rows.map((row) => <tr key={row.id}><td>{row.number}</td><td>{data.decks.find((deck) => deck.id === row.deckId)?.number}</td><td>{cabinTypes[row.type]}</td><td>{row.capacity} khách</td><td><StatusBadge status={row.status} /></td><td><Link className={styles.link} to={`/admin/cabins/${row.id}`}>Xem chi tiết</Link></td></tr>)}
  </DataTable> : <Empty title="Chưa có cabin"><Link className={styles.link} to={`/admin/cabins/new?ship=${shipId}`}>Thêm cabin</Link></Empty>
}
function ShipInfo({ ship, data }: { ship: Ship; data: DataSnapshot }) {
  const decks = data.decks.filter((row) => row.shipId === ship.id)
  const cabins = data.cabins.filter((row) => row.shipId === ship.id)
  const cruises = shipDeckCabinAdapter.getCruises(ship.id)
  return <>
    <Panel title="Thông tin tàu"><Definition rows={[
      ['Mã tàu', ship.code], ['Tên tàu', ship.name], ['Trạng thái', <StatusBadge status={ship.status} />],
      ['Sức chứa cấu hình', `${ship.capacity} khách`], ['Tổng số boong cấu hình', ship.totalDecks], ['Ngày đưa vào hoạt động', formatDate(ship.commissionDate)],
      ['Ngày tạo', formatDate(ship.createdAt)], ['Cập nhật gần nhất', formatDate(ship.updatedAt)],
    ]} /></Panel>
    <Panel title="Tổng hợp sức chứa" subtitle="Tổng hợp dữ liệu mock đã nhập, không xác nhận sức chứa khai thác thực tế.">
      <Definition rows={[
        ['Boong đã tạo / cấu hình', `${decks.length} / ${ship.totalDecks}`], ['Cabin đã nhập', cabins.length],
        ['Tổng sức chứa cabin đã nhập', `${cabins.reduce((sum, row) => sum + row.capacity, 0)} khách`],
        ['Cabin sẵn sàng', cabins.filter((row) => row.status === 'AVAILABLE').length], ['Cabin có khách', cabins.filter((row) => row.status === 'OCCUPIED').length], ['Cabin hỗ trợ tiếp cận', cabins.filter((row) => row.accessible).length],
      ]} />
      <div className={styles.actions}><Link className={styles.link} to={`/admin/decks?ship=${ship.id}`}>Quản lý boong</Link><Link className={styles.link} to={`/admin/cabins?ship=${ship.id}`}>Quản lý cabin</Link></div>
    </Panel>
    <Panel title="Chuyến hiện tại" subtitle="Thông tin do mock adapter cung cấp.">
      {cruises.length ? <Definition rows={[
        ['Mã chuyến', cruises[0].code], ['Hành trình', cruises[0].name], ['Khoảng thời gian', cruises[0].period],
      ]} /> : <Empty title="Chưa có chuyến hiện tại trong dữ liệu demo" />}
    </Panel>
    <Panel title="Các chuyến liên quan / bị ảnh hưởng" subtitle="Tham khảo trước khi thay đổi trạng thái tàu; chưa có chính sách xử lý chuyến thật.">
      {cruises.length ? <DataTable label="Các chuyến liên quan" headers={['MÃ CHUYẾN', 'HÀNH TRÌNH', 'THỜI GIAN', 'TRẠNG THÁI']}>
        {cruises.map((row) => <tr key={row.code}><td>{row.code}</td><td>{row.name}</td><td>{row.period}</td><td>{row.status}</td></tr>)}
      </DataTable> : <Empty title="Chưa có chuyến liên quan trong dữ liệu demo" />}
    </Panel>
  </>
}
function DeckInfo({ deck, data }: { deck: Deck; data: DataSnapshot }) {
  const ship = data.ships.find((row) => row.id === deck.shipId)!
  const cabins = data.cabins.filter((row) => row.deckId === deck.id)
  return <>
    <Panel title="Thông tin boong"><Definition rows={[
      ['Số boong', deck.number], ['Tên boong', deck.name || 'Chưa đặt tên'], ['Tàu', <Link className={styles.link} to={`/admin/ships/${ship.id}`}>{ship.code} · {ship.name}</Link>],
      ['Số cabin đã nhập', cabins.length], ['Tổng sức chứa cabin đã nhập', `${cabins.reduce((sum, row) => sum + row.capacity, 0)} khách`], ['Cập nhật gần nhất', formatDate(deck.updatedAt)],
    ]} /></Panel>
    <Panel title={`Cabin trên boong ${deck.number}`}><CabinRows data={data} shipId={deck.shipId} deckId={deck.id} /></Panel>
  </>
}
function CabinInfo({ cabin, data }: { cabin: Cabin; data: DataSnapshot }) {
  const ship = data.ships.find((row) => row.id === cabin.shipId)!
  const deck = data.decks.find((row) => row.id === cabin.deckId)!
  const history = shipDeckCabinAdapter.getHistory(cabin.id)
  return <>
    <Panel title="Thông tin cabin"><Definition rows={[
      ['Số cabin', cabin.number], ['Loại cabin', cabinTypes[cabin.type]], ['Trạng thái', <StatusBadge status={cabin.status} />],
      ['Tàu', <Link className={styles.link} to={`/admin/ships/${ship.id}`}>{ship.code} · {ship.name}</Link>], ['Boong', <Link className={styles.link} to={`/admin/decks/${deck.id}`}>Boong {deck.number} · {deck.name}</Link>], ['Sức chứa', `${cabin.capacity} khách`],
      ['Hỗ trợ tiếp cận', cabin.accessible ? 'Có' : 'Không'], ['Ngày tạo', formatDate(cabin.createdAt)], ['Cập nhật gần nhất', formatDate(cabin.updatedAt)],
    ]} /></Panel>
    {cabin.status === 'OCCUPIED' && <Panel title="Khả năng thao tác"><Notice title="Cabin đang có khách" tone="warning">Đổi trạng thái, khóa/mở, chỉnh sửa và xóa bị chặn trong kịch bản mock. Không tự kết thúc gán khách.</Notice></Panel>}
    <Panel title="Lịch sử gán cabin" subtitle="Dữ liệu minh họa; chưa có luồng gán khách hoặc booking.">
      {history.length ? <DataTable label="Lịch sử gán cabin" headers={['THỜI ĐIỂM', 'CHUYẾN', 'THAO TÁC', 'NGƯỜI THỰC HIỆN']}>
        {history.map((row) => <tr key={`${row.date}-${row.cruise}`}><td>{formatDate(row.date)}</td><td>{row.cruise}</td><td>{row.action}</td><td>{row.actor}</td></tr>)}
      </DataTable> : <Empty title="Chưa có lịch sử gán cabin" />}
    </Panel>
  </>
}
function DetailPage({ kind }: { kind: EntityKind }) {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { data, loading, error, retry } = useAdminData()
  const [operation, setOperation] = useState<Operation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const mutation = useMutation()
  if (loading || error || !data) return <DataState loading={loading} error={error} retry={retry} />
  const item = data[kind].find((row) => row.id === id)
  if (!item) return <NotFound back={`/admin/${kind}`} />
  const capability = shipDeckCabinAdapter.deleteCapability(kind, id)
  const open = (next: Operation) => { mutation.clear(); setOperation(next) }
  const hostId = 'shipId' in item ? item.shipId : ''
  return <>
    <PageHeader breadcrumb={`Vận hành / Tàu & đội tàu / ${sectionLabels[kind]} / Chi tiết`} title={entityName(item)} description="Thông tin và thao tác quản lý · Dữ liệu minh họa"
      actions={<>
        <Link className={styles.link} to={`/admin/${kind}/${id}/edit`}>Chỉnh sửa</Link>
        {'status' in item && <Button onClick={() => open('status')}>Đổi trạng thái</Button>}
        {'code' in item && <><Button tone="secondary" onClick={() => open('schedule')}>Kiểm tra lịch trống</Button><Button tone="secondary" onClick={() => open('ready')}>Kiểm tra sẵn sàng</Button></>}
        {'deckId' in item && <><Button tone="secondary" onClick={() => open('availability')}>Kiểm tra cabin</Button>
          {item.status !== 'OUT_OF_SERVICE' && <Button tone="secondary" onClick={() => open('block')}>Khóa cabin</Button>}
          {item.status !== 'AVAILABLE' && <Button tone="secondary" onClick={() => open('release')}>Mở cabin</Button>}
        </>}
        <Button tone="secondary" onClick={() => navigate(`/admin/${kind}${hostId ? `?ship=${hostId}` : ''}`)}>Về danh sách</Button>
      </>} />
    {(location.state as { saved?: boolean } | null)?.saved && <Panel title="Kết quả lưu"><Notice title="Đã lưu thành công" tone="success">Thông tin đã được cập nhật trong phiên demo.</Notice></Panel>}
    {'code' in item ? <ShipInfo ship={item} data={data} /> : 'deckId' in item ? <CabinInfo cabin={item} data={data} /> : <DeckInfo deck={item} data={data} />}
    <Panel title={`Xóa ${kindLabels[kind]} chưa sử dụng`}>
      {!capability.allowed ? <Notice title="Không thể xóa" tone="warning">{capability.reason}</Notice> : <p className={styles.muted}>Đối tượng chưa sử dụng trong dữ liệu mock. Cần xác nhận trước khi xóa.</p>}
      <Button tone="danger" disabled={!capability.allowed} onClick={() => { mutation.clear(); setDeleting(true) }}>Xóa chưa sử dụng</Button>
    </Panel>
    {operation && 'status' in item && <OperationDialog item={item} operation={operation} onClose={() => setOperation(null)} />}
    {deleting && <Modal title={`Xóa ${kindLabels[kind]} chưa sử dụng?`} busy={mutation.busy} onClose={() => setDeleting(false)}>
      <div className={styles.stack}><Notice title={entityName(item)} tone="warning">Xác nhận xóa đối tượng này khỏi phiên demo.</Notice>
        {mutation.error && <Notice title="Xóa thất bại" tone="error">{mutation.error}</Notice>}
        <div className={styles.actions}><Button tone="danger" disabled={mutation.busy || !capability.allowed} onClick={() => void mutation.run(async () => { await shipDeckCabinAdapter.deleteUnused(kind, id, item.version); navigate(`/admin/${kind}${hostId ? `?ship=${hostId}` : ''}`) })}>{mutation.busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button><Button tone="secondary" disabled={mutation.busy} onClick={() => setDeleting(false)}>Hủy</Button></div>
      </div>
    </Modal>}
  </>
}
export function ShipDetailPage() { const { id } = useParams(); return <AdminFrame><DetailPage key={id} kind="ships" /></AdminFrame> }
export function DeckDetailPage() { const { id } = useParams(); return <AdminFrame><DetailPage key={id} kind="decks" /></AdminFrame> }
export function CabinDetailPage() { const { id } = useParams(); return <AdminFrame><DetailPage key={id} kind="cabins" /></AdminFrame> }
