import { useState } from 'react'
import { Button, Field, Modal, Notice, Panel } from '@/shared/ui'
import { tourGroupApi } from '../api/tour-group-api'
import { checkPassengerAvailability } from '../api/group-passenger-api'
import { useTourMutation } from '../hooks/useTourResource'
import { actionLabels, canPrepareGroup, groupActions, isUuid, type GroupAction, type TourGroup } from '../model/tour-group'
import { TourError } from './TourUI'
import styles from './TourGroups.module.css'

type Control = GroupAction | 'guide' | 'assign-passenger' | 'remove-passenger' | 'validate'
const labels: Record<Control, string> = { ...actionLabels, guide: 'Phân công hướng dẫn viên', 'assign-passenger': 'Thêm hành khách', 'remove-passenger': 'Gỡ hành khách', validate: 'Kiểm tra nhóm tour' }
export function GroupControls({ group, onRefresh }: { group: TourGroup; onRefresh: () => void }) {
  const mutation = useTourMutation()
  const [control, setControl] = useState<Control | null>(null), [idValue, setIdValue] = useState(''), [reason, setReason] = useState(''), [report, setReport] = useState('')
  const preparing = canPrepareGroup(group.status)
  const needsId = control === 'guide' || control === 'assign-passenger' || control === 'remove-passenger'
  function open(next: Control) { mutation.clearError(); setReport(''); setReason(''); setIdValue(next === 'guide' ? group.guideId ?? '' : ''); setControl(next) }
  async function execute() {
    if (!control) return
    const id = group.tourGroupId
    const result = await mutation.run<TourGroup | string>(async (signal) => {
      if (control === 'guide') return tourGroupApi.assignGuide(id, idValue.trim(), signal)
      if (control === 'assign-passenger') {
        const current = await tourGroupApi.get(id, signal)
        await checkPassengerAvailability(current, idValue.trim(), signal)
        return tourGroupApi.assignPassenger(id, idValue.trim(), signal)
      }
      if (control === 'remove-passenger') return tourGroupApi.removePassenger(id, idValue.trim(), signal)
      if (control === 'validate') return tourGroupApi.validate(id, signal)
      return tourGroupApi.transition(id, control, reason.trim(), signal)
    })
    if (!result.ok) return
    setControl(null)
    if (typeof result.value === 'string') setReport(result.value === 'Tour group validation passed.' ? 'Nhóm tour đáp ứng điều kiện kiểm tra.' : result.value)
    else onRefresh()
  }
  return <Panel title="Phân công và vận hành">
    {preparing && <>
      <p>Phân công hướng dẫn viên và hành khách trước khi xác nhận nhóm. Hành khách cần có đăng ký đã xác nhận cho chuyến tham quan này.</p>
      <div className={styles.actions}>
        <Button tone="secondary" disabled={mutation.busy} onClick={() => open('guide')}>{labels.guide}</Button>
        <Button tone="secondary" disabled={mutation.busy || group.availableCapacity === 0} onClick={() => open('assign-passenger')}>{labels['assign-passenger']}</Button>
        <Button tone="secondary" disabled={mutation.busy} onClick={() => open('remove-passenger')}>{labels['remove-passenger']}</Button>
      </div>
      {group.availableCapacity === 0 && <p>Nhóm đã hết chỗ. Tải lại dữ liệu hoặc gỡ phân công trước khi thêm hành khách.</p>}
    </>}
    {!preparing && <p>Chỉ có thể chỉnh sửa và phân công hướng dẫn viên khi nhóm đang lên kế hoạch. Điểm danh và điều chuyển hành khách trong danh sách bên dưới.</p>}
    <div className={styles.actions}>{groupActions(group.status).map((action) => <Button key={action} tone={action === 'cancel' ? 'danger' : 'secondary'} disabled={mutation.busy} onClick={() => open(action)}>{labels[action]}</Button>)}<Button tone="secondary" disabled={mutation.busy} onClick={() => open('validate')}>{labels.validate}</Button></div>
    {report && <Notice title="Kết quả kiểm tra">{report}</Notice>}
    {control && <Modal title={labels[control]} busy={mutation.busy} onClose={() => setControl(null)}>
      <p className={styles.text}>Nhóm {group.groupCode}</p>
      {needsId && <Field htmlFor="tour-assignment-id" label={control === 'guide' ? 'ID hướng dẫn viên (UUID)' : 'ID hành khách (UUID)'} error={idValue && !isUuid(idValue.trim()) ? 'Nhập ID UUID hợp lệ.' : undefined}>
        <input id="tour-assignment-id" disabled={mutation.busy} value={idValue} aria-invalid={!!idValue && !isUuid(idValue.trim())} aria-describedby={idValue && !isUuid(idValue.trim()) ? 'tour-assignment-id-hint' : undefined} onChange={(event) => setIdValue(event.target.value)} />
      </Field>}
      {control === 'remove-passenger' && <p>Xác nhận gỡ phân công của hành khách có ID trên khỏi nhóm này.</p>}
      {control === 'cancel' && <><p>Hủy nhóm cũng hủy các phân công hành khách của nhóm.</p><Field htmlFor="tour-cancel-reason" label="Lý do hủy (bắt buộc)"><textarea id="tour-cancel-reason" required maxLength={500} disabled={mutation.busy} value={reason} onChange={(event) => setReason(event.target.value)} /></Field></>}
      {control === 'confirm' && <p>Hệ thống kiểm tra hướng dẫn viên, điểm tập trung, lịch trình và sức chứa trước khi xác nhận nhóm.</p>}
      {control === 'start' && <p>Nhóm cần có hành khách được phân công và đã đến giờ khởi hành dự kiến. Hệ thống kiểm tra điều kiện trước khi cập nhật.</p>}
      {mutation.error != null && <TourError error={mutation.error} />}
      <div className={styles.actions}><Button tone="secondary" disabled={mutation.busy} onClick={() => setControl(null)}>Quay lại</Button><Button tone={control === 'cancel' || control === 'remove-passenger' ? 'danger' : 'primary'} disabled={mutation.busy || (needsId && !isUuid(idValue.trim())) || (control === 'cancel' && (!reason.trim() || reason.trim().length > 500))} onClick={() => void execute()}>{mutation.busy ? 'Đang xử lý…' : 'Xác nhận'}</Button></div>
    </Modal>}
  </Panel>
}
