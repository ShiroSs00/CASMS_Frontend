import { departureWindowIncludes, departureWindowInputs, departureWindowLabel, parseDepartureMinute } from '@/domain/trip-departure-window'
import { businessErrorMessage } from '@/shared/api/business-errors'
import { businessCopy } from '@/shared/i18n/business-copy'
import { InheritedSourcePlan } from '../components/InheritedSourcePlan'
import { Badge, EditorLayout } from '@/shared/ui'
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
import { readPublishedSource } from '../api/source-version'
import { departureApi } from '../api/departure-api'
import { type DepartureSchedule } from '../model/departure-contract'
import { scheduleInstant } from '../model/cruise-validation'
import { ItineraryDayBrowser, TemplateSchedule } from '@/domain/itinerary-day'
import { ScheduleContents } from '../components/DepartureData'
import { CruiseSourceDetails } from '../components/CruiseSourceDetails'
import { CruiseDateTimeFields } from '../components/CruiseDateTimeFields'
import { ShipPackageSuggestions } from '../components/ShipPackageSuggestions'
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
  return time ? date.split('-').reverse().join('/') + ' · ' + time.replace(/^(\d{2}:\d{2}):00$/, '$1') : 'Chưa xác định'
}

function departureScheduleErrorMessage(err: unknown, durationDays?: number | null, durationNights?: number | null): string {
  if (!(err instanceof ApiError)) return err instanceof Error ? err.message : 'Không tải được lịch trình theo ngày giờ này.'
  if (err.code === 'SOURCE_DURATION_INVALID' || err.code === 'DRAFT_ITINERARY_DAY_COUNT_MISMATCH') {
    if (durationDays === 1) {
      return 'Giờ khởi hành quá trễ so với lịch trình 1 ngày (chuyến sẽ kết thúc sang ngày hôm sau). Chọn giờ khởi hành sớm hơn để hoàn tất trong cùng ngày.'
    }
    return durationDays != null
      ? `Giờ khởi hành làm số ngày hoặc số đêm thực tế không khớp với mẫu (${durationDays} ngày${durationNights ? ` ${durationNights} đêm` : ''}). Chọn giờ khởi hành phù hợp hơn.`
      : 'Giờ khởi hành làm thay đổi số ngày hoặc số đêm so với mẫu lịch trình. Chọn giờ khởi hành phù hợp hơn.'
  }
  if (durationDays === 1 && (err.code === 'SOURCE_PROGRAM_OUTSIDE_CRUISE' || err.code === 'SOURCE_EXCURSION_OUTSIDE_PORT_CALL')) {
    return 'Giờ khởi hành quá trễ khiến hoạt động hoặc tour bờ vượt quá thời gian kết thúc trong ngày của chuyến 1 ngày. Chọn giờ khởi hành sớm hơn.'
  }
  return err.message
}

const normalizeShipSearch = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi').trim()

const shipStatusLabel = (status: string) =>
  ({ DRAFT: 'Đang thiết lập', READY: 'Sẵn sàng', IN_SERVICE: 'Đang khai thác', MAINTENANCE: 'Đang bảo trì', SUSPENDED: 'Tạm dừng', RETIRED: 'Đã ngừng hoạt động' } as Record<string, string>)[status] ?? status

export function CruiseFormPage() {
  const [dateFieldsGeneration, setDateFieldsGeneration] = useState(0)
  const [dateFieldsIncomplete, setDateFieldsIncomplete] = useState(false)
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
  const [initialSourceId] = useState(() => new URLSearchParams(location.search).get('sourceVersionId'))
  const [shipEdited, setShipEdited] = useState(() => Boolean(restored?.draft.shipId))
  const [passengerInput, setPassengerInput] = useState(() => String(createIntent.record?.payload.expectedPassengerCount ?? restored?.draft.expectedPassengerCount ?? ''))
  const [shipSearch, setShipSearch] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [appliedPreview, setAppliedPreview] = useState('')
  const [applyingSchedule, setApplyingSchedule] = useState(false)
  const [applyScheduleError, setApplyScheduleError] = useState('')
  const [previewSchedule, setPreviewSchedule] = useState<{ key: string; data: DepartureSchedule } | null>(null)
  const scheduleRequest = useRef<AbortController | null>(null)
  const [scheduleDetailOpen, setScheduleDetailOpen] = useState(false)

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
  const source = useReadQuery('cruise-source:' + sourceId, useCallback(signal => sourceId ? readPublishedSource(sourceId, signal) : Promise.resolve(null), [sourceId]))
  const activeSource = !source.loading && !source.error && source.data?.versionId === sourceId ? source.data : null
  const outsideDepartureWindow = Boolean(activeSource && draft.departureDatetime &&
    !departureWindowIncludes(activeSource, draft.departureDatetime))
  const departureWindowError = outsideDepartureWindow ? businessErrorMessage('DEPARTURE_OUTSIDE_TRIP_WINDOW', '') : undefined
  const scheduleKey = JSON.stringify([sourceId, draft.departureDatetime])
  const previewScheduleData = !outsideDepartureWindow && previewSchedule?.key === scheduleKey ? previewSchedule.data : null
  useLayoutEffect(() => () => scheduleRequest.current?.abort(), [scheduleKey])

  const loadSchedule = useCallback(async (apply: boolean) => {
    if (!draft.departureDatetime || !sourceId || !activeSource || outsideDepartureWindow) return
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
      if (apply) {
        setDraft(current => ({
          ...current,
          returnDatetime: schedule.returnDatetime ? localCruiseInput(schedule.returnDatetime) : current.returnDatetime,
          departurePortId: schedule.departurePortId ?? current.departurePortId,
          returnPortId: schedule.returnPortId ?? current.returnPortId,
        }))
        setPreviewRevision(schedule.sourceVersionRevision)
        setAppliedPreview(scheduleKey)
      }
      setPreviewSchedule({ key: scheduleKey, data: schedule })
      setErrors(current => {
        if (!current.departureDatetime) return current
        const nextErrors = { ...current }
        delete nextErrors.departureDatetime
        return nextErrors
      })
      if (!apply) setScheduleDetailOpen(true)
    } catch (err) {
      if (request.signal.aborted) return
      if (err instanceof ApiError && [
        'DEPARTURE_OUTSIDE_TRIP_WINDOW',
        'SOURCE_DURATION_INVALID',
        'DRAFT_ITINERARY_DAY_COUNT_MISMATCH',
        'SOURCE_PROGRAM_OUTSIDE_CRUISE',
        'SOURCE_EXCURSION_OUTSIDE_PORT_CALL',
      ].includes(err.code ?? '')) {
        const message = err.code === 'DEPARTURE_OUTSIDE_TRIP_WINDOW'
          ? err.message
          : departureScheduleErrorMessage(err, activeSource?.durationDays, activeSource?.durationNights)
        setErrors(current => ({ ...current, departureDatetime: message }))
      } else {
        setApplyScheduleError(err instanceof Error ? err.message : 'Không tải được lịch trình theo ngày giờ này.')
      }
    } finally {
      if (scheduleRequest.current === request) {
        scheduleRequest.current = null
        setApplyingSchedule(false)
      }
    }
  }, [sourceId, draft.departureDatetime, scheduleKey, activeSource, outsideDepartureWindow])

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
  const newDraftChanged = !editing && Boolean(
    sourceId !== initialSourceId || shipEdited || passengerInput || dateFieldsIncomplete || (draft.plannedScope ?? EMPTY_DRAFT.plannedScope) !== EMPTY_DRAFT.plannedScope ||
    Object.entries(EMPTY_DRAFT).some(([key, value]) => draft[key as keyof CruiseDraft] !== value),
  )
  const existingDraftChanged = Boolean(editing && storedCruise && loadedId === cruiseId && (draft.cruiseName !== storedCruise.cruiseName || draft.shipId !== storedCruise.shipId || draft.departureDatetime !== localCruiseInput(storedCruise.departureDatetime) || draft.returnDatetime !== localCruiseInput(storedCruise.returnDatetime) || draft.departurePortId !== storedCruise.departurePortId || draft.returnPortId !== storedCruise.returnPortId || draft.plannedScope !== (storedCruise.plannedScope ?? undefined) || draft.itineraryMode !== storedCruise.itineraryMode))
  const guard = useUnsavedFormGuard(newDraftChanged || existingDraftChanged, busy, (current, next) => current.pathname !== next.pathname)
  const submitLock = useRef(false)
  const passengerCount = Number(passengerInput)
  const validPassengerCount = /^[0-9]+$/.test(passengerInput) && Number.isInteger(passengerCount) && passengerCount > 0 && passengerCount <= 2147483647
  const eligibilityKey = !editing && canChooseInitialShip && !uncertain && sourceId && validPassengerCount &&
    appliedPreview === scheduleKey && previewRevision != null && previewScheduleData ? JSON.stringify([scheduleKey, previewRevision, passengerCount]) : ''
  const eligible = useReadQuery('cruise-eligible-ships:' + eligibilityKey, useCallback(
    signal => eligibilityKey && sourceId && previewRevision != null
      ? cruiseApi.eligibleShips(sourceId, previewRevision, draft.departureDatetime, passengerCount, signal)
      : Promise.resolve(null),
    [eligibilityKey, sourceId, previewRevision, draft.departureDatetime, passengerCount]))
  const suitableShips = eligibilityKey && eligible.data?.expectedPassengerCount === passengerCount &&
    eligible.data?.sourceVersionId === sourceId && eligible.data?.sourceVersionRevision === previewRevision &&
    Date.parse(eligible.data.departureDatetime) === scheduleInstant(draft.departureDatetime).getTime() ? eligible.data.ships : []
  const canSave = !outsideDepartureWindow && (!sourceId || appliedPreview === JSON.stringify([sourceId, draft.departureDatetime]) && previewRevision != null && source.data?.revision === previewRevision) && (editing || Boolean(sourceId)) && (editing || !canChooseInitialShip || suitableShips.some(ship => ship.shipId === draft.shipId)) && !uncertain && !invalidSource && createIntent.owner === (access.userId ?? '') && (!sourceId || !source.loading && !source.error && source.data?.versionId === sourceId) && !portsLoading && !portsError && access.canDo(editing ? 'CRUISE_UPDATE_DRAFT' : 'CRUISE_CREATE') && (!editing || (loadedId === cruiseId && currentStatus === 'DRAFT'))

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
  const selectedShip = suitableShips.find(ship => ship.shipId === draft.shipId)
  const normalizedShipQuery = normalizeShipSearch(shipSearch)
  const filteredSuitableShips = normalizedShipQuery
    ? suitableShips.filter(ship =>
        normalizeShipSearch(`${ship.shipName ?? ''} ${ship.shipCode ?? ''}`).includes(normalizedShipQuery),
      )
    : suitableShips

  useEffect(() => {
    if (editing || !sourceId || !draft.departureDatetime || invalidSource) return
    void loadSchedule(true)
  }, [editing, sourceId, draft.departureDatetime, invalidSource, loadSchedule])

  function update<K extends keyof CruiseDraft>(key: K, value: CruiseDraft[K]) {
    if (key === 'departureDatetime' && value !== draft.departureDatetime) {
      scheduleRequest.current?.abort()
      setPreviewSchedule(null)
      setAppliedPreview('')
      setPreviewRevision(null)
      setApplyScheduleError('')
      setSubmitError('')
      if (!hasSubmitted) {
        setErrors(current => {
          if (!current.departureDatetime) return current
          const nextErrors = { ...current }
          delete nextErrors.departureDatetime
          return nextErrors
        })
      }
    }
    if (key === 'shipId' && value !== draft.shipId) {
      setShipEdited(true)
      setApplyScheduleError('')
      setSubmitError('')
    }
    if (key === 'cruiseName') setNameEdited(true)
    let next: CruiseDraft = { ...draft, cruiseName: displayName, ...(!editing && key === 'departureDatetime' && value !== draft.departureDatetime ? {shipId:null} : {}), [key]: value }
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
    setDraft(old => ({ ...old, cruiseName: nameEdited ? old.cruiseName : name ?? '', shipId: null, departureDatetime: '', returnDatetime: '', departurePortId: '', returnPortId: '' }))
    setErrors({}); setSubmitError('')
    setDateFieldsIncomplete(false)
    setDateFieldsGeneration(generation => generation + 1)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveDraft()
  }
  async function saveDraft(replay = false) {
    const mayReplay = !editing && replay && createIntent.record?.status === 'unknown' && !createIntent.storageError && createIntent.owner === (access.userId ?? '') && access.canDo('CRUISE_CREATE')
    if (submitLock.current || (!canSave && !mayReplay)) return
    if (editing && storedCruise && !storedCruise.sourceVersionId && !storedCruise.sourceTripId && !['DOMESTIC', 'INTERNATIONAL'].includes(draft.plannedScope ?? '')) { setSubmitError('Chọn phạm vi hành trình trước khi lưu chuyến khởi hành nhập trực tiếp.'); return }
    const input = mayReplay ? createIntent.record!.payload : { ...draft, cruiseName: displayName, ...(!editing && sourceId && source.data ? { itineraryMode: draft.itineraryMode || ('FIXED' as const), sourceVersionId: sourceId, expectedSourceVersionRevision: previewRevision, creationPayloadVersion: canChooseInitialShip ? 3 as const : 2 as const, ...(canChooseInitialShip ? {expectedPassengerCount:passengerCount} : {}), cruiseType: source.data.durationDays === 1 ? 'ONE_DAY' as const : 'MULTI_DAYS' as const } : {}) }
    if (!editing && !mayReplay && canChooseInitialShip && (eligible.loading || eligible.error || !suitableShips.some(ship => ship.shipId === input.shipId))) { setSubmitError('Nhập số khách dự kiến và chọn tàu đủ chỗ, còn lịch trống.'); return }
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
      if (error instanceof ApiError && ['DEPARTURE_OUTSIDE_TRIP_WINDOW', 'SOURCE_DURATION_INVALID', 'DRAFT_ITINERARY_DAY_COUNT_MISMATCH'].includes(error.code ?? '')) {
        const message = error.code === 'DEPARTURE_OUTSIDE_TRIP_WINDOW'
          ? error.message
          : departureScheduleErrorMessage(error, activeSource?.durationDays ?? (storedCruise?.cruiseType === 'ONE_DAY' ? 1 : null), activeSource?.durationNights)
        setErrors(current => ({ ...current, departureDatetime: message }))
        return
      }
      if (error instanceof ApiError && ['INVALID_SCHEDULE', 'SHIP_SCHEDULE_CONFLICT'].includes(error.code ?? '')) setErrors(current => ({ ...current, returnDatetime: error.code === 'SHIP_SCHEDULE_CONFLICT' ? 'Thời gian này trùng lịch của tàu đã phân công.' : 'Kiểm tra ngày giờ khởi hành và kết thúc.' }))
      if (!(error instanceof ApiError && error.code === 'STALE_REVISION')) setSubmitError(error instanceof Error ? error.message : 'Không lưu được chuyến khởi hành.')
      if (error instanceof ApiError && ['SHIP_CAPACITY_INSUFFICIENT','SHIP_SCHEDULE_CONFLICT','SHIP_NOT_ACTIVE'].includes(error.code ?? '') && !editing) {
        const reason = error.code === 'SHIP_CAPACITY_INSUFFICIENT' ? 'Tàu không còn đủ chỗ cho số khách dự kiến.'
          : error.code === 'SHIP_SCHEDULE_CONFLICT' ? 'Tàu vừa có chuyến trùng lịch.' : 'Tàu không còn sẵn sàng.'
        setDraft(current => ({...current, shipId:null}))
        setErrors(current => ({...current, shipId:reason}))
        setSubmitError(reason + ' Chọn tàu khác trong danh sách mới.')
        eligible.retry()
      }
      if (error instanceof ApiError && ['EXCURSION_DESTINATION_NOT_PLANNED', 'EXCURSION_DESTINATION_NOT_SERVED'].includes(error.code ?? '')) {
        setSubmitError('Có tour bờ chưa gắn với điểm tham quan phù hợp của lần ghé. Về mẫu lịch trình để kiểm tra điểm tham quan và tour bờ.')
      }
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  if (loading) return <CruiseFrame><Loading label="Đang tải chuyến khởi hành…" /></CruiseFrame>

  const windowBounds = source.data ? departureWindowInputs(source.data) : { earliestDeparture: '', latestDeparture: '' }
  const hasDepartureWindow = Boolean(windowBounds.earliestDeparture && windowBounds.latestDeparture)
  const windowStatus = !hasDepartureWindow
    ? 'flexible'
    : !draft.departureDatetime
      ? 'required'
      : outsideDepartureWindow
        ? 'outside'
        : 'valid'

  function applySuggestedDeparture(wallValue: string) {
    if (!wallValue) return
    update('departureDatetime', wallValue)
    setDateFieldsIncomplete(false)
    setDateFieldsGeneration(generation => generation + 1)
  }

  function nearestAllowedDeparture() {
    if (!hasDepartureWindow) return ''
    const fallbackDate = localCruiseInput(new Date().toISOString()).split('T')[0]
    const [datePart, timePart] = draft.departureDatetime ? draft.departureDatetime.split('T') : [fallbackDate, '']
    const baseDate = datePart || fallbackDate
    if (!timePart) return `${baseDate}T${windowBounds.earliestDeparture}`
    try {
      const currentMinute = parseDepartureMinute(timePart.slice(0, 5))
      const targetClock = currentMinute > parseDepartureMinute(windowBounds.latestDeparture)
        ? windowBounds.latestDeparture
        : windowBounds.earliestDeparture
      return `${baseDate}T${targetClock}`
    } catch {
      return `${baseDate}T${windowBounds.earliestDeparture}`
    }
  }

  function returnToSelectedSchedule() {
    if (!source.data) return
    const target = '/admin/trips/' + encodeURIComponent(source.data.tripId) + '/schedule?' + new URLSearchParams({
      versionId: source.data.versionId,
      returnTo: '/admin/cruises/new?sourceVersionId=' + source.data.versionId,
    }).toString()
    guard.allowLeave()
    navigate(target, {
      state: access.userId ? {
        cruiseCreationDraft: {
          owner: access.userId,
          sourceVersionId: source.data.versionId,
          draft: { ...draft, cruiseName: displayName, expectedPassengerCount: validPassengerCount ? passengerCount : null },
          nameEdited,
          appliedPreview,
          previewRevision,
        },
      } : undefined,
    })
  }

  return <CruiseFrame>
    <div className={styles.content}>
      {uncertain && <Notice title={createIntent.record?.status === 'succeeded' ? 'Đã tạo chuyến khởi hành' : editing ? 'Chưa xác nhận được thay đổi' : 'Chưa rõ chuyến khởi hành đã được tạo hay chưa'} tone="warning">
        {createIntent.record?.status !== 'succeeded' && <p>{editing ? 'Mở lại chuyến khởi hành để kiểm tra thông tin đã lưu.' : 'Thông tin bạn đã nhập vẫn ở đây. Kiểm tra Danh sách chuyến khởi hành trước khi thử lại.'}</p>}
        <ButtonLink tone="secondary" to={createIntent.record?.cruiseId ? '/admin/cruises/' + createIntent.record.cruiseId : editing ? '/admin/cruises/' + cruiseId : '/admin/cruises'}>
          {createIntent.record?.status === 'succeeded' && createIntent.record.cruiseId ? 'Mở chuyến vừa tạo' : editing ? 'Mở chi tiết chuyến' : 'Mở Danh sách chuyến khởi hành'}
        </ButtonLink>
        {!editing && createIntent.record?.status === 'unknown' && access.canDo('CRUISE_CREATE') && <Button disabled={busy || createIntent.storageError} onClick={() => void saveDraft(true)}>Thử tạo lại</Button>}
        {!editing && createIntent.record?.status === 'succeeded' && <Button disabled={busy} onClick={() => {
          if (createIntent.startNew()) {
            setDraft(EMPTY_DRAFT); setDateFieldsGeneration(generation => generation + 1); setDateFieldsIncomplete(false); setNameEdited(false); setAppliedPreview(''); setPreviewRevision(null); setUncertain(false); setErrors({}); setSubmitError('')
          }
        }}>Tạo chuyến khởi hành khác</Button>}
      </Notice>}
      <PageHeader breadcrumb="" title={editing ? 'Chỉnh sửa chuyến khởi hành' : 'Tạo chuyến khởi hành'}
        actions={!editing && access.canDo('CRUISE_READ') && <ButtonLink tone="secondary" to="/admin/cruises">Về danh sách chuyến khởi hành</ButtonLink>} />
      {!editing && !sourceId && <DepartureSourcePicker value={sourceId} disabled={busy || uncertain} onChange={chooseSource} />}
      {changeSourceOpen && <Modal large title="Đổi lịch trình mẫu đã chọn" onClose={() => setChangeSourceOpen(false)} footer={<Button tone="secondary" onClick={() => setChangeSourceOpen(false)}>Đóng</Button>}>
        <DepartureSourcePicker value={sourceId} disabled={busy || uncertain} hidePreviewButton asPanel={false} onChange={(id, name) => { chooseSource(id, name); setChangeSourceOpen(false) }} />
      </Modal>}
      {invalidSource && <Notice title="Chưa chọn mẫu lịch trình" tone="error">Chọn mẫu ở trên để tiếp tục tạo chuyến khởi hành.</Notice>}
      {storedCruise && <CruiseSourceDetails cruise={storedCruise} />}
      {sourceId && source.loading && <Loading label="Đang tải mẫu lịch trình…" />}
      {sourceId && source.error && <Notice title="Chưa tải được mẫu lịch trình" tone="error">{source.error.message}<Button tone="secondary" onClick={source.retry}>Thử lại</Button><Button disabled={busy || uncertain} onClick={() => chooseSource('')}>Chọn mẫu khác</Button></Notice>}
      {!editing && sourceId && source.data && <EditorLayout><form className={styles.departureCreateForm} onSubmit={submit} noValidate>
        <fieldset disabled={busy || uncertain} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <FormErrorSummary errors={errors} />
          <div className={styles.departureCreateLayout}>
          <aside className={styles.departureCreateSource} aria-label="Mẫu dùng cho tour">
            <Panel className={styles.departureSourcePanel}>
              <InheritedSourcePlan
                source={source.data}
                disabled={busy || uncertain}
                onChangeSource={() => setChangeSourceOpen(true)}
              />
              <div className={styles.sourceWindowSummary}>
                <span>Khung giờ khởi hành</span>
                <strong>{hasDepartureWindow ? departureWindowLabel(source.data) : 'Linh hoạt · Không giới hạn khung giờ'}</strong>
              </div>
              {!previewScheduleData && <Button type="button" tone="secondary" fullWidth onClick={() => setScheduleDetailOpen(true)}>Xem lịch từng ngày</Button>}
            </Panel>
          </aside>
          <Panel className={styles.departureCreateMain}>
            <FormSection title="Ngày khởi hành và tên tour">
              {/* UX: Proximity & Error Prevention — surface allowed departure window right above date/time inputs */}
              <div className={`${styles.departureWindowBanner} ${styles[`departureWindow_${windowStatus}`]}`} role="region" aria-label="Khung giờ khởi hành cho phép">
                <div className={styles.departureWindowTop}>
                  <div className={styles.departureWindowHeading}>
                    <svg className={styles.windowIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    <strong>{hasDepartureWindow ? 'Khung giờ khởi hành cho phép (giờ Việt Nam)' : 'Khung giờ khởi hành linh hoạt'}</strong>
                  </div>
                  <Badge
                    tone={windowStatus === 'valid' ? 'success' : windowStatus === 'outside' ? 'error' : windowStatus === 'required' ? 'info' : 'neutral'}
                    label={
                      windowStatus === 'valid' ? 'Hợp lệ · Trong khung'
                        : windowStatus === 'outside' ? 'Ngoài khung cho phép'
                        : windowStatus === 'required' ? 'Bắt buộc trong khung'
                        : 'Không giới hạn khung giờ'
                    }
                  />
                </div>
                {hasDepartureWindow && (
                  <>
                    <dl className={styles.departureWindowRange}>
                      <div>
                        <dt>Sớm nhất</dt>
                        <dd>{windowBounds.earliestDeparture}</dd>
                      </div>
                      <div>
                        <dt>Trễ nhất</dt>
                        <dd>{windowBounds.latestDeparture}</dd>
                      </div>
                    </dl>
                    {(windowStatus === 'required' || windowStatus === 'outside') && (
                      <div className={styles.departureWindowActions}>
                        <span className={styles.muted}>
                          {windowStatus === 'outside'
                            ? 'Giờ khởi hành đã chọn nằm ngoài khung giờ cho phép của mẫu lịch trình.'
                            : 'Chọn giờ khởi hành trong khung trên hoặc điền nhanh giờ mở khung.'}
                        </span>
                        <Button type="button" tone="secondary" size="compact" autoWidth onClick={() => applySuggestedDeparture(nearestAllowedDeparture())}>
                          {windowStatus === 'outside' ? 'Đưa về giờ hợp lệ gần nhất' : 'Dùng giờ mở khung'}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <CruiseDateTimeFields key={`${dateFieldsGeneration}:${source.data.versionId}`} id="departure-time" label="khởi hành"
                value={draft.departureDatetime} error={departureWindowError ?? errors.departureDatetime}
                minClock={windowBounds.earliestDeparture || undefined}
                maxClock={windowBounds.latestDeparture || undefined}
                templateClock={hasDepartureWindow ? undefined : (source.data.days.find(day => day.dayNumber === 1)?.plannedDepartureTime ?? undefined)}
                onChange={value => update('departureDatetime', value)} onIncompleteChange={setDateFieldsIncomplete} />

              <div className={styles.fullWidthField}>
                <Field htmlFor="cruise-name" label="Tên chuyến khởi hành *" error={errors.cruiseName}>
                  <input id="cruise-name" value={displayName} aria-invalid={Boolean(errors.cruiseName)} onChange={event => update('cruiseName', event.target.value)} />
                </Field>
              </div>

              {source.data.days.find(day => day.dayNumber === 1)?.dayType === 'SEA_DAY' && !source.data.days.find(day => day.dayNumber === 1)?.departurePortId && (
                <Field
                  htmlFor="source-departure-port"
                  label="Cảng khởi hành *"
                  hint="Ngày 1 của mẫu lịch trình là ngày trên biển (chưa gắn cảng đi), vui lòng chọn cảng xuất phát thực tế."
                  error={errors.departurePortId}
                >
                  <select id="source-departure-port" disabled={portsLoading || Boolean(portsError)} value={draft.departurePortId} onChange={event => update('departurePortId', event.target.value)}>
                    <option value="">Chọn cảng khởi hành</option>
                    {portOptions.filter(port => port.status === 'ACTIVE').map(port => <option value={port.portId} key={port.portId}>{port.portName}</option>)}
                  </select>
                </Field>
              )}

              {applyingSchedule && <p role="status">Đang tính lịch trình dự kiến…</p>}
              {previewScheduleData && <div className={styles.departureTiming}>
                <RecordFacts entries={[
                  ['Khởi hành (giờ Việt Nam)', calendarLabel(draft.departureDatetime)],
                  ['Kết thúc dự kiến (giờ Việt Nam)', calendarLabel(previewScheduleData.returnDatetime ? localCruiseInput(previewScheduleData.returnDatetime) : '')],
                  ...(previewScheduleData.departurePortName
                    ? [['Cảng khởi hành', `${previewScheduleData.departurePortName} (Kế thừa từ mẫu lịch trình)`] as const]
                    : draft.departurePortId
                      ? [['Cảng khởi hành', portOptions.find(p => p.portId === draft.departurePortId)?.portName ?? 'Đã chọn thủ công'] as const]
                      : []),
                  ...(previewScheduleData.returnPortName
                    ? [['Cảng trở về', `${previewScheduleData.returnPortName} (Kế thừa từ mẫu lịch trình)`] as const]
                    : []),
                ]} />
                <Button type="button" disabled={applyingSchedule} onClick={handleOpenScheduleDetail}>Xem lịch theo ngày khởi hành</Button>
              </div>}
              {applyScheduleError && (
                <div className={styles.departureCheckError} role="alert">
                  <strong>{applyScheduleError}</strong>
                </div>
              )}
            </FormSection>
            {canChooseInitialShip && <FormSection title="Số khách và tàu">
                <Field htmlFor="departure-passengers" label="Số khách dự kiến *"
                  hint="Dùng để tìm tàu đủ chỗ và còn lịch trống."
                  error={passengerInput && !validPassengerCount ? 'Nhập số nguyên lớn hơn 0.' : undefined}>
                  <input id="departure-passengers" inputMode="numeric" required value={passengerInput} onChange={event => {
                    setPassengerInput(event.target.value)
                    if (draft.shipId) update('shipId', null)
                  }} />
                </Field>
                <div className={styles.shipPickerBlock}>
                  <Field htmlFor="departure-ship-search" label="Tàu cho chuyến *" error={errors.shipId}
                    hint={
                      !draft.departureDatetime || !validPassengerCount
                        ? 'Chọn ngày khởi hành và nhập số khách để tìm tàu theo tên.'
                        : suitableShips.length > 0
                          ? `Có ${suitableShips.length} tàu đủ chỗ và trống lịch. Nhập tên hoặc mã tàu để lọc nhanh.`
                          : undefined
                    }>
                    <input
                      id="departure-ship-search"
                      type="search"
                      autoComplete="off"
                      placeholder={!draft.departureDatetime ? 'Chọn ngày và giờ khởi hành trước' : !validPassengerCount ? 'Nhập số khách trước' : 'Tìm theo tên hoặc mã tàu…'}
                      value={shipSearch}
                      disabled={eligible.loading || Boolean(eligible.error) || !suitableShips.length}
                      aria-invalid={Boolean(errors.shipId)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') event.preventDefault()
                      }}
                      onChange={event => setShipSearch(event.target.value)}
                    />
                  </Field>
                  {suitableShips.length > 0 && !eligible.loading && !eligible.error && (
                    <div className={styles.shipPickerPanel}>
                      <div className={styles.shipPickerMeta}>
                        <span>
                          Hiển thị {filteredSuitableShips.length} / {suitableShips.length} tàu phù hợp
                        </span>
                        {shipSearch.trim() && (
                          <Button type="button" tone="text" size="compact" autoWidth onClick={() => setShipSearch('')}>
                            Xóa từ khóa
                          </Button>
                        )}
                      </div>
                      {filteredSuitableShips.length > 0 ? (
                        <div className={styles.shipPickerList} role="radiogroup" aria-label="Danh sách tàu phù hợp">
                          {filteredSuitableShips.map(ship => {
                            const isSelected = selectedShip?.shipId === ship.shipId
                            const shipTitle = ship.shipName?.trim() || ship.shipCode || 'Tàu chưa đặt tên'
                            return (
                              <button
                                key={ship.shipId}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                className={`${styles.shipPickerOption} ${isSelected ? styles.shipPickerOptionSelected : ''}`.trim()}
                                onClick={() => update('shipId', ship.shipId)}
                              >
                                <span className={styles.shipPickerOptionMain}>
                                  <strong>{shipTitle}</strong>
                                  <small>
                                    {ship.shipCode ? `${ship.shipCode} · ` : ''}
                                    {ship.totalCapacity} chỗ · {shipStatusLabel(ship.status)}
                                  </small>
                                </span>
                                {isSelected && <Badge tone="success" label="Đã chọn" />}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <p className={styles.shipPickerEmpty} role="status">
                          Không tìm thấy tàu nào khớp &ldquo;{shipSearch.trim()}&rdquo;.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {eligibilityKey && eligible.data && !eligible.loading && !eligible.error && !suitableShips.length &&
                  <p className={styles.departureScheduleFull} role="status">Không có tàu đủ chỗ và còn lịch trống.</p>}
                {selectedShip && (
                  <div className={styles.departureScheduleFull}>
                    <RecordFacts entries={[
                      ['Tàu đã chọn', selectedShip.shipName?.trim() || selectedShip.shipCode],
                      ['Sức chứa tối đa', `${selectedShip.totalCapacity} khách`],
                      ['Trạng thái tàu', shipStatusLabel(selectedShip.status)],
                    ]} />
                  </div>
                )}
                {selectedShip && access.canDo('CRUISE_CREATE') && !eligible.loading && !eligible.error && <ShipPackageSuggestions key={selectedShip.shipId} shipId={selectedShip.shipId} />}
                {eligibilityKey && eligible.loading && <Loading label="Đang tìm tàu phù hợp…" />}
                {eligibilityKey && eligible.error && <div role="alert"><p>{eligible.error.message}</p><Button tone="secondary" onClick={eligible.retry}>Tải lại danh sách tàu</Button></div>}
            </FormSection>}
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
            {submitError && !uncertain && <div className={styles.departureCheckError} role="alert"><strong>Chưa tạo được chuyến khởi hành</strong><p>{submitError}</p></div>}
            <div className={styles.formActions}>
              {access.canDo('TRIP_READ') && <Button type="button" tone="secondary" disabled={busy} onClick={returnToSelectedSchedule}>Về lịch trình đã chọn</Button>}
              {access.canDo('CRUISE_CREATE') && <Button type="submit" tone="primary" value="draft" disabled={busy || !canSave}>{busy ? 'Đang tạo chuyến khởi hành…' : 'Tạo chuyến khởi hành'}</Button>}
            </div>
          </Panel>
          </div>
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
            <FormSection title="02 · Ngày và giờ">
              <CruiseDateTimeFields key={loadedId} id="departure-time" label="khởi hành" value={draft.departureDatetime} error={errors.departureDatetime} onChange={value => update('departureDatetime', value)} />
              {sourceEditing || sourceId
                ? <RecordFacts entries={[[ 'Kết thúc (giờ Việt Nam)', calendarLabel(draft.returnDatetime) ]]} />
                : <CruiseDateTimeFields key={loadedId + ':return'} id="return-time" label="kết thúc" value={draft.returnDatetime} error={errors.returnDatetime} onChange={value => update('returnDatetime', value)} />}
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
          {loadedId === cruiseId && currentStatus !== 'DRAFT' && <Notice title="Không thể sửa chuyến" tone="warning"><p>Chỉ chuyến khởi hành ở trạng thái Nháp mới được chỉnh sửa.</p></Notice>}
          {submitError && <Notice title="Chưa xác nhận được kết quả lưu" tone="error"><p>{submitError}</p>{cruiseId && <PermissionLink target="_blank" rel="noopener noreferrer" to={'/admin/cruises/' + encodeURIComponent(cruiseId)}>Xem bản đã lưu ở thẻ khác để đối chiếu</PermissionLink>}</Notice>}
          <div className={styles.formActions}>{access.canDo('CRUISE_UPDATE_DRAFT') && <Button type="submit" tone="primary" value="draft" disabled={busy || !canSave}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</Button>}<Button tone="secondary" disabled={busy} onClick={() => navigate(cruiseId ? `/admin/cruises/${cruiseId}` : '/admin/cruises')}>Hủy</Button></div>
        </Panel></fieldset>
      </form></EditorLayout>}
    </div>
    {guard.prompt}</CruiseFrame>
}
