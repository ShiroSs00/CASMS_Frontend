import { TechnicalDetails } from '@/shared/ui'
import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
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
const permission = (action: PassengerAction | 'assign') => action === 'assign' ? 'TOUR_GROUP_PASSENGER_ASSIGN' : action === 'move' ? 'TOUR_GROUP_PASSENGER_MOVE' : action === 'remove' ? 'TOUR_GROUP_PASSENGER_REMOVE' : 'TOUR_GROUP_PASSENGER_ATTENDANCE'

export function GroupPassengers({ group, onChanged }: { group: TourGroup; onChanged: (receipt: PassengerReceipt) => void }) {
  const access = useSessionAccess()
  const load = useCallback((signal: AbortSignal) => groupPassengerApi.list(group.tourGroupId, signal), [group.tourGroupId])
  const query = useTourResource(load), mutation = useTourMutation()
  const [selection, setSelection] = useState<Selection | null>(null), [idValue, setIdValue] = useState('')
  const action = selection?.action
  const loadOptions = useCallback(async (signal: AbortSignal) => action === 'assign' ? (await groupPassengerApi.eligible(group.tourGroupId, signal)).map(row => ({ id: row.passengerId, label: row.fullName })) : action === 'move' ? (await tourGroupApi.list({ excursionId: group.shoreExcursionId }, signal)).filter(target => target.tourGroupId !== group.tourGroupId && ['PLANNED', 'ASSEMBLING'].includes(target.status) && target.availableCapacity > 0).map(target => ({ id: target.tourGroupId, label: `${target.groupCode} · ${target.availableCapacity} chỗ trống` })) : [], [action, group.tourGroupId, group.shoreExcursionId])
  const options = useReadQuery(`passenger-options:${group.tourGroupId}:${action}`, loadOptions)
  const needsId = selection?.action === 'move' || selection?.action === 'assign'
  function open(next: Selection) { if (!access.has(permission(next.action))) return; mutation.clearError(); setIdValue(''); setSelection(next) }
  async function execute() {
    if (!selection || !access.has(permission(selection.action)) || (needsId && !options.data?.some(row => row.id === idValue))) return
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
      {group.status === 'ASSEMBLING' && <Button disabled={mutation.busy || !access.has('TOUR_GROUP_PASSENGER_ASSIGN') || group.availableCapacity === 0} onClick={() => open({ action: 'assign' })}>Thêm hành khách</Button>}
      <Button tone="secondary" disabled={mutation.busy || query.loading} onClick={query.reload}>Tải lại hành khách</Button>
    </div>
    {group.status === 'PLANNED' && <p>Dùng “Thêm hành khách” trong phần Phân công và vận hành để thêm vào nhóm đang lên kế hoạch.</p>}
    {query.loading ? <Loading label="Đang tải phân công hành khách…" /> : query.error != null ? <TourError error={query.error} onRetry={query.reload} /> : query.data && <PassengerRoster group={group} rows={query.data} busy={mutation.busy} onAction={(action, assignment) => open({ action, assignment })} />}
    {selection && <Modal title={selection.action === 'assign' ? 'Thêm hành khách' : passengerActionLabels[selection.action]} busy={mutation.busy} onClose={() => setSelection(null)} footer={<div className={styles.actions}><Button tone="secondary" disabled={mutation.busy} onClick={() => setSelection(null)} data-overlay-dismiss>Quay lại</Button><Button tone={selection.action === 'remove' ? 'danger' : 'primary'} disabled={mutation.busy || !access.has(permission(selection.action)) || (needsId && (options.loading || Boolean(options.error) || !isUuid(idValue.trim())))} onClick={() => void execute()}>{mutation.busy ? 'Đang kiểm tra và xử lý…' : 'Xác nhận'}</Button></div>}>
      <p className={styles.text}>Nhóm hiện tại: {group.groupCode}</p>
      {'assignment' in selection && <TechnicalDetails entries={[["Hành khách", selection.assignment.passengerId], ["Phân công", selection.assignment.tourGroupPassengerId]]} />}
      {needsId && <><Field htmlFor="group-passenger-id" label={selection.action === 'move' ? 'Nhóm đích cùng chuyến tham quan' : 'Hành khách đủ điều kiện'}><select id="group-passenger-id" disabled={mutation.busy || options.loading || Boolean(options.error)} value={idValue} onChange={event => setIdValue(event.target.value)}><option value="">{selection.action === 'move' ? 'Chọn nhóm đích' : 'Chọn hành khách'}</option>{options.data?.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></Field>{options.loading && <Loading label="Đang tải lựa chọn…" />}{options.error && <TourError error={options.error} onRetry={options.retry} />}{!options.loading && options.data?.length === 0 && <Empty title={selection.action === 'move' ? 'Không có nhóm đích phù hợp' : 'Không có hành khách đủ điều kiện'} />}</>}
      {selection.action === 'move' && <p>Nhóm đích phải khác nhóm hiện tại, thuộc cùng chuyến tham quan, đang lên kế hoạch hoặc tập trung và còn chỗ. Phân công cũ được hủy; hệ thống tạo phân công mới ở nhóm đích.</p>}
      {selection.action === 'remove' && <p>Xác nhận hủy mềm phân công này. Lịch sử phân công được giữ lại.</p>}
      {selection.action === 'departure' && <p>Ghi nhận hành khách đã có mặt khi nhóm đang tập trung. Thao tác này không khởi hành cả nhóm.</p>}
      {selection.action === 'return' && <p>Xác nhận hành khách đã trở về sau khi nhóm khởi hành.</p>}
      {mutation.error != null && <TourError error={mutation.error} />}

    </Modal>}
  </Panel>
}

export function PassengerRoster({ group, rows, busy, onAction }: { group: TourGroup; rows: GroupPassenger[]; busy: boolean; onAction: (action: PassengerAction, assignment: GroupPassenger) => void }) {
  const access = useSessionAccess()
  if (!rows.length) return <Empty title="Chưa có phân công hành khách trong nhóm" />
  return <DataTable label="Hành khách trong nhóm tour" headers={['Phân công hành khách', 'Trạng thái', 'Thời gian', 'Thao tác']}>
    {rows.map((assignment, index) => {
      const actions = passengerActions(assignment.assignmentStatus, group.status)
      return <tr key={assignment.tourGroupPassengerId}>
        <td className={styles.text}><strong>Phân công {index + 1}</strong><p>Phản hồi hiện chưa kèm tên hành khách.</p><TechnicalDetails entries={[["Hành khách", assignment.passengerId], ["Phân công", assignment.tourGroupPassengerId]]} /><Link className={styles.link} to={`/admin/tour-groups/${assignment.tourGroupId}`}>Nhóm {assignment.groupCode}</Link></td>
        <td><Badge label={assignmentLabels[assignment.assignmentStatus]} tone={assignment.assignmentStatus === 'CANCELLED' ? 'error' : assignment.assignmentStatus === 'COMPLETED' ? 'success' : 'neutral'} /></td>
        <td>Phân công: {displayTime(assignment.assignedAt)}<br />Khởi hành: {displayTime(assignment.checkedInAt)}<br />Trở về: {displayTime(assignment.returnedAt)}</td>
        <td><div className={styles.actions}>{actions.map((action) => <Button key={action} tone={action === 'remove' ? 'danger' : 'secondary'} disabled={busy || !access.has(permission(action))} onClick={() => onAction(action, assignment)}>{passengerActionLabels[action]}</Button>)}</div>{!actions.length && 'Không có thao tác phù hợp.'}</td>
      </tr>
    })}
  </DataTable>
}
