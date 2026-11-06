import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Modal } from '@/shared/ui'
import { tourGroupApi } from '../api/tour-group-api'
import { checkPassengerAvailability, groupPassengerApi } from '../api/group-passenger-api'
import { useTourMutation } from '../hooks/useTourResource'
import { actionLabels, canPrepareGroup, groupActions, isUuid, type GroupAction, type TourGroup } from '../model/tour-group'
import { TourError } from './TourUI'
import styles from './TourGroups.module.css'

type Control = GroupAction | 'assign-guide' | 'assign-passenger' | 'remove-passenger'
const labels: Record<Control, string> = { ...actionLabels, 'assign-guide':'Phân công hướng dẫn viên', 'assign-passenger': 'Thêm hành khách', 'remove-passenger': 'Gỡ hành khách' }
const permission = (control: Control) => control==='assign-guide'?'TOUR_GROUP_GUIDE_ASSIGN': control === 'assign-passenger' ? 'TOUR_GROUP_PASSENGER_ASSIGN' : control === 'remove-passenger' ? 'TOUR_GROUP_PASSENGER_REMOVE' : 'TOUR_GROUP_STATUS_CHANGE'
export function GroupControls({ group, onRefresh, children }: { group: TourGroup; onRefresh: () => void; children?: ReactNode }) {
  const access = useSessionAccess()
  const mutation = useTourMutation()
  const pending=useRef<{control:Control;id:string}|null>(null)
  const blocked=mutation.busy||mutation.needsReview
  const [control, setControl] = useState<Control | null>(null), [idValue, setIdValue] = useState(''), [reason, setReason] = useState('')
  const loadOptions = useCallback(async (signal: AbortSignal) => control==='assign-guide'?(await tourGroupApi.guideOptions(group.tourGroupId,signal)).map(v=>({id:v.id,label:`${v.name} · ${v.roleInCruise}`})): control === 'assign-passenger' ? (await groupPassengerApi.eligible(group.tourGroupId, signal)).map(row => ({ id: row.passengerId, label: row.fullName })) : control === 'remove-passenger' ? (await groupPassengerApi.list(group.tourGroupId, signal)).filter(row => row.assignmentStatus !== 'CANCELLED').map((row, index) => ({ id: row.passengerId, label: `Phân công ${index + 1} · ${row.passengerName??row.groupCode} · ${row.assignedAt ? new Date(row.assignedAt).toLocaleString('vi-VN') : 'Chưa có thời gian'}` })) : [], [control, group.tourGroupId])
  const options = useReadQuery(`group-control-options:${access.userId}:${group.tourGroupId}:${control}`, loadOptions)
  const preparing = canPrepareGroup(group.status)
  const needsId = control==='assign-guide'||control === 'assign-passenger' || control === 'remove-passenger'
  function open(next: Control) { if (blocked||!access.canDo(permission(next))) return; mutation.clearError(); setReason(''); setIdValue(''); setControl(next) }
  async function execute() {
    if (!control || !access.canDo(permission(control)) || (needsId && !options.data?.some(row => row.id === idValue)) || (control === 'cancel' && (!reason.trim() || reason.trim().length > 500))) return
    pending.current={control,id:idValue}
    const id = group.tourGroupId
    const result = await mutation.run<TourGroup>(async (signal) => {
      if(control==='assign-guide')return tourGroupApi.assignGuide(id,idValue,signal)
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
  async function review(){
    const operation=pending.current
    if(!operation)return
    const confirmed=await mutation.reconcile(async()=>{
      if(operation.control==='assign-passenger'||operation.control==='remove-passenger'){
        const roster=await groupPassengerApi.list(group.tourGroupId)
        const assigned=roster.some(row=>row.passengerId===operation.id&&row.assignmentStatus!=='CANCELLED')
        return operation.control==='assign-passenger'?assigned:!assigned
      }
      const fresh=await tourGroupApi.get(group.tourGroupId)
      if(operation.control==='assign-guide')return fresh.guideId===operation.id
      const states={confirm:'ASSEMBLING',start:'DEPARTED',complete:'RETURNED',cancel:'CANCELLED'}
      return fresh.status===states[operation.control]
    })
    if(confirmed){setControl(null);onRefresh()}
  }
  return <div className={styles.detailActions} role="group" aria-label="Thao tác nhóm tour">
    {children}
    {mutation.needsReview&&<div role="status"><p>Chưa xác nhận được kết quả đã gửi. Đối chiếu trước khi thao tác tiếp.</p><Button tone="secondary" disabled={mutation.busy} onClick={()=>void review()}>Đối chiếu kết quả đã lưu</Button></div>}
    {preparing && <>
        {access.canDo('TOUR_GROUP_GUIDE_ASSIGN') && <Button tone="secondary" disabled={blocked} onClick={()=>open('assign-guide')}>Phân công hướng dẫn viên</Button>}
        {access.canDo('TOUR_GROUP_PASSENGER_ASSIGN') && <Button tone="secondary" disabled={blocked || !access.canDo('TOUR_GROUP_PASSENGER_ASSIGN') || group.availableCapacity === 0} onClick={() => open('assign-passenger')}>{labels['assign-passenger']}</Button>}
        {access.canDo('TOUR_GROUP_PASSENGER_REMOVE') && <Button tone="secondary" disabled={blocked || !access.canDo('TOUR_GROUP_PASSENGER_REMOVE') || group.assignedPassengers === 0} onClick={() => open('remove-passenger')}>{labels['remove-passenger']}</Button>}
    </>}
    {groupActions(group.status).map(action => access.canDo(permission(action)) ? <Button key={action} tone={action === 'cancel' ? 'danger' : 'secondary'} disabled={blocked} onClick={() => open(action)}>{labels[action]}</Button> : null)}
    {control && access.canDo(permission(control)) && <Modal title={labels[control]} busy={mutation.busy} onClose={() => setControl(null)} footer={<div className={styles.actions}><Button tone="secondary" disabled={mutation.busy} onClick={() => setControl(null)} data-overlay-dismiss>Quay lại</Button>{access.canDo(permission(control)) && <Button tone={control === 'cancel' || control === 'remove-passenger' ? 'danger' : 'primary'} disabled={blocked || !access.canDo(permission(control)) || (needsId && (options.loading || Boolean(options.error) || !isUuid(idValue.trim()))) || (control === 'cancel' && (!reason.trim() || reason.trim().length > 500))} onClick={() => void execute()}>{mutation.busy ? 'Đang xử lý…' : 'Xác nhận'}</Button>}</div>}>
      <p className={styles.text}>Nhóm {group.groupCode}</p>
      {needsId && <><Field htmlFor="tour-assignment-id" label={control === 'assign-guide' ? 'Nhân viên đang được phân công trên chuyến' : control === 'assign-passenger' ? 'Hành khách đủ điều kiện' : 'Phân công hành khách hiện tại'}><select id="tour-assignment-id" disabled={blocked || options.loading || Boolean(options.error)} value={idValue} onChange={event => setIdValue(event.target.value)}><option value="">{control === 'assign-guide' ? 'Chọn hướng dẫn viên' : 'Chọn hành khách'}</option>{options.data?.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></Field>{options.error && <TourError error={options.error} onRetry={options.retry} />}{!options.loading && options.data?.length === 0 && <p>{control === 'assign-guide' ? 'Chưa có nhân viên ACTIVE trên chuyến phù hợp với lịch nhóm. Kiểm tra phân công nhân sự và giờ khởi hành, trở về.' : 'Không có hành khách phù hợp với nhóm này.'}</p>}</>}
      {control === 'remove-passenger' && <p>Xác nhận gỡ phân công đã chọn khỏi nhóm này.</p>}
      {control === 'cancel' && <><p>Hủy nhóm cũng hủy các phân công hành khách của nhóm.</p><Field htmlFor="tour-cancel-reason" label="Lý do hủy (bắt buộc)"><textarea id="tour-cancel-reason" required maxLength={500} disabled={blocked} value={reason} onChange={(event) => setReason(event.target.value)} /></Field></>}
      {control === 'confirm' && <p>Hệ thống kiểm tra hướng dẫn viên, điểm tập trung, lịch trình và sức chứa trước khi xác nhận nhóm.</p>}
      {control === 'start' && <p>Nhóm cần có hành khách được phân công và đã đến giờ khởi hành dự kiến. Hệ thống kiểm tra điều kiện trước khi cập nhật.</p>}
      {mutation.error != null && <TourError error={mutation.error} />}{mutation.needsReview&&<Button tone="secondary" disabled={mutation.busy} onClick={()=>void review()}>Đối chiếu kết quả đã lưu</Button>}

    </Modal>}
  </div>
}
