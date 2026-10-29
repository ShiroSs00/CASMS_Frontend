import { businessCopy } from '@/shared/i18n/business-copy'
import { InheritedSourcePlan } from '../components/InheritedSourcePlan'
import { DepartureMilestones } from '../components/DepartureMilestones'
import { EditorLayout } from '@/shared/ui'
import { FormErrorSummary, FormSection } from '@/shared/ui'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router'
import { ApiError, useReadQuery } from '@/shared/api'
import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
import { useSessionAccess } from '@/shared/auth'

import { Button, ButtonLink, Field, Loading, Notice, PageHeader, Panel, PermissionLink } from '@/shared/ui'

import { CruiseFrame } from '../components/CruiseUI'
import { cruiseApi } from '../api/cruise-api'
import { creationReturn } from '../model/creation-return'
import { cruiseCreateIntent } from '../model/create-intent'
import { DepartureSourcePicker } from '../components/DepartureSourcePicker'
import { readPublishedSource } from '../api/source-version'
import { DepartureSchedulePreview } from '../components/DepartureSchedulePreview'
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
  const navigate = useNavigate()
  const location=useLocation()
  const restored=!editing?creationReturn(location.state,access.userId,new URLSearchParams(location.search).get('sourceVersionId')):null
  const [createIntent] = useState(() => {
    let storage: Storage | undefined
    try { storage = window.sessionStorage } catch { storage = {getItem(){throw Error('Storage unavailable')},setItem(){throw Error('Storage unavailable')}} as unknown as Storage }
    return cruiseCreateIntent(access.userId ?? '', storage)
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
  const submitLock = useRef(false)
  const canSave = (!sourceId||appliedPreview===JSON.stringify([sourceId,draft.departureDatetime])&&previewRevision!=null&&source.data?.revision===previewRevision) && (editing||Boolean(sourceId)) && !uncertain && !invalidSource && createIntent.owner===(access.userId??'') && (!sourceId||!source.loading&&!source.error&&source.data?.versionId===sourceId) && !portsLoading && !portsError && access.canDo(editing ? 'CRUISE_UPDATE_DRAFT' : 'CRUISE_CREATE') && (!editing || (loadedId === cruiseId && currentStatus === 'DRAFT'))

  useEffect(() => {
    if (!cruiseId) return
    const controller = new AbortController()
    void cruiseApi.getDetail(cruiseId, controller.signal).then((detail) => {
      if (controller.signal.aborted) return
      setDraft({
        revision: detail.cruise.revision,
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveDraft()
  }
  async function saveDraft(replay=false) {
    const mayReplay=!editing&&replay&&createIntent.record?.status==='unknown'&&!createIntent.storageError&&createIntent.owner===(access.userId??'')&&access.canDo('CRUISE_CREATE')
    if (submitLock.current || (!canSave&&!mayReplay)) return
    const input=mayReplay?createIntent.record!.payload:{...draft,cruiseName:displayName,...(!editing&&sourceId?{sourceVersionId:sourceId,expectedSourceVersionRevision:previewRevision}:{})}
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
      navigate(`/admin/cruises/${saved.cruiseId}`, { replace: !editing })
    } catch (error) {
      if(editing ? mutationOutcomeUnknown(error) : createIntent.record?.status==='unknown'||createIntent.storageError)setUncertain(true)
      if(error instanceof ApiError&&error.code==='STALE_REVISION')setSubmitError('Lần khởi hành đã được người khác cập nhật. Nội dung bạn nhập vẫn được giữ. Mở bản đã lưu ở thẻ khác để đối chiếu trước khi chỉnh tiếp.');
      if (error instanceof ApiError && ['INVALID_SCHEDULE','SHIP_SCHEDULE_CONFLICT'].includes(error.code ?? '')) setErrors(current => ({ ...current, returnDatetime: error.code === 'SHIP_SCHEDULE_CONFLICT' ? 'Thời gian này trùng lịch của tàu đã phân công.' : 'Kiểm tra ngày giờ khởi hành và kết thúc.' }))
      if(!(error instanceof ApiError&&error.code==='STALE_REVISION'))setSubmitError(error instanceof Error ? error.message : 'Không lưu được lần khởi hành.')
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  if (loading) return <CruiseFrame><Loading label="Đang tải chuyến đi…" /></CruiseFrame>

  return <CruiseFrame>
    <div className={styles.content}>
      {uncertain&&<Notice title={createIntent.record?.status==='succeeded'?'Lần khởi hành đã được tạo':'Chưa xác định được kết quả lưu'} tone="warning"><p>{createIntent.record?.status==='succeeded'?'Mở bản ghi đã được hệ thống xác nhận.':'Bản nhập và mã thao tác cũ được giữ nguyên. Chưa có API tra cứu riêng kết quả thao tác.'}</p><ButtonLink tone="secondary" to={createIntent.record?.cruiseId?'/admin/cruises/'+createIntent.record.cruiseId:editing?'/admin/cruises/'+cruiseId:'/admin/cruises'}>Đối chiếu lần khởi hành</ButtonLink>{!editing&&createIntent.record?.status==='unknown'&&access.canDo('CRUISE_CREATE')&&<Button disabled={busy||createIntent.storageError} onClick={()=>void saveDraft(true)}>Gửi lại cùng yêu cầu</Button>}{!editing&&createIntent.record?.status==='succeeded'&&<Button disabled={busy} onClick={()=>{if(createIntent.startNew()){setDraft(EMPTY_DRAFT);setUncertain(false);setErrors({});setSubmitError('')}}}>Tạo lần khởi hành khác</Button>}</Notice>}
      <PageHeader breadcrumb="LẦN KHỞI HÀNH" title={editing ? 'Chỉnh sửa lần khởi hành' : businessCopy('cruise.source.create')} description={editing ? 'Chỉnh sửa dữ liệu chuyến. Phân công tàu được kiểm tra và xác nhận trong luồng riêng.' : businessCopy('cruise.source.createDescription')} />
      {!editing&&(sourceId?<details className={styles.sourceSwitch}><summary>Đổi lịch trình nguồn</summary><DepartureSourcePicker value={sourceId} disabled={busy||uncertain} onChange={(id,name)=>{const next=new URLSearchParams(params);next.delete('mode');if(id)next.set('sourceVersionId',id);else next.delete('sourceVersionId');setParams(next,{replace:true});setAppliedPreview('');setDraft(old=>({...old,cruiseName:old.cruiseName||name||'',returnDatetime:'',departurePortId:'',returnPortId:''}));setErrors({});setSubmitError('')}}/></details>:<DepartureSourcePicker value={sourceId} disabled={busy||uncertain} onChange={(id,name)=>{const next=new URLSearchParams(params);next.delete('mode');if(id)next.set('sourceVersionId',id);else next.delete('sourceVersionId');setParams(next,{replace:true});setAppliedPreview('');setDraft(old=>({...old,cruiseName:old.cruiseName||name||'',returnDatetime:'',departurePortId:'',returnPortId:''}));setErrors({});setSubmitError('')}}/>)}
      {invalidSource&&<Notice title="Thiếu phiên bản nguồn" tone="error">Liên kết tạo đang thiếu định danh phiên bản. Mở lại đúng phiên bản lịch trình đã phát hành; không tự chuyển sang tạo trực tiếp.</Notice>}
      {storedCruise&&<CruiseSourceDetails cruise={storedCruise}/>}
      {sourceId&&<DepartureMilestones creating/>}
      {sourceId&&source.loading&&<Loading label="Đang đọc tuyến và chương trình đã phát hành…"/>}
      {sourceId&&source.error&&<Notice title="Chưa đọc được lịch trình nguồn" tone="error">{source.error.message}<Button onClick={source.retry}>Tải lại</Button></Notice>}
      <div className={sourceId&&source.data?styles.sourceCreationGrid:undefined}>
      {sourceId&&source.data&&<InheritedSourcePlan source={source.data} returnState={{cruiseCreationDraft:{owner:access.userId,sourceVersionId:sourceId,draft:{...draft,cruiseName:displayName},nameEdited,appliedPreview,previewRevision}}}/>}
      {(editing||sourceId&&source.data)&&<CreationLayout sourceFlow={Boolean(sourceId)}><form onSubmit={submit} noValidate>
        <fieldset disabled={busy||uncertain} style={{border:0,padding:0,margin:0,minWidth:0}}><Panel title={sourceId?'Bổ sung cho lần khởi hành này':'Thông tin lần khởi hành'}>
          <FormErrorSummary errors={errors} />
          <div className={styles.journeyForm}><FormSection title={sourceId?'Thông tin riêng':'01 · Nhận diện lần khởi hành'}>
            <Field htmlFor="cruise-name" label="Tên lần khởi hành *" error={errors.cruiseName}><input id="cruise-name" value={displayName} aria-invalid={Boolean(errors.cruiseName)} aria-describedby={errors.cruiseName ? 'cruise-name-hint' : undefined} onChange={(event) => update('cruiseName', event.target.value)} /></Field>
            {!sourceId&&<Field htmlFor="cruise-type-form" label="Thời lượng chuyến" error={errors.cruiseType}><select id="cruise-type-form" value={draft.cruiseType} onChange={(event) => update('cruiseType', event.target.value as CruiseType)}><option value="">Hệ thống xác định theo ngày giờ</option><option value="ONE_DAY">Một ngày</option><option value="MULTI_DAYS">Nhiều ngày</option></select></Field>}
            {!editing&&sourceId&&<Field htmlFor="itinerary-mode" label="Lịch trình lần khởi hành"><select id="itinerary-mode" disabled={busy||uncertain} value={draft.itineraryMode??'FIXED'} onChange={e=>update('itineraryMode',e.target.value as 'FIXED'|'CUSTOM')}><option value="FIXED">{businessCopy('cruise.itinerary.FIXED')}</option><option value="CUSTOM">{businessCopy('cruise.itinerary.CUSTOM')}</option></select></Field>}
            </FormSection><p className={styles.muted}>{sourceId?'Nhập ngày bắt đầu, xem trước và áp dụng lịch để lưu nháp.':'Nhập ngày giờ và cảng đi/về để lưu nháp lần khởi hành.'}</p>
            {sourceEditing&&<Notice title="Lịch đã được tạo từ nguồn" tone="warning">Hiện chỉ sửa thông tin nhận diện. Đổi ngày hoặc cảng cần xử lý cùng lịch và chương trình liên quan.</Notice>}
            <FormSection title={sourceId?'Ngày tổ chức thực tế':'02 · Thời gian'}><Field htmlFor="departure-time" label={sourceId?'Bắt đầu lần khởi hành (giờ Việt Nam)':'Khởi hành (giờ Việt Nam)'} error={errors.departureDatetime}><input id="departure-time" disabled={sourceEditing} type="datetime-local" value={draft.departureDatetime} aria-invalid={Boolean(errors.departureDatetime)} aria-describedby={errors.departureDatetime ? 'departure-time-hint' : undefined} onChange={(event) => update('departureDatetime', event.target.value)} /></Field>
      {sourceId && source.data && <DepartureSchedulePreview sourceVersionId={sourceId} departure={draft.departureDatetime} contextKey={JSON.stringify([sourceId,source.data.revision])} disabled={busy||uncertain||Boolean(source.error)} onApply={schedule=>{setDraft(current=>({...current,returnDatetime:schedule.returnDatetime?localCruiseInput(schedule.returnDatetime):current.returnDatetime,departurePortId:schedule.departurePortId??current.departurePortId,returnPortId:schedule.returnPortId??current.returnPortId}));setPreviewRevision(schedule.sourceVersionRevision);setAppliedPreview(JSON.stringify([sourceId,draft.departureDatetime]))}}/>}
            {!sourceId&&<Field htmlFor="return-time" label="Kết thúc (giờ Việt Nam)" error={errors.returnDatetime}><input id="return-time" disabled={sourceEditing||Boolean(sourceId)} type="datetime-local" value={draft.returnDatetime} aria-invalid={Boolean(errors.returnDatetime)} aria-describedby={errors.returnDatetime ? 'return-time-hint' : undefined} onChange={(event) => update('returnDatetime', event.target.value)} /></Field>}

            </FormSection>{sourceId?<dl className={styles.sourceFacts}><div><dt>Thời lượng nguồn</dt><dd>{source.data?.days.length} ngày</dd></div><div><dt>Kết thúc dự kiến</dt><dd>{calendarLabel(draft.returnDatetime)}</dd></div><div><dt>Cảng bắt đầu</dt><dd>{portOptions.find(p=>p.portId===draft.departurePortId)?.portName||'Theo lịch sau khi áp dụng'}</dd></div><div><dt>Cảng kết thúc</dt><dd>{portOptions.find(p=>p.portId===draft.returnPortId)?.portName||'Theo lịch sau khi áp dụng'}</dd></div></dl>:<><FormSection title="03 · Cảng đi và về"><Field htmlFor="departure-port" label="Cảng khởi hành" error={errors.departurePortId}><select id="departure-port" disabled={busy || sourceEditing || Boolean(sourceId) || portsLoading || Boolean(portsError)} value={draft.departurePortId} aria-invalid={Boolean(errors.departurePortId)} aria-describedby={errors.departurePortId ? 'departure-port-hint' : undefined} onChange={(event) => update('departurePortId', event.target.value)}><option value="">Chọn cảng khởi hành</option>{portOptions.map(port => <option value={port.portId} key={port.portId}>{port.portName}{port.countryCode ? ` · ${port.countryCode}` : ''}{port.status === 'INACTIVE' ? ' · Cảng đã lưu, không còn hoạt động' : port.status === 'UNKNOWN' ? ' · Chưa xác định trạng thái' : ''}</option>)}</select></Field>
            <Field htmlFor="return-port" label="Cảng trở về" error={errors.returnPortId}><select id="return-port" disabled={busy || sourceEditing || Boolean(sourceId) || portsLoading || Boolean(portsError)} value={draft.returnPortId} aria-invalid={Boolean(errors.returnPortId)} aria-describedby={errors.returnPortId ? 'return-port-hint' : undefined} onChange={(event) => update('returnPortId', event.target.value)}><option value="">Chọn cảng trở về</option>{portOptions.map(port => <option value={port.portId} key={port.portId}>{port.portName}{port.countryCode ? ` · ${port.countryCode}` : ''}{port.status === 'INACTIVE' ? ' · Cảng đã lưu, không còn hoạt động' : port.status === 'UNKNOWN' ? ' · Chưa xác định trạng thái' : ''}</option>)}</select></Field>
            </FormSection></>}{editing && <p>Tàu hiện tại: {currentShip}</p>}
          </div>
          {portsLoading && !source.error && !invalidSource && <Loading label="Đang tải danh sách cảng…" />}
          {portsError && <Notice title="Không tải được danh sách cảng" tone="error"><p>{portsError}</p><Button type="button" tone="secondary" onClick={() => { setPortsLoading(true); setPortsError(''); setPortsAttempt(value=>value+1) }}>Tải lại danh sách cảng</Button></Notice>}
          {!portsLoading && !portsError && !ports.length && <Notice title="Chưa có cảng hoạt động" tone="warning">Cần tạo hoặc kích hoạt cảng trước khi lập chuyến mới.</Notice>}
          {detailError && <Notice title="Không tải được chuyến" tone="error"><p>{detailError}</p><Button type="button" tone="secondary" onClick={() => { setLoading(true); setDetailError(''); setDetailAttempt(value=>value+1) }}>Tải lại chuyến</Button></Notice>}
          {editing && loadedId === cruiseId && currentStatus !== 'DRAFT' && <Notice title="Không thể sửa chuyến" tone="warning"><p>Chỉ chuyến ở trạng thái DRAFT mới được chỉnh sửa.</p></Notice>}
          {submitError && <Notice title="Chưa xác nhận được kết quả lưu" tone="error"><p>{submitError}</p>{editing&&cruiseId&&<PermissionLink target="_blank" rel="noopener noreferrer" to={'/admin/cruises/'+encodeURIComponent(cruiseId)}>Xem bản đã lưu ở thẻ khác để đối chiếu</PermissionLink>}</Notice>}
          {!sourceId&&!sourceEditing&&!access.canDo('ITINERARY_CREATE') && <p className={styles.muted}>Tài khoản chưa có quyền tạo lịch trình. Bạn vẫn có thể lưu nháp chuyến nếu được cấp quyền.</p>}
          <div className={styles.formActions}>{access.canDo(editing ? 'CRUISE_UPDATE_DRAFT' : 'CRUISE_CREATE') && <Button type="submit" tone="secondary" value="draft" disabled={busy || !canSave}>{busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : sourceId?'Tạo hồ sơ lần khởi hành':'Lưu nháp'}</Button>}<Button tone="secondary" disabled={busy} onClick={() => navigate(editing && cruiseId ? `/admin/cruises/${cruiseId}` : '/admin/cruises')}>Hủy</Button></div>
        </Panel></fieldset>
      </form></CreationLayout>}
      </div>
    </div>
  </CruiseFrame>
}
