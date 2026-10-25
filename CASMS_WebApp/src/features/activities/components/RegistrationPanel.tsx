import { useCallback, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { BookingPassengerPicker } from '@/domain/booking-context'
import { Button, DataTable, Empty, Field, Modal, Notice, Panel } from '@/shared/ui'
import { activityApi } from '../api/activity-api'
import { activityTime, attendanceLabels, type Participation } from '../model/activity'
import { attendanceActions } from '../model/activity-actions'
import { registrationAccess } from '../model/activity-permissions'
import { ActivityState } from './ActivityUI'
type Context = { kind: 'activities' | 'excursions'; id: string; cruiseId: string; status: string; startTime: string; endTime: string }
const labels = { create: 'Đăng ký tham gia', update: 'Lưu số chỗ và ghi chú', confirm: 'Xác nhận đăng ký', cancel: 'Hủy đăng ký', 'check-in': 'Điểm danh vào', checkout: 'Ghi nhận ra', complete: 'Hoàn thành lượt tham gia', 'no-show': 'Ghi nhận vắng mặt' }
export function RegistrationPanel({ context }: { context: Context }) {
  const [now] = useState(Date.now)
  const access = useSessionAccess(), lock = useRef(false)
  const policy=registrationAccess(access,context.kind)
  const load = useCallback((signal: AbortSignal) => policy.read ? activityApi.registrations(context.kind === 'activities' ? context.id : undefined, signal).then(rows => rows.filter(item => context.kind === 'activities' ? item.activityId === context.id : item.excursionId === context.id)) : Promise.resolve(null), [context.id, context.kind, policy.read])
  const list = useReadQuery('registrations:' + access.userId + ':' + policy.read + ':' + context.kind + context.id, load)
  const [selected, setSelected] = useState(''), [passengerId, setPassengerId] = useState(''), [quantity, setQuantity] = useState(1), [notes, setNotes] = useState(''), [reason, setReason] = useState('')
  const [action, setAction] = useState<'create' | 'update' | 'confirm' | 'cancel' | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const detail = useReadQuery('registration:' + access.userId + ':' + policy.read + ':' + selected, useCallback(signal => policy.read && selected ? activityApi.registration(selected, signal) : Promise.resolve(null), [selected,policy.read]))
  const current = detail.data && (context.kind === 'activities' ? detail.data.activityId === context.id : detail.data.excursionId === context.id) ? detail.data : null
  const canRegister = policy.create && context.status === 'OPEN' && Date.parse(context.endTime) > now && Boolean(passengerId)
  const allowed = (value: NonNullable<typeof action>) => value === 'create' ? canRegister : policy.manage && Boolean(current && (value === 'cancel' ? ['PENDING', 'CONFIRMED'].includes(current.status) && Date.parse(context.startTime) > now : current.status === 'PENDING'))
  async function confirm() {
    if (!action || !allowed(action) || lock.current) return
    if ((action === 'create' || action === 'update') && (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2147483647 || notes.length > 500)) { setError('Số chỗ phải là số nguyên dương; ghi chú tối đa 500 ký tự.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      if (action === 'create') await activityApi.register(context.kind, context.id, passengerId, quantity)
      else if (action === 'update') await activityApi.updateRegistration(selected, quantity, notes)
      else await activityApi.registrationAction(selected, action, reason.trim() || undefined)
      setAction(null); list.retry(); detail.retry()
    } catch (value) { setError(value instanceof Error ? value.message : 'Chưa thay đổi được đăng ký.') }
    finally { lock.current = false; setBusy(false) }
  }
  if(!policy.read) return <Panel title="Đăng ký tham gia"><Notice title="Chưa có quyền xem đăng ký">Tài khoản cần quyền quản lý đăng ký hoặc điểm danh.</Notice></Panel>
  return <><Panel title="Đăng ký tham gia"><ActivityState {...list} />{list.data && (!list.data.length ? <Empty title="Chưa có đăng ký" /> : <DataTable label="Đăng ký tham gia" headers={['Số chỗ', 'Trạng thái', 'Thời gian', '']} >{list.data.map((item, index) => <tr key={item.id}><td>{item.quantity}</td><td>{attendanceLabels[item.status] ?? item.status}</td><td>{activityTime(item.registeredAt)}</td><td><Button tone="secondary" onClick={() => { setSelected(item.id); setQuantity(item.quantity); setNotes(''); setReason('') }}>Xem đăng ký {index + 1}</Button></td></tr>)}</DataTable>)}{policy.create && <><p>Chọn đặt chỗ đã xác nhận và hành khách của đúng chuyến. Số chỗ còn lại được kiểm tra lại khi lưu.</p><BookingPassengerPicker key={context.cruiseId} cruiseId={context.cruiseId} allowedStatuses={['Confirmed']} value={passengerId} onChange={person => setPassengerId(person?.bookingPassengerId ?? '')} /><Field htmlFor="registration-quantity" label="Số chỗ"><input id="registration-quantity" type="number" min={1} step={1} value={Number.isNaN(quantity) ? '' : quantity} onChange={event => setQuantity(event.target.value ? Number(event.target.value) : NaN)} /></Field><Button disabled={!canRegister || busy} onClick={() => { setAction('create'); setError('') }}>Đăng ký tham gia</Button></>}</Panel>
    {selected && <Panel title="Đăng ký đã chọn"><ActivityState {...detail} />{current && <><p>{attendanceLabels[current.status] ?? current.status} · {current.quantity} chỗ · {activityTime(current.registeredAt)}</p>{policy.manage && current.status === 'PENDING' && <><Field htmlFor="registration-notes" label="Ghi chú thay thế"><textarea id="registration-notes" maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} /></Field><p>Ghi chú cũ không có trong dữ liệu trả về. Lưu chỉnh sửa sẽ thay thế ghi chú bằng nội dung trong ô, kể cả để trống.</p></>}{policy.manage && <Field htmlFor="registration-cancel-reason" label="Lý do hủy (nếu có)"><input id="registration-cancel-reason" value={reason} onChange={event => setReason(event.target.value)} /></Field>}{(['update', 'confirm', 'cancel'] as const).filter(() => policy.manage).map(value => <Button key={value} disabled={!allowed(value) || busy} tone={value === 'cancel' ? 'danger' : 'secondary'} onClick={() => { setAction(value); setError('') }}>{labels[value]}</Button>)}</>}</Panel>}
    {policy.attend && list.data && <ParticipationPanel registrationIds={list.data.map(item => item.id)} context={context} />}
    {action && (action === 'create' ? policy.create : policy.manage) && <Modal title={labels[action]} busy={busy} onClose={() => setAction(null)}><p>Xác nhận {labels[action].toLocaleLowerCase('vi')}? Thao tác này thay đổi đăng ký thực tế.</p>{error && <Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}<Button disabled={busy || !allowed(action)} onClick={() => void confirm()}>Xác nhận</Button></Modal>}</>
}
function ParticipationPanel({ registrationIds, context }: { registrationIds: string[]; context: Context }) {
  const list = useReadQuery('activity-participations', activityApi.participations), access = useSessionAccess(), lock = useRef(false)
  const [selected, setSelected] = useState(''), [action, setAction] = useState<ReturnType<typeof attendanceActions>[number] | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const detail = useReadQuery('participation:' + selected, useCallback(signal => selected ? activityApi.participation(selected, signal) : Promise.resolve(null), [selected]))
  const current: Participation | null = detail.data && registrationIds.includes(detail.data.registrationId) ? detail.data : null
  const rows = list.data?.filter(item => registrationIds.includes(item.registrationId))
  async function confirm() {
    if (!action || !current || !access.canDo('ACTIVITY_ATTENDANCE') || !attendanceActions(current, context).includes(action) || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await activityApi.attendance(current.id, action); setAction(null); detail.retry(); list.retry() }
    catch (value) { setError(value instanceof Error ? value.message : 'Chưa cập nhật điểm danh.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Tham gia & điểm danh"><ActivityState {...list} />{rows && (!rows.length ? <Empty title="Chưa có lượt tham gia được xác nhận" /> : rows.map((item, index) => <p key={item.id}>{attendanceLabels[item.status] ?? item.status} · Vào: {activityTime(item.checkInTime)} · Ra: {activityTime(item.checkOutTime)} <Button tone="secondary" onClick={() => setSelected(item.id)}>Xem lượt {index + 1}</Button></p>))}{selected && <ActivityState {...detail} />}{current && <><p>{attendanceLabels[current.status] ?? current.status} · {activityTime(current.checkInTime)} → {activityTime(current.checkOutTime)}</p>{attendanceActions(current, context).map(value => (access.canDo('ACTIVITY_ATTENDANCE') ? <Button key={value} disabled={!access.canDo('ACTIVITY_ATTENDANCE') || busy} onClick={() => { setAction(value); setError('') }}>{labels[value]}</Button> : null))}<p>Ghi nhận ra chuyển sang đang tham gia; cần hoàn thành riêng để chốt lượt. Vắng mặt chỉ ghi nhận sau giờ kết thúc.</p></>}{action && access.canDo('ACTIVITY_ATTENDANCE') && <Modal title={labels[action]} busy={busy} onClose={() => setAction(null)}>{error && <Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}<Button disabled={busy} onClick={() => void confirm()}>Xác nhận</Button></Modal>}</Panel>
}
