import { EditorLayout } from '@/shared/ui'
import { FormErrorSummary, FormSection } from '@/shared/ui'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'

import { Button, ButtonLink, Field, JourneySteps, Loading, Notice, PageHeader, Panel } from '@/shared/ui'

import { CruiseFrame } from '../components/CruiseUI'
import { cruiseApi } from '../api/cruise-api'
import { cruiseCreateIntent } from '../model/create-intent'
import { readPublishedSource } from '../api/source-version'
import { CruiseSourceDetails } from '../components/CruiseSourceDetails'
import styles from '../components/Cruises.module.css'
import type { CruiseDraft, CruiseRecord, CruiseStatus, CruiseType, PortRecord } from '../model/cruise-record'
import { validateCruiseDraft, localCruiseInput, type CruiseFormErrors } from '../model/cruise-validation'

const EMPTY_DRAFT: CruiseDraft = {
  cruiseCode: '',
  cruiseName: '',
  cruiseType: '',
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
  const [createIntent] = useState(() => {
    let storage: Storage | undefined
    try { storage = window.sessionStorage } catch { storage = {getItem(){throw Error('Storage unavailable')},setItem(){throw Error('Storage unavailable')}} as unknown as Storage }
    return cruiseCreateIntent(access.userId ?? '', storage)
  })
  const [draft, setDraft] = useState<CruiseDraft>(() => !editing && createIntent.record ? structuredClone(createIntent.record.payload) : EMPTY_DRAFT)
  const [currentStatus, setCurrentStatus] = useState<CruiseStatus>('DRAFT')
  const [currentShip, setCurrentShip] = useState('Chưa phân công')
  const [loading, setLoading] = useState(editing)
  const [errors, setErrors] = useState<CruiseFormErrors>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uncertain,setUncertain]=useState(() => !editing && (createIntent.storageError || ['unknown','sending','succeeded'].includes(createIntent.record?.status ?? '')))
  const [params]=useSearchParams()
  const requestedSource=params.get('sourceVersionId')
  const invalidSource=!editing&&params.has('sourceVersionId')&&!requestedSource?.trim()
  const sourceId=editing?null:uncertain&&createIntent.record?createIntent.record.payload.sourceVersionId??null:requestedSource
  const source=useReadQuery('cruise-source:'+sourceId,useCallback(signal=>sourceId?readPublishedSource(sourceId,signal):Promise.resolve(null),[sourceId]))
  const [storedCruise,setStoredCruise]=useState<CruiseRecord|null>(null)
  const [ports, setPorts] = useState<PortRecord[]>([])
  const [portsPending, setPortsLoading] = useState(true)
  const [portsLoadedKey,setPortsLoadedKey]=useState('')
  const sourceTripId=sourceId?source.data?.tripId:undefined
  const portRequestKey=sourceId?'source:'+(sourceTripId??'pending'):'legacy'
  const portsLoading=portsPending||portsLoadedKey!==portRequestKey
  const [portsError, setPortsError] = useState('')
  const [portsAttempt, setPortsAttempt] = useState(0)
  const [detailError, setDetailError] = useState('')
  const [detailAttempt, setDetailAttempt] = useState(0)
  const [storedPorts, setStoredPorts] = useState<PortRecord[]>([])
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const submitLock = useRef(false)
  const canSave = !uncertain && !invalidSource && createIntent.owner===(access.userId??'') && (!sourceId||!source.loading&&!source.error&&source.data?.versionId===sourceId) && !portsLoading && !portsError && access.canDo(editing ? 'CRUISE_UPDATE_DRAFT' : 'CRUISE_CREATE') && (!editing || (loadedId === cruiseId && currentStatus === 'DRAFT'))

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
    if(invalidSource||sourceId&&!sourceTripId)return
    const controller = new AbortController()
    void cruiseApi.listPorts(controller.signal,sourceTripId).then((result) => {
      if (!controller.signal.aborted) { setPorts(result); setPortsLoadedKey(portRequestKey); setPortsLoading(false); setPortsError('') }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) { setPortsLoadedKey(portRequestKey); setPortsError(error instanceof Error ? error.message : 'Không tải được danh mục cảng.'); setPortsLoading(false) }
    })
    return () => controller.abort()
  }, [portsAttempt,sourceId,sourceTripId,portRequestKey,invalidSource])

  const portOptions = [...(portsLoadedKey===portRequestKey?ports:[]), ...storedPorts.filter((port,index,all) => port && !ports.some(item=>item.portId===port.portId) && all.findIndex(item=>item?.portId===port.portId)===index)]

  function update<K extends keyof CruiseDraft>(key: K, value: CruiseDraft[K]) {
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (hasSubmitted) {
      setErrors(validateCruiseDraft(next))
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextStep = !sourceId && (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'continue'
    await saveDraft(nextStep)
  }
  async function saveDraft(nextStep=false,replay=false) {
    const mayReplay=!editing&&replay&&createIntent.record?.status==='unknown'&&!createIntent.storageError&&createIntent.owner===(access.userId??'')&&access.canDo('CRUISE_CREATE')
    if (submitLock.current || (!canSave&&!mayReplay) || (nextStep && !access.canDo('ITINERARY_CREATE'))) return
    const input=mayReplay?createIntent.record!.payload:{...draft,...(!editing&&sourceId?{sourceVersionId:sourceId}:{})}
    setHasSubmitted(true)
    const nextErrors = validateCruiseDraft(input)
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
        ? await cruiseApi.updateCruise(cruiseId, input)
        : await createIntent.execute(input, cruiseApi.createCruise)
      if(!editing&&input.sourceVersionId&&saved.sourceVersionId!==input.sourceVersionId){setUncertain(true);setSubmitError('Hệ thống đã tạo bản ghi nhưng phản hồi chưa xác nhận đúng phiên bản nguồn. Mở bản ghi để đối chiếu trước khi thực hiện tiếp.');return}
      navigate(nextStep ? `/admin/itineraries/new?cruiseId=${encodeURIComponent(saved.cruiseId)}` : `/admin/cruises/${saved.cruiseId}`, { replace: !editing })
    } catch (error) {
      if(editing ? !(error instanceof ApiError)||error.status===0||error.status>=500 : createIntent.record?.status==='unknown'||createIntent.storageError)setUncertain(true)
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
      {uncertain&&<Notice title={createIntent.record?.status==='succeeded'?'Lần khởi hành đã được tạo':'Chưa xác định được kết quả lưu'} tone="warning"><p>{createIntent.record?.status==='succeeded'?'Mở bản ghi đã được hệ thống xác nhận.':'Bản nhập và mã thao tác cũ được giữ nguyên. Chưa có API tra cứu riêng kết quả thao tác.'}</p><ButtonLink tone="secondary" to={createIntent.record?.cruiseId?'/admin/cruises/'+createIntent.record.cruiseId:editing?'/admin/cruises/'+cruiseId:'/admin/cruises'}>Đối chiếu lần khởi hành</ButtonLink>{!editing&&createIntent.record?.status==='unknown'&&access.canDo('CRUISE_CREATE')&&<Button disabled={busy||createIntent.storageError} onClick={()=>void saveDraft(false,true)}>Gửi lại cùng yêu cầu</Button>}{!editing&&createIntent.record?.status==='succeeded'&&<Button disabled={busy} onClick={()=>{if(createIntent.startNew()){setDraft(EMPTY_DRAFT);setUncertain(false);setErrors({});setSubmitError('')}}}>Tạo lần khởi hành khác</Button>}</Notice>}
      <PageHeader breadcrumb="LẦN KHỞI HÀNH" title={editing ? 'Chỉnh sửa lần khởi hành' : 'Tạo lần khởi hành'} description={editing ? 'Chỉnh sửa dữ liệu chuyến. Phân công tàu được kiểm tra và xác nhận trong luồng riêng.' : 'Chọn thời gian và cảng đi, cảng kết thúc. Có thể phân công tàu sau khi lưu bản nháp.'} />
      <JourneySteps current={0} />
      {invalidSource&&<Notice title="Thiếu phiên bản nguồn" tone="error">Liên kết tạo đang thiếu định danh phiên bản. Mở lại đúng phiên bản lịch trình đã phát hành; không tự chuyển sang tạo trực tiếp.</Notice>}
      {storedCruise&&<CruiseSourceDetails cruise={storedCruise}/>}
      {sourceId&&<Panel title="Phiên bản lịch trình nguồn">{source.loading?<Loading label="Đang tải đúng phiên bản nguồn…"/>:source.error?<Notice title="Chưa xác nhận được phiên bản nguồn" tone="error">{source.error.message}<Button disabled={busy} onClick={source.retry}>Thử lại</Button></Notice>:source.data&&<><p>{source.data.tripName} · {source.data.tripCode} · Phiên bản {source.data.versionNumber} · Đã phát hành lịch trình</p><p>Chỉ liên kết nguồn. Hãy nhập đầy đủ ngày giờ và cảng bên dưới; chưa tự chuyển lịch trình nguồn sang lịch của lần khởi hành.</p></>}</Panel>}
      <EditorLayout guidance={[{title:"Thời gian và cảng",description:"Đối chiếu ngày giờ khởi hành, kết thúc và cảng đi/về."},{title:"Bản nháp chuyến đi",description:"Phân công tàu và lập lịch trình là các thao tác riêng sau khi lưu."}]}><form onSubmit={submit} noValidate>
        <fieldset disabled={busy||uncertain} style={{border:0,padding:0,margin:0,minWidth:0}}><Panel title="Thông tin chuyến">
          <FormErrorSummary errors={errors} />
          <div className={styles.journeyForm}><FormSection title="01 · Nhận diện chuyến đi">
            <Field htmlFor="cruise-name" label="Tên chuyến đi *" error={errors.cruiseName}><input id="cruise-name" value={draft.cruiseName} aria-invalid={Boolean(errors.cruiseName)} aria-describedby={errors.cruiseName ? 'cruise-name-hint' : undefined} onChange={(event) => update('cruiseName', event.target.value)} /></Field>
            <Field htmlFor="cruise-type-form" label="Thời lượng chuyến" error={errors.cruiseType}><select id="cruise-type-form" value={draft.cruiseType} onChange={(event) => update('cruiseType', event.target.value as CruiseType)}><option value="">Hệ thống xác định theo ngày giờ</option><option value="ONE_DAY">Một ngày</option><option value="MULTI_DAYS">Nhiều ngày</option></select></Field>
            </FormSection><Notice title="Thông tin cần có để lưu nháp">Hệ thống hiện yêu cầu ngày giờ và cảng đi/về ngay khi tạo chuyến. Hãy điền lịch thực tế bên dưới để tiếp tục lập tuyến tàu.</Notice>
            <FormSection title="02 · Thời gian"><Field htmlFor="departure-time" label="Khởi hành (giờ Việt Nam)" error={errors.departureDatetime}><input id="departure-time" type="datetime-local" value={draft.departureDatetime} aria-invalid={Boolean(errors.departureDatetime)} aria-describedby={errors.departureDatetime ? 'departure-time-hint' : undefined} onChange={(event) => update('departureDatetime', event.target.value)} /></Field>
            <Field htmlFor="return-time" label="Kết thúc (giờ Việt Nam)" error={errors.returnDatetime}><input id="return-time" type="datetime-local" value={draft.returnDatetime} aria-invalid={Boolean(errors.returnDatetime)} aria-describedby={errors.returnDatetime ? 'return-time-hint' : undefined} onChange={(event) => update('returnDatetime', event.target.value)} /></Field>

            </FormSection><FormSection title="03 · Cảng đi và về"><Field htmlFor="departure-port" label="Cảng khởi hành" error={errors.departurePortId}><select id="departure-port" disabled={busy || portsLoading || Boolean(portsError)} value={draft.departurePortId} aria-invalid={Boolean(errors.departurePortId)} aria-describedby={errors.departurePortId ? 'departure-port-hint' : undefined} onChange={(event) => update('departurePortId', event.target.value)}><option value="">Chọn cảng khởi hành</option>{portOptions.map(port => <option value={port.portId} key={port.portId}>{port.portName}{port.countryCode ? ` · ${port.countryCode}` : ''}{port.status !== 'ACTIVE' ? ' · Cảng đã lưu, không còn hoạt động' : ''}</option>)}</select></Field>
            <Field htmlFor="return-port" label="Cảng trở về" error={errors.returnPortId}><select id="return-port" disabled={busy || portsLoading || Boolean(portsError)} value={draft.returnPortId} aria-invalid={Boolean(errors.returnPortId)} aria-describedby={errors.returnPortId ? 'return-port-hint' : undefined} onChange={(event) => update('returnPortId', event.target.value)}><option value="">Chọn cảng trở về</option>{portOptions.map(port => <option value={port.portId} key={port.portId}>{port.portName}{port.countryCode ? ` · ${port.countryCode}` : ''}{port.status !== 'ACTIVE' ? ' · Cảng đã lưu, không còn hoạt động' : ''}</option>)}</select></Field>
            </FormSection>{editing && <p>Tàu hiện tại: {currentShip}</p>}
            <details className={styles.unavailableFields}><summary>Phạm vi và giới thiệu chuyến đi</summary><p>Phiên bản hiện tại chưa lưu được phạm vi trong/ngoài nước, miền, quốc gia và giới thiệu chuyến đi. Các thông tin này sẽ được bổ sung khi hệ thống hỗ trợ lưu đầy đủ.</p></details>
          </div>
          {portsLoading && !source.error && !invalidSource && <Loading label="Đang tải danh sách cảng…" />}
          {portsError && <Notice title="Không tải được danh sách cảng" tone="error"><p>{portsError}</p><Button type="button" tone="secondary" onClick={() => { setPortsLoading(true); setPortsError(''); setPortsAttempt(value=>value+1) }}>Tải lại danh sách cảng</Button></Notice>}
          {!portsLoading && !portsError && !ports.length && <Notice title="Chưa có cảng hoạt động" tone="warning">Cần tạo hoặc kích hoạt cảng trước khi lập chuyến mới.</Notice>}
          {detailError && <Notice title="Không tải được chuyến" tone="error"><p>{detailError}</p><Button type="button" tone="secondary" onClick={() => { setLoading(true); setDetailError(''); setDetailAttempt(value=>value+1) }}>Tải lại chuyến</Button></Notice>}
          {editing && loadedId === cruiseId && currentStatus !== 'DRAFT' && <Notice title="Không thể sửa chuyến" tone="warning"><p>Chỉ chuyến ở trạng thái DRAFT mới được chỉnh sửa.</p></Notice>}
          {submitError && <Notice title="Không lưu được chuyến đi" tone="error"><p>{submitError}</p></Notice>}
          {!access.canDo('ITINERARY_CREATE') && <p className={styles.muted}>Tài khoản chưa có quyền tạo lịch trình. Bạn vẫn có thể lưu nháp chuyến nếu được cấp quyền.</p>}
          <div className={styles.formActions}>{access.canDo(editing ? 'CRUISE_UPDATE_DRAFT' : 'CRUISE_CREATE') && <Button type="submit" tone="secondary" value="draft" disabled={busy || !canSave}>{busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu nháp'}</Button>}{!sourceId&&access.canDo('ITINERARY_CREATE') && <Button type="submit" value="continue" disabled={busy || !canSave || !access.canDo('ITINERARY_CREATE')}>Tiếp tục lập lịch trình</Button>}<Button tone="secondary" disabled={busy} onClick={() => navigate(editing && cruiseId ? `/admin/cruises/${cruiseId}` : '/admin/cruises')}>Hủy</Button></div>
        </Panel></fieldset>
      </form></EditorLayout>
    </div>
  </CruiseFrame>
}
