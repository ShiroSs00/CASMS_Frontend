import { useSessionAccess } from '@/shared/auth'
import { entityPermission, operationPermission } from '../model/permissions'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Button, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { useApiQuery, useEntity, useMutation } from '../hooks/useAdminData'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { entityName, kindLabels, sectionLabels } from '../model/types'
import type { Entity, EntityKind } from '../model/types'
import { DataState, NotFound } from '../components/Common'
import { ShipInfo, DeckInfo, CabinInfo } from '../components/EntityDetails'
import { OperationDialog, type Operation } from '../components/OperationDialog'
import styles from '../components/Management.module.css'

function DeckOwnershipDialog({ item, onClose }: { item: Entity; onClose: () => void }) {
  const ships = useApiQuery('deck-ownership-ships', shipDeckCabinApi.listShips)
  return <OperationDialog item={item} kind="decks" operation="ownership" ships={ships.data ?? []} shipChoicesState={ships} onClose={onClose} />
}

function DetailPage({ kind }: { kind: EntityKind }) {
  const access = useSessionAccess()
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const entity = useEntity(kind, id)
  const [operation, setOperation] = useState<Operation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const mutation = useMutation()
  if (entity.loading || entity.error) return <DataState loading={entity.loading} error={entity.error} retry={entity.retry} />
  const item = entity.data
  if (!item) return <NotFound back={`/admin/${kind}`} />
  const open = (next: Operation) => { if (!access.has(operationPermission(kind, next))) return; mutation.clear(); setOperation(next) }
  const hostId = 'shipId' in item ? item.shipId : ''
  return <>
    <PageHeader breadcrumb={`Vận hành / Tàu & đội tàu / ${sectionLabels[kind]} / Chi tiết`} title={entityName(item)} description="Thông tin và thao tác quản lý"
      actions={<>
        {access.has(entityPermission(kind, 'UPDATE')) && <Link className={styles.link} to={`/admin/${kind}/${id}/edit`}>Chỉnh sửa</Link>}
        {'status' in item && <Button disabled={!access.has(operationPermission(kind, 'status'))} onClick={() => open('status')}>Đổi trạng thái</Button>}
        {'code' in item && <><Button tone="secondary" disabled={!access.has(operationPermission(kind, 'schedule'))} onClick={() => open('schedule')}>Kiểm tra lịch trống</Button><Button tone="secondary" disabled={!access.has(operationPermission(kind, 'ready'))} onClick={() => open('ready')}>Kiểm tra sẵn sàng</Button><Button tone="secondary" disabled={!access.has(operationPermission(kind, 'affected'))} onClick={() => open('affected')}>Chuyến bị ảnh hưởng</Button></>}
        {kind === 'decks' && <Button tone="secondary" disabled={!access.has(operationPermission(kind, 'ownership'))} onClick={() => open('ownership')}>Kiểm tra thuộc tàu</Button>}
        <Button tone="secondary" disabled={!access.has(operationPermission(kind, 'validate'))} onClick={() => open('validate')}>Kiểm tra cấu hình</Button>
        {'deckId' in item && <><Button tone="secondary" disabled={!access.has(operationPermission(kind, 'availability'))} onClick={() => open('availability')}>Kiểm tra cabin</Button>
          {item.status === 'AVAILABLE' && <Button tone="secondary" disabled={!access.has(operationPermission(kind, 'block'))} onClick={() => open('block')}>Khóa cabin</Button>}
          {item.status !== 'AVAILABLE' && <Button tone="secondary" disabled={!access.has(operationPermission(kind, 'release'))} onClick={() => open('release')}>Mở cabin</Button>}
        </>}
        <Button tone="secondary" onClick={() => navigate(`/admin/${kind}${hostId ? `?ship=${hostId}` : ''}`)}>Về danh sách</Button>
      </>} />
    {(location.state as { saved?: boolean } | null)?.saved && <Panel title="Kết quả lưu"><Notice title="Đã lưu thành công" tone="success">Thông tin đã được cập nhật trong hệ thống.</Notice></Panel>}
    {'code' in item ? <ShipInfo ship={item} /> : 'deckId' in item ? <CabinInfo cabin={item} /> : <DeckInfo deck={item} />}
    <Panel title={`Xóa ${kindLabels[kind]} chưa sử dụng`}>
      <p className={styles.muted}>Chỉ xóa đối tượng chưa sử dụng. Hệ thống sẽ kiểm tra các dữ liệu liên quan trước khi xóa.</p>
      <Button tone="danger" disabled={!access.has(entityPermission(kind, 'DELETE'))} onClick={() => { mutation.clear(); setDeleting(true) }}>Xóa chưa sử dụng</Button>
    </Panel>
    {operation && (kind === 'decks' && operation === 'ownership'
      ? <DeckOwnershipDialog item={item} onClose={() => setOperation(null)} />
      : <OperationDialog item={item} kind={kind} ships={'code' in item ? [item] : []} operation={operation} onClose={() => setOperation(null)} />)}
    {deleting && <Modal title={`Xóa ${kindLabels[kind]} chưa sử dụng?`} busy={mutation.busy} onClose={() => setDeleting(false)}>
      <div className={styles.stack}><Notice title={entityName(item)} tone="warning">Xác nhận xóa đối tượng này khỏi hệ thống. Thao tác có thể bị từ chối khi còn dữ liệu liên quan.</Notice>
        {mutation.error && <Notice title="Xóa thất bại" tone="error">{mutation.error}</Notice>}
        <div className={styles.actions}><Button tone="danger" disabled={mutation.busy} onClick={() => void mutation.run(async () => { if (!access.has(entityPermission(kind, 'DELETE'))) return; await shipDeckCabinApi.deleteUnused(kind, id); navigate(`/admin/${kind}${hostId ? `?ship=${hostId}` : ''}`) })}>{mutation.busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button><Button tone="secondary" disabled={mutation.busy} onClick={() => setDeleting(false)} data-overlay-dismiss>Hủy</Button></div>
      </div>
    </Modal>}
  </>
}
export function ShipDetailPage() { const { id } = useParams(); return <AdminShell><DetailPage key={id} kind="ships" /></AdminShell> }
export function DeckDetailPage() { const { id } = useParams(); return <AdminShell><DetailPage key={id} kind="decks" /></AdminShell> }
export function CabinDetailPage() { const { id } = useParams(); return <AdminShell><DetailPage key={id} kind="cabins" /></AdminShell> }
