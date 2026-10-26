import { useSessionAccess } from '@/shared/auth'
import { Button, Modal } from '@/shared/ui'
import { Notice } from '@/shared/ui'
import { useNavigate } from 'react-router'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useMutation } from '../hooks/useAdminData'
import { FleetEditDialog, type FleetEditTarget } from './FleetEditDialog'
import { OperationDialog, type Operation } from './OperationDialog'
import { operationPermission } from '../model/permissions'
import { fleetError, roomTypeLabels } from '../model/ship-management'
import { cabinStatuses } from '../model/types'
import type { Cabin, Entity, EntityKind, Ship } from '../model/types'
import styles from './ShipManagement.module.css'

export type FleetDialog = { type: 'edit'; target: FleetEditTarget }
  | { type: 'operation'; item: Entity; kind: EntityKind; operation: Operation }
  | { type: 'room'; room: Cabin; deckName: string }
  | { type: 'deleteShip' }

export function FleetDialogs({ dialog, ship, onChange, onSaved }: { dialog: FleetDialog | null; ship: Ship; onChange: (value: FleetDialog | null) => void; onSaved: (message: string) => void }) {
  const access = useSessionAccess()
  const navigate = useNavigate()
  const mutation = useMutation()
  if (!dialog) return null
  if (dialog.type === 'deleteShip') {
    if (!access.canDo('SHIP_DELETE')) return null
    return <Modal title="Xóa tàu chưa sử dụng?" description={`${ship.code} · ${ship.name}`} busy={mutation.busy} onClose={() => onChange(null)} protectChanges={false}
      footer={<><Button tone="secondary" data-overlay-dismiss disabled={mutation.busy} onClick={() => onChange(null)}>Hủy</Button><Button tone="danger" disabled={mutation.busy} onClick={() => void mutation.run(async () => { if (!access.canDo('SHIP_DELETE')) return; await shipDeckCabinApi.deleteUnused('ships', ship.id); onChange(null); navigate('/admin/ships') })}>{mutation.busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button></>}>
      <Notice title="Kiểm tra dữ liệu liên quan" tone="warning">Chỉ xóa tàu chưa được sử dụng. Tàu đã có chuyến đi, boong, phòng hoặc mô hình liên kết có thể bị hệ thống từ chối xóa.</Notice>
      {mutation.error && <Notice title="Chưa xóa được tàu" tone="error">{fleetError(mutation.error)}</Notice>}
    </Modal>
  }
  if (dialog.type === 'edit') {
    return <FleetEditDialog key={`${dialog.target.kind}:${dialog.target.item.id}`} target={dialog.target} onClose={() => onChange(null)} onSaved={onSaved} />
  }
  if (dialog.type === 'operation') {
    if (!access.canDo(operationPermission(dialog.kind, dialog.operation))) return null
    return <OperationDialog key={`${dialog.item.id}:${dialog.operation}`} item={dialog.item} kind={dialog.kind} operation={dialog.operation} ships={[ship]} onClose={() => onChange(null)} />
  }
  if (!access.canDo('CABIN_READ')) return null
  const room = dialog.room
  return <Modal title={`Phòng ${room.number}`} description={`${ship.name} · ${dialog.deckName}`} onClose={() => onChange(null)} protectChanges={false}
    footer={<><Button tone="secondary" data-overlay-dismiss onClick={() => onChange(null)}>Đóng</Button>{access.canDo('CABIN_UPDATE') && <Button onClick={() => onChange({ type: 'edit', target: { kind: 'cabins', item: room } })}>Chỉnh sửa phòng</Button>}</>}>
    <dl className={styles.readonly}>
      <div><dt>Loại phòng</dt><dd>{roomTypeLabels[room.type]}</dd></div><div><dt>Trạng thái</dt><dd>{cabinStatuses[room.status]}</dd></div>
      <div><dt>Sức chứa</dt><dd>{room.capacity} khách</dd></div><div><dt>Hỗ trợ người khuyết tật</dt><dd>{room.accessible ? 'Có' : 'Không'}</dd></div>
      {room.modelWidth != null && <div><dt>Chiều rộng</dt><dd>{room.modelWidth} m</dd></div>}
      {room.modelHeight != null && <div><dt>Chiều cao</dt><dd>{room.modelHeight} m</dd></div>}
      {room.modelDepth != null && <div><dt>Chiều sâu</dt><dd>{room.modelDepth} m</dd></div>}
    </dl>
  </Modal>
}
