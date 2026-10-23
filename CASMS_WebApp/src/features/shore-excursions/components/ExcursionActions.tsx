import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Modal, Notice, Panel } from '@/shared/ui'
import { shoreExcursionApi } from '../api/shore-excursion-api'
import { useShoreMutation } from '../hooks/useShoreRequest'
import { actionLabels, canDeleteExcursion, lifecycleActions, statusLabels, type LifecycleAction, type ShoreExcursion } from '../model/shore-excursion'
import { ShoreError } from './ShoreUI'
import styles from './ShoreExcursions.module.css'

type Action = LifecycleAction | 'remove'
const labels: Record<Action, string> = { ...actionLabels, remove: 'Xóa chuyến tham quan' }
const permission = (action: Action) => action === 'remove' ? 'EXCURSION_DELETE_DRAFT' : 'EXCURSION_STATUS_CHANGE'
export function ExcursionActions({ excursion, onRefresh, children }: { excursion: ShoreExcursion; onRefresh: () => void; children?: ReactNode }) {
  const access = useSessionAccess()
  const navigate = useNavigate()
  const mutation = useShoreMutation()
  const [action, setAction] = useState<Action | null>(null)
  const [reason, setReason] = useState('')
  function open(next: Action) { mutation.clearError(); setReason(''); setAction(next) }
  async function execute() {
    if (!action || !access.has(permission(action))) return
    const id = excursion.shoreExcursionId
    const result = await mutation.run<ShoreExcursion | void>((signal) => {
      if (action === 'remove') return shoreExcursionApi.remove(id, signal)
      return shoreExcursionApi.transition(id, action, reason.trim(), signal)
    })
    if (!result.ok) return
    setAction(null)
    if (action === 'remove') navigate('/admin/shore-excursions')
    else onRefresh()
  }
  return <div className={styles.detailActions} role="group" aria-label="Thao tác chuyến tham quan">
      {children}
      {lifecycleActions(excursion.status).map((next) => (access.has(permission(next)) ? <Button key={next} tone={next === 'cancel' ? 'danger' : 'secondary'} disabled={mutation.busy || !access.has(permission(next))} onClick={() => open(next)}>{labels[next]}</Button> : null))}
      {canDeleteExcursion(excursion.status) && (access.has(permission('remove')) ? <Button tone="danger" disabled={mutation.busy || !access.has(permission('remove'))} onClick={() => open('remove')}>{labels.remove}</Button> : null)}
    {action && access.has(permission(action)) && <Modal title={labels[action]} busy={mutation.busy} onClose={() => setAction(null)} footer={<div className={styles.actions}><Button tone="secondary" disabled={mutation.busy} onClick={() => setAction(null)} data-overlay-dismiss>Quay lại</Button>{access.has(permission(action)) && <Button tone={action === 'cancel' || action === 'remove' ? 'danger' : 'primary'} disabled={mutation.busy || !access.has(permission(action)) || (action === 'cancel' && (!reason.trim() || reason.trim().length > 500))} onClick={() => void execute()}>{mutation.busy ? 'Đang xử lý…' : 'Xác nhận'}</Button>}</div>}>
      <p className={styles.text}>{excursion.excursionName}</p>
      {action === 'remove' ? <p>Chỉ có thể xóa chuyến tham quan đang lên kế hoạch và chưa có đăng ký. Hệ thống sẽ kiểm tra trước khi xóa.</p>
        : action === 'start' ? <p>Chỉ bắt đầu khi thời điểm hiện tại nằm trong khoảng thời gian diễn ra chuyến tham quan. Hệ thống kiểm tra điều kiện trước khi cập nhật.</p>
          : <p>Xác nhận thực hiện thao tác này?</p>}
      {action === 'cancel' && <Field htmlFor="excursion-cancel-reason" label="Lý do hủy (bắt buộc)"><textarea id="excursion-cancel-reason" required maxLength={500} disabled={mutation.busy} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>}
      {mutation.error != null && <ShoreError error={mutation.error} />}

    </Modal>}
  </div>
}

export function ExcursionAvailability({ excursion }: { excursion: ShoreExcursion }) {
  const access = useSessionAccess()
  const mutation = useShoreMutation()
  const [participants, setParticipants] = useState('1')
  const [report, setReport] = useState('')
  async function checkAvailability(event: FormEvent) {
    event.preventDefault(); setReport('')
    if (excursion.status !== 'OPEN' || !access.has('EXCURSION_READ')) return
    const count = Number(participants)
    if (!Number.isInteger(count) || count < 1 || count > 2147483647) return
    const result = await mutation.run(signal => shoreExcursionApi.availability(excursion.shoreExcursionId, count, signal))
    if (result.ok) setReport(`Kết quả cho ${count} khách: ${statusLabels[result.value.status]}, còn ${result.value.availableCapacity} chỗ.`)
  }
  if (excursion.status !== 'OPEN' || !access.has('EXCURSION_READ')) return null
  return <Panel title="Tra cứu chỗ trống">
    <form className={styles.availabilityForm} onSubmit={event => void checkAvailability(event)}>
      <Field htmlFor="excursion-participants" label="Số khách cần kiểm tra"><input id="excursion-participants" type="number" min={1} max={2147483647} step={1} required disabled={mutation.busy} value={participants} onChange={event => { setParticipants(event.target.value); setReport(''); mutation.clearError() }} /></Field>
      <Button type="submit" tone="secondary" disabled={mutation.busy}>{mutation.busy ? 'Đang kiểm tra…' : 'Kiểm tra chỗ trống'}</Button>
    </form>
    {mutation.error != null && <ShoreError error={mutation.error} />}
    {report && <Notice title="Kết quả từ hệ thống">{report}</Notice>}
  </Panel>
}
