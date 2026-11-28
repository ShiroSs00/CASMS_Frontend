import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { SHIP_TIME_ZONE, zonedInput } from '@/shared/lib/journey-time'
import { Button, ButtonLink, Field, Modal, Notice, Panel } from '@/shared/ui'
import { activityApi, type ActivityCatalogEntry } from '../api/activity-api'
import { activityActions } from '../model/activity-actions'
import type { Activity } from '../model/activity'
import styles from './Activities.module.css'
import { useActivityProgramAccess } from '../model/useActivityProgramAccess'
const labels = { open: 'Mở đăng ký', start: 'Bắt đầu hoạt động', complete: 'Hoàn thành hoạt động', cancel: 'Hủy hoạt động', delete: 'Xóa hoạt động chưa sử dụng' }
export function ActivityOperations({ activity, onChanged, onDeleted, renderCatalogHeader }: {
  activity: Activity | ActivityCatalogEntry
  onChanged: () => void
  onDeleted?: () => void
  renderCatalogHeader?: (deleteAction: ReactNode) => ReactNode
}) {
  const access = useSessionAccess(), navigate = useNavigate(), lock = useRef(false)
  const [action, setAction] = useState<keyof typeof labels | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [weatherOpen, setWeatherOpen] = useState(false)
  const [weatherLocation, setWeatherLocation] = useState('')
  const [weatherMeeting, setWeatherMeeting] = useState('')
  const [weatherStart, setWeatherStart] = useState('')
  const [weatherEnd, setWeatherEnd] = useState('')
  const [weatherReason, setWeatherReason] = useState('')
  const [weatherNotice, setWeatherNotice] = useState('')
  const occurrence = activity.catalogEntry === true ? null : activity
  const programAccess = useActivityProgramAccess(occurrence?.cruiseId, !occurrence)
  const canDelete = !occurrence || occurrence.status === 'PLANNED'
  const canWeatherReschedule = Boolean(
    occurrence &&
    ['PLANNED', 'OPEN', 'FULL', 'IN_PROGRESS'].includes(occurrence.status) &&
    access.roles.some(role => ['ACTIVITY_SERVICE_MANAGER', 'ONBOARD_STAFF', 'OPERATIONS_MANAGER', 'SHIP_MANAGER', 'ADMIN'].includes(role)),
  )
  const lifecycle = occurrence ? activityActions(occurrence) : []
  const allowed = (action: keyof typeof labels) => access.canDo(action === 'delete' ? 'ACTIVITY_UPDATE' : 'ACTIVITY_LIFECYCLE') && (action === 'delete' ? canDelete && programAccess.editable : lifecycle.includes(action))
  function openWeatherModal() {
    if (!occurrence) return
    setWeatherLocation(occurrence.location ?? '')
    setWeatherMeeting('')
    setWeatherStart(occurrence.startTime ? zonedInput(occurrence.startTime, SHIP_TIME_ZONE).slice(0, 16) : '')
    setWeatherEnd(occurrence.endTime ? zonedInput(occurrence.endTime, SHIP_TIME_ZONE).slice(0, 16) : '')
    setWeatherReason('')
    setError('')
    setWeatherOpen(true)
  }
  async function submitWeatherReschedule() {
    if (!occurrence || lock.current || !weatherLocation.trim() || !weatherReason.trim()) return
    if (weatherStart && weatherEnd && weatherEnd <= weatherStart) {
      setError('Giờ kết thúc mới phải sau giờ bắt đầu mới.')
      return
    }
    lock.current = true; setBusy(true); setError('')
    try {
      const res = await activityApi.weatherReschedule(occurrence.id, {
        newLocation: weatherLocation,
        newMeetingPoint: weatherMeeting || null,
        newStartTime: weatherStart || null,
        newEndTime: weatherEnd || null,
        reason: weatherReason,
      })
      setWeatherOpen(false)
      setWeatherNotice(`Đã dời lịch hoạt động sang "${res.newLocation}" và gửi thông báo tới ${res.notifiedPassengerCount} hành khách.`)
      onChanged()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chưa dời lịch được hoạt động.')
    } finally {
      lock.current = false; setBusy(false)
    }
  }
  async function confirm() {
    if (!action || lock.current || !allowed(action)) return
    lock.current = true; setBusy(true); setError('')
    try {
      if (action === 'delete') {
        await activityApi.remove(activity.id)
        setAction(null)
        if (onDeleted) onDeleted()
        else navigate('/admin/activities')
      } else {
        await activityApi.lifecycle(activity.id, action)
        onChanged()
        setAction(null)
      }
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa thực hiện được thay đổi.') }
    finally { lock.current = false; setBusy(false) }
  }
  const canUpdate = access.canDo('ACTIVITY_UPDATE') && programAccess.editable
  const canManageLifecycle = access.canDo('ACTIVITY_LIFECYCLE')
  const deleteNote = 'Chỉ xóa hoạt động chưa có đăng ký và chưa được tham chiếu.'
  function openAction(item: keyof typeof labels) {
    setAction(item)
    setError('')
  }
  const deleteAction = canUpdate && canDelete && <Button tone="danger" disabled={busy} onClick={() => openAction('delete')}>{labels.delete}</Button>

  return <>
    {weatherNotice && <Notice title="Đã điều chỉnh lịch hoạt động" tone="success">{weatherNotice}</Notice>}
    {programAccess.reason && <Notice title="Quyền sửa chương trình"><p>{programAccess.reason}</p><Button tone="secondary" onClick={programAccess.retry}>Kiểm tra lại quyền sửa</Button></Notice>}
    {renderCatalogHeader ? renderCatalogHeader(deleteAction) : (canUpdate || canManageLifecycle || canWeatherReschedule) && <Panel title="Điều hành hoạt động">
      <div className={styles.actions}>
        {occurrence?.status === 'PLANNED' && canUpdate && <ButtonLink tone="secondary" to={`/admin/activities/${activity.id}/edit`}>Chỉnh sửa</ButtonLink>}
        {canWeatherReschedule && <Button tone="secondary" disabled={busy} onClick={openWeatherModal}>Dời lịch do thời tiết</Button>}
        {canManageLifecycle && lifecycle.map(item => <Button key={item} tone={item === 'cancel' ? 'danger' : 'secondary'} disabled={busy} onClick={() => openAction(item)}>{labels[item]}</Button>)}
        {deleteAction}
      </div>
      {deleteAction && <p>{deleteNote}</p>}
    </Panel>}
    {weatherOpen && occurrence && (
      <Modal
        title="Dời lịch hoạt động do thời tiết"
        description={occurrence.name}
        busy={busy}
        onClose={() => { if (!busy) setWeatherOpen(false) }}
        footer={
          <>
            <Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={() => setWeatherOpen(false)}>Hủy</Button>
            <Button busy={busy} disabled={busy || !weatherLocation.trim() || !weatherReason.trim()} onClick={() => void submitWeatherReschedule()}>
              Xác nhận dời lịch & báo khách
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          <Field htmlFor="weather-location" label="Địa điểm tổ chức mới *">
            <input id="weather-location" value={weatherLocation} disabled={busy} placeholder="VD: Phòng hội trường Boong 5" onChange={e => setWeatherLocation(e.target.value)} />
          </Field>
          <Field htmlFor="weather-meeting" label="Điểm tập trung mới (tùy chọn)">
            <input id="weather-meeting" value={weatherMeeting} disabled={busy} placeholder="VD: Sảnh chính Boong 5" onChange={e => setWeatherMeeting(e.target.value)} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '12px' }}>
            <Field htmlFor="weather-start" label="Giờ bắt đầu mới (tùy chọn)">
              <input id="weather-start" type="datetime-local" value={weatherStart} disabled={busy} onChange={e => setWeatherStart(e.target.value)} />
            </Field>
            <Field htmlFor="weather-end" label="Giờ kết thúc mới (tùy chọn)">
              <input id="weather-end" type="datetime-local" value={weatherEnd} disabled={busy} onChange={e => setWeatherEnd(e.target.value)} />
            </Field>
          </div>
          <Field htmlFor="weather-reason" label="Lý do thời tiết *">
            <textarea id="weather-reason" rows={2} value={weatherReason} disabled={busy} placeholder="VD: Mưa lớn trên boong mở, chuyển vào không gian trong nhà." onChange={e => setWeatherReason(e.target.value)} />
          </Field>
          {error && <Notice title="Chưa dời lịch được" tone="error">{error}</Notice>}
        </div>
      </Modal>
    )}
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
