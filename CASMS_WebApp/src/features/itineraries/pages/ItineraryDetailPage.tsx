import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { ApiError } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'

import { itineraryApi, itineraryHistoryApi, type ItineraryHistoryEntry } from '../api/itinerary-api'
import { DayEditor } from '../components/DayEditor'
import { ItineraryFrame, ItineraryStatusBadge } from '../components/ItineraryUI'
import { StopEditor } from '../components/StopEditor'
import { StopOperations } from '../components/StopOperations'
import { DayOperations } from '../components/DayOperations'
import { DayRegistry } from '../components/DayRegistry'
import styles from '../components/Itineraries.module.css'
import { useItineraryEditor } from '../hooks/useItineraryEditor'
import type { CruiseStop, Itinerary, ItineraryDay } from '../model/itinerary'

type Action = 'submit' | 'approve' | 'reject' | 'publish' | 'cancel' | 'applyChange' | 'validate' | 'remove'
const actionLabels: Record<Action, string> = { submit: 'Gửi duyệt', approve: 'Phê duyệt', reject: 'Từ chối', publish: 'Mở bán', cancel: 'Hủy lịch trình', applyChange: 'Ghi nhận thay đổi', validate: 'Kiểm tra lịch trình', remove: 'Xóa bản nháp' }
const actionPermissions: Record<Action, string> = { submit: 'ITINERARY_SUBMIT', approve: 'ITINERARY_APPROVE', reject: 'ITINERARY_REJECT', publish: 'ITINERARY_PUBLISH', cancel: 'ITINERARY_CANCEL', applyChange: 'ITINERARY_APPLY_CHANGE', validate: 'ITINERARY_VALIDATE', remove: 'ITINERARY_DELETE_DRAFT' }
const callTypeLabels: Record<CruiseStop['callType'], string> = { NORMAL: 'Thông thường', LATE_NIGHT: 'Đến khuya', OVERNIGHT: 'Qua đêm' }
const dayTypeLabels: Record<ItineraryDay['dayType'], string> = { SEA_DAY: 'Ngày trên biển', PORT_DAY: 'Ngày ghé cảng' }

const historyTypeLabels: Record<NonNullable<ItineraryHistoryEntry['changeType']>, string> = {
  TIME_CHANGE: 'Thay đổi thời gian', PORT_OMITTED: 'Bỏ cảng', PORT_SUBSTITUTED: 'Thay thế cảng',
  STOP_REORDERED: 'Sắp xếp lại điểm dừng', EXCURSION_IMPACT: 'Ảnh hưởng chuyến tham quan', OTHER: 'Khác',
}

function historyTime(value: string | null) {
  if (!value) return 'Chưa có thời gian'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Thời gian không hợp lệ' : date.toLocaleString('vi-VN')
}

type HistoryResult = { entries: ItineraryHistoryEntry[]; error?: never; forbidden?: never }
  | { entries?: never; error: string; forbidden: boolean }

function HistoryContent({ result, onRetry }: { result: HistoryResult | null; onRetry: () => void }) {
  if (!result) return <Loading label="Đang tải lịch sử thay đổi…" />
  if (result.error !== undefined) return <>
    <Notice tone="error" title={result.forbidden ? 'Không có quyền xem lịch sử' : 'Không tải được lịch sử thay đổi'}>{result.error}</Notice>
    <Button tone="secondary" onClick={onRetry}>Thử lại</Button>
  </>
  if (!result.entries.length) return <Empty title="Chưa có lịch sử thay đổi" />
  return <ol className={styles.timeline} aria-label="Lịch sử thay đổi lịch trình" style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
    {result.entries.map((entry) => <li key={entry.changeHistoryId}>
      <strong>{entry.changeSummary?.trim() || 'Chưa có mô tả thay đổi'}</strong>
      <div>Loại thay đổi: {entry.changeType ? historyTypeLabels[entry.changeType] : 'Chưa có loại thay đổi'}</div>
      <div>Lý do: {entry.reason?.trim() || 'Chưa có lý do'}</div>
      <div>Thời gian: {historyTime(entry.changedAt)}</div>
      <div>ID người thay đổi: {entry.changedByUserId?.trim() || 'Chưa có ID người thay đổi'}</div>
    </li>)}
  </ol>
}

function ItineraryHistory({ itinerary }: { itinerary: Itinerary }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<(HistoryResult & { itinerary: Itinerary; attempt: number }) | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void itineraryHistoryApi.list(itinerary.itineraryId, controller.signal).then((entries) => {
      if (!controller.signal.aborted) setResult({ itinerary, attempt, entries })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ itinerary, attempt,
        error: error instanceof Error ? error.message : 'Không tải được lịch sử thay đổi.',
        forbidden: error instanceof ApiError && error.status === 403,
      })
    })
    return () => controller.abort()
  }, [itinerary, attempt])

  return <HistoryContent result={result?.itinerary === itinerary && result.attempt === attempt ? result : null} onRetry={() => setAttempt((value) => value + 1)} />
}

export function ItineraryDetailPage() {
  const access = useSessionAccess()
  const { itineraryId = '' } = useParams()
  const navigate = useNavigate()
  const { data, busy, error, success, run, retry } = useItineraryEditor(itineraryId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addingStop, setAddingStop] = useState(false)
  const [dayEditor, setDayEditor] = useState<{ day: ItineraryDay | null } | null>(null)
  const [deletion, setDeletion] = useState<{ kind: 'day' | 'stop'; id: string } | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [reason, setReason] = useState('')
  if (!data) return <ItineraryFrame>{error ? <Notice title="Không tải được lịch trình" tone="error">{error}<Button onClick={() => void retry()}>Thử lại</Button></Notice> : <Loading label="Đang tải trình biên tập…" />}</ItineraryFrame>

  const { itinerary, days, stops, ports, destinations } = data
  const orderedStops = [...stops].sort((a, b) => a.stopOrder - b.stopOrder)
  const selected = addingStop ? null : orderedStops.find((stop) => stop.cruiseStopId === selectedId) ?? orderedStops[0] ?? null
  const editable = ['DRAFT', 'PENDING_APPROVAL'].includes(itinerary.status) && !data.supplementaryLoading && !Object.keys(data.supplementaryErrors).length

  async function confirmAction() {
    if (!action || !access.has(actionPermissions[action])) return
    const operation = async () => {
      if (action === 'validate') { await itineraryApi.validateStructure(itineraryId); await itineraryApi.validateSequence(itineraryId); await itineraryApi.validateFeasibility(itineraryId) }
      else if (action === 'approve') await itineraryApi.approve(itineraryId)
      else if (action === 'reject') await itineraryApi.reject(itineraryId, reason.trim())
      else if (action === 'applyChange') await itineraryApi.applyChange(itineraryId, reason.trim())
      else if (action === 'remove') { await itineraryApi.removeDraft(itineraryId); navigate('/admin/itineraries') }
      else await itineraryApi[action](itineraryId)
    }
    if (await run(operation, action === 'applyChange' ? 'Đã ghi nhận mô tả thay đổi.' : `${actionLabels[action]} thành công.`, action !== 'remove')) { setAction(null); setReason('') }
  }

  return <ItineraryFrame>
    <PageHeader breadcrumb="" title="Biên tập lịch trình" description={`${itinerary.itineraryName} · ${itinerary.startDate} → ${itinerary.endDate} · thứ tự điểm dừng, giờ đến/đi dự kiến, ngày trên biển và múi giờ.`} actions={<><ItineraryStatusBadge status={itinerary.status} />{itinerary.status === 'DRAFT' && access.has('ITINERARY_UPDATE_DRAFT') && <ButtonLink to={`/admin/itineraries/${itineraryId}/edit`}>Sửa bản nháp</ButtonLink>}</>} />
    {error && <Notice title="Chưa thể thực hiện" tone="error">{error}</Notice>}
    {success && <Notice title="Đã cập nhật" tone="success">{success}</Notice>}
    {access.status === 'error' && <Notice title="Chưa tải được quyền thao tác" tone="error">{access.error}</Notice>}
    <div className={styles.actions}><ButtonLink tone="secondary" to={`/admin/cruises/${itinerary.cruiseId}`}>Xem chuyến du lịch</ButtonLink><ButtonLink tone="secondary" to="/admin/itineraries">Danh sách hải trình</ButtonLink><ButtonLink tone="secondary" to={`/admin/itinerary-history?itineraryId=${itineraryId}`}>Nhật ký điều chỉnh</ButtonLink></div>
    {data.supplementaryLoading && <Loading label="Đang tải ngày, điểm dừng và danh mục cảng…" />}
    {Object.entries(data.supplementaryErrors).map(([key, message]) => <Notice key={key} title={`Không tải được ${{ days: 'ngày hành trình', stops: 'điểm dừng', ports: 'cảng', destinations: 'điểm đến' }[key] ?? 'dữ liệu liên quan'}`} tone="error"><p>{message}</p><Button onClick={() => void retry()}>Thử lại</Button></Notice>)}
    <div className={styles.editorGrid}>
      <div>
        <div className={styles.stopList}>
          {!data.supplementaryLoading && !data.supplementaryErrors.stops && !stops.length && <Empty title="Chưa có điểm dừng" />}
          {orderedStops.map((stop) => <button className={`${styles.stopCard} ${selected?.cruiseStopId === stop.cruiseStopId ? styles.selectedStop : ''}`} key={stop.cruiseStopId} onClick={() => { setSelectedId(stop.cruiseStopId); setAddingStop(false) }}><strong className={styles.stopNumber}>{String(stop.stopOrder).padStart(2, '0')}</strong><span className={styles.stopCopy}><strong>{stop.portName ?? stop.portId}</strong><span>{new Date(stop.plannedArrival).toLocaleString('vi-VN')}</span></span><Badge label={callTypeLabels[stop.callType]} tone={stop.callType === 'OVERNIGHT' ? 'info' : 'neutral'} /></button>)}
        </div>
        {editable && <div className={styles.actions}><Button tone="secondary" disabled={busy || !access.has('CRUISE_STOP_ADD')} onClick={() => setAddingStop(true)}>Thêm điểm dừng</Button><Button tone="secondary" disabled={busy || !access.has('ITINERARY_DAY_CREATE')} onClick={() => setDayEditor({ day: null })}>Thêm ngày</Button></div>}
        <Panel title={`Ngày trong hành trình${data.supplementaryLoading || data.supplementaryErrors.days ? '' : ` · ${days.length}`}`}>
          <DayRegistry key={itineraryId} itineraryId={itineraryId} />
          {!data.supplementaryLoading && !data.supplementaryErrors.days && !days.length && <Empty title="Thêm ngày trước khi cấu hình điểm dừng" />}
          {days.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <Button
                tone="secondary"
                disabled={busy || !access.has('ITINERARY_DAY_READ')}
                onClick={() => void run(() => itineraryApi.validateDaySequence(itineraryId), 'Hệ thống xác nhận thứ tự ngày trong hành trình hợp lệ.')}
              >
                Kiểm tra thứ tự ngày
              </Button>
            </div>
          )}
          {days.map((day) => <div key={day.itineraryDayId}><div className={styles.dayHeading}><div><strong>Ngày {day.dayNumber} · {day.date}</strong><div className={styles.muted}>{dayTypeLabels[day.dayType]} · {day.shipTimeZoneId ?? 'Chưa đặt múi giờ'}</div></div>{editable && <div className={styles.inlineActions}><Button tone="text" disabled={busy || !access.has('ITINERARY_DAY_READ')} onClick={() => void run(() => itineraryApi.validateDay(day.itineraryDayId), `Ngày ${day.dayNumber} hợp lệ.`)}>Kiểm tra</Button><Button tone="text" disabled={busy || !access.has('ITINERARY_DAY_UPDATE')} onClick={() => setDayEditor({ day })}>Sửa</Button><Button tone="text" disabled={busy || !access.has('ITINERARY_DAY_DELETE')} onClick={() => setDeletion({ kind: 'day', id: day.itineraryDayId })}>Xóa</Button></div>}</div><DayOperations key={`${day.itineraryDayId}:${day.dayType}:${day.shipTimeZoneId}`} day={day} editable={editable} onChanged={() => void retry()} /></div>)}
        </Panel>
      </div>
      <aside>
        {(selected || addingStop) && <StopEditor key={selected?.cruiseStopId ?? 'new'} itineraryId={itineraryId} stop={selected} days={days} ports={ports} destinations={destinations} busy={busy} editable={editable && access.has(selected ? 'CRUISE_STOP_UPDATE' : 'CRUISE_STOP_ADD')} onSave={(draft) => { if (!access.has(selected ? 'CRUISE_STOP_UPDATE' : 'CRUISE_STOP_ADD')) return; void run(() => selected ? itineraryApi.updateStop(selected.cruiseStopId, draft) : itineraryApi.createStop(draft), 'Đã lưu điểm dừng.').then((ok) => { if (ok) setAddingStop(false) }) }} onValidate={() => { if (selected && access.has('CRUISE_STOP_VALIDATE')) void run(() => itineraryApi.validateStop(selected.cruiseStopId), 'Điểm dừng hợp lệ.') }} onRemove={() => { if (selected && access.has('CRUISE_STOP_REMOVE_DRAFT')) setDeletion({ kind: 'stop', id: selected.cruiseStopId }) }} />}
        {selected && <StopOperations key={selected.cruiseStopId} stop={selected} stops={stops} itineraryStatus={itinerary.status} onChanged={() => void retry()} />}
        <Panel title="Quy trình phê duyệt"><div className={styles.stopForm}>
          <Button tone="secondary" disabled={busy || !access.has(actionPermissions.validate)} onClick={() => setAction('validate')}>Kiểm tra lịch trình</Button>
          {itinerary.status === 'DRAFT' && <Button disabled={busy || !access.has(actionPermissions.submit)} onClick={() => setAction('submit')}>Gửi duyệt</Button>}
          {itinerary.status === 'PENDING_APPROVAL' && <><Button disabled={busy || !access.has(actionPermissions.approve)} onClick={() => setAction('approve')}>Phê duyệt</Button><Button tone="danger" disabled={busy || !access.has(actionPermissions.reject)} onClick={() => setAction('reject')}>Từ chối</Button></>}
          {itinerary.status === 'APPROVED' && <Button disabled={busy || !access.has(actionPermissions.publish)} onClick={() => setAction('publish')}>Mở bán</Button>}
          {['APPROVED', 'OPEN_FOR_SALE', 'ACTIVE'].includes(itinerary.status) && <Button tone="secondary" disabled={busy || !access.has(actionPermissions.applyChange)} onClick={() => setAction('applyChange')}>Ghi nhận thay đổi</Button>}
          {!['COMPLETED', 'CANCELLED'].includes(itinerary.status) && <Button tone="danger" disabled={busy || !access.has(actionPermissions.cancel)} onClick={() => setAction('cancel')}>Hủy lịch trình</Button>}
          {itinerary.status === 'DRAFT' && <Button tone="danger" disabled={busy || !access.has(actionPermissions.remove) || data.supplementaryLoading || Boolean(data.supplementaryErrors.days) || days.length > 0} onClick={() => setAction('remove')}>Xóa bản nháp</Button>}
        </div></Panel>
        <Panel title="Lịch sử thay đổi"><ItineraryStatusBadge status={itinerary.status} /><ItineraryHistory key={itineraryId} itinerary={itinerary} /></Panel>
      </aside>
    </div>
    {dayEditor && <Modal title={dayEditor.day ? 'Chỉnh sửa ngày' : 'Thêm ngày'} busy={busy} onClose={() => setDayEditor(null)}><DayEditor itineraryId={itineraryId} itinerary={itinerary} days={days} day={dayEditor.day} busy={busy} onSave={(draft) => { if (!access.has(dayEditor.day ? 'ITINERARY_DAY_UPDATE' : 'ITINERARY_DAY_CREATE')) return; void run(() => dayEditor.day ? itineraryApi.updateDay(dayEditor.day.itineraryDayId, draft) : itineraryApi.createDay(draft), 'Đã lưu ngày hành trình.').then((ok) => { if (ok) setDayEditor(null) }) }} /></Modal>}
    {deletion && <Modal title="Xác nhận xóa" busy={busy} onClose={() => setDeletion(null)}><p>Chỉ có thể xóa bản ghi chưa được sử dụng và đáp ứng trạng thái cho phép.</p>{error && <Notice title="Không thể xóa" tone="error">{error}</Notice>}<div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => setDeletion(null)}>Quay lại</Button><Button tone="danger" disabled={busy} onClick={() => { if (!access.has(deletion.kind === 'day' ? 'ITINERARY_DAY_DELETE' : 'CRUISE_STOP_REMOVE_DRAFT')) return; void run(() => deletion.kind === 'day' ? itineraryApi.removeDay(deletion.id) : itineraryApi.removeStop(deletion.id), 'Đã xóa bản ghi.').then((ok) => { if (ok) setDeletion(null) }) }}>Xác nhận xóa</Button></div></Modal>}
    {action && <Modal title={actionLabels[action]} busy={busy} onClose={() => setAction(null)}><p>{itinerary.itineraryName}</p>{['reject', 'applyChange'].includes(action) && <Field htmlFor="action-reason" label={action === 'reject' ? 'Lý do từ chối' : 'Mô tả thay đổi'}><textarea id="action-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></Field>}{action === 'applyChange' && <p className={styles.muted}>Thao tác này ghi nhận mô tả thay đổi, không thay thế dữ liệu lịch trình.</p>}{error && <Notice title="Chưa thể thực hiện" tone="error">{error}</Notice>}<div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => setAction(null)}>Quay lại</Button><Button disabled={busy || (['reject', 'applyChange'].includes(action) && !reason.trim())} onClick={() => void confirmAction()}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</Button></div></Modal>}
  </ItineraryFrame>
}
