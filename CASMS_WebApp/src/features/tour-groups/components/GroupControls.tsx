import { useCallback, useState, type ReactNode } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Modal } from '@/shared/ui'
import { tourGroupApi } from '../api/tour-group-api'
import { checkPassengerAvailability, groupPassengerApi } from '../api/group-passenger-api'
import { useTourMutation } from '../hooks/useTourResource'
import { actionLabels, canPrepareGroup, groupActions, isUuid, type GroupAction, type TourGroup } from '../model/tour-group'
import { TourError } from './TourUI'
import styles from './TourGroups.module.css'

type Control = GroupAction | 'assign-passenger' | 'remove-passenger'
const labels: Record<Control, string> = { ...actionLabels, 'assign-passenger': 'Thêm hành khách', 'remove-passenger': 'Gỡ hành khách' }
const permission = (control: Control) => control === 'assign-passenger' ? 'TOUR_GROUP_PASSENGER_ASSIGN' : control === 'remove-passenger' ? 'TOUR_GROUP_PASSENGER_REMOVE' : 'TOUR_GROUP_STATUS_CHANGE'
export function GroupControls({ group, onRefresh, children }: { group: TourGroup; onRefresh: () => void; children?: ReactNode }) {
  const access = useSessionAccess()
  const mutation = useTourMutation()
  const [control, setControl] = useState<Control | null>(null), [idValue, setIdValue] = useState(''), [reason, setReason] = useState('')
  const loadOptions = useCallback(async (signal: AbortSignal) => control === 'assign-passenger' ? (await groupPassengerApi.eligible(group.tourGroupId, signal)).map(row => ({ id: row.passengerId, label: row.fullName })) : control === 'remove-passenger' ? (await groupPassengerApi.list(group.tourGroupId, signal)).filter(row => row.assignmentStatus !== 'CANCELLED').map((row, index) => ({ id: row.passengerId, label: `Phân công ${index + 1} · ${row.groupCode} · ${row.assignedAt ? new Date(row.assignedAt).toLocaleString('vi-VN') : 'Chưa có thời gian'}` })) : [], [control, group.tourGroupId])
  const options = useReadQuery(`group-control-options:${group.tourGroupId}:${control}`, loadOptions)
  const preparing = canPrepareGroup(group.status)
  const needsId = control === 'assign-passenger' || control === 'remove-passenger'
  function open(next: Control) { if (!access.canDo(permission(next))) return; mutation.clearError(); setReason(''); setIdValue(''); setControl(next) }
  async function execute() {
    if (!control || !access.canDo(permission(control)) || (needsId && !options.data?.some(row => row.id === idValue)) || (control === 'cancel' && (!reason.trim() || reason.trim().length > 500))) return
    const id = group.tourGroupId
    const result = await mutation.run<TourGroup>(async (signal) => {
      if (control === 'assign-passenger') {
        const current = await tourGroupApi.get(id, signal)
        await checkPassengerAvailability(current, idValue.trim(), signal)
        return tourGroupApi.assignPassenger(id, idValue.trim(), signal)
      }
      if (control === 'remove-passenger') return tourGroupApi.removePassenger(id, idValue.trim(), signal)
      return tourGroupApi.transition(id, control, reason.trim(), signal)
    })
    if (!result.ok) return
    setControl(null)
    onRefresh()
  }
  return <div className={styles.detailActions} role="group" aria-label="Thao tác nhóm tour">
    {children}
    {preparing && <>
        {access.canDo('TOUR_GROUP_GUIDE_ASSIGN') && <Button tone="secondary" disabled title="Chưa có danh mục hướng dẫn viên đủ điều kiện">Phân công hướng dẫn viên</Button>}
        {access.canDo('TOUR_GROUP_PASSENGER_ASSIGN') && <Button tone="secondary" disabled={mutation.busy || !access.canDo('TOUR_GROUP_PASSENGER_ASSIGN') || group.availableCapacity === 0} onClick={() => open('assign-passenger')}>{labels['assign-passenger']}</Button>}
        {access.canDo('TOUR_GROUP_PASSENGER_REMOVE') && <Button tone="secondary" disabled={mutation.busy || !access.canDo('TOUR_GROUP_PASSENGER_REMOVE') || group.assignedPassengers === 0} onClick={() => open('remove-passenger')}>{labels['remove-passenger']}</Button>}
    </>}
    {groupActions(group.status).map(action => access.canDo(permission(action)) ? <Button key={action} tone={action === 'cancel' ? 'danger' : 'secondary'} disabled={mutation.busy} onClick={() => open(action)}>{labels[action]}</Button> : null)}
    {control && access.canDo(permission(control)) && <Modal title={labels[control]} busy={mutation.busy} onClose={() => setControl(null)} footer={<div className={styles.actions}><Button tone="secondary" disabled={mutation.busy} onClick={() => setControl(null)} data-overlay-dismiss>Quay lại</Button>{access.canDo(permission(control)) && <Button tone={control === 'cancel' || control === 'remove-passenger' ? 'danger' : 'primary'} disabled={mutation.busy || !access.canDo(permission(control)) || (needsId && (options.loading || Boolean(options.error) || !isUuid(idValue.trim()))) || (control === 'cancel' && (!reason.trim() || reason.trim().length > 500))} onClick={() => void execute()}>{mutation.busy ? 'Đang xử lý…' : 'Xác nhận'}</Button>}</div>}>
      <p className={styles.text}>Nhóm {group.groupCode}</p>
      {needsId && <><Field htmlFor="tour-assignment-id" label={control === 'assign-passenger' ? 'Hành khách đủ điều kiện' : 'Phân công hành khách hiện tại'}><select id="tour-assignment-id" disabled={mutation.busy || options.loading || Boolean(options.error)} value={idValue} onChange={event => setIdValue(event.target.value)}><option value="">Chọn hành khách</option>{options.data?.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></Field>{options.error && <TourError error={options.error} onRetry={options.retry} />}{!options.loading && options.data?.length === 0 && <p>Không có hành khách phù hợp. Không thể tự tạo hành khách thay thế.</p>}</>}
      {control === 'remove-passenger' && <p>Xác nhận gỡ phân công đã chọn khỏi nhóm này.</p>}
      {control === 'cancel' && <><p>Hủy nhóm cũng hủy các phân công hành khách của nhóm.</p><Field htmlFor="tour-cancel-reason" label="Lý do hủy (bắt buộc)"><textarea id="tour-cancel-reason" required maxLength={500} disabled={mutation.busy} value={reason} onChange={(event) => setReason(event.target.value)} /></Field></>}
      {control === 'confirm' && <p>Hệ thống kiểm tra hướng dẫn viên, điểm tập trung, lịch trình và sức chứa trước khi xác nhận nhóm.</p>}
      {control === 'start' && <p>Nhóm cần có hành khách được phân công và đã đến giờ khởi hành dự kiến. Hệ thống kiểm tra điều kiện trước khi cập nhật.</p>}
      {mutation.error != null && <TourError error={mutation.error} />}

    </Modal>}
  </div>
}
