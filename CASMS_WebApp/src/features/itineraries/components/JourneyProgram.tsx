import { useRef, useState, type FormEvent } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Empty, Field, Modal, Notice, Panel } from '@/shared/ui'
import { journeyTime, SHIP_TIME_ZONE, validTimeZone, wallTimeToInstant, zonedInput } from '@/shared/lib/journey-time'
import { programApi, type ProgramActivity, type ProgramExcursion, type ProgramService } from '../api/program-api'
import type { CruiseStop, ItineraryDay, Port } from '../model/itinerary'
import { excursionIssue, overlapsDay } from '../model/journey-review'
import {businessCopy} from '@/shared/i18n/business-copy'
import styles from './Itineraries.module.css'

function ProgramTimeEditor({ activity, excursion, stop, zone, cruise, onSaved, onBusy }: { activity?: ProgramActivity; excursion?: ProgramExcursion; stop?: CruiseStop; zone: string; cruise: { departureDatetime: string; returnDatetime: string }; onSaved: () => void; onBusy: (busy: boolean) => void }) {
  const access = useSessionAccess(), lock = useRef(false)
  const [start, setStart] = useState(() => zonedInput(activity?.startTime ?? excursion!.startTime, zone))
  const [end, setEnd] = useState(() => zonedInput(activity?.endTime ?? excursion!.plannedReturnTime, zone))
  const [location, setLocation] = useState(activity?.location ?? excursion?.meetingPoint ?? '')
  const [errors, setErrors] = useState<Record<string,string>>({}), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !access.canDo(activity ? 'ACTIVITY_UPDATE' : 'EXCURSION_UPDATE')) return
    const invalid: Record<string,string> = {}
    let startTime = '', endTime = ''
    try { startTime = wallTimeToInstant(start, zone) } catch (reason) { invalid.start = reason instanceof Error ? reason.message : 'Giờ bắt đầu chưa hợp lệ.' }
    try { endTime = wallTimeToInstant(end, zone) } catch (reason) { invalid.end = reason instanceof Error ? reason.message : 'Giờ kết thúc chưa hợp lệ.' }
    if (startTime && endTime && Date.parse(endTime) <= Date.parse(startTime)) invalid.end = 'Kết thúc phải sau bắt đầu.'
    if (activity && (Date.parse(startTime) < Date.parse(cruise.departureDatetime) || Date.parse(endTime) > Date.parse(cruise.returnDatetime))) invalid.end = 'Hoạt động phải nằm trong thời gian chuyến đi.'
    if (excursion && stop) { const issue = excursionIssue({ ...excursion, startTime, plannedReturnTime: endTime }, stop); if (issue) invalid.end = issue }
    if (location.trim().length > 250 || (excursion && !location.trim())) invalid.location = 'Điểm tập trung bắt buộc cho tham quan, tối đa 250 ký tự.'
    setErrors(invalid); setError('')
    if (Object.keys(invalid).length) return
    if(activity && activity.capacity==null){setError(businessCopy('program.activity.configurationRequired'));return}
    lock.current = true; setBusy(true); onBusy(true)
    try {
      if (activity) await programApi.updateActivity(activity.id, { activityName: activity.name, description: activity.description, cruiseId: activity.cruiseId, startTime, endTime, location: location.trim(), capacity: activity.capacity, deckId: activity.deckId, cabinId: activity.cabinId, price: activity.price, currencyCode: activity.currencyCode })
      else if (excursion) await programApi.updateExcursion(excursion, startTime, endTime, location.trim())
      onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa lưu được chương trình. Nội dung đã nhập được giữ lại.') }
    finally { lock.current = false; setBusy(false); onBusy(false) }
  }
  return <form onSubmit={submit} noValidate className={styles.editorForm}>
    <p>Giờ nhập: {activity ? 'Việt Nam' : `địa phương cảng (${zone})`}. Thao tác cập nhật hoạt động đã chọn, không tạo bản sao.</p>
    <Field htmlFor="program-start" label="Ngày và giờ bắt đầu *" error={errors.start}><input id="program-start" type="datetime-local" step="1" disabled={busy} value={start} onChange={event => setStart(event.target.value)} /></Field>
    <Field htmlFor="program-end" label="Ngày và giờ kết thúc *" error={errors.end}><input id="program-end" type="datetime-local" step="1" disabled={busy} value={end} onChange={event => setEnd(event.target.value)} /></Field>
    <Field htmlFor="program-location" label={activity ? 'Địa điểm tổ chức' : 'Điểm tập trung *'} error={errors.location}><input id="program-location" disabled={busy} value={location} maxLength={250} onChange={event => setLocation(event.target.value)} /></Field>
    {error && <Notice title="Chưa thể lưu" tone="error">{error}</Notice>}
    <div className={styles.editorActions}><Button disabled={busy} type="submit">{busy ? 'Đang lưu…' : 'Lưu chương trình'}</Button></div>
  </form>
}

export function JourneyProgram({ day, activities, excursions, services, stops, ports, cruise, editable, onSaved }: { day: ItineraryDay; activities: ProgramActivity[]; excursions: ProgramExcursion[]; services: ProgramService[]; stops: CruiseStop[]; ports: Port[]; cruise: { departureDatetime: string; returnDatetime: string }; editable: boolean; onSaved: () => void }) {
  const access = useSessionAccess()
  const [search, setSearch] = useState(''), [selected, setSelected] = useState(''), [editing, setEditing] = useState<{ activity?: ProgramActivity; excursion?: ProgramExcursion } | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedNotice, setSavedNotice] = useState('')
  const dayActivities = activities.filter(row => overlapsDay(row.startTime, row.endTime, day))
  const dayExcursions = excursions.filter(row => stops.some(stop => stop.cruiseStopId === row.cruiseStopId) && overlapsDay(row.startTime, row.plannedReturnTime, day))
  const selectedActivity = activities.find(row => row.id === selected)
  const editingStop = stops.find(stop => stop.cruiseStopId === editing?.excursion?.cruiseStopId)
  const editingZone = editing?.activity ? SHIP_TIME_ZONE : ports.find(port => port.portId === editingStop?.portId)?.timeZoneId
  return <div className={styles.programStack}>
    {savedNotice && <Notice title="Đã lưu chương trình" tone="success">{savedNotice}</Notice>}
    {access.canDo('ACTIVITY_READ') && <Panel title="Hoạt động trên tàu" subtitle="Lịch hoạt động theo giờ Việt Nam. Chọn hoạt động có sẵn của chuyến để chỉnh thời gian.">
      {editable && access.canDo('ACTIVITY_UPDATE') && <div className={styles.editorFields}>
        <Field htmlFor="program-search" label="Tìm hoạt động"><input id="program-search" type="search" value={search} onChange={event => setSearch(event.target.value)} /></Field>
        <Field htmlFor="program-picker" label="Hoạt động của chuyến"><select id="program-picker" value={selected} onChange={event => setSelected(event.target.value)}><option value="">Chọn hoạt động</option>{activities.filter(row => row.status === 'PLANNED' && (row.id === selected || row.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')))).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        <Button disabled={!selectedActivity} onClick={() => selectedActivity && setEditing({ activity: selectedActivity })}>Chỉnh lịch hoạt động</Button>
      </div>}
      {!dayActivities.length && <Empty title="Chưa có hoạt động trong ngày này" />}
      {dayActivities.map(row => <article className={styles.programCard} key={row.id}><div><strong>{row.name}</strong><p>{journeyTime(row.startTime)} → {journeyTime(row.endTime)}</p><span>{row.location || 'Chưa có địa điểm'}</span>{row.capacity==null&&<Notice title={businessCopy('program.activity.capacityUnknown')}>{businessCopy('program.activity.configurationRequired')}</Notice>}</div>{editable && row.status === 'PLANNED' && row.capacity!=null && access.canDo('ACTIVITY_UPDATE') && <Button tone="secondary" onClick={() => setEditing({ activity: row })}>Chỉnh sửa</Button>}</article>)}
      <p className={styles.muted}>Danh mục mẫu hoạt động dùng lại cho nhiều chuyến chưa được hỗ trợ. Danh sách trên là các hoạt động đã gắn với chuyến này.</p>
    </Panel>}
    {access.canDo('EXCURSION_READ') && <Panel title="Chuyến tham quan trên bờ" subtitle="Các chuyến tham quan đã liên kết với lần ghé cảng. Giờ hiển thị theo địa phương cảng.">
      {!dayExcursions.length && <Empty title="Chưa có chương trình tham quan trong ngày" />}
      {dayExcursions.map(row => { const stop = stops.find(item => item.cruiseStopId === row.cruiseStopId)!; const zone = ports.find(item => item.portId === stop.portId)?.timeZoneId; const issue = excursionIssue(row, stop)
        return <article className={styles.programCard} key={row.shoreExcursionId}><div><strong>{row.excursionName}</strong><p>{validTimeZone(zone) ? `${journeyTime(row.startTime, zone)} → ${journeyTime(row.plannedReturnTime, zone)} · ${zone}` : 'Cảng thiếu cấu hình múi giờ.'}</p>{issue && <Notice title="Cần điều chỉnh" tone="error">{issue}</Notice>}</div>{editable && ['DRAFT','OPEN'].includes(row.status) && access.canDo('EXCURSION_UPDATE') && <Button tone="secondary" disabled={!validTimeZone(zone)} onClick={() => setEditing({ excursion: row })}>Chỉnh sửa</Button>}<ButtonLink tone="secondary" to={`/admin/shore-excursions/${row.shoreExcursionId}`}>Chi tiết</ButtonLink></article>
      })}
    </Panel>}
    {access.canDo('SERVICE_READ') && <Panel title="Khung phục vụ" subtitle="Nhà hàng, spa và các dịch vụ của tàu.">
      <Notice title="Chưa hỗ trợ lưu khung phục vụ kế hoạch" tone="warning">Hệ thống hiện quản lý lịch đặt chỗ và sức chứa dịch vụ. Chưa thể lưu khung giờ phục vụ theo ngày hoặc áp dụng nhiều ngày trong lịch trình.</Notice>
      <Field htmlFor="service-reference" label="Danh mục dịch vụ hiện có — chỉ tra cứu"><select id="service-reference" defaultValue=""><option value="">Xem danh mục dịch vụ</option>{services.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
    </Panel>}
    {editing && validTimeZone(editingZone) && <Modal variant="drawer" busy={saving} title={editing.activity?.name ?? editing.excursion!.excursionName} onClose={() => setEditing(null)}><ProgramTimeEditor key={editing.activity?.id ?? editing.excursion?.shoreExcursionId} {...editing} onBusy={setSaving} stop={editingStop} zone={editingZone} cruise={cruise} onSaved={() => { setSavedNotice('Thay đổi đã được hệ thống xác nhận. Đang tải lại chương trình theo thời gian mới.'); setEditing(null); onSaved() }} /></Modal>}
  </div>
}
