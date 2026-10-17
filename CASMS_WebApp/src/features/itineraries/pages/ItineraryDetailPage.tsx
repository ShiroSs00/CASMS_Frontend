import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Badge, Button, ButtonLink, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'

import { itineraryApi, itineraryHistoryApi } from '../api/itinerary-api'
import { DayEditor } from '../components/DayEditor'
import { ItineraryFrame, ItineraryStatusBadge } from '../components/ItineraryUI'
import { StopEditor } from '../components/StopEditor'
import styles from '../components/Itineraries.module.css'
import { useItineraryEditor } from '../hooks/useItineraryEditor'
import type { ItineraryDay } from '../model/itinerary'

type Action = 'submit' | 'approve' | 'reject' | 'publish' | 'cancel' | 'applyChange' | 'validate' | 'remove'
const actionLabels: Record<Action, string> = { submit: 'Gửi duyệt', approve: 'Phê duyệt', reject: 'Từ chối', publish: 'Mở bán', cancel: 'Hủy lịch trình', applyChange: 'Ghi nhận thay đổi', validate: 'Kiểm tra lịch trình', remove: 'Xóa bản nháp' }

export function ItineraryDetailPage() {
  const { itineraryId = '' } = useParams()
  const navigate = useNavigate()
  const { data, busy, error, success, run } = useItineraryEditor(itineraryId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addingStop, setAddingStop] = useState(false)
  const [dayEditor, setDayEditor] = useState<{ day: ItineraryDay | null } | null>(null)
  const [deletion, setDeletion] = useState<{ kind: 'day' | 'stop'; id: string } | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [approverId, setApproverId] = useState('')
  const [reason, setReason] = useState('')
  if (!data) return <ItineraryFrame>{error ? <Notice title="Không tải được lịch trình" tone="error">{error}</Notice> : <Loading label="Đang tải trình biên tập…" />}</ItineraryFrame>

  const { itinerary, days, stops, ports, destinations } = data
  const orderedStops = [...stops].sort((a, b) => a.stopOrder - b.stopOrder)
  const selected = addingStop ? null : orderedStops.find((stop) => stop.cruiseStopId === selectedId) ?? orderedStops[0] ?? null
  const editable = ['DRAFT', 'PENDING_APPROVAL'].includes(itinerary.status)

  async function confirmAction() {
    if (!action) return
    const operation = async () => {
      if (action === 'validate') { await itineraryApi.validateStructure(itineraryId); await itineraryApi.validateSequence(itineraryId); await itineraryApi.validateFeasibility(itineraryId) }
      else if (action === 'approve') await itineraryApi.approve(itineraryId, approverId.trim())
      else if (action === 'reject') await itineraryApi.reject(itineraryId, approverId.trim(), reason.trim())
      else if (action === 'applyChange') await itineraryApi.applyChange(itineraryId, reason.trim())
      else if (action === 'remove') { await itineraryApi.removeDraft(itineraryId); navigate('/admin/itineraries') }
      else await itineraryApi[action](itineraryId)
    }
    if (await run(operation, action === 'applyChange' ? 'Đã ghi nhận mô tả thay đổi.' : `${actionLabels[action]} thành công.`, action !== 'remove')) { setAction(null); setReason('') }
  }

  return <ItineraryFrame>
    <PageHeader breadcrumb="" title="Itinerary editor" description={`${itinerary.itineraryName} · ${itinerary.startDate} → ${itinerary.endDate} · stop order, ETA/ETD, sea-day và timezone.`} actions={<><ItineraryStatusBadge status={itinerary.status} />{itinerary.status === 'DRAFT' && <ButtonLink to={`/admin/itineraries/${itineraryId}/edit`}>Sửa bản nháp</ButtonLink>}</>} />
    {error && <Notice title="Chưa thể thực hiện" tone="error">{error}</Notice>}
    {success && <Notice title="Đã cập nhật" tone="success">{success}</Notice>}
    <div className={styles.editorGrid}>
      <div>
        <div className={styles.stopList}>
          {!stops.length && <Empty title="Chưa có điểm dừng" />}
          {orderedStops.map((stop) => <button className={`${styles.stopCard} ${selected?.cruiseStopId === stop.cruiseStopId ? styles.selectedStop : ''}`} key={stop.cruiseStopId} onClick={() => { setSelectedId(stop.cruiseStopId); setAddingStop(false) }}><strong className={styles.stopNumber}>{String(stop.stopOrder).padStart(2, '0')}</strong><span className={styles.stopCopy}><strong>{stop.portName ?? stop.portId}</strong><span>{new Date(stop.plannedArrival).toLocaleString('vi-VN')}</span></span><Badge label={stop.callType} tone={stop.callType === 'OVERNIGHT' ? 'info' : 'neutral'} /></button>)}
        </div>
        {editable && <div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => setAddingStop(true)}>Thêm điểm dừng</Button><Button tone="secondary" disabled={busy} onClick={() => setDayEditor({ day: null })}>Thêm ngày</Button></div>}
        <Panel title={`Ngày trong hành trình · ${days.length}`}>
          {!days.length && <Empty title="Thêm ngày trước khi cấu hình điểm dừng" />}
          {days.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <Button
                tone="secondary"
                disabled={busy}
                onClick={() => void run(() => itineraryApi.validateDaySequence(itineraryId), 'Backend xác nhận thứ tự ngày trong hành trình hợp lệ.')}
              >
                Kiểm tra thứ tự ngày
              </Button>
            </div>
          )}
          {days.map((day) => <div className={styles.dayHeading} key={day.itineraryDayId}><div><strong>Ngày {day.dayNumber} · {day.date}</strong><div className={styles.muted}>{day.dayType} · {day.shipTimeZoneId ?? 'Chưa đặt múi giờ'}</div></div>{editable && <div className={styles.inlineActions}><Button tone="text" disabled={busy} onClick={() => void run(() => itineraryApi.validateDay(day.itineraryDayId), `Backend xác nhận ngày ${day.dayNumber} hợp lệ.`)}>Validate</Button><Button tone="text" disabled={busy} onClick={() => setDayEditor({ day })}>Sửa</Button><Button tone="text" disabled={busy} onClick={() => setDeletion({ kind: 'day', id: day.itineraryDayId })}>Xóa</Button></div>}</div>)}
        </Panel>
      </div>
      <aside>
        {(selected || addingStop) && <StopEditor key={selected?.cruiseStopId ?? 'new'} itineraryId={itineraryId} stop={selected} days={days} ports={ports} destinations={destinations} busy={busy} editable={editable} onSave={(draft) => { void run(() => selected ? itineraryApi.updateStop(selected.cruiseStopId, draft) : itineraryApi.createStop(draft), 'Đã lưu điểm dừng.').then((ok) => { if (ok) setAddingStop(false) }) }} onValidate={() => { if (selected) void run(() => itineraryApi.validateStop(selected.cruiseStopId), 'Điểm dừng hợp lệ.') }} onRemove={() => { if (selected) setDeletion({ kind: 'stop', id: selected.cruiseStopId }) }} />}
        <Panel title="Quy trình phê duyệt"><div className={styles.stopForm}>
          <Button tone="secondary" disabled={busy} onClick={() => setAction('validate')}>Kiểm tra lịch trình</Button>
          {itinerary.status === 'DRAFT' && <Button disabled={busy} onClick={() => setAction('submit')}>Gửi duyệt</Button>}
          {itinerary.status === 'PENDING_APPROVAL' && <><Button disabled={busy} onClick={() => setAction('approve')}>Phê duyệt</Button><Button tone="danger" disabled={busy} onClick={() => setAction('reject')}>Từ chối</Button></>}
          {itinerary.status === 'APPROVED' && <Button disabled={busy} onClick={() => setAction('publish')}>Mở bán</Button>}
          {['APPROVED', 'OPEN_FOR_SALE', 'ACTIVE'].includes(itinerary.status) && <Button tone="secondary" disabled={busy} onClick={() => setAction('applyChange')}>Ghi nhận thay đổi</Button>}
          {!['COMPLETED', 'CANCELLED'].includes(itinerary.status) && <Button tone="danger" disabled={busy} onClick={() => setAction('cancel')}>Hủy lịch trình</Button>}
          {itinerary.status === 'DRAFT' && <Button tone="danger" disabled={busy || days.length > 0} onClick={() => setAction('remove')}>Xóa bản nháp</Button>}
        </div></Panel>
        <Panel title="Lịch sử trạng thái"><ItineraryStatusBadge status={itinerary.status} />{itineraryHistoryApi.availability === 'pending' && <p className={styles.muted}>Lịch sử thay đổi chưa khả dụng. Trạng thái hiện tại đã được cập nhật từ hệ thống.</p>}</Panel>
      </aside>
    </div>
    {dayEditor && <Modal title={dayEditor.day ? 'Chỉnh sửa ngày' : 'Thêm ngày'} busy={busy} onClose={() => setDayEditor(null)}><DayEditor itineraryId={itineraryId} day={dayEditor.day} busy={busy} onSave={(draft) => { void run(() => dayEditor.day ? itineraryApi.updateDay(dayEditor.day.itineraryDayId, draft) : itineraryApi.createDay(draft), 'Đã lưu ngày hành trình.').then((ok) => { if (ok) setDayEditor(null) }) }} /></Modal>}
    {deletion && <Modal title="Xác nhận xóa" busy={busy} onClose={() => setDeletion(null)}><p>Chỉ có thể xóa bản ghi chưa được sử dụng và đáp ứng trạng thái cho phép.</p>{error && <Notice title="Không thể xóa" tone="error">{error}</Notice>}<div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => setDeletion(null)}>Quay lại</Button><Button tone="danger" disabled={busy} onClick={() => { void run(() => deletion.kind === 'day' ? itineraryApi.removeDay(deletion.id) : itineraryApi.removeStop(deletion.id), 'Đã xóa bản ghi.').then((ok) => { if (ok) setDeletion(null) }) }}>Xác nhận xóa</Button></div></Modal>}
    {action && <Modal title={actionLabels[action]} busy={busy} onClose={() => setAction(null)}><p>{itinerary.itineraryName}</p>{['approve', 'reject'].includes(action) && <Field htmlFor="approver-id" label="ID người phê duyệt"><input id="approver-id" value={approverId} onChange={(event) => setApproverId(event.target.value)} /></Field>}{['reject', 'applyChange'].includes(action) && <Field htmlFor="action-reason" label={action === 'reject' ? 'Lý do từ chối' : 'Mô tả thay đổi'}><textarea id="action-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></Field>}{action === 'applyChange' && <p className={styles.muted}>Thao tác này ghi nhận mô tả thay đổi, không thay thế dữ liệu lịch trình.</p>}{error && <Notice title="Chưa thể thực hiện" tone="error">{error}</Notice>}<div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => setAction(null)}>Quay lại</Button><Button disabled={busy || (['approve', 'reject'].includes(action) && !approverId.trim()) || (['reject', 'applyChange'].includes(action) && !reason.trim())} onClick={() => void confirmAction()}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</Button></div></Modal>}
  </ItineraryFrame>
}
