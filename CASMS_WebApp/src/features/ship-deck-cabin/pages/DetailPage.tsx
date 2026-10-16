import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { AdminFrame, Button, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { useAdminData, useEntity, useMutation } from '../hooks/useAdminData'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { entityName, kindLabels, sectionLabels } from '../model/types'
import type { EntityKind } from '../model/types'
import { DataState, NotFound } from '../components/Common'
import { ShipInfo, DeckInfo, CabinInfo } from '../components/EntityDetails'
import { OperationDialog, type Operation } from '../components/OperationDialog'
import { BulkCabinDialog } from '../components/BulkCabinDialog'
import styles from '../components/Management.module.css'

function DetailPage({ kind }: { kind: EntityKind }) {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { data, loading, error, retry } = useAdminData()
  const entity = useEntity(kind, id)
  const [operation, setOperation] = useState<Operation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const mutation = useMutation()
  if (loading || error || !data) return <DataState loading={loading} error={error} retry={retry} />
  if (entity.loading || entity.error) return <DataState loading={entity.loading} error={entity.error} retry={entity.retry} />
  const item = entity.data
  if (!item) return <NotFound back={`/admin/${kind}`} />
  const open = (next: Operation) => { mutation.clear(); setOperation(next) }
  const hostId = 'shipId' in item ? item.shipId : ''
  return <>
    <PageHeader breadcrumb={`Vận hành / Tàu & đội tàu / ${sectionLabels[kind]} / Chi tiết`} title={entityName(item)} description="Thông tin và thao tác quản lý"
      actions={<>
        <Link className={styles.link} to={`/admin/${kind}/${id}/edit`}>Chỉnh sửa</Link>
        {'status' in item && <Button onClick={() => open('status')}>Đổi trạng thái</Button>}
        {'code' in item && <><Button tone="secondary" onClick={() => open('schedule')}>Kiểm tra lịch trống</Button><Button tone="secondary" onClick={() => open('ready')}>Kiểm tra sẵn sàng</Button><Button tone="secondary" onClick={() => open('affected')}>Chuyến bị ảnh hưởng</Button></>}
        {kind === 'decks' && <><Button tone="secondary" onClick={() => open('ownership')}>Kiểm tra thuộc tàu</Button><Button onClick={() => setBulkOpen(true)}>Tự động tạo cabin</Button></>}
        <Button tone="secondary" onClick={() => open('validate')}>Kiểm tra cấu hình</Button>
        {'deckId' in item && <><Button tone="secondary" onClick={() => open('availability')}>Kiểm tra cabin</Button>
          {item.status === 'AVAILABLE' && <Button tone="secondary" onClick={() => open('block')}>Khóa cabin</Button>}
          {item.status !== 'AVAILABLE' && <Button tone="secondary" onClick={() => open('release')}>Mở cabin</Button>}
        </>}
        <Button tone="secondary" onClick={() => navigate(`/admin/${kind}${hostId ? `?ship=${hostId}` : ''}`)}>Về danh sách</Button>
      </>} />
    {(location.state as { saved?: boolean } | null)?.saved && <Panel title="Kết quả lưu"><Notice title="Đã lưu thành công" tone="success">Thông tin đã được cập nhật trong hệ thống.</Notice></Panel>}
    {mutation.success && <Panel title="Kết quả thao tác"><Notice title="Thao tác thành công" tone="success">{mutation.success}</Notice></Panel>}
    {'code' in item ? <ShipInfo ship={item} /> : 'deckId' in item ? <CabinInfo cabin={item} data={data} /> : <DeckInfo deck={item} data={data} />}
    <Panel title={`Xóa ${kindLabels[kind]} chưa sử dụng`}>
      <p className={styles.muted}>Chỉ xóa đối tượng chưa sử dụng. Hệ thống sẽ kiểm tra các dữ liệu liên quan trước khi xóa.</p>
      <Button tone="danger" onClick={() => { mutation.clear(); setDeleting(true) }}>Xóa chưa sử dụng</Button>
    </Panel>
    {operation && <OperationDialog item={item} kind={kind} ships={data.ships} operation={operation} onClose={() => setOperation(null)} />}
    {bulkOpen && kind === 'decks' && item && !('code' in item) && !('deckId' in item) && (
      <BulkCabinDialog
        deck={item}
        ship={data.ships.find((s) => s.id === item.shipId) ?? { id: item.shipId, code: 'SHIP', name: 'Tàu', status: 'ACTIVE', capacity: 0, totalDecks: 0, commissionDate: '' }}
        existingCabins={data.cabins}
        onClose={() => setBulkOpen(false)}
        onSuccess={(count) => {
          mutation.setSuccess(`Đã tự động tạo thành công ${count} cabin cho Boong ${item.number}.`)
        }}
      />
    )}
    {deleting && <Modal title={`Xóa ${kindLabels[kind]} chưa sử dụng?`} busy={mutation.busy} onClose={() => setDeleting(false)}>
      <div className={styles.stack}><Notice title={entityName(item)} tone="warning">Xác nhận xóa đối tượng này khỏi hệ thống. Thao tác có thể bị từ chối khi còn dữ liệu liên quan.</Notice>
        {mutation.error && <Notice title="Xóa thất bại" tone="error">{mutation.error}</Notice>}
        <div className={styles.actions}><Button tone="danger" disabled={mutation.busy} onClick={() => void mutation.run(async () => { await shipDeckCabinApi.deleteUnused(kind, id); navigate(`/admin/${kind}${hostId ? `?ship=${hostId}` : ''}`) })}>{mutation.busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button><Button tone="secondary" disabled={mutation.busy} onClick={() => setDeleting(false)}>Hủy</Button></div>
      </div>
    </Modal>}
  </>
}
export function ShipDetailPage() { const { id } = useParams(); return <AdminFrame><DetailPage key={id} kind="ships" /></AdminFrame> }
export function DeckDetailPage() { const { id } = useParams(); return <AdminFrame><DetailPage key={id} kind="decks" /></AdminFrame> }
export function CabinDetailPage() { const { id } = useParams(); return <AdminFrame><DetailPage key={id} kind="cabins" /></AdminFrame> }
