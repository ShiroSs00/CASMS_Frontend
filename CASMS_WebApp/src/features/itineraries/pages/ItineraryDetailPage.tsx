import { TechnicalDetails } from '@/shared/ui'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { ApiError } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, Empty, Field, JourneySteps, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'

import { itineraryApi, itineraryHistoryApi, type ItineraryHistoryEntry } from '../api/itinerary-api'
import { DayEditor } from '../components/DayEditor'
import { ItineraryFrame, ItineraryStatusBadge } from '../components/ItineraryUI'
import { StopOperations } from '../components/StopOperations'
import { StopEditor } from '../components/StopEditor'
import { JourneyProgram } from '../components/JourneyProgram'
import { useJourneyProgram } from '../hooks/useJourneyProgram'
import { journeyTime, validTimeZone, addCalendarDays } from '@/shared/lib/journey-time'
import { overlapsDay, reviewJourney, stopsForDay } from '../model/journey-review'
import styles from '../components/Itineraries.module.css'
import { useItineraryEditor } from '../hooks/useItineraryEditor'
import type { CruiseStop, Itinerary, ItineraryDay } from '../model/itinerary'

type Action = 'submit' | 'approve' | 'reject' | 'publish' | 'cancel' | 'applyChange' | 'validate' | 'remove'
const actionLabels: Record<Action, string> = { submit: 'Gửi duyệt', approve: 'Phê duyệt', reject: 'Từ chối', publish: 'Phát hành lịch trình', cancel: 'Hủy lịch trình', applyChange: 'Ghi nhận thay đổi', validate: 'Kiểm tra lịch trình', remove: 'Xóa bản nháp' }
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
  return Number.isNaN(date.getTime()) ? 'Thời gian không hợp lệ' : journeyTime(value)
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
      <TechnicalDetails entries={[["Người thay đổi", entry.changedByUserId]]} />
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
  const access = useSessionAccess(), navigate = useNavigate()
  const { itineraryId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const step = params.get('step') === '2' ? 2 : params.get('step') === '3' ? 3 : 1
  const { data, busy, error, success, stale, run, retry } = useItineraryEditor(itineraryId)
  const program = useJourneyProgram(data?.itinerary.cruiseId ?? '')
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [stopEditor, setStopEditor] = useState<{ stop: CruiseStop | null } | null>(null)
  const [dayEditor, setDayEditor] = useState<{ day: ItineraryDay | null } | null>(null)
  const [deletion, setDeletion] = useState<{ kind: 'day' | 'stop'; id: string } | null>(null)
  const [action, setAction] = useState<Action | null>(null), [reason, setReason] = useState('')
  if (!data) return <ItineraryFrame>{error ? <Notice title="Không tải được lịch trình" tone="error">{error}<Button onClick={() => void retry()}>Thử lại</Button></Notice> : <Loading label="Đang tải lịch trình…" />}</ItineraryFrame>
  const { itinerary, cruise, days, stops, ports, destinations } = data
  const orderedDays = [...days].sort((a,b) => a.dayNumber - b.dayNumber)
  const selectedDay = orderedDays.find(day => day.itineraryDayId === selectedDayId) ?? orderedDays[0]
  const maxDays = cruise?.cruiseType === 'ONE_DAY' ? 2 : 5, minDays = cruise?.cruiseType === 'ONE_DAY' ? 1 : 3
  const editable = access.canDo('ITINERARY_UPDATE_DRAFT') && !stale && ['DRAFT','PENDING_APPROVAL'].includes(itinerary.status) && Boolean(cruise) && !data.supplementaryLoading && !Object.keys(data.supplementaryErrors).length
  const activities = program.data?.activities ?? [], excursions = program.data?.excursions ?? []
  const completeProgram = Boolean(program.data?.impactKnown)
  const issues = reviewJourney(days, stops, ports, activities, excursions, minDays, maxDays)
  const selectedStops = selectedDay ? stopsForDay(stops, selectedDay).sort((a,b) => a.stopOrder - b.stopOrder) : []
  const pendingDays = Array.from({ length: Math.max(0,minDays - days.length) }, (_, offset) => ({ number: days.length + offset + 1, date: addCalendarDays(itinerary.startDate, days.length + offset) }))
  const nextDate = addCalendarDays(itinerary.startDate, Math.max(0,...days.map(day => day.dayNumber)))
  const canAddDay = editable && days.length < maxDays && nextDate <= itinerary.endDate && access.canDo('ITINERARY_DAY_CREATE')
  const removeDay = deletion?.kind === 'day' ? days.find(day => day.itineraryDayId === deletion.id) : undefined
  const affectedStops = removeDay ? stops.filter(stop => stop.arrivalItineraryDayId === removeDay.itineraryDayId || stop.departureItineraryDayId === removeDay.itineraryDayId || overlapsDay(stop.plannedArrival,stop.plannedDeparture,removeDay)) : []
  const affectedActivities = removeDay ? activities.filter(item => overlapsDay(item.startTime,item.endTime,removeDay)) : []
  const affectedExcursions = excursions.filter(item => removeDay ? affectedStops.some(stop => stop.cruiseStopId === item.cruiseStopId) || overlapsDay(item.startTime,item.plannedReturnTime,removeDay) : item.cruiseStopId === deletion?.id)
  const deletionBlocked = !completeProgram || !editable || (removeDay ? affectedStops.length > 0 || affectedActivities.length > 0 || affectedExcursions.length > 0 || removeDay.dayNumber !== Math.max(...days.map(day => day.dayNumber)) : affectedExcursions.length > 0)
  function changeStep(value: number) { setParams({ step: String(value) }) }
  const actionAllowed = (value: Action) => {
    if (!access.canDo(actionPermissions[value])) return false
    if (value === 'approve' && (!itinerary.createdByUserId || itinerary.createdByUserId === access.userId)) return false
    const states: Partial<Record<Action, readonly string[]>> = {
      submit: ['DRAFT'], approve: ['PENDING_APPROVAL'], reject: ['PENDING_APPROVAL'],
      publish: ['APPROVED'], applyChange: ['APPROVED','OPEN_FOR_SALE','ACTIVE'], remove: ['DRAFT'],
    }
    return states[value] ? states[value]!.includes(itinerary.status) : !['COMPLETED','CANCELLED'].includes(itinerary.status)
  }
  async function confirmAction() {
    if (!action || !actionAllowed(action)) return
    if (['submit','approve','publish'].includes(action) && (stale || issues.length || data?.supplementaryLoading || Object.keys(data?.supplementaryErrors ?? {}).length)) return
    const operation = async () => {
      if (action === 'validate') { await itineraryApi.validateStructure(itineraryId); await itineraryApi.validateSequence(itineraryId); await itineraryApi.validateFeasibility(itineraryId) }
      else if (action === 'approve') await itineraryApi.approve(itineraryId)
      else if (action === 'reject') await itineraryApi.reject(itineraryId, reason.trim())
      else if (action === 'applyChange') await itineraryApi.applyChange(itineraryId, reason.trim())
      else if (action === 'remove') { await itineraryApi.removeDraft(itineraryId); navigate('/admin/itineraries') }
      else await itineraryApi[action](itineraryId)
    }
    if (await run(operation, `${actionLabels[action]} đã được hệ thống xác nhận.`, action !== 'remove')) { setAction(null); setReason('') }
  }
  return <ItineraryFrame>
    <PageHeader breadcrumb="LẬP CHUYẾN ĐI / LỊCH TRÌNH" title={itinerary.itineraryName} description={`${itinerary.startDate} → ${itinerary.endDate} · Giờ trên tàu: Việt Nam`} actions={<><ItineraryStatusBadge status={itinerary.status} /><ButtonLink tone="secondary" to={`/admin/cruises/${itinerary.cruiseId}`}>Xem chuyến đi</ButtonLink></>} />
    <JourneySteps current={step} cruiseId={access.canDo('CRUISE_UPDATE_DRAFT') ? itinerary.cruiseId : undefined} itineraryId={itineraryId} onStep={changeStep} />
    {error && <Notice title="Chưa thể hoàn tất" tone="error"><p>{error}</p><Button tone="secondary" onClick={() => void retry()}>Tải lại dữ liệu</Button></Notice>}
    {success && <Notice title="Đã lưu" tone="success">{success}</Notice>}
    {data.supplementaryLoading && <Loading label="Đang tải ngày và cảng ghé…" />}
    {Object.entries(data.supplementaryErrors).map(([key,message]) => <Notice key={key} title="Chưa tải đủ dữ liệu lịch trình" tone="error"><p>{message}</p><Button onClick={() => void retry()}>Thử lại</Button></Notice>)}
    {!program.data ? <Loading label="Đang đọc chương trình để kiểm tra liên kết…" /> : program.data.errors.length > 0 && <Notice title="Chương trình chưa được kiểm tra đầy đủ" tone="warning"><ul>{program.data.errors.map(message => <li key={message}>{message}</li>)}</ul><Button tone="secondary" onClick={program.retry}>Tải lại chương trình</Button></Notice>}
    {step !== 3 ? <div className={styles.journeyGrid}>
      <aside className={styles.daysSidebar} aria-label="Danh sách ngày">
        <h2>Ngày trong lịch trình</h2><p>{days.length}/{maxDays} ngày đã lưu</p>
        <div className={styles.dayChoices}>{orderedDays.map(day => <button type="button" key={day.itineraryDayId} className={`${styles.dayChoice} ${selectedDay?.itineraryDayId === day.itineraryDayId ? styles.daySelected : ''}`} aria-pressed={selectedDay?.itineraryDayId === day.itineraryDayId} onClick={() => setSelectedDayId(day.itineraryDayId)}><strong>Ngày {day.dayNumber}</strong><span>{day.date}</span><span>{dayTypeLabels[day.dayType] ?? 'Chưa xác định'}</span>{issues.some(issue => issue.dayId === day.itineraryDayId) && <span className={styles.incomplete}>Cần bổ sung</span>}</button>)}
        {pendingDays.map(day => <div className={styles.pendingDay} key={day.date}><strong>Ngày {day.number}</strong><span>Chưa xác định · chưa lưu</span>{day.number === days.length + 1 && <Button tone="secondary" disabled={!canAddDay || busy} onClick={() => setDayEditor({ day: null })}>Chọn loại ngày</Button>}</div>)}
        </div><Button tone="secondary" disabled={!canAddDay || busy} onClick={() => setDayEditor({ day: null })}>Thêm ngày</Button>
        {!canAddDay && <p className={styles.muted}>{!editable ? 'Lịch trình chưa đủ dữ liệu hoặc không ở trạng thái cho phép sửa.' : !access.canDo('ITINERARY_DAY_CREATE') ? 'Tài khoản chưa có quyền thêm ngày.' : days.length >= maxDays ? `Đã đạt giới hạn ${maxDays} ngày.` : 'Đã đến ngày kết thúc. Điều chỉnh khoảng ngày trước khi thêm.'}</p>}
        {itinerary.status === 'DRAFT' && access.canDo('ITINERARY_UPDATE_DRAFT') && <ButtonLink tone="secondary" to={`/admin/itineraries/${itineraryId}/edit`}>Thông tin lịch trình</ButtonLink>}
      </aside>
      <section className={styles.dayContent} aria-label="Nội dung ngày">
        {selectedDay ? <>
          <div className={styles.dayToolbar}><div><h2>Ngày {selectedDay.dayNumber} · {dayTypeLabels[selectedDay.dayType]}</h2><p>{selectedDay.date} · {selectedDay.description || 'Chưa có giới thiệu ngày'}</p></div><div className={styles.editorTools}>
            {editable && access.canDo('ITINERARY_DAY_UPDATE') && <Button tone="secondary" disabled={busy} onClick={() => setDayEditor({ day: selectedDay })}>Chỉnh ngày</Button>}
            {editable && access.canDo('ITINERARY_DAY_DELETE') && <Button tone="danger" disabled={busy} onClick={() => setDeletion({ kind: 'day', id: selectedDay.itineraryDayId })}>Xóa ngày</Button>}
          </div></div>
          <Panel title="Lần ghé cảng" subtitle="Cùng một lần ghé qua đêm xuất hiện ở các ngày liên quan; chỉ lưu một bản ghi.">
            {!selectedStops.length && <Empty title={selectedDay.dayType === 'PORT_DAY' ? 'Ngày ghé cảng chưa hoàn thiện' : 'Ngày trên biển'}>{selectedDay.dayType === 'PORT_DAY' ? 'Thêm cảng ngay tại đây hoặc bổ sung sau.' : 'Bạn có thể lập chương trình trên tàu cho ngày này.'}</Empty>}
            {selectedStops.map(stop => { const port = ports.find(item => item.portId === stop.portId); return <article className={styles.programCard} key={stop.cruiseStopId}><div><strong>{stop.stopOrder}. {stop.portName ?? port?.portName ?? 'Cảng'}</strong><p>{validTimeZone(port?.timeZoneId) ? `${journeyTime(stop.plannedArrival,port.timeZoneId)} → ${journeyTime(stop.plannedDeparture,port.timeZoneId)} · giờ cảng` : 'Cảng thiếu cấu hình múi giờ.'}</p><p className={styles.muted}>Việt Nam: {journeyTime(stop.plannedArrival)} → {journeyTime(stop.plannedDeparture)}</p><Badge label={callTypeLabels[stop.callType]} /></div><Button tone="secondary" disabled={busy} onClick={() => setStopEditor({ stop })}>{editable && access.canDo('CRUISE_STOP_UPDATE') ? 'Chỉnh sửa' : 'Xem cảng'}</Button></article> })}
            {selectedDay.dayType === 'PORT_DAY' && editable && access.canDo('CRUISE_STOP_ADD') && <Button disabled={busy} onClick={() => setStopEditor({ stop: null })}>Thêm lần ghé cảng</Button>}
          </Panel>
          {step === 2 && cruise && <JourneyProgram key={selectedDay.itineraryDayId} day={selectedDay} activities={activities} excursions={excursions} services={program.data?.services ?? []} stops={stops} ports={ports} cruise={cruise} editable={editable && completeProgram} onSaved={program.retry} />}
          {step === 1 && <Panel title="Chương trình ngày"><p>Hoạt động trên tàu và tham quan sử dụng chung ngày, cảng ghé với tuyến tàu này.</p><Button tone="secondary" onClick={() => changeStep(2)}>Lập chương trình ngày</Button></Panel>}
        </> : <Empty title="Bắt đầu với ngày đầu tiên">Chọn loại ngày ở danh sách bên trái để lưu ngày thực tế vào lịch trình.</Empty>}
      </section>
    </div> : <div className={styles.programStack}>
      <Panel title="Kiểm tra lịch trình" subtitle="Kiểm tra dữ liệu đã lưu; chọn một vấn đề để trở lại đúng ngày hoặc cảng.">
        {issues.length ? <ul className={styles.reviewList}>{issues.map(issue => <li key={issue.key}><span>{issue.message}</span>{issue.activityId ? <ButtonLink tone="secondary" to={`/admin/activities/${issue.activityId}`}>Xem hoạt động</ButtonLink> : <Button tone="secondary" onClick={() => { if (issue.dayId) setSelectedDayId(issue.dayId); changeStep(1); if (issue.stopId) { const stop = stops.find(item => item.cruiseStopId === issue.stopId); if (stop) setStopEditor({ stop }) } }}>Xem và sửa</Button>}</li>)}</ul> : <Notice title="Chưa phát hiện lỗi trong dữ liệu đã tải" tone={completeProgram ? 'success' : 'warning'}>Cần kiểm tra hệ thống trước khi gửi duyệt. Khung phục vụ kế hoạch chưa được hỗ trợ lưu.</Notice>}
        <div className={styles.editorTools}>{access.canDo(actionPermissions.validate) && <Button tone="secondary" disabled={busy} onClick={() => setAction('validate')}>Kiểm tra với hệ thống</Button>}</div>
      </Panel>
      <Panel title="Phê duyệt và phát hành"><div className={styles.editorTools}>
        {itinerary.status === 'DRAFT' && access.canDo(actionPermissions.submit) && <Button disabled={busy || stale || issues.length > 0} onClick={() => setAction('submit')}>Gửi duyệt</Button>}
        {itinerary.status === 'PENDING_APPROVAL' && <>{actionAllowed('approve') && <Button disabled={busy || stale || issues.length > 0} onClick={() => setAction('approve')}>Phê duyệt</Button>}{access.canDo(actionPermissions.reject) && <Button tone="secondary" disabled={busy} onClick={() => setAction('reject')}>Từ chối</Button>}</>}
        {itinerary.status === 'APPROVED' && access.canDo(actionPermissions.publish) && <Button disabled={busy || stale || issues.length > 0} onClick={() => setAction('publish')}>Phát hành lịch trình</Button>}
        {['APPROVED','OPEN_FOR_SALE','ACTIVE'].includes(itinerary.status) && access.canDo(actionPermissions.applyChange) && <Button tone="secondary" disabled={busy} onClick={() => setAction('applyChange')}>Ghi nhận thay đổi</Button>}
        {itinerary.status === 'DRAFT' && access.canDo(actionPermissions.remove) && <Button tone="danger" disabled={busy || data.supplementaryLoading || Boolean(data.supplementaryErrors.days) || days.length > 0} onClick={() => setAction('remove')}>Xóa bản nháp trống</Button>}
        {!['COMPLETED','CANCELLED'].includes(itinerary.status) && access.canDo(actionPermissions.cancel) && <Button tone="danger" disabled={busy} onClick={() => setAction('cancel')}>Hủy lịch trình</Button>}
      </div>{access.canDo('ITINERARY_APPROVE') && itinerary.status === 'PENDING_APPROVAL' && (!itinerary.createdByUserId || itinerary.createdByUserId === access.userId) && <p>Người tạo không thể tự phê duyệt lịch trình. Cần xác định người tạo trước khi duyệt.</p>}<p className={styles.muted}>Phát hành cập nhật trạng thái lịch trình hiện có; không mở bán chuyến đi hoặc booking. Hệ thống chưa hỗ trợ khóa phiên bản riêng.</p>{issues.length > 0 && <p>Cần xử lý các vấn đề đã phát hiện trước khi gửi duyệt hoặc phát hành.</p>}{!completeProgram && <p>Chưa đối chiếu đầy đủ hoạt động và tham quan do dữ liệu chưa tải được hoặc chưa có quyền xem. Kết quả hiển thị chỉ áp dụng cho dữ liệu đã tải; hệ thống tiếp tục kiểm tra khi thực hiện thao tác.</p>}</Panel>
      <Panel title="Lịch sử thay đổi"><ItineraryHistory itinerary={itinerary} /></Panel>
    </div>}
    <footer className={styles.journeyFooter}><span>Mỗi mục chỉ được ghi nhận sau khi hệ thống xác nhận lưu.</span><div className={styles.editorTools}>{step > 1 && <Button tone="secondary" disabled={busy} onClick={() => changeStep(step-1)}>Quay lại</Button>}{step < 3 && <Button disabled={busy} onClick={() => changeStep(step+1)}>{step === 1 ? 'Tiếp tục: Chương trình' : 'Tiếp tục: Kiểm tra'}</Button>}</div></footer>
    {dayEditor && <Modal variant="drawer" title={dayEditor.day ? 'Chỉnh ngày' : 'Thêm ngày vào lịch trình'} busy={busy} onClose={() => setDayEditor(null)}>
      <DayEditor itineraryId={itineraryId} itinerary={itinerary} days={days} day={dayEditor.day} maxDays={maxDays} busy={busy} onSave={draft => {
        if (!editable || !access.canDo(dayEditor.day ? 'ITINERARY_DAY_UPDATE' : 'ITINERARY_DAY_CREATE')) return
        if (draft.dayType === 'SEA_DAY' && dayEditor.day && stopsForDay(stops,dayEditor.day).length) { void run(async () => { throw new Error('Ngày này đang có lần ghé cảng, kể cả cảng qua đêm. Xử lý các lần ghé trước khi đổi thành ngày trên biển.') }, ''); return }
        let saved: ItineraryDay | undefined
        void run(async () => {
          if (!dayEditor.day && (await itineraryApi.listDays(itineraryId)).some(day => day.dayNumber === draft.dayNumber)) throw new Error('Ngày này đã tồn tại trên hệ thống. Tải lại trước khi tiếp tục để tránh tạo trùng.')
          saved = dayEditor.day ? await itineraryApi.updateDay(dayEditor.day.itineraryDayId,draft) : await itineraryApi.createDay(draft)
        }, 'Đã lưu ngày.').then(ok => { if (ok && saved) { setDayEditor(null); setSelectedDayId(saved.itineraryDayId); if (!dayEditor.day && saved.dayType === 'PORT_DAY' && access.canDo('CRUISE_STOP_ADD')) setStopEditor({ stop: null }) } })
      }} />{error && <Notice title="Chưa thể lưu ngày" tone="error">{error}</Notice>}
    </Modal>}
    {stopEditor && <Modal variant="drawer" wide title={stopEditor.stop ? 'Lần ghé cảng' : 'Thêm lần ghé cảng'} busy={busy} onClose={() => setStopEditor(null)}>
      <StopEditor itineraryId={itineraryId} stop={stopEditor.stop} days={days} ports={ports} destinations={destinations} stops={stops} excursions={excursions} cruise={cruise} busy={busy} editable={editable && (!stopEditor.stop || completeProgram) && access.canDo(stopEditor.stop ? 'CRUISE_STOP_UPDATE' : 'CRUISE_STOP_ADD')} onSave={draft => {
        if (!editable || (stopEditor.stop && !completeProgram) || !access.canDo(stopEditor.stop ? 'CRUISE_STOP_UPDATE' : 'CRUISE_STOP_ADD')) return
        void run(async () => {
          if (stopEditor.stop) return itineraryApi.updateStop(stopEditor.stop.cruiseStopId,draft)
          const currentStops = await itineraryApi.listStops(itineraryId)
          if (currentStops.some(item => item.portId === draft.portId && Date.parse(item.plannedArrival) === Date.parse(draft.plannedArrival) && Date.parse(item.plannedDeparture) === Date.parse(draft.plannedDeparture))) throw new Error('Lần ghé này đã có trên hệ thống. Tải lại dữ liệu để tránh tạo trùng.')
          return itineraryApi.createStop(draft)
        }, 'Đã lưu lần ghé cảng.').then(ok => { if (ok) { setStopEditor(null); program.retry() } })
      }} onRemove={() => { if (stopEditor.stop && access.canDo('CRUISE_STOP_REMOVE_DRAFT')) setDeletion({ kind:'stop', id:stopEditor.stop.cruiseStopId }) }} />
      {stopEditor.stop && !['DRAFT','PENDING_APPROVAL'].includes(itinerary.status) && validTimeZone(ports.find(port => port.portId === stopEditor.stop?.portId)?.timeZoneId) && <StopOperations stop={stopEditor.stop} stops={stops} itineraryStatus={itinerary.status} timeZoneId={ports.find(port => port.portId === stopEditor.stop?.portId)!.timeZoneId} onChanged={() => { void retry(); program.retry() }} />}
      {error && <Notice title="Chưa thể lưu cảng" tone="error">{error}</Notice>}
    </Modal>}
    {deletion && <Modal title="Kiểm tra ảnh hưởng trước khi xóa" busy={busy} onClose={() => setDeletion(null)} footer={<div className={styles.editorActions}><Button tone="secondary" disabled={busy} onClick={() => setDeletion(null)}>Quay lại</Button><Button tone="danger" disabled={busy || deletionBlocked || !access.canDo(deletion.kind === 'day' ? 'ITINERARY_DAY_DELETE' : 'CRUISE_STOP_REMOVE_DRAFT')} onClick={() => {
      if (deletionBlocked || !access.canDo(deletion.kind === 'day' ? 'ITINERARY_DAY_DELETE' : 'CRUISE_STOP_REMOVE_DRAFT')) return
      void run(() => deletion.kind === 'day' ? itineraryApi.removeDay(deletion.id) : itineraryApi.removeStop(deletion.id), 'Đã xóa mục chưa sử dụng.').then(ok => { if (ok) { setDeletion(null); setStopEditor(null); program.retry() } })
    }}>Xác nhận xóa</Button></div>}>
      <p>{removeDay ? `${affectedStops.length} lần ghé cảng · ${affectedActivities.length} hoạt động · ` : ''}{affectedExcursions.length} chuyến tham quan liên quan.</p><p>Khung phục vụ kế hoạch: chưa có mô hình lưu trong hệ thống.</p>
      {deletionBlocked && <Notice title="Chưa thể xóa" tone="warning">Chỉ xóa ngày cuối chưa có tham chiếu sau khi tải đủ dữ liệu. Các cảng qua đêm và chương trình phải được xử lý trước; hệ thống không tự xóa hoặc đổi liên kết nội dung.</Notice>}{error && <Notice title="Không thể xóa" tone="error">{error}</Notice>}
    </Modal>}
    {action && actionAllowed(action) && <Modal title={actionLabels[action]} busy={busy} onClose={() => setAction(null)} footer={<div className={styles.editorActions}><Button tone="secondary" disabled={busy} onClick={() => setAction(null)} data-overlay-dismiss>Quay lại</Button><Button disabled={busy || (['reject','applyChange'].includes(action) && !reason.trim())} onClick={() => void confirmAction()}>Xác nhận</Button></div>}>
      <p>{itinerary.itineraryName}</p>{['reject','applyChange'].includes(action) && <Field htmlFor="action-reason" label="Lý do"><textarea id="action-reason" value={reason} onChange={event => setReason(event.target.value)} /></Field>}{error && <Notice title="Chưa thể thực hiện" tone="error">{error}</Notice>}
    </Modal>}
  </ItineraryFrame>
}
