import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, DataTable, Empty, Field, Loading, Modal, Panel } from '@/shared/ui'
import { checkPassengerAssignment, groupPassengerApi, performPassengerAction } from '../api/group-passenger-api'
import { tourGroupApi } from '../api/tour-group-api'
import { useTourMutation, useTourResource } from '../hooks/useTourResource'
import { assignmentLabels, passengerActionLabels, passengerActions, type GroupPassenger, type PassengerAction } from '../model/group-passenger'
import { displayTime, isUuid, type TourGroup } from '../model/tour-group'
import { TourError } from './TourUI'
import styles from './TourGroups.module.css'

type Selection = { action: PassengerAction; assignment: GroupPassenger } | { action: 'assign' }
export type PassengerReceipt = { message: string; targetId?: string; targetCode?: string }

export function GroupPassengers({ group, onChanged }: { group: TourGroup; onChanged: (receipt: PassengerReceipt) => void }) {
  const load = useCallback((signal: AbortSignal) => groupPassengerApi.list(group.tourGroupId, signal), [group.tourGroupId])
  const query = useTourResource(load), mutation = useTourMutation()
  const [selection, setSelection] = useState<Selection | null>(null), [idValue, setIdValue] = useState('')
  const needsId = selection?.action === 'move' || selection?.action === 'assign'
  function open(next: Selection) { mutation.clearError(); setIdValue(''); setSelection(next) }
  async function execute() {
    if (!selection) return
    const result = await mutation.run(async (signal) => {
      if (selection.action === 'assign') {
        const current = await tourGroupApi.get(group.tourGroupId, signal)
        await checkPassengerAssignment(current, idValue.trim(), signal)
        return groupPassengerApi.assign(current.tourGroupId, idValue.trim(), signal)
      }
      return performPassengerAction(group.tourGroupId, selection.assignment.tourGroupPassengerId, selection.action, idValue.trim(), signal)
    })
    if (!result.ok) return
    onChanged({
      message: selection.action === 'assign' ? 'Đã thêm hành khách vào nhóm.' : selection.action === 'move' ? 'Đã chuyển hành khách sang nhóm đích; phân công cũ được lưu với trạng thái đã hủy.' : selection.action === 'remove' ? 'Đã gỡ phân công hành khách.' : selection.action === 'departure' ? 'Đã ghi nhận điểm danh khởi hành.' : 'Đã ghi nhận hành khách trở về.',
      ...(selection.action === 'move' ? { targetId: result.value.tourGroupId, targetCode: result.value.groupCode } : {}),
    })
  }
  return <Panel title="Hành khách trong nhóm">
    <p>Nhóm {group.groupCode}. Sức chứa: {group.assignedPassengers} / {group.maximumCapacity}; còn {group.availableCapacity} chỗ.</p>
    <p>Thêm và chuyển nhóm cần đăng ký đã xác nhận, chuyến tham quan đang mở và nhóm đích còn chỗ. Hệ thống kiểm tra lại trước khi lưu.</p>
    <div className={styles.actions}>
      {group.status === 'ASSEMBLING' && <Button disabled={mutation.busy || group.availableCapacity === 0} onClick={() => open({ action: 'assign' })}>Thêm hành khách</Button>}
      <Button tone="secondary" disabled={mutation.busy || query.loading} onClick={query.reload}>Tải lại hành khách</Button>
    </div>
    {group.status === 'PLANNED' && <p>Dùng “Thêm hành khách” trong phần Phân công và vận hành để thêm vào nhóm đang lên kế hoạch.</p>}
    {query.loading ? <Loading label="Đang tải phân công hành khách…" /> : query.error != null ? <TourError error={query.error} onRetry={query.reload} /> : query.data && <PassengerRoster group={group} rows={query.data} busy={mutation.busy} onAction={(action, assignment) => open({ action, assignment })} />}
    {selection && <Modal title={selection.action === 'assign' ? 'Thêm hành khách' : passengerActionLabels[selection.action]} busy={mutation.busy} onClose={() => setSelection(null)}>
      <p className={styles.text}>Nhóm hiện tại: {group.groupCode} ({group.tourGroupId})</p>
      {'assignment' in selection && <p className={styles.text}>ID hành khách: {selection.assignment.passengerId}<br />ID phân công: {selection.assignment.tourGroupPassengerId}</p>}
      {needsId && <Field htmlFor="group-passenger-id" label={selection.action === 'move' ? 'ID nhóm đích cùng chuyến tham quan (UUID)' : 'ID hành khách (UUID)'} error={idValue && !isUuid(idValue.trim()) ? 'Nhập ID UUID hợp lệ.' : undefined}>
        <input id="group-passenger-id" disabled={mutation.busy} value={idValue} onChange={(event) => setIdValue(event.target.value)} aria-invalid={!!idValue && !isUuid(idValue.trim())} aria-describedby={idValue && !isUuid(idValue.trim()) ? 'group-passenger-id-hint' : undefined} />
      </Field>}
      {selection.action === 'move' && <p>Nhóm đích phải khác nhóm hiện tại, thuộc cùng chuyến tham quan, đang lên kế hoạch hoặc tập trung và còn chỗ. Phân công cũ được hủy; hệ thống tạo phân công mới ở nhóm đích.</p>}
      {selection.action === 'remove' && <p>Xác nhận hủy mềm phân công này. Lịch sử phân công được giữ lại.</p>}
      {selection.action === 'departure' && <p>Ghi nhận hành khách đã có mặt khi nhóm đang tập trung. Thao tác này không khởi hành cả nhóm.</p>}
      {selection.action === 'return' && <p>Xác nhận hành khách đã trở về sau khi nhóm khởi hành.</p>}
      {mutation.error != null && <TourError error={mutation.error} />}
      <div className={styles.actions}><Button tone="secondary" disabled={mutation.busy} onClick={() => setSelection(null)}>Quay lại</Button><Button tone={selection.action === 'remove' ? 'danger' : 'primary'} disabled={mutation.busy || (needsId && !isUuid(idValue.trim()))} onClick={() => void execute()}>{mutation.busy ? 'Đang kiểm tra và xử lý…' : 'Xác nhận'}</Button></div>
    </Modal>}
  </Panel>
}

export function PassengerRoster({ group, rows, busy, onAction }: { group: TourGroup; rows: GroupPassenger[]; busy: boolean; onAction: (action: PassengerAction, assignment: GroupPassenger) => void }) {
  if (!rows.length) return <Empty title="Chưa có phân công hành khách trong nhóm" />
  return <DataTable label="Hành khách trong nhóm tour" headers={['ID hành khách / phân công', 'Trạng thái', 'Thời gian', 'Thao tác']}>
    {rows.map((assignment) => {
      const actions = passengerActions(assignment.assignmentStatus, group.status)
      return <tr key={assignment.tourGroupPassengerId}>
        <td className={styles.text}><strong>{assignment.passengerId}</strong><br />Phân công: {assignment.tourGroupPassengerId}<br /><Link className={styles.link} to={`/admin/tour-groups/${assignment.tourGroupId}`}>Nhóm {assignment.groupCode}</Link></td>
        <td><Badge label={assignmentLabels[assignment.assignmentStatus]} tone={assignment.assignmentStatus === 'CANCELLED' ? 'error' : assignment.assignmentStatus === 'COMPLETED' ? 'success' : 'neutral'} /></td>
        <td>Phân công: {displayTime(assignment.assignedAt)}<br />Khởi hành: {displayTime(assignment.checkedInAt)}<br />Trở về: {displayTime(assignment.returnedAt)}</td>
        <td><div className={styles.actions}>{actions.map((action) => <Button key={action} tone={action === 'remove' ? 'danger' : 'secondary'} disabled={busy} onClick={() => onAction(action, assignment)}>{passengerActionLabels[action]}</Button>)}</div>{!actions.length && 'Không có thao tác phù hợp.'}</td>
      </tr>
    })}
  </DataTable>
}
