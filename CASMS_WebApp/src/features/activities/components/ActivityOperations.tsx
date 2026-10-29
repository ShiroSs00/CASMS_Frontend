import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Modal, Notice, Panel } from '@/shared/ui'
import { activityApi } from '../api/activity-api'
import { activityActions } from '../model/activity-actions'
import type { Activity } from '../model/activity'
const labels = { open: 'Mở đăng ký', start: 'Bắt đầu hoạt động', complete: 'Hoàn thành hoạt động', cancel: 'Hủy hoạt động', delete: 'Xóa hoạt động chưa sử dụng' }
export function ActivityOperations({ activity, onChanged }: { activity: Activity; onChanged: () => void }) {
  const access = useSessionAccess(), navigate = useNavigate(), lock = useRef(false)
  const [action, setAction] = useState<keyof typeof labels | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const allowed = (action: keyof typeof labels) => access.canDo(action === 'delete' ? 'ACTIVITY_UPDATE' : 'ACTIVITY_LIFECYCLE') && (action === 'delete' ? activity.status === 'PLANNED' : activityActions(activity).includes(action))
  async function confirm() {
    if (!action || lock.current || !allowed(action)) return
    lock.current = true; setBusy(true); setError('')
    try { if (action === 'delete') { await activityApi.remove(activity.id); navigate('/admin/activities') } else { await activityApi.lifecycle(activity.id, action); onChanged() } setAction(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa thực hiện được thay đổi.') }
    finally { lock.current = false; setBusy(false) }
  }
  if (!access.canDo('ACTIVITY_UPDATE') && !access.canDo('ACTIVITY_LIFECYCLE')) return null
  return <Panel title="Điều hành hoạt động">{activity.status === 'PLANNED' && access.canDo('ACTIVITY_UPDATE') && <ButtonLink tone="secondary" to={`/admin/activities/${activity.id}/edit`}>Chỉnh sửa</ButtonLink>}{[...activityActions(activity), ...(activity.status === 'PLANNED' ? ['delete' as const] : [])].filter(item => access.canDo(item === 'delete' ? 'ACTIVITY_UPDATE' : 'ACTIVITY_LIFECYCLE')).map(item => <Button key={item} tone={item === 'cancel' || item === 'delete' ? 'danger' : 'secondary'} disabled={!allowed(item) || busy} onClick={() => { setAction(item); setError('') }}>{labels[item]}</Button>)}<p>Chỉ xóa hoạt động chưa có đăng ký và chưa được đưa vào gói. Mở đăng ký không tự xác nhận hành khách.</p>{action && allowed(action) && <Modal title={labels[action]} busy={busy} onClose={() => setAction(null)}><p>Xác nhận {labels[action].toLocaleLowerCase('vi')} cho {activity.name}?</p>{error && <Notice title="Không thực hiện được" tone="error">{error}</Notice>}<Button disabled={busy || !allowed(action)} onClick={() => void confirm()}>{labels[action]}</Button></Modal>}</Panel>
}
