import { businessCopy } from '@/shared/i18n/business-copy'
import { InheritedSourcePlan } from '../components/InheritedSourcePlan'
import { DepartureMilestones } from '../components/DepartureMilestones'
import { EditorLayout } from '@/shared/ui'
import { FormErrorSummary, FormSection,useUnsavedFormGuard } from '@/shared/ui'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router'
import { ApiError, useReadQuery } from '@/shared/api'
import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
import { useSessionAccess } from '@/shared/auth'

import { Badge, Button, ButtonLink, Field, Loading, Modal, Notice, PageHeader, Panel, PermissionLink } from '@/shared/ui'

import { CruiseFrame } from '../components/CruiseUI'
import { cruiseApi } from '../api/cruise-api'
import { creationReturn } from '../model/creation-return'
import { cruiseCreateIntent } from '../model/create-intent'
import { DepartureSourcePicker } from '../components/DepartureSourcePicker'
import { readPublishedSource, eligibleSources } from '../api/source-version'
import { departureApi } from '../api/departure-api'
import type { DepartureSchedule } from '../model/departure-contract'
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


function CreationLayout({sourceFlow,children}:{sourceFlow:boolean;children:ReactNode}){
 return sourceFlow?<div>{children}</div>:<EditorLayout >{children}</EditorLayout>
}
const calendarLabel=(value:string)=>{if(!value)return 'Chưa áp dụng lịch';const [date,time]=value.split('T');return date.split('-').reverse().join('/')+' · '+time}

export function CruiseFormPage() {
  const access = useSessionAccess()
  const { cruiseId } = useParams()
  const editing = Boolean(cruiseId)
  const eligibleSourcesQuery = useReadQuery('eligible-sources-all', useCallback(signal => eligibleSources('', 0, signal), []))
  const canChooseInitialShip=!editing&&access.roles.includes('CRUISE_MANAGER')&&access.canDo('CRUISE_ASSIGN_SHIP')&&access.canDo('SHIP_READ')
  const initialShips=useReadQuery(`create-departure-ships:${access.userId}:${canChooseInitialShip}`,useCallback(signal=>canChooseInitialShip?cruiseApi.listShips(signal):Promise.resolve([]),[canChooseInitialShip]))
  const navigate = useNavigate()
  const location=useLocation()
  const restored=!editing?creationReturn(location.state,access.userId,new URLSearchParams(location.search).get('sourceVersionId')):null
  const [createIntent] = useState(() => {
    let storage: Storage | undefined
    try { storage = window.sessionStorage } catch { storage = {getItem(){throw Error('Storage unavailable')},setItem(){throw Error('Storage unavailable')}} as unknown as Storage }
    const intent=cruiseCreateIntent(access.userId ?? '', storage)
    // A completed operation belongs to the previous creation. Entering this form
    // starts a new one; unresolved operations retain their payload/key for recovery.
    if(!editing&&intent.record?.status==='succeeded')intent.startNew()
    return intent
  })
  const [draft, setDraft] = useState<CruiseDraft>(() => !editing && createIntent.record ? structuredClone(createIntent.record.payload) : restored?.draft ?? EMPTY_DRAFT)
  const [currentStatus, setCurrentStatus] = useState<CruiseStatus>('DRAFT')
  const [currentShip, setCurrentShip] = useState('Chưa phân công')
  const [loading, setLoading] = useState(editing)
  const [errors, setErrors] = useState<CruiseFormErrors>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [nameEdited,setNameEdited]=useState(()=>Boolean(createIntent.record?.payload.cruiseName)||Boolean(restored?.nameEdited))
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [appliedPreview,setAppliedPreview]=useState(restored?.appliedPreview??'')
  const [applyingSchedule, setApplyingSchedule] = useState(false)
  const [applyScheduleError, setApplyScheduleError] = useState('')
  const [previewScheduleData, setPreviewScheduleData] = useState<DepartureSchedule | null>(null)
  const [scheduleDetailOpen, setScheduleDetailOpen] = useState(false)

  async function handleApplySchedule() {
    if (!draft.departureDatetime || !sourceId) {
      setApplyScheduleError('Vui lòng nhập ngày giờ khởi hành trước khi áp dụng.')
      return
    }
    setApplyingSchedule(true)
    setApplyScheduleError('')
    try {
      const instant = scheduleInstant(draft.departureDatetime).toISOString()
      const schedule = await departureApi.preview(sourceId, instant)
      setDraft(current => ({
        ...current,
        returnDatetime: schedule.returnDatetime ? localCruiseInput(schedule.returnDatetime) : current.returnDatetime,
        departurePortId: schedule.departurePortId ?? current.departurePortId,
        returnPortId: schedule.returnPortId ?? current.returnPortId
      }))
      setPreviewRevision(schedule.sourceVersionRevision)
      setAppliedPreview(JSON.stringify([sourceId, draft.departureDatetime]))
      setPreviewScheduleData(schedule)
    } catch (err) {
      setApplyScheduleError(err instanceof Error ? err.message : 'Không tính toán được lịch trình theo ngày giờ này.')
    } finally {
      setApplyingSchedule(false)
    }
  }

  async function handleOpenScheduleDetail() {
    if (previewScheduleData) {
      setScheduleDetailOpen(true)
      return
    }
    if (draft.departureDatetime && sourceId) {
      try {
        const instant = scheduleInstant(draft.departureDatetime).toISOString()
        const schedule = await departureApi.preview(sourceId, instant)
        setPreviewScheduleData(schedule)
        setScheduleDetailOpen(true)
      } catch (err) {
        setApplyScheduleError(err instanceof Error ? err.message : 'Không tải được chi tiết lịch trình.')
      }
    }
  }
  const [changeSourceOpen, setChangeSourceOpen] = useState(false)
  const [previewRevision,setPreviewRevision]=useState<number|null>(restored?.previewRevision??null)
  const [uncertain,setUncertain]=useState(() => !editing && (createIntent.storageError || ['unknown','sending','succeeded'].includes(createIntent.record?.status ?? '')))
  const [params,setParams]=useSearchParams()
  const requestedSource=params.get('sourceVersionId')
  const invalidSource=!editing&&params.has('sourceVersionId')&&!requestedSource?.trim()
  const sourceId=editing?null:uncertain&&createIntent.record?createIntent.record.payload.sourceVersionId??null:requestedSource
  const source=useReadQuery('cruise-source:'+sourceId,useCallback(signal=>sourceId?readPublishedSource(sourceId,signal):Promise.resolve(null),[sourceId]))
  const displayName=!editing&&sourceId&&source.data&&!nameEdited?source.data.tripName:draft.cruiseName
  const [storedCruise,setStoredCruise]=useState<CruiseRecord|null>(null)
  const sourceEditing=editing&&Boolean(storedCruise?.sourceVersionId)
  const [ports, setPorts] = useState<PortRecord[]>([])
  const [portsPending, setPortsLoading] = useState(true)
  const [portsLoadedKey,setPortsLoadedKey]=useState('')
  const sourceTripId=editing?(storedCruise&&storedCruise.cruiseId===cruiseId?storedCruise.sourceTripId??undefined:undefined):sourceId?source.data?.tripId:undefined
  const portRequestKey=editing&&storedCruise?.cruiseId!==cruiseId?'pending':sourceTripId?'source:'+sourceTripId:sourceId?'source:pending':'legacy'
  const portsLoading=portsPending||portsLoadedKey!==portRequestKey
  const [portsError, setPortsError] = useState('')
  const [portsAttempt, setPortsAttempt] = useState(0)
  const [detailError, setDetailError] = useState('')
  const [detailAttempt, setDetailAttempt] = useState(0)
  const [storedPorts, setStoredPorts] = useState<PortRecord[]>([])
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const newDraftChanged=!editing&&Boolean(sourceId||draft.shipId||Object.entries(EMPTY_DRAFT).some(([key,value])=>draft[key as keyof CruiseDraft]!==value))
  const existingDraftChanged=Boolean(editing&&storedCruise&&loadedId===cruiseId&&(draft.cruiseName!==storedCruise.cruiseName||draft.departureDatetime!==localCruiseInput(storedCruise.departureDatetime)||draft.returnDatetime!==localCruiseInput(storedCruise.returnDatetime)||draft.departurePortId!==storedCruise.departurePortId||draft.returnPortId!==storedCruise.returnPortId||draft.plannedScope!==(storedCruise.plannedScope??undefined)||draft.itineraryMode!==storedCruise.itineraryMode))
  const guard=useUnsavedFormGuard(newDraftChanged||existingDraftChanged,busy,(current,next)=>current.pathname!==next.pathname)
  const submitLock = useRef(false)
  const canSave = (!sourceId||appliedPreview===JSON.stringify([sourceId,draft.departureDatetime])&&previewRevision!=null&&source.data?.revision===previewRevision) && (editing||Boolean(sourceId)) && !uncertain && !invalidSource && createIntent.owner===(access.userId??'') && (!sourceId||!source.loading&&!source.error&&source.data?.versionId===sourceId) && !portsLoading && !portsError && access.canDo(editing ? 'CRUISE_UPDATE_DRAFT' : 'CRUISE_CREATE') && (!editing || (loadedId === cruiseId && currentStatus === 'DRAFT'))

  useEffect(() => {
    if (!cruiseId) return
    const controller = new AbortController()
    void cruiseApi.getDetail(cruiseId, controller.signal).then((detail) => {
      if (controller.signal.aborted) return
      setDraft({
        revision: detail.cruise.revision,
        plannedScope: detail.cruise.plannedScope??undefined,
        itineraryMode: detail.cruise.itineraryMode,
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
    if(!editing&&!sourceId||invalidSource||editing&&storedCruise?.cruiseId!==cruiseId||sourceId&&!sourceTripId)return
    const controller = new AbortController()
    void cruiseApi.listPorts(controller.signal,sourceTripId).then((result) => {
      if (!controller.signal.aborted) { setPorts(result); setPortsLoadedKey(portRequestKey); setPortsLoading(false); setPortsError('') }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) { setPortsLoadedKey(portRequestKey); setPortsError(error instanceof Error ? error.message : 'Không tải được danh mục cảng.'); setPortsLoading(false) }
    })
    return () => controller.abort()
  }, [portsAttempt,sourceId,sourceTripId,portRequestKey,invalidSource,editing,storedCruise,cruiseId])

  const portOptions = [...(portsLoadedKey===portRequestKey?ports:[]), ...(loadedId===cruiseId?storedPorts:[]).filter((port,index,all) => port && !ports.some(item=>item.portId===port.portId) && all.findIndex(item=>item?.portId===port.portId)===index)]

  function update<K extends keyof CruiseDraft>(key: K, value: CruiseDraft[K]) {
    if(key==='cruiseName')setNameEdited(true)
    const next = { ...draft,cruiseName:displayName, [key]: value }
    setDraft(next)
    if (hasSubmitted) {
      setErrors(validateCruiseDraft(next))
    }
  }

  function chooseSource(id:string,name?:string){
    const next=new URLSearchParams(params);next.delete('mode')
    if(id)next.set('sourceVersionId',id);else next.delete('sourceVersionId')
    setParams(next,{replace:true});setAppliedPreview('');setPreviewRevision(null)
    setDraft(old=>({...old,cruiseName:nameEdited?old.cruiseName:name??'',returnDatetime:'',departurePortId:'',returnPortId:''}))
    setErrors({});setSubmitError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveDraft()
  }
  async function saveDraft(replay=false) {
    const mayReplay=!editing&&replay&&createIntent.record?.status==='unknown'&&!createIntent.storageError&&createIntent.owner===(access.userId??'')&&access.canDo('CRUISE_CREATE')
    if (submitLock.current || (!canSave&&!mayReplay)) return
    if(editing&&storedCruise&&!storedCruise.sourceVersionId&&!storedCruise.sourceTripId&&!['DOMESTIC','INTERNATIONAL'].includes(draft.plannedScope??'')){setSubmitError('Chọn phạm vi hành trình trước khi lưu chuyến khởi hành nhập trực tiếp.');return}
    const input=mayReplay?createIntent.record!.payload:{...draft,cruiseName:displayName,...(!editing&&sourceId&&source.data?{sourceVersionId:sourceId,expectedSourceVersionRevision:previewRevision,creationPayloadVersion:2 as const,cruiseType:source.data.durationDays===1?'ONE_DAY' as const:'MULTI_DAYS' as const}:{})}
    if(!editing&&!mayReplay&&input.shipId&&(!canChooseInitialShip||initialShips.loading||initialShips.error||!initialShips.data?.some(ship=>ship.shipId===input.shipId&&['READY','IN_SERVICE'].includes(ship.status)))){setSubmitError('Chọn lại tàu đang sẵn sàng hoặc đang khai thác từ danh sách hiện tại, hoặc để phân công sau.');return}
    if(sourceEditing&&storedCruise&&(draft.departureDatetime!==localCruiseInput(storedCruise.departureDatetime)||draft.returnDatetime!==localCruiseInput(storedCruise.returnDatetime)||draft.departurePortId!==storedCruise.departurePortId||draft.returnPortId!==storedCruise.returnPortId)){setSubmitError('Thay đổi ngày hoặc cảng của lịch đã tạo cần được xử lý cùng các chương trình liên quan. Hiện chỉ lưu thông tin nhận diện tại đây.');return}
    setHasSubmitted(true)
    const nextErrors = validateCruiseDraft(input)
    if(!mayReplay&&!ports.some(port=>port.portId===input.departurePortId))nextErrors.departurePortId='Chọn lại cảng khởi hành phù hợp phạm vi hiện tại.'
    if(!mayReplay&&!ports.some(port=>port.portId===input.returnPortId))nextErrors.returnPortId='Chọn lại cảng kết thúc phù hợp phạm vi hiện tại.'
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
        ? await cruiseApi.updateCruise(cruiseId, input, storedCruise??undefined)
        : await createIntent.execute(input, cruiseApi.createCruise)
      if(!editing&&input.sourceVersionId&&saved.sourceVersionId!==input.sourceVersionId){setUncertain(true);setSubmitError('Hệ thống đã tạo bản ghi nhưng phản hồi chưa xác nhận đúng phiên bản nguồn. Mở bản ghi để đối chiếu trước khi thực hiện tiếp.');return}
      guard.allowLeave();navigate(`/admin/cruises/${saved.cruiseId}`, { replace: !editing })
    } catch (error) {
      if(editing ? mutationOutcomeUnknown(error) : createIntent.record?.status==='unknown'||createIntent.storageError)setUncertain(true)
      if(error instanceof ApiError&&error.code==='STALE_REVISION')setSubmitError('Chuyến khởi hành đã được người khác cập nhật. Nội dung bạn nhập vẫn được giữ. Mở bản đã lưu ở thẻ khác để đối chiếu trước khi chỉnh tiếp.');
      if (error instanceof ApiError && ['INVALID_SCHEDULE','SHIP_SCHEDULE_CONFLICT'].includes(error.code ?? '')) setErrors(current => ({ ...current, returnDatetime: error.code === 'SHIP_SCHEDULE_CONFLICT' ? 'Thời gian này trùng lịch của tàu đã phân công.' : 'Kiểm tra ngày giờ khởi hành và kết thúc.' }))
      if(!(error instanceof ApiError&&error.code==='STALE_REVISION'))setSubmitError(error instanceof Error ? error.message : 'Không lưu được chuyến khởi hành.')
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  if (loading) return <CruiseFrame><Loading label="Đang tải chuyến khởi hành…" /></CruiseFrame>

  return <CruiseFrame>
    <div className={styles.content}>
      {uncertain&&<Notice title={createIntent.record?.status==='succeeded'?'Chuyến khởi hành đã được tạo':'Chưa xác định được kết quả lưu'} tone="warning"><p>{createIntent.record?.status==='succeeded'?'Mở bản ghi đã được hệ thống xác nhận.':'Bản nhập và mã thao tác cũ được giữ nguyên. Chưa có API tra cứu riêng kết quả thao tác.'}</p><ButtonLink tone="secondary" to={createIntent.record?.cruiseId?'/admin/cruises/'+createIntent.record.cruiseId:editing?'/admin/cruises/'+cruiseId:'/admin/cruises'}>Đối chiếu chuyến khởi hành</ButtonLink>{!editing&&createIntent.record?.status==='unknown'&&access.canDo('CRUISE_CREATE')&&<Button disabled={busy||createIntent.storageError} onClick={()=>void saveDraft(true)}>Gửi lại cùng yêu cầu</Button>}{!editing&&createIntent.record?.status==='succeeded'&&<Button disabled={busy} onClick={()=>{if(createIntent.startNew()){setDraft(EMPTY_DRAFT);setNameEdited(false);setAppliedPreview('');setPreviewRevision(null);setUncertain(false);setErrors({});setSubmitError('')}}}>Tạo chuyến khởi hành khác</Button>}</Notice>}
      <PageHeader breadcrumb="" title={editing ? 'Chỉnh sửa chuyến khởi hành' : businessCopy('cruise.source.create')} description={editing ? undefined : 'Chọn lịch trình đã chốt và ngày tổ chức. Sau khi tạo, bạn tiếp tục chuẩn bị hồ sơ để gửi Quản lý vận hành.'} />
      {!editing&&<DepartureMilestones creating creationStep={!sourceId?1:appliedPreview===JSON.stringify([sourceId,draft.departureDatetime])?3:2}/>}
      {!editing&&!sourceId&&<DepartureSourcePicker value={sourceId} disabled={busy||uncertain} onChange={chooseSource}/>}
      {changeSourceOpen&&<Modal large title="Đổi lịch trình mẫu đã chọn" onClose={()=>setChangeSourceOpen(false)} footer={<Button tone="secondary" onClick={()=>setChangeSourceOpen(false)}>Đóng</Button>}>
        <DepartureSourcePicker value={sourceId} disabled={busy||uncertain} hidePreviewButton asPanel={false} onChange={(id,name)=>{chooseSource(id,name);setChangeSourceOpen(false)}}/>
      </Modal>}
      {invalidSource&&<Notice title="Thiếu phiên bản nguồn" tone="error">Liên kết tạo đang thiếu định danh phiên bản. Mở lại đúng phiên bản lịch trình đã phát hành; không tự chuyển sang tạo trực tiếp.</Notice>}
      {storedCruise&&<CruiseSourceDetails cruise={storedCruise}/>}
      {sourceId&&source.loading&&<Loading label="Đang đọc tuyến và chương trình đã phát hành…"/>}
      {sourceId&&source.error&&<Notice title="Chưa đọc được lịch trình nguồn" tone="error">{source.error.message}<Button tone="secondary" onClick={source.retry}>Tải lại</Button><Button disabled={busy||uncertain} onClick={()=>chooseSource('')}>Chọn lịch trình khác</Button></Notice>}
      {!editing&&sourceId&&source.data&&<CreationLayout sourceFlow={Boolean(sourceId)}><form onSubmit={submit} noValidate>
        <fieldset disabled={busy||uncertain} style={{border:0,padding:0,margin:0,minWidth:0}}>
          <FormErrorSummary errors={errors} />
          <div className={styles.sourceCreationGrid}>
            <InheritedSourcePlan source={source.data} disabled={busy||uncertain} onChangeSource={()=>setChangeSourceOpen(true)}/>
            <Panel title="Thiết lập chuyến khởi hành" className={styles.inheritedPlan}>
              <div className={styles.journeyForm} style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <div>
                  <Field htmlFor="cruise-name" label="Tên chuyến khởi hành *" error={errors.cruiseName}>
                    <input id="cruise-name" value={displayName} aria-invalid={Boolean(errors.cruiseName)} aria-describedby={errors.cruiseName ? 'cruise-name-hint' : undefined} onChange={(event) => update('cruiseName', event.target.value)} />
                  </Field>
                  <div style={{ marginTop: '16px' }}>
                    <Field htmlFor="itinerary-mode" label="Lịch trình chuyến khởi hành">
                      <select id="itinerary-mode" disabled={busy||uncertain} value={draft.itineraryMode??'FIXED'} onChange={e=>update('itineraryMode',e.target.value as 'FIXED'|'CUSTOM')}>
                        <option value="FIXED">{businessCopy('cruise.itinerary.FIXED')}</option>
                        <option value="CUSTOM">{businessCopy('cruise.itinerary.CUSTOM')}</option>
                      </select>
                    </Field>
                    <div style={{ marginTop: '8px', padding: '10px 14px', borderRadius: '8px', border: draft.itineraryMode === 'CUSTOM' ? '1px solid #0d9488' : '1px solid #cbd5e1', background: draft.itineraryMode === 'CUSTOM' ? '#f0fdfa' : '#f8fafc' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: draft.itineraryMode === 'CUSTOM' ? '#0f766e' : '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {draft.itineraryMode === 'CUSTOM' ? '✨ Chế độ Tùy chỉnh lịch trình' : '🔒 Chế độ Theo mẫu cố định'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', lineHeight: 1.5 }}>
                        {draft.itineraryMode === 'CUSTOM'
                          ? 'Sau khi tạo chuyến, hệ thống cho phép người quản lý thêm mới, sửa đổi hoặc xóa bớt hoạt động và tour tham quan trên bờ riêng cho chuyến này.'
                          : 'Kế thừa nguyên bản 100% khung chương trình và các điểm dừng ghé cảng từ lịch trình mẫu đã chốt, đảm bảo cố định tiêu chuẩn tour.'}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '13px', color: '#64748b' }}>
                    Thời lượng mẫu: <strong style={{ color: '#0f172a' }}>{source.data.durationDays} ngày · {source.data.durationNights} đêm</strong>
                  </div>
                </div>

                {canChooseInitialShip && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--ui-border, #e2e8f0)' }}>
                    <Field htmlFor="departure-initial-ship" label="Tàu phân công">
                      <select id="departure-initial-ship" value={draft.shipId??''} disabled={busy||uncertain||initialShips.loading||Boolean(initialShips.error)} onChange={event=>update('shipId',event.target.value||null)}>
                        <option value="">Chọn tàu phân công cho chuyến này</option>
                        {draft.shipId&&!initialShips.data?.some(ship=>ship.shipId===draft.shipId)&&<option value={draft.shipId}>Tàu đã chọn · cần tải lại để đối chiếu</option>}
                        {initialShips.data?.map(ship=><option key={ship.shipId} value={ship.shipId} disabled={!['READY','IN_SERVICE'].includes(ship.status)}>{ship.shipName} · {ship.shipCode} ({Number.isSafeInteger(ship.totalCapacity)&&ship.totalCapacity>=0?`${ship.totalCapacity} khách`:'Sức chứa chưa rõ'})</option>)}
                      </select>
                    </Field>
                    {initialShips.loading && <Loading label="Đang tải danh sách tàu…" />}
                    {initialShips.error && <Notice title="Chưa tải được danh sách tàu" tone="error"><p>{initialShips.error.message}</p><Button tone="secondary" onClick={initialShips.retry}>Tải lại tàu</Button></Notice>}
                    {!draft.shipId && <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>Chọn tàu để hiển thị thông số và sức chứa ở bảng bên dưới.</div>}
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* Bảng chi tiết tàu phân công khi người dùng chọn tàu */}
          {draft.shipId && initialShips.data?.some(ship => ship.shipId === draft.shipId) && (() => {
            const selectedShip = initialShips.data.find(ship => ship.shipId === draft.shipId)!
            return (
              <div style={{ marginTop: '20px', marginBottom: '24px' }}>
                <Panel title={`Thông tin chi tiết tàu phân công: ${selectedShip.shipName}`} className={styles.departureBottomPanel}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Mã tàu</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{selectedShip.shipCode}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Tên tàu</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{selectedShip.shipName}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Sức chứa hành khách</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#0d9488', marginTop: '2px' }}>
                      {Number.isSafeInteger(selectedShip.totalCapacity) && selectedShip.totalCapacity >= 0 ? `${selectedShip.totalCapacity} khách` : 'Chưa có thông tin'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Số tầng boong</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{selectedShip.totalDecks ?? 'Chưa xác định'} tầng</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Trạng thái vận hành</div>
                    <div style={{ marginTop: '2px' }}>
                      <Badge tone={['READY', 'IN_SERVICE'].includes(selectedShip.status) ? 'success' : 'warning'} label={({ DRAFT: 'Bản nháp', READY: 'Sẵn sàng', IN_SERVICE: 'Đang khai thác', MAINTENANCE: 'Bảo trì', SUSPENDED: 'Tạm ngừng', RETIRED: 'Ngừng khai thác' } as Record<string, string>)[selectedShip.status] ?? 'Chưa xác định'} />
                    </div>
                  </div>
                </div>

              </Panel>
              </div>
            )
          })()}

          <Panel title="Thời gian khởi hành & Chốt lịch trình thực tế" className={styles.departureBottomPanel}>
            {/* 1. Phần thông tin tóm tắt & Thay đổi lịch trình trực tiếp */}
            <div style={{ padding: '16px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  📋 Lộ trình & Lịch trình áp dụng
                </div>
                <Button type="button" tone="secondary" onClick={handleOpenScheduleDetail}>
                  👁 Xem chi tiết lịch trình
                </Button>
              </div>

              {/* Mục thay đổi lịch trình mẫu trực tiếp ngay tại đây */}
              <div style={{ marginBottom: '14px' }}>
                <Field htmlFor="source-change-dropdown" label="Thay đổi lịch trình mẫu">
                  <select
                    id="source-change-dropdown"
                    disabled={busy || uncertain || eligibleSourcesQuery.loading}
                    value={sourceId ?? ''}
                    onChange={e => {
                      const selected = eligibleSourcesQuery.data?.content.find(v => v.versionId === e.target.value)
                      chooseSource(e.target.value, selected?.tripName)
                    }}
                  >
                    <option value="">-- Chọn hoặc đổi sang lịch trình mẫu khác --</option>
                    {sourceId && !eligibleSourcesQuery.data?.content.some(v => v.versionId === sourceId) && (
                      <option value={sourceId}>{source.data.tripCode} · {source.data.tripName} · Phiên bản {source.data.versionNumber}</option>
                    )}
                    {eligibleSourcesQuery.data?.content.map(v => (
                      <option key={v.versionId} value={v.versionId}>
                        {v.tripCode} · {v.tripName} · Phiên bản {v.versionNumber} ({v.durationDays} ngày {v.durationNights ? `${v.durationNights} đêm` : ''})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', background: '#fff', padding: '12px 16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Tên chuyến đi</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{displayName || source.data.tripName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Thời lượng lộ trình</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{source.data.durationDays} ngày · {source.data.durationNights} đêm</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Cảng đón khách (Mẫu)</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                    {source.data.days.find(d => d.dayNumber === 1)?.departurePortName || source.data.stops.find(s => s.isEmbarkation)?.portName || 'Cảng khởi hành theo mẫu'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Cảng trả khách (Mẫu)</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                    {source.data.stops.find(s => s.isDisembarkation)?.portName || 'Cảng kết thúc theo mẫu'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Hình thức áp dụng</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: draft.itineraryMode === 'CUSTOM' ? '#0d9488' : '#0f172a', marginTop: '2px' }}>
                    {draft.itineraryMode === 'CUSTOM' ? 'Tùy chỉnh lịch trình' : 'Theo mẫu cố định'}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Phần thời gian cảng rời & chốt thời gian khởi hành thực tế */}
            <div style={{ padding: '16px 20px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '14px' }}>
                ⚓ Chốt thời gian cảng rời (Khởi hành thực tế)
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 320px', minWidth: '280px' }}>
                  <Field htmlFor="departure-time" label="Thời gian cảng rời (Giờ Việt Nam) *" hint="Nhập thời điểm tàu xuất bến thực tế để tính toán mốc đến cảng và ngày kết thúc." error={errors.departureDatetime}>
                    <input
                      id="departure-time"
                      disabled={sourceEditing}
                      type="datetime-local"
                      step="1"
                      value={draft.departureDatetime}
                      aria-invalid={Boolean(errors.departureDatetime)}
                      aria-describedby={errors.departureDatetime ? 'departure-time-hint' : undefined}
                      onChange={(event) => {
                        const value = event.target.value
                        const clock = source.data?.days.find(day => day.dayNumber === 1)?.plannedDepartureTime
                        update('departureDatetime', clock && value && value.slice(0, 10) !== draft.departureDatetime.slice(0, 10) ? `${value.slice(0, 10)}T${clock.slice(0, 8)}` : value)
                      }}
                    />
                  </Field>
                </div>

                <div style={{ marginTop: '24px' }}>
                  <Button
                    type="button"
                    tone={appliedPreview === JSON.stringify([sourceId, draft.departureDatetime]) ? 'secondary' : 'primary'}
                    disabled={busy || uncertain || Boolean(source.error) || !draft.departureDatetime || applyingSchedule}
                    onClick={handleApplySchedule}
                  >
                    {applyingSchedule ? 'Đang tính toán…' : appliedPreview === JSON.stringify([sourceId, draft.departureDatetime]) ? '✓ Đã chốt lịch trình' : '⚡ Áp dụng & Chốt lịch trình'}
                  </Button>
                </div>
              </div>

              {applyScheduleError && (
                <div style={{ marginTop: '12px' }}>
                  <Notice title="Chưa áp dụng được lịch trình" tone="error">
                    <p>{applyScheduleError}</p>
                  </Notice>
                </div>
              )}

              {source.data.days.find(day => day.dayNumber === 1)?.dayType === 'SEA_DAY' && !source.data.days.find(day => day.dayNumber === 1)?.departurePortId && (
                <div style={{ marginTop: '16px' }}>
                  <Field htmlFor="source-departure-port" label="Cảng xuất phát của chuyến khởi hành *" hint="Ngày đầu lịch trình ở trên biển. Cảng này là thông tin xuất phát của chuyến, không tạo lần ghé cảng trong ngày 1." error={errors.departurePortId}>
                    <select id="source-departure-port" disabled={busy || uncertain || portsLoading || Boolean(portsError)} value={draft.departurePortId} onChange={event => update('departurePortId', event.target.value)}>
                      <option value="">Chọn cảng xuất phát</option>
                      {portOptions.filter(port => port.status === 'ACTIVE').map(port => <option value={port.portId} key={port.portId}>{port.portName}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              {appliedPreview === JSON.stringify([sourceId, draft.departureDatetime]) ? (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', background: '#f0fdfa', padding: '14px 16px', borderRadius: '8px', border: '1px solid #ccfbf1' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#0f766e', fontWeight: 500 }}>Khởi hành thực tế</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{calendarLabel(draft.departureDatetime)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#0f766e', fontWeight: 500 }}>Kết thúc dự kiến</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#0d9488', marginTop: '2px' }}>{calendarLabel(draft.returnDatetime)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#0f766e', fontWeight: 500 }}>Cảng khởi hành thực tế</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{portOptions.find(p => p.portId === draft.departurePortId)?.portName || 'Theo lịch trình'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#0f766e', fontWeight: 500 }}>Cảng kết thúc thực tế</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{portOptions.find(p => p.portId === draft.returnPortId)?.portName || 'Theo lịch trình'}</div>
                    </div>
                  </div>
                </div>
              ) : draft.departureDatetime ? (
                <div style={{ marginTop: '14px', fontSize: '13px', color: '#64748b', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                  👉 Bấm <strong>"⚡ Áp dụng & Chốt lịch trình"</strong> để tính toán ngày kết thúc và áp dụng cảng xuất phát / kết thúc thực tế.
                </div>
              ) : null}
            </div>

            {scheduleDetailOpen && (
              <Modal
                large
                protectChanges={false}
                title={`Chi tiết lịch trình: ${source.data?.tripName}`}
                description={`Mã chuyến: ${source.data?.tripCode} · Thời lượng: ${source.data?.durationDays} ngày ${source.data?.durationNights ? `${source.data?.durationNights} đêm` : ''}`}
                onClose={() => setScheduleDetailOpen(false)}
                footer={<Button tone="secondary" onClick={() => setScheduleDetailOpen(false)}>Đóng</Button>}
              >
                <div style={{ minWidth: 0, padding: '4px 0' }}>
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
                    <div style={{ padding: '8px 0' }}>
                      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748b' }}>
                        Khung lịch trình mẫu kế thừa. Chọn thời gian khởi hành thực tế bên dưới và bấm "Áp dụng & Chốt lịch trình" để tính toán mốc giờ vận hành chính xác.
                      </p>
                      <TemplateSchedule days={source.data.days} stops={source.data.stops} entries={source.data.entries} />
                    </div>
                  )}
                </div>
              </Modal>
            )}
            
            {portsLoading && !source.error && !invalidSource && <Loading label="Đang tải danh sách cảng…" />}
            {portsError && <Notice title="Không tải được danh sách cảng" tone="error"><p>{portsError}</p><Button type="button" tone="secondary" onClick={() => { setPortsLoading(true); setPortsError(''); setPortsAttempt(value=>value+1) }}>Tải lại danh sách cảng</Button></Notice>}
            {!portsLoading && !portsError && !ports.length && <Notice title="Chưa có cảng hoạt động" tone="warning">Cần tạo hoặc kích hoạt cảng trước khi lập chuyến mới.</Notice>}
            {submitError && <Notice title="Chưa xác nhận được kết quả lưu" tone="error"><p>{submitError}</p></Notice>}
            <div className={styles.formActions}>
              {access.canDo('CRUISE_CREATE') && <Button type="submit" tone="primary" value="draft" disabled={busy || !canSave}>{busy ? 'Đang lưu…' : 'Tạo hồ sơ chuyến khởi hành'}</Button>}
              <Button tone="secondary" disabled={busy} onClick={() => navigate('/admin/cruises')}>Hủy</Button>
            </div>
          </Panel>
        </fieldset>
      </form></CreationLayout>}
      {editing&&<CreationLayout sourceFlow={false}><form onSubmit={submit} noValidate>
        <fieldset disabled={busy||uncertain} style={{border:0,padding:0,margin:0,minWidth:0}}><Panel title="Thông tin chuyến khởi hành">
          <FormErrorSummary errors={errors} />
          <div className={styles.journeyForm}><FormSection title="01 · Nhận diện chuyến khởi hành">
            <Field htmlFor="cruise-name" label="Tên chuyến khởi hành *" error={errors.cruiseName}><input id="cruise-name" value={displayName} aria-invalid={Boolean(errors.cruiseName)} aria-describedby={errors.cruiseName ? 'cruise-name-hint' : undefined} onChange={(event) => update('cruiseName', event.target.value)} /></Field>
            {!sourceEditing&&<Field htmlFor="cruise-type-form" label="Thời lượng chuyến" error={errors.cruiseType}><select id="cruise-type-form" value={draft.cruiseType} onChange={(event) => update('cruiseType', event.target.value as CruiseType)}><option value="">Hệ thống xác định theo ngày giờ</option><option value="ONE_DAY">Một ngày</option><option value="MULTI_DAYS">Nhiều ngày</option></select></Field>}
            {sourceEditing&&<p>Thời lượng được kế thừa từ lịch trình nguồn đã liên kết.</p>}
            {storedCruise&&!storedCruise.sourceVersionId&&!storedCruise.sourceTripId&&<>
              <Field htmlFor="legacy-scope" label="Phạm vi hành trình"><select id="legacy-scope" value={draft.plannedScope??''} onChange={e=>update('plannedScope',e.target.value as 'DOMESTIC'|'INTERNATIONAL')} required><option value="">Chọn phạm vi</option><option value="DOMESTIC">Nội địa</option><option value="INTERNATIONAL">Quốc tế</option></select></Field>
              <Field htmlFor="legacy-mode" label="Chỉnh sửa lịch trình"><select id="legacy-mode" value={draft.itineraryMode??'FIXED'} onChange={e=>update('itineraryMode',e.target.value as 'FIXED'|'CUSTOM')}><option value="FIXED">Giữ cố định lịch trình hiện có</option><option value="CUSTOM">Cho phép chỉnh sửa lịch trình</option></select></Field>
            </>}
            </FormSection>
            {sourceEditing&&<Notice title="Lịch đã được tạo từ nguồn" tone="warning">Hiện chỉ sửa thông tin nhận diện. Đổi ngày hoặc cảng cần xử lý cùng lịch và chương trình liên quan.</Notice>}
            <FormSection title="02 · Thời gian"><Field htmlFor="departure-time" label="Khởi hành (giờ Việt Nam)" error={errors.departureDatetime}><input id="departure-time" disabled={sourceEditing} type="datetime-local" step="1" value={draft.departureDatetime} aria-invalid={Boolean(errors.departureDatetime)} aria-describedby={errors.departureDatetime ? 'departure-time-hint' : undefined} onChange={(event) => update('departureDatetime', event.target.value)} /></Field>
            <Field htmlFor="return-time" label="Kết thúc (giờ Việt Nam)" error={errors.returnDatetime}><input id="return-time" disabled={sourceEditing||Boolean(sourceId)} type="datetime-local" value={draft.returnDatetime} aria-invalid={Boolean(errors.returnDatetime)} aria-describedby={errors.returnDatetime ? 'return-time-hint' : undefined} onChange={(event) => update('returnDatetime', event.target.value)} /></Field>
            </FormSection>
            {!sourceEditing&&<FormSection title="03 · Cảng đi và về"><Field htmlFor="departure-port" label="Cảng khởi hành" error={errors.departurePortId}><select id="departure-port" disabled={busy || sourceEditing || portsLoading || Boolean(portsError)} value={draft.departurePortId} aria-invalid={Boolean(errors.departurePortId)} aria-describedby={errors.departurePortId ? 'departure-port-hint' : undefined} onChange={(event) => update('departurePortId', event.target.value)}><option value="">Chọn cảng khởi hành</option>{portOptions.map(port => <option value={port.portId} key={port.portId}>{port.portName}{port.countryCode ? ` · ${port.countryCode}` : ''}{port.status === 'INACTIVE' ? ' · Cảng đã lưu, không còn hoạt động' : port.status === 'UNKNOWN' ? ' · Chưa xác định trạng thái' : ''}</option>)}</select></Field>
            <Field htmlFor="return-port" label="Cảng trở về" error={errors.returnPortId}><select id="return-port" disabled={busy || sourceEditing || portsLoading || Boolean(portsError)} value={draft.returnPortId} aria-invalid={Boolean(errors.returnPortId)} aria-describedby={errors.returnPortId ? 'return-port-hint' : undefined} onChange={(event) => update('returnPortId', event.target.value)}><option value="">Chọn cảng trở về</option>{portOptions.map(port => <option value={port.portId} key={port.portId}>{port.portName}{port.countryCode ? ` · ${port.countryCode}` : ''}{port.status === 'INACTIVE' ? ' · Cảng đã lưu, không còn hoạt động' : port.status === 'UNKNOWN' ? ' · Chưa xác định trạng thái' : ''}</option>)}</select></Field>
            </FormSection>}
            <p>Tàu hiện tại: {currentShip}</p>
          </div>
          {portsLoading && !portsError && <Loading label="Đang tải danh sách cảng…" />}
          {portsError && <Notice title="Không tải được danh sách cảng" tone="error"><p>{portsError}</p><Button type="button" tone="secondary" onClick={() => { setPortsLoading(true); setPortsError(''); setPortsAttempt(value=>value+1) }}>Tải lại danh sách cảng</Button></Notice>}
          {detailError && <Notice title="Không tải được chuyến" tone="error"><p>{detailError}</p><Button type="button" tone="secondary" onClick={() => { setLoading(true); setDetailError(''); setDetailAttempt(value=>value+1) }}>Tải lại chuyến</Button></Notice>}
          {loadedId === cruiseId && currentStatus !== 'DRAFT' && <Notice title="Không thể sửa chuyến" tone="warning"><p>Chỉ chuyến ở trạng thái DRAFT mới được chỉnh sửa.</p></Notice>}
          {submitError && <Notice title="Chưa xác nhận được kết quả lưu" tone="error"><p>{submitError}</p>{cruiseId&&<PermissionLink target="_blank" rel="noopener noreferrer" to={'/admin/cruises/'+encodeURIComponent(cruiseId)}>Xem bản đã lưu ở thẻ khác để đối chiếu</PermissionLink>}</Notice>}
          <div className={styles.formActions}>{access.canDo('CRUISE_UPDATE_DRAFT') && <Button type="submit" tone="primary" value="draft" disabled={busy || !canSave}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</Button>}<Button tone="secondary" disabled={busy} onClick={() => navigate(cruiseId ? `/admin/cruises/${cruiseId}` : '/admin/cruises')}>Hủy</Button></div>
        </Panel></fieldset>
      </form></CreationLayout>}
    </div>
  {guard.prompt}</CruiseFrame>
}


