import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Modal, Notice, Panel } from '@/shared/ui'
import { activityApi, type ActivityCatalogEntry } from '../api/activity-api'
import { activityActions } from '../model/activity-actions'
import type { Activity } from '../model/activity'
import styles from './Activities.module.css'
const labels = { open: 'Mở đăng ký', start: 'Bắt đầu hoạt động', complete: 'Hoàn thành hoạt động', cancel: 'Hủy hoạt động', delete: 'Xóa hoạt động chưa sử dụng' }
export function ActivityOperations({ activity, onChanged, renderCatalogHeader }: {
  activity: Activity | ActivityCatalogEntry
  onChanged: () => void
  renderCatalogHeader?: (deleteAction: ReactNode) => ReactNode
}) {
  const access = useSessionAccess(), navigate = useNavigate(), lock = useRef(false)
  const [action, setAction] = useState<keyof typeof labels | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const occurrence = activity.catalogEntry === true ? null : activity
  const canDelete = !occurrence || occurrence.status === 'PLANNED'
  const lifecycle = occurrence ? activityActions(occurrence) : []
  const allowed = (action: keyof typeof labels) => access.canDo(action === 'delete' ? 'ACTIVITY_UPDATE' : 'ACTIVITY_LIFECYCLE') && (action === 'delete' ? canDelete : lifecycle.includes(action))
  async function confirm() {
    if (!action || lock.current || !allowed(action)) return
    lock.current = true; setBusy(true); setError('')
    try { if (action === 'delete') { await activityApi.remove(activity.id); navigate('/admin/activities') } else { await activityApi.lifecycle(activity.id, action); onChanged() } setAction(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa thực hiện được thay đổi.') }
    finally { lock.current = false; setBusy(false) }
  }
  const canUpdate = access.canDo('ACTIVITY_UPDATE')
  const canManageLifecycle = access.canDo('ACTIVITY_LIFECYCLE')
  const deleteNote = 'Chỉ xóa hoạt động chưa có đăng ký và chưa được tham chiếu.'
  function openAction(item: keyof typeof labels) {
    setAction(item)
    setError('')
  }
  const deleteAction = canUpdate && canDelete && <Button tone="danger" disabled={busy} onClick={() => openAction('delete')}>{labels.delete}</Button>

  return <>
    {renderCatalogHeader ? renderCatalogHeader(deleteAction) : (canUpdate || canManageLifecycle) && <Panel title="Điều hành hoạt động">
      <div className={styles.actions}>
        {occurrence?.status === 'PLANNED' && canUpdate && <ButtonLink tone="secondary" to={`/admin/activities/${activity.id}/edit`}>Chỉnh sửa</ButtonLink>}
        {canManageLifecycle && lifecycle.map(item => <Button key={item} tone={item === 'cancel' ? 'danger' : 'secondary'} disabled={busy} onClick={() => openAction(item)}>{labels[item]}</Button>)}
        {deleteAction}
      </div>
      <p>{deleteNote}</p>
    </Panel>}
    {action && allowed(action) && <Modal title={labels[action]} busy={busy} onClose={() => setAction(null)} protectChanges={false} footer={<>
      <Button tone="secondary" disabled={busy} onClick={() => setAction(null)}>Hủy</Button>
      <Button tone={action === 'delete' || action === 'cancel' ? 'danger' : 'primary'} busy={busy} disabled={!allowed(action)} onClick={() => void confirm()}>{labels[action]}</Button>
    </>}>
      <p>Xác nhận {labels[action].toLocaleLowerCase('vi')} cho {activity.name}?</p>
      {!occurrence && action === 'delete' && <p>{deleteNote}</p>}
      {error && <Notice title="Không thực hiện được" tone="error">{error}</Notice>}
    </Modal>}
  </>
}
