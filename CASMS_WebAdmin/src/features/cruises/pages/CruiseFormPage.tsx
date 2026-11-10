import { businessCopy } from '@/shared/i18n/business-copy'
import { InheritedSourcePlan } from '../components/InheritedSourcePlan'
import { EditorLayout } from '@/shared/ui'
import { FormErrorSummary, FormSection, useUnsavedFormGuard } from '@/shared/ui'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router'
import { ApiError, useReadQuery } from '@/shared/api'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'
import { useSessionAccess } from '@/shared/auth'

import { Button, ButtonLink, Field, Loading, Modal, Notice, PageHeader, Panel, PermissionLink, RecordFacts } from '@/shared/ui'

import { CruiseFrame } from '../components/CruiseUI'
import { cruiseApi } from '../api/cruise-api'
import { creationReturn } from '../model/creation-return'
import { cruiseCreateIntent } from '../model/create-intent'
import { DepartureSourcePicker } from '../components/DepartureSourcePicker'
import { readPublishedSource, type PublishedSource } from '../api/source-version'
import { departureApi } from '../api/departure-api'
import { type DepartureSchedule } from '../model/departure-contract'
import { scheduleInstant } from '../model/cruise-validation'
import { ItineraryDayBrowser, TemplateSchedule } from '@/domain/itinerary-day'
import { ScheduleContents } from '../components/DepartureData'
import { CruiseSourceDetails } from '../components/CruiseSourceDetails'
import styles from '../components/Cruises.module.css'
import type { CruiseDraft, CruiseRecord, CruiseStatus, CruiseType, PortRecord } from '../model/cruise-record'
import { validateCruiseDraft, localCruiseInput, type CruiseFormErrors } from '../model/cruise-validation'

const EMPTY_DRAFT: CruiseDraft = {
  itineraryMode: 'FIXED',
  cruiseCode: '',
  cruiseName: '',
  cruiseType: '',
  departureDatetime: '',
  returnDatetime: '',
  departurePortId: '',
  returnPortId: '',
}

const calendarLabel = (value: string) => {
  const [date, time] = value.split('T')
  return time ? date.split('-').reverse().join('/') + ' · ' + time.slice(0, 5) : 'Chưa xác định'
}

function convertPortClockToVietnamClock(rawTime: string, portTimeZoneId?: string | null, referenceDate?: string): { clock: string; label: string } {
  const normalized = rawTime.length === 5 ? `${rawTime}:00` : rawTime.slice(0, 8)
  if (!portTimeZoneId || portTimeZoneId === 'Asia/Ho_Chi_Minh') {
    return { clock: normalized, label: `${normalized.slice(0, 5)} (giờ Việt Nam)` }
  }
  try {
    const [y, m, d] = (referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate) ? referenceDate : '2026-11-10').split('-').map(Number)
    const [hh, mm, ss] = normalized.split(':').map(Number)
    const utcGuess = Date.UTC(y, m - 1, d, hh, mm, ss || 0)
    const getPartsMs = (instantMs: number, timeZone: string) => {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
          timeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
        }).formatToParts(new Date(instantMs)).map(p => [p.type, p.value])
      )
      return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
    }
    const portOffsetMs = getPartsMs(utcGuess, portTimeZoneId) - utcGuess
    const actualInstantMs = utcGuess - portOffsetMs
    const vnParts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date(actualInstantMs)).map(p => [p.type, p.value])
    )
    const vnClock = `${vnParts.hour}:${vnParts.minute}:${vnParts.second}`
    return {
      clock: vnClock,
      label: `${vnClock.slice(0, 5)} giờ Việt Nam (${normalized.slice(0, 5)} giờ cảng ${portTimeZoneId})`,
    }
  } catch {
    return { clock: normalized, label: normalized.slice(0, 5) }
  }
}

function resolveTemplateDepartureClock(source: PublishedSource | null | undefined, referenceDate?: string): { clock: string; label: string } | null {
  if (!source) return null
  const day1 = source.days.find(day => day.dayNumber === 1)
  if (day1?.plannedDepartureTime) {
    const clock = day1.plannedDepartureTime.length === 5 ? `${day1.plannedDepartureTime}:00` : day1.plannedDepartureTime.slice(0, 8)
    return { clock, label: `${clock.slice(0, 5)} (giờ Việt Nam)` }
  }
  const sortedStops = [...source.stops].sort((a, b) => a.stopOrder - b.stopOrder)
  const firstStop = sortedStops.find(s => s.arrivalDayNumber === 1) ?? sortedStops[0]
  const rawTime = firstStop?.plannedArrivalTime ?? firstStop?.plannedDepartureTime
  if (!rawTime) return null
  return convertPortClockToVietnamClock(rawTime, firstStop?.timeZoneId, referenceDate)
}

export function CruiseFormPage() {
  const access = useSessionAccess()
  const { cruiseId } = useParams()
  const editing = Boolean(cruiseId)
  const canChooseInitialShip = access.roles.includes('CRUISE_MANAGER') && access.canDo('CRUISE_ASSIGN_SHIP') && access.canDo('SHIP_READ')
  const initialShips = useReadQuery(`create-departure-ships:${access.userId}:${canChooseInitialShip}`, useCallback(signal => canChooseInitialShip ? cruiseApi.listShips(signal) : Promise.resolve([]), [canChooseInitialShip]))
  const navigate = useNavigate()
  const location = useLocation()
  const restored = !editing ? creationReturn(location.state, access.userId, new URLSearchParams(location.search).get('sourceVersionId')) : null
  const [createIntent] = useState(() => {
    let storage: Storage | undefined
    try { storage = window.sessionStorage } catch { storage = { getItem() { throw Error('Storage unavailable') }, setItem() { throw Error('Storage unavailable') } } as unknown as Storage }
    const intent = cruiseCreateIntent(access.userId ?? '', storage)
    // A completed operation belongs to the previous creation. Entering this form
    // starts a new one; unresolved operations retain their payload/key for recovery.
    if (!editing && intent.record?.status === 'succeeded') intent.startNew()
    return intent
  })
  const [draft, setDraft] = useState<CruiseDraft>(() => !editing && createIntent.record ? structuredClone(createIntent.record.payload) : restored?.draft ?? EMPTY_DRAFT)
  const [currentStatus, setCurrentStatus] = useState<CruiseStatus>('DRAFT')
  const [currentShip, setCurrentShip] = useState('Chưa phân công')
  const [loading, setLoading] = useState(editing)
  const [errors, setErrors] = useState<CruiseFormErrors>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [nameEdited, setNameEdited] = useState(() => Boolean(createIntent.record?.payload.cruiseName) || Boolean(restored?.nameEdited))
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [appliedPreview, setAppliedPreview] = useState('')
  const [applyingSchedule, setApplyingSchedule] = useState(false)
  const [applyScheduleError, setApplyScheduleError] = useState('')
  const [previewSchedule, setPreviewSchedule] = useState<{ key: string; data: DepartureSchedule } | null>(null)
  const scheduleRequest = useRef<AbortController | null>(null)
  const [scheduleDetailOpen, setScheduleDetailOpen] = useState(false)

  async function loadSchedule(apply: boolean) {
    if (!draft.departureDatetime || !sourceId) return
    scheduleRequest.current?.abort()
    const request = new AbortController()
    scheduleRequest.current = request
    setApplyingSchedule(true)
    setApplyScheduleError('')
    if (apply) {
      setAppliedPreview('')
      setSubmitError('')
      setPreviewSchedule(null)
    }
    try {
      const instant = scheduleInstant(draft.departureDatetime).toISOString()
      const schedule = await departureApi.preview(sourceId, instant, request.signal)
      if (request.signal.aborted) return
      let hasShipConflict = false
      if (apply && draft.shipId && access.canDo('CRUISE_READ')) {
        try {
          const existingCruises = await cruiseApi.list(
            { search: '', shipId: draft.shipId, status: '', cruiseType: '', departureDate: '', page: 1, pageSize: 100 },
            request.signal
          )
          if (request.signal.aborted) return
          const startMs = schedule.departureDatetime ? Date.parse(schedule.departureDatetime) : NaN
          const endMs = schedule.returnDatetime ? Date.parse(schedule.returnDatetime) : NaN
          const overlapping = existingCruises?.items?.find(item => {
            if (item.cruise.status === 'CANCELLED' || item.cruise.status === 'COMPLETED') return false
            const itemStart = Date.parse(item.cruise.departureDatetime)
            const itemEnd = Date.parse(item.cruise.returnDatetime)
            return Number.isFinite(itemStart) && Number.isFinite(itemEnd) && Number.isFinite(startMs) && Number.isFinite(endMs) && itemStart < endMs && itemEnd > startMs
          })
          if (overlapping) {
            hasShipConflict = true
            setApplyScheduleError(`Tàu phân công đang trùng lịch với chuyến ${overlapping.cruise.cruiseCode} (${overlapping.cruise.cruiseName}). Vui lòng chọn ngày giờ khác hoặc đổi tàu.`)
          }
        } catch {
          // Bỏ qua nếu không truy vấn được danh sách chuyến; Backend vẫn kiểm tra tại POST /cruise
        }
      }
      if (apply) {
        setDraft(current => ({
          ...current,
          returnDatetime: schedule.returnDatetime ? localCruiseInput(schedule.returnDatetime) : current.returnDatetime,
          departurePortId: schedule.departurePortId ?? current.departurePortId,
          returnPortId: schedule.returnPortId ?? current.returnPortId,
        }))
        setPreviewRevision(schedule.sourceVersionRevision)
        setAppliedPreview(!hasShipConflict ? scheduleKey : '')
      }
      setPreviewSchedule({ key: scheduleKey, data: schedule })
      if (!apply) setScheduleDetailOpen(true)
    } catch (err) {
      if (!request.signal.aborted) setApplyScheduleError(err instanceof Error ? err.message : 'Không tải được lịch trình theo ngày giờ này.')
    } finally {
      scheduleRequest.current = null
      setApplyingSchedule(false)
    }
  }

  function handleOpenScheduleDetail() {
    if (previewScheduleData || !draft.departureDatetime) setScheduleDetailOpen(true)
    else void loadSchedule(false)
  }
  const [changeSourceOpen, setChangeSourceOpen] = useState(false)
  const [previewRevision, setPreviewRevision] = useState<number | null>(restored?.previewRevision ?? null)
  const [uncertain, setUncertain] = useState(() => !editing && (createIntent.storageError || ['unknown', 'sending', 'succeeded'].includes(createIntent.record?.status ?? '')))
  const [params, setParams] = useSearchParams()
  const requestedSource = params.get('sourceVersionId')
  const invalidSource = !editing && params.has('sourceVersionId') && !requestedSource?.trim()
  const sourceId = editing ? null : uncertain && createIntent.record ? createIntent.record.payload.sourceVersionId ?? null : requestedSource
  const scheduleKey = JSON.stringify([sourceId, draft.departureDatetime])
  const previewScheduleData = previewSchedule?.key === scheduleKey ? previewSchedule.data : null
  useLayoutEffect(() => () => scheduleRequest.current?.abort(), [scheduleKey])

  const source = useReadQuery('cruise-source:' + sourceId, useCallback(signal => sourceId ? readPublishedSource(sourceId, signal) : Promise.resolve(null), [sourceId]))
  const displayName = !editing && sourceId && source.data && !nameEdited ? source.data.tripName : draft.cruiseName
  const [storedCruise, setStoredCruise] = useState<CruiseRecord | null>(null)
  const sourceEditing = editing && Boolean(storedCruise?.sourceVersionId)
  const [ports, setPorts] = useState<PortRecord[]>([])
  const [portsPending, setPortsLoading] = useState(true)
  const [portsLoadedKey, setPortsLoadedKey] = useState('')
  const sourceTripId = editing ? (storedCruise && storedCruise.cruiseId === cruiseId ? storedCruise.sourceTripId ?? undefined : undefined) : sourceId ? source.data?.tripId : undefined
  const portRequestKey = editing && storedCruise?.cruiseId !== cruiseId ? 'pending' : sourceTripId ? 'source:' + sourceTripId : sourceId ? 'source:pending' : 'legacy'
  const portsLoading = portsPending || portsLoadedKey !== portRequestKey
  const [portsError, setPortsError] = useState('')
  const [portsAttempt, setPortsAttempt] = useState(0)
  const [detailError, setDetailError] = useState('')
  const [detailAttempt, setDetailAttempt] = useState(0)
  const [storedPorts, setStoredPorts] = useState<PortRecord[]>([])
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const newDraftChanged = !editing && Boolean(sourceId || draft.shipId || Object.entries(EMPTY_DRAFT).some(([key, value]) => draft[key as keyof CruiseDraft] !== value))
  const existingDraftChanged = Boolean(editing && storedCruise && loadedId === cruiseId && (draft.cruiseName !== storedCruise.cruiseName || draft.shipId !== storedCruise.shipId || draft.departureDatetime !== localCruiseInput(storedCruise.departureDatetime) || draft.returnDatetime !== localCruiseInput(storedCruise.returnDatetime) || draft.departurePortId !== storedCruise.departurePortId || draft.returnPortId !== storedCruise.returnPortId || draft.plannedScope !== (storedCruise.plannedScope ?? undefined) || draft.itineraryMode !== storedCruise.itineraryMode))
  const guard = useUnsavedFormGuard(newDraftChanged || existingDraftChanged, busy, (current, next) => current.pathname !== next.pathname)
  const submitLock = useRef(false)
  const canSave = (!sourceId || appliedPreview === JSON.stringify([sourceId, draft.departureDatetime]) && previewRevision != null && source.data?.revision === previewRevision) && (editing || Boolean(sourceId)) && (!canChooseInitialShip || Boolean(draft.shipId)) && !uncertain && !invalidSource && createIntent.owner === (access.userId ?? '') && (!sourceId || !source.loading && !source.error && source.data?.versionId === sourceId) && !portsLoading && !portsError && access.canDo(editing ? 'CRUISE_UPDATE_DRAFT' : 'CRUISE_CREATE') && (!editing || (loadedId === cruiseId && currentStatus === 'DRAFT'))

  useEffect(() => {
    if (!cruiseId) return
    const controller = new AbortController()
    void cruiseApi.getDetail(cruiseId, controller.signal).then((detail) => {
      if (controller.signal.aborted) return
      setDraft({
        revision: detail.cruise.revision,
        plannedScope: detail.cruise.plannedScope ?? undefined,
        itineraryMode: detail.cruise.itineraryMode,
        cruiseCode: detail.cruise.cruiseCode,
        cruiseName: detail.cruise.cruiseName,
        cruiseType: detail.cruise.cruiseType,
        shipId: detail.cruise.shipId,
        departureDatetime: localCruiseInput(detail.cruise.departureDatetime),
        returnDatetime: localCruiseInput(detail.cruise.returnDatetime),
        departurePortId: detail.cruise.departurePortId,
        returnPortId: detail.cruise.returnPortId,
      })
      setStoredPorts([detail.departurePort, detail.returnPort])
      setStoredCruise(detail.cruise)
      setErrors({})
      setHasSubmitted(false)
      setCurrentStatus(detail.cruise.status)
      setLoadedId(cruiseId)
      setCurrentShip(detail.ship?.shipName ?? 'Chưa phân công')
      setLoading(false)
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setDetailError(error instanceof Error ? error.message : 'Không tải được chuyến.')
      setLoading(false)
    })
    return () => controller.abort()
  }, [cruiseId, detailAttempt])

  useEffect(() => {
    if (!editing && !sourceId || invalidSource || editing && storedCruise?.cruiseId !== cruiseId || sourceId && !sourceTripId) return
    const controller = new AbortController()
    void cruiseApi.listPorts(controller.signal, sourceTripId).then((result) => {
      if (!controller.signal.aborted) { setPorts(result); setPortsLoadedKey(portRequestKey); setPortsLoading(false); setPortsError('') }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) { setPortsLoadedKey(portRequestKey); setPortsError(error instanceof Error ? error.message : 'Không tải được danh mục cảng.'); setPortsLoading(false) }
    })
    return () => controller.abort()
  }, [portsAttempt, sourceId, sourceTripId, portRequestKey, invalidSource, editing, storedCruise, cruiseId])

  const portOptions = [...(portsLoadedKey === portRequestKey ? ports : []), ...(loadedId === cruiseId ? storedPorts : []).filter((port, index, all) => port && !ports.some(item => item.portId === port.portId) && all.findIndex(item => item?.portId === port.portId) === index)]
  const selectedShip = canChooseInitialShip && draft.shipId ? initialShips.data?.find(ship => ship.shipId === draft.shipId) ?? null : null

  useEffect(() => {
    if (!canChooseInitialShip || editing || draft.shipId || !initialShips.data?.length) return
    const operationalShips = initialShips.data.filter(ship => ['READY', 'IN_SERVICE'].includes(ship.status))
    if (operationalShips.length >= 1) {
      setDraft(current => current.shipId ? current : { ...current, shipId: operationalShips[0].shipId })
    }
  }, [canChooseInitialShip, editing, draft.shipId, initialShips.data])

  useEffect(() => {
    if (editing || !sourceId || !draft.departureDatetime || invalidSource) return
    void loadSchedule(true)
  }, [editing, sourceId, draft.departureDatetime, draft.shipId, invalidSource])

  function update<K extends keyof CruiseDraft>(key: K, value: CruiseDraft[K]) {
    if (key === 'departureDatetime' && value !== draft.departureDatetime) {
      scheduleRequest.current?.abort()
      setPreviewSchedule(null)
      setAppliedPreview('')
      setPreviewRevision(null)
      setApplyScheduleError('')
      setSubmitError('')
    }
    if (key === 'shipId' && value !== draft.shipId) {
      setApplyScheduleError('')
      setSubmitError('')
    }
    if (key === 'cruiseName') setNameEdited(true)
    let next: CruiseDraft = { ...draft, cruiseName: displayName, [key]: value }
    if (key === 'departureDatetime' && sourceEditing && storedCruise && typeof value === 'string' && value) {
      try {
        const durationMs = Date.parse(storedCruise.returnDatetime) - Date.parse(storedCruise.departureDatetime)
        if (Number.isFinite(durationMs) && durationMs > 0) {
          const nextDepMs = scheduleInstant(value).getTime()
          if (Number.isFinite(nextDepMs)) {
            next = { ...next, returnDatetime: localCruiseInput(new Date(nextDepMs + durationMs).toISOString()) }
          }
        }
      } catch {
        // Giữ nguyên giờ kết thúc nếu đang nhập dở
      }
    }
    setDraft(next)
    if (hasSubmitted) {
      setErrors(validateCruiseDraft(next))
    }
  }

  function chooseSource(id: string, name?: string) {
    const next = new URLSearchParams(params); next.delete('mode')
    if (id) next.set('sourceVersionId', id); else next.delete('sourceVersionId')
    scheduleRequest.current?.abort()
    setPreviewSchedule(null)
    setApplyScheduleError('')
    setParams(next, { replace: true }); setAppliedPreview(''); setPreviewRevision(null)
    setDraft(old => ({ ...old, cruiseName: nameEdited ? old.cruiseName : name ?? '', returnDatetime: '', departurePortId: '', returnPortId: '' }))
    setErrors({}); setSubmitError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveDraft()
  }
  async function saveDraft(replay = false) {
    const mayReplay = !editing && replay && createIntent.record?.status === 'unknown' && !createIntent.storageError && createIntent.owner === (access.userId ?? '') && access.canDo('CRUISE_CREATE')
    if (submitLock.current || (!canSave && !mayReplay)) return
    if (editing && storedCruise && !storedCruise.sourceVersionId && !storedCruise.sourceTripId && !['DOMESTIC', 'INTERNATIONAL'].includes(draft.plannedScope ?? '')) { setSubmitError('Chọn phạm vi hành trình trước khi lưu chuyến khởi hành nhập trực tiếp.'); return }
    const input = mayReplay ? createIntent.record!.payload : { ...draft, cruiseName: displayName, ...(!editing && sourceId && source.data ? { itineraryMode: draft.itineraryMode || ('FIXED' as const), sourceVersionId: sourceId, expectedSourceVersionRevision: previewRevision, creationPayloadVersion: 2 as const, cruiseType: source.data.durationDays === 1 ? 'ONE_DAY' as const : 'MULTI_DAYS' as const } : {}) }
    if (!editing && !mayReplay && canChooseInitialShip && (!input.shipId || initialShips.loading || initialShips.error || !initialShips.data?.some(ship => ship.shipId === input.shipId && ['READY', 'IN_SERVICE'].includes(ship.status)))) { setSubmitError('Vui lòng chọn tàu phân công đang sẵn sàng hoặc đang khai thác từ danh sách hiện tại.'); return }
    if (sourceEditing && storedCruise && (draft.departurePortId !== storedCruise.departurePortId || draft.returnPortId !== storedCruise.returnPortId)) { setSubmitError('Cảng đi và cảng về được kế thừa cố định từ lịch trình mẫu.'); return }
    setHasSubmitted(true)
    const nextErrors = validateCruiseDraft(input)
    if (!mayReplay && !portOptions.some(port => port.portId === input.departurePortId)) nextErrors.departurePortId = 'Chọn lại cảng khởi hành phù hợp phạm vi hiện tại.'
    if (!mayReplay && !portOptions.some(port => port.portId === input.returnPortId)) nextErrors.returnPortId = 'Chọn lại cảng kết thúc phù hợp phạm vi hiện tại.'
    setErrors(nextErrors)
    setSubmitError('')
    if (Object.keys(nextErrors).length) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    submitLock.current = true
    setBusy(true)
    try {
      const saved = editing && cruiseId
        ? await cruiseApi.updateCruise(cruiseId, input, storedCruise ?? undefined)
        : await createIntent.execute(input, cruiseApi.createCruise)
      if (!editing && input.sourceVersionId && saved.sourceVersionId !== input.sourceVersionId) { setUncertain(true); setSubmitError('Hệ thống đã tạo bản ghi nhưng phản hồi chưa xác nhận đúng phiên bản nguồn. Mở bản ghi để đối chiếu trước khi thực hiện tiếp.'); return }
      guard.allowLeave(); navigate(`/admin/cruises/${saved.cruiseId}`, { replace: !editing })
    } catch (error) {
      if (editing ? mutationOutcomeUnknown(error) : createIntent.record?.status === 'unknown' || createIntent.storageError) setUncertain(true)
      if (error instanceof ApiError && error.code === 'STALE_REVISION') setSubmitError('Chuyến khởi hành đã được người khác cập nhật. Nội dung bạn nhập vẫn được giữ. Mở bản đã lưu ở thẻ khác để đối chiếu trước khi chỉnh tiếp.')
      if (error instanceof ApiError && ['INVALID_SCHEDULE', 'SHIP_SCHEDULE_CONFLICT'].includes(error.code ?? '')) setErrors(current => ({ ...current, returnDatetime: error.code === 'SHIP_SCHEDULE_CONFLICT' ? 'Thời gian này trùng lịch của tàu đã phân công.' : 'Kiểm tra ngày giờ khởi hành và kết thúc.' }))
      if (!(error instanceof ApiError && error.code === 'STALE_REVISION')) setSubmitError(error instanceof Error ? error.message : 'Không lưu được chuyến khởi hành.')
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  if (loading) return <CruiseFrame><Loading label="Đang tải chuyến khởi hành…" /></CruiseFrame>

  return <CruiseFrame>
    <div className={styles.content}>
      {uncertain && <Notice title={createIntent.record?.status === 'succeeded' ? 'Chuyến khởi hành đã được tạo' : 'Chưa xác định được kết quả lưu'} tone="warning"><p>{createIntent.record?.status === 'succeeded' ? 'Mở bản ghi đã được hệ thống xác nhận.' : 'Bản nhập và mã thao tác cũ được giữ nguyên. Chưa có API tra cứu riêng kết quả thao tác.'}</p><ButtonLink tone="secondary" to={createIntent.record?.cruiseId ? '/admin/cruises/' + createIntent.record.cruiseId : editing ? '/admin/cruises/' + cruiseId : '/admin/cruises'}>Đối chiếu chuyến khởi hành</ButtonLink>{!editing && createIntent.record?.status === 'unknown' && access.canDo('CRUISE_CREATE') && <Button disabled={busy || createIntent.storageError} onClick={() => void saveDraft(true)}>Gửi lại cùng yêu cầu</Button>}{!editing && createIntent.record?.status === 'succeeded' && <Button disabled={busy} onClick={() => { if (createIntent.startNew()) { setDraft(EMPTY_DRAFT); setNameEdited(false); setAppliedPreview(''); setPreviewRevision(null); setUncertain(false); setErrors({}); setSubmitError('') } }}>Tạo chuyến khởi hành khác</Button>}</Notice>}
      <PageHeader breadcrumb="" title={editing ? 'Chỉnh sửa chuyến khởi hành' : businessCopy('cruise.source.create')} />
      {!editing && !sourceId && <DepartureSourcePicker value={sourceId} disabled={busy || uncertain} onChange={chooseSource} />}
      {changeSourceOpen && <Modal large title="Đổi lịch trình mẫu đã chọn" onClose={() => setChangeSourceOpen(false)} footer={<Button tone="secondary" onClick={() => setChangeSourceOpen(false)}>Đóng</Button>}>
        <DepartureSourcePicker value={sourceId} disabled={busy || uncertain} hidePreviewButton asPanel={false} onChange={(id, name) => { chooseSource(id, name); setChangeSourceOpen(false) }} />
      </Modal>}
      {invalidSource && <Notice title="Thiếu phiên bản nguồn" tone="error">Liên kết tạo đang thiếu định danh phiên bản. Mở lại đúng phiên bản lịch trình đã phát hành; không tự chuyển sang tạo trực tiếp.</Notice>}
      {storedCruise && <CruiseSourceDetails cruise={storedCruise} />}
      {sourceId && source.loading && <Loading label="Đang đọc tuyến và chương trình đã phát hành…" />}
      {sourceId && source.error && <Notice title="Chưa đọc được lịch trình nguồn" tone="error">{source.error.message}<Button tone="secondary" onClick={source.retry}>Tải lại</Button><Button disabled={busy || uncertain} onClick={() => chooseSource('')}>Chọn lịch trình khác</Button></Notice>}
      {!editing && sourceId && source.data && <EditorLayout><form className={styles.departureCreateForm} onSubmit={submit} noValidate>
        <fieldset disabled={busy || uncertain} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <FormErrorSummary errors={errors} />
          <Panel title="Hồ sơ chuyến khởi hành">
            <InheritedSourcePlan
              source={source.data}
              disabled={busy || uncertain}
              onChangeSource={() => setChangeSourceOpen(true)}
            />
            <FormSection title="Thông tin chuyến">
              <Field htmlFor="cruise-name" label="Tên chuyến khởi hành *" error={errors.cruiseName}>
                <input id="cruise-name" value={displayName} aria-invalid={Boolean(errors.cruiseName)} onChange={event => update('cruiseName', event.target.value)} />
              </Field>
              {canChooseInitialShip && <>
                <Field htmlFor="departure-initial-ship" label="Tàu phân công *" error={errors.shipId}>
                  <select id="departure-initial-ship" value={draft.shipId ?? ''} aria-invalid={Boolean(errors.shipId)} disabled={initialShips.loading || Boolean(initialShips.error)} onChange={event => update('shipId', event.target.value || null)}>
                    <option value="">Chọn tàu phân công</option>
                    {draft.shipId && !initialShips.data?.some(ship => ship.shipId === draft.shipId) && <option value={draft.shipId}>Tàu đã chọn · cần tải lại</option>}
                    {initialShips.data?.map(ship => <option key={ship.shipId} value={ship.shipId} disabled={!['READY', 'IN_SERVICE'].includes(ship.status)}>
                      {ship.shipName} · {ship.shipCode}{Number.isSafeInteger(ship.totalCapacity) && ship.totalCapacity >= 0 ? ` · ${ship.totalCapacity} khách` : ''}
                    </option>)}
                  </select>
                </Field>
                {selectedShip && (
                  <div className={styles.departureScheduleFull}>
                    <RecordFacts entries={[
                      ['Mã tàu', selectedShip.shipCode],
                      ['Sức chứa tối đa', `${selectedShip.totalCapacity} khách`],
                      ['Số tầng boong', selectedShip.totalDecks != null ? `${selectedShip.totalDecks} tầng` : 'Chưa cập nhật'],
                      ['Trạng thái tàu', selectedShip.status === 'READY' ? 'Sẵn sàng' : selectedShip.status === 'IN_SERVICE' ? 'Đang khai thác' : selectedShip.status],
                    ]} />
                  </div>
                )}
                {initialShips.loading && <Loading label="Đang tải danh sách tàu…" />}
                {initialShips.error && <div role="alert"><p>Chưa tải được danh sách tàu.</p><Button tone="secondary" onClick={initialShips.retry}>Tải lại</Button></div>}
              </>}
            </FormSection>

            <FormSection title="Ngày giờ khởi hành">
              <div className={styles.departureScheduleRow}>
                <Field
                  htmlFor="departure-time"
                  label="Khởi hành dự kiến (giờ Việt Nam) *"
                  error={errors.departureDatetime}
                >
                  <input id="departure-time" type="datetime-local" step="1" value={draft.departureDatetime}
                    aria-invalid={Boolean(errors.departureDatetime)} onChange={event => {
                      const value = event.target.value
                      const datePart = value ? value.slice(0, 10) : undefined
                      const resolvedClock = resolveTemplateDepartureClock(source.data, datePart)?.clock
                      update(
                        'departureDatetime',
                        resolvedClock && value && value.slice(0, 10) !== draft.departureDatetime.slice(0, 10)
                          ? `${value.slice(0, 10)}T${resolvedClock}`
                          : value
                      )
                    }} />
                </Field>
                <Button tone="secondary" disabled={applyingSchedule} onClick={handleOpenScheduleDetail}>
                  Xem lịch trình
                </Button>
              </div>

              {source.data.days.find(day => day.dayNumber === 1)?.dayType === 'SEA_DAY' && !source.data.days.find(day => day.dayNumber === 1)?.departurePortId && (
                <Field htmlFor="source-departure-port" label="Cảng khởi hành *" error={errors.departurePortId}>
                  <select id="source-departure-port" disabled={portsLoading || Boolean(portsError)} value={draft.departurePortId} onChange={event => update('departurePortId', event.target.value)}>
                    <option value="">Chọn cảng khởi hành</option>
                    {portOptions.filter(port => port.status === 'ACTIVE').map(port => <option value={port.portId} key={port.portId}>{port.portName}</option>)}
                  </select>
                </Field>
              )}

              {applyingSchedule && <p role="status">Đang tính lịch trình dự kiến…</p>}
              {previewScheduleData && <div className={styles.departureScheduleFull}><RecordFacts entries={[
                ['Cảng khởi hành', previewScheduleData.departurePortName ?? portOptions.find(port => port.portId === draft.departurePortId)?.portName ?? 'Chưa chọn'],
                ['Cảng trả khách', previewScheduleData.returnPortName ?? portOptions.find(port => port.portId === draft.returnPortId)?.portName ?? 'Chưa xác định'],
                ['Kết thúc dự kiến (giờ Việt Nam)', calendarLabel(previewScheduleData.returnDatetime ? localCruiseInput(previewScheduleData.returnDatetime) : '')],
              ]} /></div>}
              {applyScheduleError && (
                <div className={styles.departureCheckError} role="alert">
                  <strong>{applyScheduleError}</strong>
                </div>
              )}
            </FormSection>
            {scheduleDetailOpen && (
              <Modal
                wide
                quiet
                protectChanges={false}
                title={`${previewScheduleData ? 'Lịch trình' : 'Lịch mẫu'} · ${source.data.tripName}`}
                description={`${source.data.tripCode} · ${source.data.durationDays} ngày${source.data.durationNights ? ` ${source.data.durationNights} đêm` : ''}`}
                onClose={() => setScheduleDetailOpen(false)}
              >
                {previewScheduleData ? (
                  <ItineraryDayBrowser days={previewScheduleData.days}>
                    {day => (
                      <ScheduleContents
                        schedule={previewScheduleData}
                        preview
                        selectedDay={day}
                        entryTitles={Object.fromEntries((source.data?.entries ?? []).flatMap(entry => [[entry.clientKey, entry.title], ...(entry.entryId ? [[entry.entryId, entry.title]] : [])]))}
                      />
                    )}
                  </ItineraryDayBrowser>
                ) : (
                  <TemplateSchedule days={source.data.days} stops={source.data.stops} entries={source.data.entries} />
                )}
              </Modal>
            )}

            {portsLoading && !source.error && !invalidSource && <Loading label="Đang tải danh sách cảng…" />}
            {portsError && <Notice title="Không tải được danh sách cảng" tone="error"><p>{portsError}</p><Button type="button" tone="secondary" onClick={() => { setPortsLoading(true); setPortsError(''); setPortsAttempt(value => value + 1) }}>Tải lại danh sách cảng</Button></Notice>}
            {!portsLoading && !portsError && !ports.length && <Notice title="Chưa có cảng hoạt động" tone="warning">Cần tạo hoặc kích hoạt cảng trước khi lập chuyến mới.</Notice>}
            {submitError && !uncertain && <div className={styles.departureCheckError} role="alert"><strong>Chưa tạo được chuyến</strong><p>{submitError}</p></div>}
            <div className={styles.formActions}>
              {access.canDo('CRUISE_CREATE') && <Button type="submit" tone="primary" value="draft" disabled={busy || !canSave}>{busy ? 'Đang lưu…' : 'Tạo chuyến khởi hành'}</Button>}
              <Button tone="secondary" disabled={busy} onClick={() => navigate('/admin/cruises')}>Hủy</Button>
            </div>
          </Panel>
        </fieldset>
      </form></EditorLayout>}
      {editing && <EditorLayout><form onSubmit={submit} noValidate>
        <fieldset disabled={busy || uncertain} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><Panel title="Thông tin chuyến khởi hành">
          <FormErrorSummary errors={errors} />
          <div className={styles.journeyForm}><FormSection title="01 · Nhận diện chuyến khởi hành">
            <Field htmlFor="cruise-name" label="Tên chuyến khởi hành *" error={errors.cruiseName}><input id="cruise-name" value={displayName} aria-invalid={Boolean(errors.cruiseName)} aria-describedby={errors.cruiseName ? 'cruise-name-hint' : undefined} onChange={(event) => update('cruiseName', event.target.value)} /></Field>
            {!sourceEditing && <Field htmlFor="cruise-type-form" label="Thời lượng chuyến" error={errors.cruiseType}><select id="cruise-type-form" value={draft.cruiseType} onChange={(event) => update('cruiseType', event.target.value as CruiseType)}><option value="">Hệ thống xác định theo ngày giờ</option><option value="ONE_DAY">Một ngày</option><option value="MULTI_DAYS">Nhiều ngày</option></select></Field>}
            {sourceEditing && <p>Thời lượng được kế thừa từ lịch trình nguồn đã liên kết.</p>}
            {storedCruise && !storedCruise.sourceVersionId && !storedCruise.sourceTripId && <>
              <Field htmlFor="legacy-scope" label="Phạm vi hành trình"><select id="legacy-scope" value={draft.plannedScope ?? ''} onChange={e => update('plannedScope', e.target.value as 'DOMESTIC' | 'INTERNATIONAL')} required><option value="">Chọn phạm vi</option><option value="DOMESTIC">Nội địa</option><option value="INTERNATIONAL">Quốc tế</option></select></Field>
              <Field htmlFor="legacy-mode" label="Chỉnh sửa lịch trình"><select id="legacy-mode" value={draft.itineraryMode ?? 'FIXED'} onChange={e => update('itineraryMode', e.target.value as 'FIXED' | 'CUSTOM')}><option value="FIXED">Giữ cố định lịch trình hiện có</option><option value="CUSTOM">Cho phép chỉnh sửa lịch trình</option></select></Field>
            </>}
          </FormSection>
            <FormSection title="02 · Thời gian"><Field htmlFor="departure-time" label="Khởi hành (giờ Việt Nam)" error={errors.departureDatetime}><input id="departure-time" type="datetime-local" step="1" value={draft.departureDatetime} aria-invalid={Boolean(errors.departureDatetime)} aria-describedby={errors.departureDatetime ? 'departure-time-hint' : undefined} onChange={(event) => update('departureDatetime', event.target.value)} /></Field>
              <Field htmlFor="return-time" label="Kết thúc (giờ Việt Nam)" error={errors.returnDatetime}><input id="return-time" disabled={sourceEditing || Boolean(sourceId)} type="datetime-local" value={draft.returnDatetime} aria-invalid={Boolean(errors.returnDatetime)} aria-describedby={errors.returnDatetime ? 'return-time-hint' : undefined} onChange={(event) => update('returnDatetime', event.target.value)} /></Field>
            </FormSection>
            {!sourceEditing && <FormSection title="03 · Cảng đi và về"><Field htmlFor="departure-port" label="Cảng khởi hành" error={errors.departurePortId}><select id="departure-port" disabled={busy || sourceEditing || portsLoading || Boolean(portsError)} value={draft.departurePortId} aria-invalid={Boolean(errors.departurePortId)} aria-describedby={errors.departurePortId ? 'departure-port-hint' : undefined} onChange={(event) => update('departurePortId', event.target.value)}><option value="">Chọn cảng khởi hành</option>{portOptions.map(port => <option value={port.portId} key={port.portId}>{port.portName}{port.countryCode ? ` · ${port.countryCode}` : ''}{port.status === 'INACTIVE' ? ' · Cảng đã lưu, không còn hoạt động' : port.status === 'UNKNOWN' ? ' · Chưa xác định trạng thái' : ''}</option>)}</select></Field>
              <Field htmlFor="return-port" label="Cảng trở về" error={errors.returnPortId}><select id="return-port" disabled={busy || sourceEditing || portsLoading || Boolean(portsError)} value={draft.returnPortId} aria-invalid={Boolean(errors.returnPortId)} aria-describedby={errors.returnPortId ? 'return-port-hint' : undefined} onChange={(event) => update('returnPortId', event.target.value)}><option value="">Chọn cảng trở về</option>{portOptions.map(port => <option value={port.portId} key={port.portId}>{port.portName}{port.countryCode ? ` · ${port.countryCode}` : ''}{port.status === 'INACTIVE' ? ' · Cảng đã lưu, không còn hoạt động' : port.status === 'UNKNOWN' ? ' · Chưa xác định trạng thái' : ''}</option>)}</select></Field>
            </FormSection>}
            <p>Tàu hiện tại: {currentShip}</p>
            {canChooseInitialShip && (
              <Field htmlFor="edit-departure-ship" label="Tàu phân công *" error={errors.shipId}>
                <select id="edit-departure-ship" value={draft.shipId ?? ''} aria-invalid={Boolean(errors.shipId)} disabled={initialShips.loading || Boolean(initialShips.error)} onChange={event => update('shipId', event.target.value || null)}>
                  <option value="">Chọn tàu phân công</option>
                  {draft.shipId && !initialShips.data?.some(ship => ship.shipId === draft.shipId) && <option value={draft.shipId}>Tàu đã chọn · cần tải lại</option>}
                  {initialShips.data?.map(ship => <option key={ship.shipId} value={ship.shipId} disabled={!['READY', 'IN_SERVICE'].includes(ship.status)}>
                    {ship.shipName} · {ship.shipCode}{Number.isSafeInteger(ship.totalCapacity) && ship.totalCapacity >= 0 ? ` · ${ship.totalCapacity} khách` : ''}
                  </option>)}
                </select>
              </Field>
            )}
          </div>
          {portsLoading && !portsError && <Loading label="Đang tải danh sách cảng…" />}
          {portsError && <Notice title="Không tải được danh sách cảng" tone="error"><p>{portsError}</p><Button type="button" tone="secondary" onClick={() => { setPortsLoading(true); setPortsError(''); setPortsAttempt(value => value + 1) }}>Tải lại danh sách cảng</Button></Notice>}
          {detailError && <Notice title="Không tải được chuyến" tone="error"><p>{detailError}</p><Button type="button" tone="secondary" onClick={() => { setLoading(true); setDetailError(''); setDetailAttempt(value => value + 1) }}>Tải lại chuyến</Button></Notice>}
          {loadedId === cruiseId && currentStatus !== 'DRAFT' && <Notice title="Không thể sửa chuyến" tone="warning"><p>Chỉ chuyến ở trạng thái DRAFT mới được chỉnh sửa.</p></Notice>}
          {submitError && <Notice title="Chưa xác nhận được kết quả lưu" tone="error"><p>{submitError}</p>{cruiseId && <PermissionLink target="_blank" rel="noopener noreferrer" to={'/admin/cruises/' + encodeURIComponent(cruiseId)}>Xem bản đã lưu ở thẻ khác để đối chiếu</PermissionLink>}</Notice>}
          <div className={styles.formActions}>{access.canDo('CRUISE_UPDATE_DRAFT') && <Button type="submit" tone="primary" value="draft" disabled={busy || !canSave}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</Button>}<Button tone="secondary" disabled={busy} onClick={() => navigate(cruiseId ? `/admin/cruises/${cruiseId}` : '/admin/cruises')}>Hủy</Button></div>
        </Panel></fieldset>
      </form></EditorLayout>}
    </div>
    {guard.prompt}</CruiseFrame>
}
