import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { Button, Field, Loading, Notice, Panel } from '@/shared/ui'
import { usePlanning, useSources, useUnsavedGuard } from '../hooks'
import { failure } from '../api/live'
import { InfoConflictDialog } from '../components/ReviewDialogs'
import { emptyInfo, infoErrors, type Trip, type TripInfo } from '../model/plan'
import styles from '../Planning.module.css'
import { useTripOperation } from '../useTripOperation'
import { OperationRecovery } from '../components/OperationNotice'
import { TripSteps } from '../components/TripSteps'
import { CatalogChoices } from '../components/CatalogChoices'
import { portScopeViolations } from '../model/port-rules'
import { supportedDuration } from '../model/duration'

export function TripInfoPage({id}:{id?:string}) {
  const {gateway}=usePlanning()
  const query=useReadQuery('trip-info:'+(id??'new'),useCallback(signal=>id?gateway.getTrip(id,signal):Promise.resolve(null),[gateway,id]))
  if(id&&query.loading)return <Loading label="Đang tải thông tin chuyến…"/>
  if(query.error)return <Notice title="Chưa tải được thông tin chuyến" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>
  return <InfoForm key={id??'new'} trip={query.data??undefined}/>
}
function InfoForm({trip:initial}:{trip?:Trip}) {
  const [recovery,setRecovery]=useState(false),[trip,setTrip]=useState(initial),[compare,setCompare]=useState(false)
  const {gateway,root,can}=usePlanning(),navigate=useNavigate(),[baseline,setBaseline]=useState<TripInfo>(()=>structuredClone(initial?.info??emptyInfo()))
  const [form,setForm]=useState<TripInfo>(()=>structuredClone(baseline)),[attempted,setAttempted]=useState(false),[touched,setTouched]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const operation=useTripOperation('create'),lock=useRef(false),regions=useSources('regions'),countries=useSources('countries'),durations=useSources('durations')
  const permitted=can(trip?'TRIP_UPDATE':'TRIP_CREATE')&&!gateway.readOnly&&trip?.status!=='ARCHIVED'
  const full=gateway.supportsFullInfo,locked=Boolean(trip?.structuralLockedAt||trip?.versions?.some(v=>v.status==='PUBLISHED'))
  const scopeChanged=Boolean(trip)&&(form.scope!==baseline.scope||JSON.stringify(form.regionIds)!==JSON.stringify(baseline.regionIds)||JSON.stringify(form.countryCodes)!==JSON.stringify(baseline.countryCodes))
  const portCatalog=useSources('ports',{tripId:trip?.tripId},Boolean(trip)&&scopeChanged,trip?.revision)
  const scopePorts=scopeChanged&&!portCatalog.loading&&!portCatalog.error?portCatalog.data:null
  const scopeInfo=useMemo(()=>({scope:form.scope,regionIds:form.regionIds,countryCodes:form.countryCodes}),[form.scope,form.regionIds,form.countryCodes])
  const scopeData=useReadQuery('trip-scope:'+trip?.tripId+':'+trip?.revision+':'+JSON.stringify(scopeInfo),useCallback(async signal=>{
    if(!trip||!scopeChanged||!scopePorts)return []
    const detail=await gateway.getTrip(trip.tripId,signal)
    if(!Array.isArray(detail.versions))throw new Error('Chưa đọc được danh sách phiên bản để đối chiếu phạm vi. Bản nhập vẫn được giữ.')
    const versions=await Promise.all(detail.versions.filter(version=>version.status!=='CANCELLED').map(version=>gateway.version(version.versionId,signal)))
    return versions.flatMap(version=>portScopeViolations(version,scopeInfo,scopePorts).map(issue=>({...issue,message:'Phiên bản '+version.versionNumber+' · '+issue.message})))
  },[gateway,trip,scopeChanged,scopeInfo,scopePorts]))
  const dirty=JSON.stringify(form)!==JSON.stringify(baseline),guard=useUnsavedGuard(dirty,busy)
  const errors:Record<string,string>=full||!trip?infoErrors(form):(!form.name.trim()?{name:'Nhập tên chuyến.'}:form.name.length>200?{name:'Tên chuyến tối đa 200 ký tự.'}:{})
  const scopeBlocked=scopeChanged&&(scopeData.loading||Boolean(scopeData.error)||portCatalog.loading||Boolean(portCatalog.error&&portCatalog.errorCode!=='SCOPE_COUNTRY_REQUIRED')||Boolean(scopeData.data?.length))
  const show=(field:string)=>attempted||touched[field]?errors[field]:undefined
  const change=<K extends keyof TripInfo>(field:K,value:TripInfo[K])=>setForm(old=>({...old,[field]:value}))
  const geography=form.scope==='DOMESTIC'?regions:countries
  const catalogBlocked=durations.loading||Boolean(durations.error)||!durations.data.some(item=>item.id===form.durationBand&&supportedDuration(item.id))||(Boolean(form.scope)&&(geography.loading||Boolean(geography.error)))
  async function save(event:React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();setAttempted(true)
    if(!permitted||lock.current||(!full&&!trip)||(full&&catalogBlocked))return
    if(scopeChanged&&(scopeData.loading||scopeData.error||portCatalog.loading||(portCatalog.error&&portCatalog.errorCode!=='SCOPE_COUNTRY_REQUIRED')||scopeData.data?.length)){setError('Chưa lưu thay đổi phạm vi. Hãy kiểm tra các lần ghé cảng đang liên kết bên dưới.');return}
    if(!trip&&operation.blocked){setRecovery(true);return}
    if(Object.keys(errors).length){requestAnimationFrame(()=>document.querySelector<HTMLElement>('#trip-info [aria-invalid=true]')?.focus());return}
    lock.current=true;setBusy(true);setError('')
    try {const input={...form,name:form.name.trim()},request=trip?{payload:input,key:''}:operation.begin(input);const saved=await gateway.saveInfo(request.payload,request.key,trip);if(!trip)operation.succeeded(saved.tripId);guard.allowLeave();navigate(`${root}/${saved.tripId}/schedule`)} catch(e){if(!trip)operation.failed(e);setError(failure(e).message)} finally {lock.current=false;setBusy(false)}
  }
  return <div className={styles.info}>
    <header className={styles.heading}><div><h1>{trip?'Thông tin chuyến':'Tạo chuyến đi'}</h1><p className={styles.muted}>{trip?.tripCode??'Mã chuyến được tạo khi lưu thành công.'}</p></div><Link to={root}>Về danh sách</Link></header><TripSteps stage="info" tripId={trip?.tripId}/>
    {!full&&<Notice title={trip?'Phạm vi chỉnh sửa hiện có':'Chức năng tạo đang chờ cập nhật'} tone="warning">{trip?'Chế độ hiện tại chỉ lưu tên và giới thiệu. Thời lượng, nhiều miền/quốc gia của biểu mẫu mới chưa có hợp đồng lưu đầy đủ.':'Biểu mẫu mới chưa lưu được đầy đủ bằng API hiện tại. Chưa gửi dữ liệu và không tự chọn loại tuyến để vượt kiểm tra.'}</Notice>}
    {!permitted&&<Notice title="Chỉ xem thông tin chuyến">Tài khoản hoặc trạng thái chuyến hiện tại không cho phép chỉnh sửa.</Notice>}
    {trip?.durationIssue&&<Notice title="Cần đối soát thời lượng" tone="warning">{trip.durationIssue}</Notice>}{locked&&<Notice title="Thời lượng đã khóa">Chuyến có lịch trình đã phát hành nên không thể đổi số ngày. Hãy nhân bản chuyến.</Notice>}
    {recovery&&<OperationRecovery operation={operation} onClose={()=>setRecovery(false)}/>}<Panel title="Thông tin cơ bản"><form id="trip-info" className={styles.single} onSubmit={e=>void save(e)} noValidate>
      <Field htmlFor="trip-name" label="Tên chuyến *" error={show('name')}><input id="trip-name" value={form.name} maxLength={200} required disabled={!permitted||busy} aria-invalid={Boolean(show('name'))} onBlur={()=>setTouched(t=>({...t,name:true}))} onChange={e=>change('name',e.target.value)}/></Field>
      <Field htmlFor="trip-band" label="Thời lượng *" error={durations.error||show('durationBand')}><select id="trip-band" value={form.durationBand} disabled={!permitted||busy||locked||durations.loading||Boolean(durations.error)||(gateway.mode==='api'&&Boolean(trip))} aria-invalid={Boolean(show('durationBand'))} onBlur={()=>setTouched(t=>({...t,durationBand:true}))} onChange={e=>change('durationBand',e.target.value as TripInfo['durationBand'])}><option value="">{durations.loading?'Đang tải thời lượng…':'Chọn thời lượng'}</option>{durations.data.filter(item=>supportedDuration(item.id)).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>{durations.error&&<Button type="button" tone="text" onClick={durations.retry}>Tải lại thời lượng</Button>}{gateway.mode==='api'&&trip&&!locked&&<small>Chuyến đang có giữ nhóm thời lượng để bảo toàn số ngày và nội dung. Chọn nhóm khác khi tạo chuyến mới.</small>}</Field>
      <Field htmlFor="trip-scope" label="Phạm vi *" error={show('scope')}><select id="trip-scope" value={form.scope} disabled={!permitted||busy||(!full&&Boolean(trip))} aria-invalid={Boolean(show('scope'))} onBlur={()=>setTouched(t=>({...t,scope:true}))} onChange={e=>change('scope',e.target.value as TripInfo['scope'])}><option value="">Chọn phạm vi</option><option value="DOMESTIC">Trong nước</option><option value="INTERNATIONAL">Ngoài nước</option></select></Field>
      {form.scope&&<fieldset disabled={!permitted||busy||!full}><legend>{form.scope==='DOMESTIC'?'Chọn các miền *':'Chọn quốc gia/vùng lãnh thổ *'}</legend><CatalogChoices catalog={geography} values={form.scope==='DOMESTIC'?form.regionIds:form.countryCodes} onChange={values=>change(form.scope==='DOMESTIC'?'regionIds':'countryCodes',values)}/>{show(form.scope==='DOMESTIC'?'regions':'countries')&&<p className={styles.error} role="alert">{show(form.scope==='DOMESTIC'?'regions':'countries')}</p>}</fieldset>}
      {scopeChanged&&<section aria-label="Đối chiếu cảng khi đổi phạm vi">{(scopeData.loading||portCatalog.loading)?<Loading label="Đang đối chiếu các lần ghé cảng…"/>:(scopeData.error||portCatalog.error)?<Notice title="Chưa đối chiếu được phạm vi" tone="warning">{scopeData.error?.message||portCatalog.error}<Button type="button" tone="secondary" onClick={()=>{scopeData.retry();portCatalog.retry()}}>Thử lại</Button></Notice>:Boolean(scopeData.data?.length)&&<Notice title="Các lần ghé cần xử lý trước khi đổi phạm vi" tone="warning"><ul>{scopeData.data?.map((issue,index)=><li key={issue.clientKey+':'+index}>{issue.message}</li>)}</ul><Link to={root+'/'+trip!.tripId+'/schedule'}>Mở lịch trình để xử lý</Link></Notice>}</section>}
      {trip&&!full&&<p className={styles.note}>Dữ liệu hiện có: {trip.durationDays} ngày · Phạm vi: {trip.plannedScope||'Chưa có thông tin'}.</p>}
      <Field htmlFor="trip-description" label="Giới thiệu (tùy chọn)"><textarea id="trip-description" rows={4} value={form.description} disabled={!permitted||busy} onChange={e=>change('description',e.target.value)}/></Field>
      {error&&<Notice title="Chưa lưu được thông tin" tone="error">{error}<p>Bản nhập vẫn được giữ. Không tự gửi lại yêu cầu tạo chuyến.</p>{trip&&<Button type="button" tone="secondary" onClick={()=>setCompare(true)}>So sánh thông tin máy chủ</Button>}</Notice>}
      <div className={styles.formFooter}><Link to={root}>Hủy</Link>{trip&&<Link to={`${root}/${trip.tripId}/schedule`}>Lịch trình</Link>}{permitted&&<Button type="submit" disabled={busy||scopeBlocked||(!full&&!trip)||(full&&catalogBlocked)}>{busy?'Đang lưu…':!full?'Lưu tên và giới thiệu':'Lưu và lập lịch trình'}</Button>}</div>
    </form></Panel>{compare&&trip&&<InfoConflictDialog trip={trip} local={form} onClose={()=>setCompare(false)} onReplace={server=>{setTrip(server);setBaseline(structuredClone(server.info));setForm(structuredClone(server.info));setCompare(false);setError('');setAttempted(false);setTouched({})}}/>}{guard.prompt}
  </div>
}
