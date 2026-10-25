import { FormErrorSummary } from '@/shared/ui'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'

import { Button, Field, JourneySteps, Loading, Notice, PageHeader, Panel } from '@/shared/ui'

import { CruiseFrame } from '../components/CruiseUI'
import { cruiseApi } from '../api/cruise-api'
import styles from '../components/Cruises.module.css'
import type { CruiseDraft, CruiseStatus, CruiseType, PortRecord } from '../model/cruise-record'
import { validateCruiseDraft, localCruiseInput, type CruiseFormErrors } from '../model/cruise-validation'

const EMPTY_DRAFT: CruiseDraft = {
  cruiseCode: '',
  cruiseName: '',
  cruiseType: 'ONE_DAY',
  departureDatetime: '',
  returnDatetime: '',
  departurePortId: '',
  returnPortId: '',
}


export function CruiseFormPage() {
  const access = useSessionAccess()
  const { cruiseId } = useParams()
  const editing = Boolean(cruiseId)
  const navigate = useNavigate()
  const [draft, setDraft] = useState<CruiseDraft>(EMPTY_DRAFT)
  const [currentStatus, setCurrentStatus] = useState<CruiseStatus>('DRAFT')
  const [currentShip, setCurrentShip] = useState('Chưa phân công')
  const [loading, setLoading] = useState(editing)
  const [errors, setErrors] = useState<CruiseFormErrors>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ports, setPorts] = useState<PortRecord[]>([])
  const [portsLoading, setPortsLoading] = useState(true)
  const [portsError, setPortsError] = useState('')
  const [portsAttempt, setPortsAttempt] = useState(0)
  const [detailError, setDetailError] = useState('')
  const [detailAttempt, setDetailAttempt] = useState(0)
  const [storedPorts, setStoredPorts] = useState<PortRecord[]>([])
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const submitLock = useRef(false)
  const canSave = !portsLoading && !portsError && access.canDo(editing ? 'CRUISE_UPDATE_DRAFT' : 'CRUISE_CREATE') && (!editing || (loadedId === cruiseId && currentStatus === 'DRAFT'))

  useEffect(() => {
    if (!cruiseId) return
    const controller = new AbortController()
    void cruiseApi.getDetail(cruiseId, controller.signal).then((detail) => {
      if (controller.signal.aborted) return
      setDraft({
        cruiseCode: detail.cruise.cruiseCode,
        cruiseName: detail.cruise.cruiseName,
        cruiseType: detail.cruise.cruiseType,
        departureDatetime: localCruiseInput(detail.cruise.departureDatetime),
        returnDatetime: localCruiseInput(detail.cruise.returnDatetime),
        departurePortId: detail.cruise.departurePortId,
        returnPortId: detail.cruise.returnPortId,
      })
      setStoredPorts([detail.departurePort,detail.returnPort])
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
    const controller = new AbortController()
    void cruiseApi.listPorts(controller.signal).then((result) => {
      if (!controller.signal.aborted) { setPorts(result); setPortsLoading(false); setPortsError('') }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) { setPortsError(error instanceof Error ? error.message : 'Không tải được danh mục cảng.'); setPortsLoading(false) }
    })
    return () => controller.abort()
  }, [portsAttempt])

  const portOptions = [...ports, ...storedPorts.filter((port,index,all) => port && !ports.some(item=>item.portId===port.portId) && all.findIndex(item=>item?.portId===port.portId)===index)]

  function update<K extends keyof CruiseDraft>(key: K, value: CruiseDraft[K]) {
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (hasSubmitted) {
      setErrors(validateCruiseDraft(next))
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextStep = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'continue'
    if (submitLock.current || !canSave || (nextStep && !access.canDo('ITINERARY_CREATE'))) return
    setHasSubmitted(true)
    const nextErrors = validateCruiseDraft(draft)
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
        ? await cruiseApi.updateCruise(cruiseId, draft)
        : await cruiseApi.createCruise(draft)
      navigate(nextStep ? `/admin/itineraries/new?cruiseId=${encodeURIComponent(saved.cruiseId)}` : `/admin/cruises/${saved.cruiseId}`, { replace: !editing })
    } catch (error) {
      if (error instanceof ApiError && ['INVALID_SCHEDULE','SHIP_SCHEDULE_CONFLICT'].includes(error.code ?? '')) setErrors(current => ({ ...current, returnDatetime: error.code === 'SHIP_SCHEDULE_CONFLICT' ? 'Thời gian này trùng lịch của tàu đã phân công.' : 'Kiểm tra ngày giờ khởi hành và kết thúc.' }))
      setSubmitError(error instanceof Error ? error.message : 'Không lưu được chuyến đi.')
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  if (loading) return <CruiseFrame><Loading label="Đang tải chuyến đi…" /></CruiseFrame>

  return <CruiseFrame>
    <div className={styles.content}>
      <PageHeader breadcrumb="LẬP CHUYẾN ĐI" title={editing ? 'Chỉnh sửa chuyến đi' : 'Tạo chuyến đi'} description={editing ? 'Chỉnh sửa dữ liệu chuyến. Phân công tàu được kiểm tra và xác nhận trong luồng riêng.' : 'Chọn thời gian và cảng đi, cảng kết thúc. Có thể phân công tàu sau khi lưu bản nháp.'} />
      <JourneySteps current={0} />
      <form onSubmit={submit} noValidate>
        <Panel title="Thông tin chuyến">
          <FormErrorSummary errors={errors} />
          <div className={styles.journeyForm}>
            <Field htmlFor="cruise-name" label="Tên chuyến đi *" error={errors.cruiseName}><input id="cruise-name" value={draft.cruiseName} aria-invalid={Boolean(errors.cruiseName)} aria-describedby={errors.cruiseName ? 'cruise-name-hint' : undefined} onChange={(event) => update('cruiseName', event.target.value)} /></Field>
            <Field htmlFor="cruise-type-form" label="Thời lượng chuyến *" error={errors.cruiseType}><select id="cruise-type-form" value={draft.cruiseType} onChange={(event) => update('cruiseType', event.target.value as CruiseType)}><option value="ONE_DAY">Chuyến ngắn ngày (1–2 ngày)</option><option value="MULTI_DAYS">Chuyến dài ngày (3–5 ngày)</option></select></Field>
            <Notice title="Thông tin cần có để lưu nháp">Hệ thống hiện yêu cầu ngày giờ và cảng đi/về ngay khi tạo chuyến. Hãy điền lịch thực tế bên dưới để tiếp tục lập tuyến tàu.</Notice>
            <Field htmlFor="departure-time" label="Khởi hành (giờ Việt Nam)" error={errors.departureDatetime}><input id="departure-time" type="datetime-local" value={draft.departureDatetime} aria-invalid={Boolean(errors.departureDatetime)} aria-describedby={errors.departureDatetime ? 'departure-time-hint' : undefined} onChange={(event) => update('departureDatetime', event.target.value)} /></Field>
            <Field htmlFor="return-time" label="Kết thúc (giờ Việt Nam)" error={errors.returnDatetime}><input id="return-time" type="datetime-local" value={draft.returnDatetime} aria-invalid={Boolean(errors.returnDatetime)} aria-describedby={errors.returnDatetime ? 'return-time-hint' : undefined} onChange={(event) => update('returnDatetime', event.target.value)} /></Field>

            <Field htmlFor="departure-port" label="Cảng khởi hành" error={errors.departurePortId}><select id="departure-port" disabled={busy || portsLoading || Boolean(portsError)} value={draft.departurePortId} aria-invalid={Boolean(errors.departurePortId)} aria-describedby={errors.departurePortId ? 'departure-port-hint' : undefined} onChange={(event) => update('departurePortId', event.target.value)}><option value="">Chọn cảng khởi hành</option>{portOptions.map(port => <option value={port.portId} key={port.portId}>{port.portName}{port.countryCode ? ` · ${port.countryCode}` : ''}{port.status !== 'ACTIVE' ? ' · Cảng đã lưu, không còn hoạt động' : ''}</option>)}</select></Field>
            <Field htmlFor="return-port" label="Cảng trở về" error={errors.returnPortId}><select id="return-port" disabled={busy || portsLoading || Boolean(portsError)} value={draft.returnPortId} aria-invalid={Boolean(errors.returnPortId)} aria-describedby={errors.returnPortId ? 'return-port-hint' : undefined} onChange={(event) => update('returnPortId', event.target.value)}><option value="">Chọn cảng trở về</option>{portOptions.map(port => <option value={port.portId} key={port.portId}>{port.portName}{port.countryCode ? ` · ${port.countryCode}` : ''}{port.status !== 'ACTIVE' ? ' · Cảng đã lưu, không còn hoạt động' : ''}</option>)}</select></Field>
            {editing && <p>Tàu hiện tại: {currentShip}</p>}
            <details className={styles.unavailableFields}><summary>Phạm vi và giới thiệu chuyến đi</summary><p>Phiên bản hiện tại chưa lưu được phạm vi trong/ngoài nước, miền, quốc gia và giới thiệu chuyến đi. Các thông tin này sẽ được bổ sung khi hệ thống hỗ trợ lưu đầy đủ.</p></details>
          </div>
          {portsLoading && <Loading label="Đang tải danh sách cảng…" />}
          {portsError && <Notice title="Không tải được danh sách cảng" tone="error"><p>{portsError}</p><Button type="button" tone="secondary" onClick={() => { setPortsLoading(true); setPortsError(''); setPortsAttempt(value=>value+1) }}>Tải lại danh sách cảng</Button></Notice>}
          {!portsLoading && !portsError && !ports.length && <Notice title="Chưa có cảng hoạt động" tone="warning">Cần tạo hoặc kích hoạt cảng trước khi lập chuyến mới.</Notice>}
          {detailError && <Notice title="Không tải được chuyến" tone="error"><p>{detailError}</p><Button type="button" tone="secondary" onClick={() => { setLoading(true); setDetailError(''); setDetailAttempt(value=>value+1) }}>Tải lại chuyến</Button></Notice>}
          {editing && loadedId === cruiseId && currentStatus !== 'DRAFT' && <Notice title="Không thể sửa chuyến" tone="warning"><p>Chỉ chuyến ở trạng thái DRAFT mới được chỉnh sửa.</p></Notice>}
          {submitError && <Notice title="Không lưu được chuyến đi" tone="error"><p>{submitError}</p></Notice>}
          {!access.canDo('ITINERARY_CREATE') && <p className={styles.muted}>Tài khoản chưa có quyền tạo lịch trình. Bạn vẫn có thể lưu nháp chuyến nếu được cấp quyền.</p>}
          <div className={styles.formActions}>{access.canDo(editing ? 'CRUISE_UPDATE_DRAFT' : 'CRUISE_CREATE') && <Button type="submit" tone="secondary" value="draft" disabled={busy || !canSave}>{busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu nháp'}</Button>}{access.canDo('ITINERARY_CREATE') && <Button type="submit" value="continue" disabled={busy || !canSave || !access.canDo('ITINERARY_CREATE')}>Tiếp tục lập lịch trình</Button>}<Button tone="secondary" disabled={busy} onClick={() => navigate(editing && cruiseId ? `/admin/cruises/${cruiseId}` : '/admin/cruises')}>Hủy</Button></div>
        </Panel>
      </form>
    </div>
  </CruiseFrame>
}
