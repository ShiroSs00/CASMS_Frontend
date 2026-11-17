import { createScheduleTemplate } from '../model/schedule-validation'
import { describeRouteDays, projectRoute } from '../model/route-order'
import { mergePlanningViolations } from '../model/validation-copy'
import { useSessionAccess } from '@/shared/auth/session-access'
import {PublishedTemplateDialog} from '../components/PublishedTemplateDialog'
import { departureReturn } from '@/shared/lib/departure-return'
import { businessCopy } from '@/shared/i18n/business-copy'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { Badge, Button, Empty, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import { usePlanning, useSources, useUnsavedGuard } from '../hooks'
import { failure } from '../api/live'
import { PlanningFault } from '../api/gateway'
import { contentOf, versionLabels, newKey, SHIP_ZONE, shortTime, timeNumber, type Content, type Entry, type Stop, type Trip, type Version, type Violation } from '../model/plan'
import { DepartureSourceSummary } from '../components/DepartureSourceSummary'
import { DayPane } from '../components/DayPane'
import { EntryDrawer, StopDrawer } from '../components/PlanDrawers'
import { ConflictDialog, HistoryDialog, ValidationPanel } from '../components/ReviewDialogs'
import type { Report } from '../model/plan'
import styles from '../Planning.module.css'
import { violationTarget } from '../model/violation-target'
import { normalizeBoundaryDays } from '../model/day-labels'
import { versionContext, workingVersionLabel } from '../model/version-context'
import { durationRules, supportedDuration } from '../model/duration'
import { callsAfterTerminal, consecutiveSamePortViolations, departureTimingViolations, stopTimingViolations, portScopeViolations, linkedTourViolations, routeOrderViolations, portMatchesScope } from '../model/port-rules'

export function TripSchedulePage({id}:{id:string}) {
  const {gateway}=usePlanning()
  const query=useReadQuery('planning-trip:'+id,useCallback(signal=>gateway.getTrip(id,signal),[gateway,id]))
  const [params]=useSearchParams(),location=useLocation()
  const returnTo=departureReturn(params.get('returnTo'))
  return <>
    {returnTo&&<p className={styles.note}><Link to={returnTo} state={location.state}>← Quay lại chuyến khởi hành</Link></p>}
    {query.loading?<Loading label="Đang tải chuyến và các phiên bản…"/>:query.error?<Notice title="Chưa tải được chuyến" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>:query.data?<Schedule key={`${gateway.mode}:${id}`} initial={query.data}/>:null}
  </>
}
function Schedule({initial}:{initial:Trip}) {
  const {gateway,can,root}=usePlanning(),[trip,setTrip]=useState(initial)
  const [params,setParams]=useSearchParams()
  const context=versionContext(trip.versions)
  const fallback=params.get('view')==='published'?context.published?.versionId??'':context.working?.versionId??trip.versions?.filter(v=>v.status!=='CANCELLED').toSorted((a,b)=>b.versionNumber-a.versionNumber)[0]?.versionId??trip.versions?.toSorted((a,b)=>b.versionNumber-a.versionNumber)[0]?.versionId??''
  const chosen=params.has('versionId')?params.get('versionId')!:fallback
  useEffect(()=>{if(!params.has('versionId')&&fallback){const next=new URLSearchParams(params);next.set('versionId',fallback);setParams(next,{replace:true})}},[fallback,params,setParams])
  const setChosen=(id:string)=>{const next=new URLSearchParams(params);next.set('versionId',id);next.delete('view');setParams(next)}
  const [create,setCreate]=useState(false),[source,setSource]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const creating=useRef(false),[creationUnknown,setCreationUnknown]=useState(false)
  const query=useReadQuery('planning-version:'+chosen,useCallback(async signal=>{
    if(!chosen){if(params.get('view')==='published')throw new Error('Chuyến này hiện chưa có mẫu lịch trình đã chốt. Hãy mở bản nháp để tiếp tục.');if(params.has('versionId'))throw new Error('Liên kết thiếu mã phiên bản. Hãy chọn lại từ danh sách phiên bản của chuyến.');return null}
    const version=await gateway.version(chosen,signal)
    if(version.tripId!==trip.tripId)throw new Error('Phiên bản trong liên kết không thuộc chuyến này. Không tự chuyển sang phiên bản khác.')
    return version
  },[gateway,chosen,trip.tripId,params]))
  async function reconcileVersions(){
    if(creating.current)return
    creating.current=true;setBusy(true)
    try{
      const actual=await gateway.getTrip(trip.tripId)
      if(actual.tripId!==trip.tripId||!Array.isArray(actual.versions))throw new Error('Chưa đọc được danh sách phiên bản của chuyến.')
      setTrip(actual);setCreationUnknown(false);setError('')
    }catch(e){setError(failure(e).message)}finally{creating.current=false;setBusy(false)}
  }
  async function createVersion(){
    if(creationUnknown||creating.current||!can('TRIP_PLAN_WRITE')||gateway.readOnly||trip.status==='ARCHIVED')return
    const unfinished=trip.versions?.find(v=>v.status==='DRAFT'||v.status==='IN_REVIEW')
    if(unfinished){setChosen(unfinished.versionId);setCreate(false);return}
    creating.current=true;setBusy(true);setError('')
    try{const version=await gateway.createVersion(trip,source||undefined);setTrip(old=>({...old,versions:[...(old.versions??[]),version]}));setChosen(version.versionId);setCreate(false)}catch(e){const fault=failure(e);setError(fault.message);if(fault.status===0||fault.status===408||fault.status>=500)setCreationUnknown(true)}finally{creating.current=false;setBusy(false)}
  }
  const newVersion=can('TRIP_PLAN_WRITE')&&!gateway.readOnly&&trip.status!=='ARCHIVED'?()=>{setSource(trip.versions?.filter(v=>v.status==='PUBLISHED').at(-1)?.versionId??'');setCreate(true)}:undefined
  return <>
    {query.loading?<Loading label="Đang tải phiên bản lịch trình…"/>:query.error?<Notice title="Chưa mở được phiên bản" tone="error">{query.error.message}<div className={styles.actions}><Button onClick={query.retry}>Tải lại</Button><Link to={root}>Về danh sách chuyến</Link>{trip.versions?.map(v=><Button key={v.versionId} onClick={()=>setChosen(v.versionId)}>Mở phiên bản {v.versionNumber}</Button>)}</div></Notice>:query.data?<VersionEditor key={query.data.versionId} initial={query.data} trip={trip} setTrip={setTrip} onSwitch={setChosen} onNew={newVersion}/>:<Panel title={trip.name}><Empty title="Chưa có phiên bản lịch trình"/><Link to={root}>Về danh sách</Link>{newVersion&&<Button onClick={newVersion}>Tạo phiên bản nháp</Button>}</Panel>}
    {create&&<Modal title="Tạo phiên bản lịch trình" busy={busy} onClose={()=>{if(!busy)setCreate(false)}} footer={<><Button tone="secondary" data-overlay-dismiss disabled={busy} onClick={()=>setCreate(false)}>Hủy</Button><Button busy={busy} disabled={creationUnknown} onClick={()=>void createVersion()}>{trip.versions?.some(v=>v.status==='DRAFT'||v.status==='IN_REVIEW')?'Mở bản chưa hoàn tất':busy?'Đang tạo…':'Tạo bản nháp'}</Button></>}>
      <p>Chỉ tạo bản nháp mới khi không còn bản nháp hoặc mẫu cần xử lý theo quy trình cũ của chuyến đi này.</p>
      <Field htmlFor="planning-source-version" label="Nguồn nội dung"><select id="planning-source-version" value={source} disabled={busy} onChange={e=>setSource(e.target.value)}><option value="">Nội dung trống theo số ngày của chuyến</option>{trip.versions?.filter(v=>v.status==='PUBLISHED').map(v=><option key={v.versionId} value={v.versionId}>Phiên bản {v.versionNumber} · Mẫu đã chốt</option>)}</select></Field>
      {error&&<Notice title="Chưa tạo được phiên bản" tone="error">{error}<Button disabled={busy} onClick={()=>void reconcileVersions()}>Đọc lại danh sách phiên bản</Button></Notice>}
    </Modal>}
  </>
}
type EditorProps={initial:Version;trip:Trip;setTrip:React.Dispatch<React.SetStateAction<Trip>>;onSwitch:(id:string)=>void;onNew?:()=>void}
function VersionEditor({initial,trip,setTrip,onSwitch,onNew}:EditorProps) {
  const access=useSessionAccess()
  const canFinalize=access.status==='ready'&&access.roles.includes('CRUISE_MANAGER')
  const {gateway,root,can}=usePlanning(),[version,setVersion]=useState(initial),[content,setContent]=useState<Content>(()=>{const content=contentOf(initial);return initial.status==='DRAFT'&&can('TRIP_PLAN_WRITE')&&!gateway.readOnly&&trip.status!=='ARCHIVED'?{...content,days:normalizeBoundaryDays(content.days)}:content})
  const [selected,setSelected]=useState(1),[busy,setBusy]=useState(''),lock=useRef(false)
  const [fault,setFault]=useState<PlanningFault|null>(null),[message,setMessage]=useState(''),[report,setReport]=useState<Report|null>(null),[uncertain,setUncertain]=useState(false),[serverLocked,setServerLocked]=useState(false)
  const [templatePreview,setTemplatePreview]=useState(false)
  const [history,setHistory]=useState(false),[compare,setCompare]=useState(false),[pendingSwitch,setPendingSwitch]=useState('')
  const [stopDrawer,setStopDrawer]=useState<{stop?:Stop;violation?:Violation}|null>(null),[entryDrawer,setEntryDrawer]=useState<{kind:Entry['kind'];entry?:Entry;stopClientKey?:string;violation?:Violation}|null>(null)
  const [showMissingFields,setShowMissingFields]=useState(false)
  const [located,setLocated]=useState<Violation|null>(null)
  const [removal,setRemoval]=useState<{kind:'stop'|'entry';key:string}|null>(null),[dayChange,setDayChange]=useState<{remove?:number}|null>(null)
  const dirty=JSON.stringify(content)!==JSON.stringify(contentOf(version)),guard=useUnsavedGuard(dirty,Boolean(busy))
  const versions=versionContext(trip.versions)
  const canEdit=version.status==='DRAFT'&&can('TRIP_PLAN_WRITE')&&!gateway.readOnly&&trip.status!=='ARCHIVED'
  const editable=canEdit&&!uncertain
  const locked=serverLocked||Boolean(trip.structuralLockedAt||trip.versions?.some(v=>v.status==='PUBLISHED'))
  const limits=supportedDuration(trip.info.durationBand)?[durationRules[trip.info.durationBand].minDays,durationRules[trip.info.durationBand].maxDays]:null
  const day=content.days.find(d=>d.dayNumber===selected)??content.days[0]
  const routeDays=describeRouteDays(content)
  const ports=useSources('ports',{tripId:trip.tripId},editable,trip.revision)
  const scopeIssues=editable&&!ports.loading&&!ports.error?portScopeViolations(content,trip.info,ports.data):[]
  const departureDay=content.days.find(day=>day.dayNumber===1)
  const departureIssues:Violation[]=departureDay&&!content.stops.some(stop=>stop.isEmbarkation)?[
    ...(!departureDay.departurePortId?[{code:'DEPARTURE_PORT_REQUIRED',severity:'ERROR' as const,entityType:'DAY',dayNumber:1,fieldPath:'days[1].departurePortId',message:'Chọn cảng khởi hành cho ngày 1.'}]:[]),
    ...(!departureDay.plannedDepartureTime?[{code:'DEPARTURE_TIME_REQUIRED',severity:'ERROR' as const,entityType:'DAY',dayNumber:1,fieldPath:'days[1].plannedDepartureTime',message:'Nhập giờ khởi hành dự kiến theo giờ Việt Nam.'}]:[]),
  ]:[]
  const terminalIssues:Violation[]=content.stops.flatMap(stop=>{
    if(!stop.isDisembarkation)return []
    const add=(field:string,message:string):Violation=>({code:'CLIENT_TERMINAL_FIELD',severity:'ERROR',entityType:'STOP',clientKey:stop.clientKey,dayNumber:stop.arrivalDayNumber,field,message})
    const issues:Violation[]=[]
    if(!stop.plannedArrivalTime)issues.push(add('plannedArrivalTime','Nhập giờ tàu dự kiến đến cảng cuối.'))
    if(!stop.plannedDepartureTime)issues.push(add('plannedDepartureTime','Nhập giờ kết thúc dự kiến.'))
    else if(stop.plannedArrivalTime && timeNumber(stop.departureDayNumber,stop.plannedDepartureTime)<=timeNumber(stop.arrivalDayNumber,stop.plannedArrivalTime))issues.push(add('plannedDepartureTime','Giờ kết thúc dự kiến phải sau giờ tàu đến.'))
    if(stop.callType!=='NORMAL')issues.push(add('callType','Chọn kiểu ghé Thông thường cho cảng kết thúc.'))
    if(Boolean(stop.allAboardDayNumber)!==Boolean(stop.allAboardTime))issues.push(add('allAboardTime','Nhập cả ngày và giờ hạn trở lại tàu.'))
    else if(stop.allAboardDayNumber!=null&&stop.allAboardTime&&stop.plannedArrivalTime&&stop.plannedDepartureTime&&(timeNumber(stop.allAboardDayNumber,stop.allAboardTime)<=timeNumber(stop.arrivalDayNumber,stop.plannedArrivalTime)||timeNumber(stop.allAboardDayNumber,stop.allAboardTime)>timeNumber(stop.departureDayNumber,stop.plannedDepartureTime)))issues.push(add('allAboardTime','Hạn trở lại phải nằm trong khoảng ghé cảng.'))
    return issues
  })
  const timingIssues=[...departureIssues,...departureTimingViolations(content),...terminalIssues,...consecutiveSamePortViolations(content),...callsAfterTerminal(content.stops),...stopTimingViolations(content),...routeOrderViolations(content),...content.stops.flatMap(stop=>linkedTourViolations(stop,content)),...scopeIssues]
  const visibleTimingIssues=showMissingFields ? timingIssues : timingIssues.filter(issue => !['DEPARTURE_PORT_REQUIRED','DEPARTURE_TIME_REQUIRED'].includes(issue.code) && !(issue.code==='CLIENT_TERMINAL_FIELD'&&issue.message.startsWith('Nhập')))
  const violationRows=mergePlanningViolations(fault?.violations.length?fault.violations:report?.violations??[],visibleTimingIssues)
  const structureAllowed=editable&&!locked&&!trip.durationIssue&&Boolean(limits)
  const removeDay=dayChange?.remove
  const affectedStops=removeDay?content.stops.filter(s=>s.arrivalDayNumber<=removeDay&&s.departureDayNumber>=removeDay):[]
  const affectedEntries=removeDay?content.entries.filter(e=>e.startDayNumber<=removeDay&&e.endDayNumber>=removeDay):[]
  // Appending also invalidates a point explicitly marked as the final disembarkation.
  const invalidFinal=!removeDay&&content.stops.some(s=>s.isDisembarkation)
  const canSubmit=editable&&canFinalize&&can('TRIP_PLAN_VALIDATE')
  const [validationExpanded,setValidationExpanded]=useState(false)
  const showValidationResult=Boolean(fault?.violations.length||report)
  const canAddDay=structureAllowed&&content.days.length<(limits?.[1]??0)
  const canRemoveDay=Boolean(day&&structureAllowed&&content.days.length>(limits?.[0]??0)&&(gateway.supportsMiddleDayRemoval||day.dayNumber===content.days.length))
  function showValidation(){setValidationExpanded(true);requestAnimationFrame(()=>{const section=document.getElementById('planning-validation');section?.scrollIntoView({block:'center'});section?.focus()})}
  function invalidateCheck(){setReport(null);setValidationExpanded(false)}
  function accept(saved:Version){invalidateCheck();setVersion(saved);setContent(saved.status==='DRAFT'&&editable?{...contentOf(saved),days:normalizeBoundaryDays(saved.days)}:contentOf(saved));setReport(null);setTrip(old=>({...old,versions:old.versions?.map(v=>v.versionId===saved.versionId?saved:v)}))}
  function edit(next:Content){if(!editable||lock.current)return;invalidateCheck();setContent({...next,stops:projectRoute(next).stops,days:normalizeBoundaryDays(next.days)});setShowMissingFields(false);setFault(null);setLocated(null);setMessage('')}
  async function run(label:string,work:()=>Promise<void>,mutation:boolean|(()=>boolean)=true,onFault?:(fault:PlanningFault)=>void){
    if(lock.current)return;lock.current=true;setBusy(label);setFault(null);setMessage('')
    try{await work()}catch(e){const error=failure(e);setFault(error);if((typeof mutation==='function'?mutation():mutation)&&(error.status===0||error.status===409||error.status>=500))setUncertain(true);onFault?.(error)}finally{lock.current=false;setBusy('')}
  }
  async function save(){
    try{const saved=await gateway.save(version,{...content,stops:projectRoute(content).stops});accept(saved);return saved}
    catch(e){const error=failure(e);if(error.status===0||error.status===409||error.status>=500)setUncertain(true);throw error}
  }
  function locate(v:Violation){
    const target=violationTarget(v,content),stop=content.stops.find(s=>s.clientKey===target.key),entry=content.entries.find(e=>e.clientKey===target.key)
    const nextDay=target.dayNumber??stop?.arrivalDayNumber??entry?.startDayNumber??selected
    if(content.days.some(d=>d.dayNumber===nextDay))setSelected(nextDay)
    setLocated(v)
    if(stop)setStopDrawer({stop,violation:v})
    else if(entry)setEntryDrawer({kind:entry.kind,entry,violation:v})
    else requestAnimationFrame(()=>{
      const notice=document.getElementById('planning-located-error')
      const field=target.fieldId?document.getElementById(target.fieldId):null
      const details=field?.closest('details')
      if(details)details.open=true
      const element=field?.matches(':disabled')?notice:field??notice
      element?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'})
      element?.focus({preventScroll:true})
    })
  }
  function switchVersion(id:string){if(lock.current||id===version.versionId)return;if(dirty)setPendingSwitch(id);else {invalidateCheck();onSwitch(id)}}
  async function changeStructure(){
    if(!dayChange||!structureAllowed||!limits||affectedStops.length||affectedEntries.length||invalidFinal)return
    if(removeDay?(content.days.length<=limits[0]||(!gateway.supportsMiddleDayRemoval&&removeDay!==content.days.length)):content.days.length>=limits[1])return
    let savedFirst=false,managed=false
    await run('Đang lưu và cập nhật ngày…',async()=>{
      const saved=await save();savedFirst=true
      try{const currentTrip=await gateway.getTrip(trip.tripId);setTrip(currentTrip);const result=await gateway.changeDay(currentTrip,saved,removeDay);managed=true;setTrip(result.trip);accept(result.version);setSelected(removeDay?Math.min(selected,result.version.days.length):result.version.days.length);setDayChange(null);setMessage('Đã cập nhật ngày.')}catch(e){const error=failure(e);setMessage(error.status===0||error.status>=500?'Đã lưu nháp; chưa xác định được kết quả thêm/xóa ngày.':`Đã lưu nháp, nhưng chưa ${removeDay?'xóa':'thêm'} được ngày.`);if(error.status===0||error.status>=500||error.stage==='reload')setUncertain(true);if(error.code==='TRIP_DURATION_LOCKED'){setServerLocked(true);try{const latest=await gateway.getTrip(trip.tripId);setTrip(latest)}catch{ /* Keep the lock reported by the mutation; never replace the local aggregate. */ }}throw error}
    })
    if(savedFirst||managed)setDayChange(null)
  }
  function focusFinalizeIssue(rows: Violation[]) {
    const first = rows.find(row => {
      if (row.severity !== 'ERROR') return false
      const target = violationTarget(row,content)
      return target.kind === 'stops' && content.stops.some(stop => stop.clientKey === target.key)
        || target.kind === 'entries' && content.entries.some(entry => entry.clientKey === target.key)
        || target.dayNumber != null && content.days.some(day => day.dayNumber === target.dayNumber)
    })
    if (first) {
      setValidationExpanded(false)
      locate(first)
    } else showValidation()
  }
  async function transition(){
    if(!canSubmit||busy)return
    await run('Đang tạo mẫu lịch trình…',async()=>{
      setShowMissingFields(true)
      setLocated(null)
      const localErrors=timingIssues.filter(issue=>issue.severity==='ERROR')
      if(localErrors.length){
        setFault(new PlanningFault('Bổ sung thông tin lịch trình để tạo mẫu.',422,'INCOMPLETE_SCHEDULE',localErrors))
        setMessage('Chưa thể tạo mẫu lịch trình')
        focusFinalizeIssue(localErrors)
        return
      }
      const outcome=await createScheduleTemplate(gateway, async()=>dirty?save():version)
      if(outcome.report){
        setReport(outcome.report)
        setMessage('Chưa thể tạo mẫu lịch trình')
        focusFinalizeIssue(outcome.report.violations)
        return
      }
      accept(outcome.version)
      setMessage('Đã tạo mẫu lịch trình')
    },false,error=>{
      if(error.status===409||error.code==='FINALIZE_UNCERTAIN')setUncertain(true)
      if ((error.status===400||error.status===422)&&error.violations.length)
        focusFinalizeIssue(error.violations)
    })
  }
  function handleDisembarkation(portId: string | null, times: Partial<Pick<Stop, 'plannedArrivalTime' | 'plannedDepartureTime'>> = {}) {
    const endingDayNumber = content.days.length
    const existingIndex = content.stops.findIndex(s => s.isDisembarkation)
    const previous = content.stops[existingIndex]
    if (previous && portId !== previous.portId && content.entries.some(entry => entry.stopClientKey === previous.clientKey)) {
      setMessage('Xử lý các tour bờ đã gắn với cảng kết thúc trước khi đổi cảng.')
      return
    }
    if (!portId) {
      if (existingIndex >= 0) {
        edit({
          ...content,
          stops: content.stops.filter((_, idx) => idx !== existingIndex),
        })
      }
      return
    }
    const port = ports.data.find(p => p.id === portId)
    const portName = port?.name ?? port?.label ?? 'Cảng'
    const timeZoneId = port?.timeZoneId ?? SHIP_ZONE

    if (existingIndex >= 0) {
      const existing = previous
      const updated: Stop = {
        ...existing,
        portId,
        portName,
        timeZoneId,
        countryCode: port?.countryCode ?? existing.countryCode,
        domesticRegion: port?.domesticRegion ?? existing.domesticRegion,
        departureDayNumber: endingDayNumber,
        ...times,
        isDisembarkation: true,
      }
      edit({
        ...content,
        stops: content.stops.map((s, idx) => (idx === existingIndex ? updated : s)),
      })
    } else {
      const newStop: Stop = {
        clientKey: newKey(),
        portId,
        portName,
        stopOrder: Math.max(0, ...content.stops.map(s => s.stopOrder)) + 1,
        arrivalDayNumber: endingDayNumber,
        plannedArrivalTime: times.plannedArrivalTime ?? null,
        departureDayNumber: endingDayNumber,
        plannedDepartureTime: times.plannedDepartureTime ?? null,
        callType: 'NORMAL',
        arrivalMethod: 'BERTH',
        timeZoneId,
        countryCode: port?.countryCode,
        domesticRegion: port?.domesticRegion ?? null,
        allAboardDayNumber: null,
        allAboardTime: null,
        isEmbarkation: false,
        isDisembarkation: true,
      }
      edit({
        ...content,
        stops: [...content.stops, newStop],
      })
    }
  }

  const switchNow=(id:string)=>{invalidateCheck();guard.allowLeave();setPendingSwitch('');onSwitch(id)}
  return <>
    {templatePreview&&<PublishedTemplateDialog trip={trip} onClose={()=>setTemplatePreview(false)}/>}
    {version.status==='IN_REVIEW'&&<Notice title="Mẫu theo quy trình duyệt cũ · Chỉ xem">Quy trình duyệt mẫu đã dừng. Nội dung, trạng thái và lịch sử của phiên bản này được giữ nguyên.</Notice>}
    <div className={styles.editorTop}>
      <header className={styles.editorHeading}>
        <div className={styles.editorTitle}>
          <h1>{trip.name}</h1>
          <div className={styles.editorMeta}>
            <span>{content.days.length} ngày</span>
            {trip.tripType && <span>{trip.tripType === 'ROUND_TRIP' ? 'Khứ hồi' : 'Một chiều'}</span>}
            <span>{trip.tripCode}</span>
            <Badge tone={version.status === 'PUBLISHED' ? 'success' : version.status === 'DRAFT' || version.status === 'IN_REVIEW' ? 'warning' : 'neutral'} label={version.status === 'DRAFT' ? 'Bản nháp' : versionLabels[version.status]} />
          </div>
        </div>
        <Link className={styles.versionLink} to={root}>Về danh sách khung chuyến</Link>
      </header>
      <div className={styles.versionContext}>
        <details className={styles.scheduleHistoryMeta}>
          <summary>Bản lịch trình và lịch sử</summary>
          <div className={styles.editorVersionTools}>
            {(trip.versions?.length??0)>1?<Field htmlFor="planning-version" label="Bản lịch trình đang xem"><select id="planning-version" value={version.versionId} disabled={Boolean(busy)} onChange={e=>switchVersion(e.target.value)}>{trip.versions?.toSorted((a,b)=>b.versionNumber-a.versionNumber).map(v=><option key={v.versionId} value={v.versionId}>Bản {v.versionNumber} — {versionLabels[v.status]}</option>)}</select></Field>:null}
            <Link to={`${root}/${trip.tripId}/info`}>Thông tin khung chuyến</Link>
            <Button tone="text" size="compact" disabled={Boolean(busy)} onClick={()=>setHistory(true)}>Xem lịch sử thay đổi</Button>
          </div>
          {versions.working&&versions.working.versionId!==version.versionId&&<p>{workingVersionLabel(versions.working.status)}: bản {versions.working.versionNumber}</p>}
          {version.creatorName && <p>Người lập lịch: {version.creatorName}</p>}
          {version.createdAt && <p>Ngày tạo: {new Date(version.createdAt).toLocaleDateString('vi-VN', { timeZone:'Asia/Ho_Chi_Minh' })}</p>}
          {version.publishedAt && <p>Chốt lịch lúc {new Date(version.publishedAt).toLocaleString('vi-VN', { timeZone:'Asia/Ho_Chi_Minh' })}{version.publishedByName ? ' bởi ' + version.publishedByName : ''}</p>}
          {version.sourceVersionId && <p>Dựa trên {trip.versions?.find(v=>v.versionId===version.sourceVersionId)?.versionNumber != null ? 'bản ' + trip.versions.find(v=>v.versionId===version.sourceVersionId)!.versionNumber : 'mẫu đã lưu'}</p>}
        </details>
        <div className={styles.actions}>
          {versions.published&&versions.published.versionId!==version.versionId&&<Button tone="text" size="compact" disabled={Boolean(busy)} onClick={()=>setTemplatePreview(true)}>Xem mẫu đã chốt · V{versions.published.versionNumber}</Button>}
          {versions.working&&versions.working.versionId!==version.versionId&&<Button tone="secondary" size="compact" disabled={Boolean(busy)} onClick={()=>switchVersion(versions.working!.versionId)}>{can('TRIP_PLAN_WRITE')&&versions.working.status==='DRAFT'?'Tiếp tục bản nháp':versions.working.status==='DRAFT'?'Xem bản nháp':'Xem bản chờ duyệt'} · V{versions.working.versionNumber}</Button>}
          {onNew&&!versions.working&&!(version.status==='DRAFT'||version.status==='IN_REVIEW')&&<Button tone="secondary" size="compact" disabled={dirty||Boolean(busy)} onClick={onNew}>Tạo bản chỉnh sửa</Button>}
        </div>
      </div>
    </div>
    {uncertain&&<Notice title="Cần đối chiếu dữ liệu trước khi tiếp tục" tone="warning"><Button disabled={Boolean(busy)} onClick={()=>setCompare(true)}>Đối chiếu bản đã lưu</Button></Notice>}
    {!editable&&version.status==='DRAFT'&&!uncertain&&<p className={styles.muted}>Chỉ xem · {trip.status==='ARCHIVED'?'Chuyến đã lưu trữ':'Tài khoản không có quyền chỉnh sửa'}</p>}
    {version.rejectionReason&&<Notice title={version.status==='CANCELLED'?'Lý do hủy bản nháp':'Lý do trả lại'} tone="warning">{version.rejectionReason}</Notice>}
    {trip.durationIssue&&<Notice title="Cần kiểm tra thời lượng" tone="warning">{trip.durationIssue}</Notice>}
    {fault&&<Notice title="Chưa hoàn tất thao tác" tone="error">{fault.message}{uncertain&&<Button onClick={()=>setCompare(true)} disabled={Boolean(busy)}>Đối chiếu bản đã lưu</Button>}</Notice>}

    <div className={styles.layout}>
      <nav className={`${styles.rail} ${styles.dayNavigator}`} aria-label="Hành trình">
        <h2>Hành trình {content.days.length} ngày</h2>
        <ol className={styles.routeDays}>{routeDays.map(({day: routeDay, role, place, points}) => (
          <li key={routeDay.key}>
            <button type="button" className={styles.dayButton} aria-current={day?.key === routeDay.key} aria-controls="planning-day-panel" onClick={() => setSelected(routeDay.dayNumber)}>
              <span className={styles.routeNumber} aria-hidden="true">{routeDay.dayNumber}</span>
              <span className={styles.routeDayInfo}><small>Ngày {routeDay.dayNumber}{role && ` — ${role}`}</small>
                {points.length ? points.map(point => <span className={styles.routePoint} key={point.key}>
                  <strong>{point.name}</strong>
                  <small className={styles.routePointTime}>
                    <span>{point.clockLabel}</span>{point.clock && <> <b className={styles.routeClock}>{shortTime(point.clock)}</b></>}
                  </small>
                </span>) : <strong>{place}</strong>}
              </span>
            </button>
          </li>
        ))}</ol>
        {editable&&(canAddDay||canRemoveDay)&&<details className={styles.manageDays}>
          <summary>Thêm hoặc xóa ngày</summary>
          {canAddDay&&<Button tone="secondary" size="compact" disabled={Boolean(busy)} onClick={()=>setDayChange({})}>Thêm Ngày {content.days.length+1}</Button>}
          {canRemoveDay&&day&&<Button tone="secondary" size="compact" disabled={Boolean(busy)} onClick={()=>setDayChange({remove:day.dayNumber})}>Xóa Ngày {day.dayNumber}</Button>}
          {!gateway.supportsMiddleDayRemoval&&content.days.length>(limits?.[0]??0)&&!canRemoveDay&&<small>Mở Ngày {content.days.length} để xóa ngày cuối.</small>}
        </details>}
      </nav>
      <section id="planning-day-panel" aria-label="Ngày đang xem">{day?<DayPane key={day.key} content={content} day={day} editable={canEdit} busy={Boolean(busy)||uncertain} violation={located} violations={violationRows} departurePorts={{...ports,data:ports.data.filter(port=>portMatchesScope(port,trip.info))}} onDeparture={value=>edit({...content,days:content.days.map(d=>d.key===day.key?{...d,...value}:d)})} onDisembarkation={handleDisembarkation}
        onTitle={title=>edit({...content,days:content.days.map(d=>d.key===day.key?{...d,title}:d)})}
        onType={dayType=>{if(dayType==='SEA_DAY'&&content.stops.some(s=>s.arrivalDayNumber<=day.dayNumber&&s.departureDayNumber>=day.dayNumber)){setMessage('Ngày còn lần ghé cảng. Hãy xử lý lần ghé và tham quan liên quan trước khi chuyển thành ngày trên biển.');return}edit({...content,days:content.days.map(d=>d.key===day.key?{...d,dayType}:d)})}}
        onStop={stop=>setStopDrawer({stop})} onEntry={(kind,entry,stopClientKey)=>setEntryDrawer({kind,entry,stopClientKey})}
        onRemoveStop={s=>setRemoval({kind:'stop',key:s.clientKey})} onRemoveEntry={e=>{if(e.kind!=='SERVING_WINDOW')setRemoval({kind:'entry',key:e.clientKey})}}
        />:<Empty title="Phiên bản chưa có ngày"/>}</section></div>
    {located&&<div id="planning-located-error" tabIndex={-1}><Notice title="Cần sửa trước khi chốt" tone="warning">{located.message}{(located.entityType==='TRIP'||located.fieldPath?.startsWith('trip.'))&&<Link to={`${root}/${trip.tripId}/info`}>Mở thông tin chuyến</Link>}</Notice></div>}
    {version.status==='PUBLISHED'?<DepartureSourceSummary trip={trip} version={version}/>:<footer className={styles.footer} aria-label="Thao tác lịch trình" aria-busy={Boolean(busy)}>
      <div className={styles.saveState} role="status"><span>{busy||message||(version.status==='DRAFT'?'Lịch trình đang soạn':versionLabels[version.status])}</span></div>
      <div className={styles.actions}>
        {showValidationResult&&<Button tone="text" size="compact" aria-expanded={validationExpanded} aria-controls={validationExpanded?'planning-validation':undefined} onClick={()=>validationExpanded?setValidationExpanded(false):showValidation()}>{validationExpanded?'Ẩn chi tiết':'Xem thông tin cần bổ sung'}</Button>}
        {canSubmit&&<Button busy={Boolean(busy)} onClick={()=>void transition()}>{businessCopy('trip.template.FINALIZE_ACTION')}</Button>}
      </div>
    </footer>}
    {showValidationResult&&validationExpanded&&<div id="planning-validation" className={styles.validation} tabIndex={-1}>
      <ValidationPanel report={fault?.violations.length?null:report} serverErrors={Boolean(fault?.violations.length)} violations={violationRows} onLocate={locate}/>
    </div>}
    {stopDrawer&&day&&<StopDrawer tripId={trip.tripId} tripRevision={trip.revision} tripInfo={trip.info} key={stopDrawer.stop?.clientKey??'new-stop'} content={content} dayNumber={day.dayNumber} readOnly={!editable||Boolean(busy)} stop={stopDrawer.stop} violation={stopDrawer.violation} onClose={()=>setStopDrawer(null)} onApply={stop=>{edit({...content,stops:content.stops.some(s=>s.clientKey===stop.clientKey)?content.stops.map(s=>s.clientKey===stop.clientKey?stop:s):[...content.stops,stop]});setStopDrawer(null)}}/>}
    {entryDrawer&&day&&<EntryDrawer key={entryDrawer.entry?.clientKey??`${entryDrawer.kind}:${selected}:${entryDrawer.stopClientKey??'new'}`} content={content} dayNumber={day.dayNumber} readOnly={!editable||Boolean(busy)||entryDrawer.kind!=='SHORE_EXCURSION'} kind={entryDrawer.kind} entry={entryDrawer.entry} initialStopClientKey={entryDrawer.stopClientKey} violation={entryDrawer.violation} onClose={()=>setEntryDrawer(null)} onApply={entries=>{const keys=new Set(entries.map(e=>e.clientKey));edit({...content,entries:[...content.entries.filter(e=>!keys.has(e.clientKey)),...entries]});setEntryDrawer(null)}}/>}
    {removal&&!(removal.kind==='entry'&&content.entries.some(e=>e.clientKey===removal.key&&e.kind==='SERVING_WINDOW'))&&<Modal title={removal.kind==='stop'?'Xóa lần ghé cảng?':'Xóa mục chương trình?'} onClose={()=>setRemoval(null)} footer={<><Button tone="secondary" onClick={()=>setRemoval(null)}>Giữ lại</Button><Button tone="danger" disabled={!editable||Boolean(busy)||(removal.kind==='stop'&&content.entries.some(e=>e.stopClientKey===removal.key))} onClick={()=>{edit(removal.kind==='stop'?{...content,stops:content.stops.filter(s=>s.clientKey!==removal.key)}:{...content,entries:content.entries.filter(e=>e.clientKey!==removal.key)});setRemoval(null)}}>Xóa khỏi bản nháp</Button></>}><p>Mục này sẽ được bỏ khỏi lịch trình đang soạn.</p>{removal.kind==='stop'&&content.entries.some(e=>e.stopClientKey===removal.key)?<Notice title="Còn nội dung liên quan" tone="warning">Hãy xử lý các tham quan gắn với lần ghé này trước. Không tự xóa nội dung liên quan.</Notice>:<p>Mục qua nhiều ngày sẽ được xóa ở cả các ngày tiếp diễn.</p>}</Modal>}
    {dayChange&&<Modal title={removeDay?`Xóa Ngày ${removeDay}?`:'Thêm ngày vào chuyến?'} onClose={()=>{if(!busy)setDayChange(null)}} footer={<><Button tone="secondary" disabled={Boolean(busy)} onClick={()=>setDayChange(null)}>Hủy</Button><Button tone={removeDay ? "danger" : "primary"} busy={Boolean(busy)} disabled={!structureAllowed||Boolean(affectedStops.length||affectedEntries.length||invalidFinal)} onClick={()=>void changeStructure()}>{removeDay ? `Xóa Ngày ${removeDay}` : `Thêm Ngày ${content.days.length+1}`}</Button></>}><p>Nội dung đang chỉnh sẽ được lưu trước. Số ngày sẽ thay đổi ở mọi phiên bản nháp của chuyến.</p>{!gateway.supportsMiddleDayRemoval&&<Notice title="Lưu trước khi thay đổi số ngày" tone="warning">Nội dung được lưu trước khi cập nhật số ngày. Nếu cập nhật số ngày thất bại, bản nháp đã lưu vẫn được giữ.</Notice>}{removeDay&&<p>Ảnh hưởng: {affectedStops.length} lần ghé cảng, {affectedEntries.length} mục chương trình bao phủ ngày này. Các mục qua ngày cũng được tính.</p>}{Boolean(affectedStops.length||affectedEntries.length)&&<Notice title="Chưa thể xóa ngày" tone="warning">Hãy xử lý các mục liên quan trước. Không tự xóa dữ liệu hoặc cắt mục qua ngày.</Notice>}{invalidFinal&&<Notice title="Cảng kết thúc chuyến đang ở ngày cuối" tone="warning">Bỏ lựa chọn cảng hành khách kết thúc chuyến trong bản nháp trước khi thêm ngày, rồi chọn lại ở ngày cuối mới.</Notice>}</Modal>}
    {pendingSwitch&&<Modal title="Đổi phiên bản khi còn thay đổi?" onClose={()=>setPendingSwitch('')} footer={<><Button tone="secondary" disabled={Boolean(busy)} onClick={()=>setPendingSwitch('')}>Ở lại</Button><Button tone="danger" disabled={Boolean(busy)} onClick={()=>switchNow(pendingSwitch)}>Bỏ thay đổi và chuyển</Button>{editable&&<Button disabled={Boolean(busy)} onClick={()=>void run('Đang lưu nháp…',async()=>{await save();switchNow(pendingSwitch)})}>Lưu rồi chuyển</Button>}</>}><p>Chuyển phiên bản sẽ thay nội dung trên màn hình. Chọn rõ cách xử lý bản nháp hiện tại.</p></Modal>}
    {history&&<HistoryDialog tripId={trip.tripId} versionId={version.versionId} onClose={()=>setHistory(false)}/>}
    {compare&&<ConflictDialog trip={trip} version={version} local={content} onClose={()=>setCompare(false)} onReconcile={(fault?.code==='STALE_REVISION'||fault?.code==='STALE_VALIDATION')?(serverTrip,serverVersion)=>{invalidateCheck();setTrip(serverTrip);setVersion(serverVersion);setUncertain(false);setFault(null);setCompare(false);setMessage('Đã đối chiếu bản mới. Kiểm tra nội dung cần giữ rồi tạo mẫu lại.')}:undefined} onReplace={(serverTrip,serverVersion)=>{setTrip(serverTrip);accept(serverVersion);setUncertain(false);setFault(null);setCompare(false);setSelected(n=>Math.min(n,serverVersion.days.length));setMessage('Đã dùng bản máy chủ theo xác nhận của bạn.')}}/>}{guard.prompt}
  </>
}

