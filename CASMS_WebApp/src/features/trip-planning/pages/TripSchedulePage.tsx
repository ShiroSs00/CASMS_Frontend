import { departureReturn } from '@/shared/lib/departure-return'
import { businessCopy } from '@/shared/i18n/business-copy'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { Badge, Button, Empty, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import { usePlanning, useSources, useUnsavedGuard } from '../hooks'
import { failure } from '../api/live'
import type { PlanningFault } from '../api/gateway'
import { contentOf, versionLabels, type Content, type Entry, type Stop, type Trip, type Version, type Violation } from '../model/plan'
import { DepartureSourceSummary } from '../components/DepartureSourceSummary'
import { DayPane } from '../components/DayPane'
import { TripSteps } from '../components/TripSteps'
import { EntryDrawer, StopDrawer } from '../components/PlanDrawers'
import { ConflictDialog, HistoryDialog, ValidationPanel } from '../components/ReviewDialogs'
import type { Report } from '../model/plan'
import styles from '../Planning.module.css'
import { violationTarget } from '../model/violation-target'
import { dayBoundaryLabel } from '../model/day-labels'
import { versionContext, workingVersionLabel } from '../model/version-context'
import { durationRules, supportedDuration } from '../model/duration'
import { stopTimingViolations, portScopeViolations, linkedTourViolations, routeOrderViolations } from '../model/port-rules'

export function TripSchedulePage({id}:{id:string}) {
  const {gateway}=usePlanning()
  const query=useReadQuery('planning-trip:'+id,useCallback(signal=>gateway.getTrip(id,signal),[gateway,id]))
  const [params]=useSearchParams(),location=useLocation()
  const returnTo=departureReturn(params.get('returnTo'))
  return <>
    {returnTo&&<p className={styles.note}><Link to={returnTo} state={location.state}>← Quay lại lần khởi hành</Link></p>}
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
  const creating=useRef(false)
  const query=useReadQuery('planning-version:'+chosen,useCallback(async signal=>{
    if(!chosen){if(params.get('view')==='published')throw new Error('Chuyến này hiện chưa có mẫu lịch trình đã chốt. Hãy mở bản nháp để tiếp tục.');if(params.has('versionId'))throw new Error('Liên kết thiếu mã phiên bản. Hãy chọn lại từ danh sách phiên bản của chuyến.');return null}
    const version=await gateway.version(chosen,signal)
    if(version.tripId!==trip.tripId)throw new Error('Phiên bản trong liên kết không thuộc chuyến này. Không tự chuyển sang phiên bản khác.')
    return version
  },[gateway,chosen,trip.tripId,params]))
  async function createVersion(){
    if(creating.current||!can('TRIP_PLAN_WRITE')||gateway.readOnly||trip.status==='ARCHIVED')return
    const unfinished=trip.versions?.find(v=>v.status==='DRAFT'||v.status==='IN_REVIEW')
    if(unfinished){setChosen(unfinished.versionId);setCreate(false);return}
    creating.current=true;setBusy(true);setError('')
    try{const version=await gateway.createVersion(trip,source||undefined);setTrip(old=>({...old,versions:[...(old.versions??[]),version]}));setChosen(version.versionId);setCreate(false)}catch(e){setError(failure(e).message)}finally{creating.current=false;setBusy(false)}
  }
  const newVersion=can('TRIP_PLAN_WRITE')&&!gateway.readOnly&&trip.status!=='ARCHIVED'?()=>{setSource(trip.versions?.filter(v=>v.status==='PUBLISHED').at(-1)?.versionId??'');setCreate(true)}:undefined
  return <>
    {query.loading?<Loading label="Đang tải phiên bản lịch trình…"/>:query.error?<Notice title="Chưa mở được phiên bản" tone="error">{query.error.message}<div className={styles.actions}><Button onClick={query.retry}>Tải lại</Button><Link to={root}>Về danh sách chuyến</Link>{trip.versions?.map(v=><Button key={v.versionId} onClick={()=>setChosen(v.versionId)}>Mở phiên bản {v.versionNumber}</Button>)}</div></Notice>:query.data?<VersionEditor key={query.data.versionId} initial={query.data} trip={trip} setTrip={setTrip} onSwitch={setChosen} onNew={newVersion}/>:<Panel title={trip.name}><Empty title="Chưa có phiên bản lịch trình"/><Link to={root}>Về danh sách</Link>{newVersion&&<Button onClick={newVersion}>Tạo phiên bản nháp</Button>}</Panel>}
    {create&&<Modal title="Tạo phiên bản lịch trình" onClose={()=>{if(!busy)setCreate(false)}} footer={<><Button tone="secondary" disabled={busy} onClick={()=>setCreate(false)}>Hủy</Button><Button disabled={busy} onClick={()=>void createVersion()}>{trip.versions?.some(v=>v.status==='DRAFT'||v.status==='IN_REVIEW')?'Mở bản chưa hoàn tất':busy?'Đang tạo…':'Tạo bản nháp'}</Button></>}>
      <p>Chỉ tạo bản nháp mới khi không còn bản nháp hoặc mẫu cần xử lý theo quy trình cũ của khung chuyến này.</p>
      <Field htmlFor="planning-source-version" label="Nguồn nội dung"><select id="planning-source-version" value={source} disabled={busy} onChange={e=>setSource(e.target.value)}><option value="">Nội dung trống theo số ngày của chuyến</option>{trip.versions?.filter(v=>v.status==='PUBLISHED').map(v=><option key={v.versionId} value={v.versionId}>Phiên bản {v.versionNumber} · Mẫu đã chốt</option>)}</select></Field>
      {error&&<Notice title="Chưa tạo được phiên bản" tone="error">{error}<Button disabled={busy} onClick={()=>void gateway.getTrip(trip.tripId).then(setTrip).catch(e=>setError(failure(e).message))}>Đọc lại danh sách phiên bản</Button></Notice>}
    </Modal>}
  </>
}
type EditorProps={initial:Version;trip:Trip;setTrip:React.Dispatch<React.SetStateAction<Trip>>;onSwitch:(id:string)=>void;onNew?:()=>void}
function VersionEditor({initial,trip,setTrip,onSwitch,onNew}:EditorProps) {
  const {gateway,root,can}=usePlanning(),[version,setVersion]=useState(initial),[content,setContent]=useState<Content>(()=>contentOf(initial))
  const [tab,setTab]=useState<'route'|'program'>('route'),[selected,setSelected]=useState(1),[busy,setBusy]=useState(''),lock=useRef(false)
  const [fault,setFault]=useState<PlanningFault|null>(null),[message,setMessage]=useState(''),[report,setReport]=useState<Report|null>(null),[uncertain,setUncertain]=useState(false),[serverLocked,setServerLocked]=useState(false)
  const [history,setHistory]=useState(false),[compare,setCompare]=useState(false),[pendingSwitch,setPendingSwitch]=useState('')
  const [stopDrawer,setStopDrawer]=useState<{stop?:Stop;violation?:Violation}|null>(null),[entryDrawer,setEntryDrawer]=useState<{kind:Entry['kind'];entry?:Entry;stopClientKey?:string;violation?:Violation}|null>(null)
  const [located,setLocated]=useState<Violation|null>(null)
  const [removal,setRemoval]=useState<{kind:'stop'|'entry';key:string}|null>(null),[dayChange,setDayChange]=useState<{remove?:number}|null>(null)
  const [action,setAction]=useState<'finalize'|null>(null)
  const [lifecycle,setLifecycle]=useState<'cancel'|'withdraw'|null>(null),[lifecycleReason,setLifecycleReason]=useState('')
  const dirty=JSON.stringify(content)!==JSON.stringify(contentOf(version)),guard=useUnsavedGuard(dirty,Boolean(busy))
  const versions=versionContext(trip.versions)
  const editable=version.status==='DRAFT'&&can('TRIP_PLAN_WRITE')&&!gateway.readOnly&&trip.status!=='ARCHIVED'&&!uncertain
  const locked=serverLocked||Boolean(trip.structuralLockedAt||trip.versions?.some(v=>v.status==='PUBLISHED'))
  const limits=supportedDuration(trip.info.durationBand)?[durationRules[trip.info.durationBand].minDays,durationRules[trip.info.durationBand].maxDays]:null
  const day=content.days.find(d=>d.dayNumber===selected)??content.days[0]
  const ports=useSources('ports',{tripId:trip.tripId},editable,trip.revision)
  const scopeIssues=editable&&!ports.loading&&!ports.error?portScopeViolations(content,trip.info,ports.data):[]
  const timingIssues=[...stopTimingViolations(content),...routeOrderViolations(content),...content.stops.flatMap(stop=>linkedTourViolations(stop,content)),...scopeIssues]
  const violationRows=[...(fault?.violations.length?fault.violations:report?.violations??[]),...timingIssues]
  const structureAllowed=editable&&!locked&&!trip.durationIssue&&Boolean(limits)
  const removeDay=dayChange?.remove
  const affectedStops=removeDay?content.stops.filter(s=>s.arrivalDayNumber<=removeDay&&s.departureDayNumber>=removeDay):[]
  const affectedEntries=removeDay?content.entries.filter(e=>e.startDayNumber<=removeDay&&e.endDayNumber>=removeDay):[]
  // Appending also invalidates a point explicitly marked as the final disembarkation.
  const invalidFinal=!removeDay&&content.stops.some(s=>s.isDisembarkation)
  const blockingRows=violationRows.filter(v=>v.severity==='ERROR')
  const canSubmit=version.status==='DRAFT'&&can('TRIP_PLAN_WRITE')&&!gateway.readOnly
  function showValidation(){requestAnimationFrame(()=>{const section=document.getElementById('planning-validation');if(section instanceof HTMLDetailsElement)section.open=true;section?.scrollIntoView({block:'center'});section?.focus()})}
  async function checkSchedule(){
    if(!can('TRIP_PLAN_VALIDATE')||uncertain||gateway.readOnly||trip.status==='ARCHIVED'||(dirty&&!editable))return
    await run('Đang kiểm tra lịch trình…',async()=>{
      const target=dirty?await save():version
      setReport(null)
      if(dirty)setMessage('Đã lưu nháp. Nếu kiểm tra chưa hoàn tất, hãy thử kiểm tra lại.')
      const result=await gateway.validate(target)
      if(result.versionId!==target.versionId||result.revision!==target.revision)throw new Error('Chưa xác nhận được kết quả kiểm tra. Hãy đối chiếu dữ liệu đã lưu.')
      setReport(result);setMessage('');showValidation()
    },false)
  }
  function accept(saved:Version){setVersion(saved);setContent(contentOf(saved));setReport(null);setTrip(old=>({...old,versions:old.versions?.map(v=>v.versionId===saved.versionId?saved:v)}))}
  function edit(next:Content){if(!editable||lock.current)return;setContent(next);setReport(null);setFault(null);setLocated(null);setMessage('')}
  async function run(label:string,work:()=>Promise<void>,mutation:boolean|(()=>boolean)=true){
    if(lock.current)return;lock.current=true;setBusy(label);setFault(null);setMessage('')
    try{await work()}catch(e){const error=failure(e);setFault(error);if((typeof mutation==='function'?mutation():mutation)&&(error.status===0||error.status===409||error.status>=500))setUncertain(true)}finally{lock.current=false;setBusy('')}
  }
  async function save(){
    try{const saved=await gateway.save(version,content);accept(saved);return saved}
    catch(e){const error=failure(e);if(error.status===0||error.status===409||error.status>=500)setUncertain(true);throw error}
  }
  function locate(v:Violation){
    const target=violationTarget(v),stop=content.stops.find(s=>s.clientKey===target.key),entry=content.entries.find(e=>e.clientKey===target.key)
    const nextDay=target.dayNumber??stop?.arrivalDayNumber??entry?.startDayNumber??selected
    if(content.days.some(d=>d.dayNumber===nextDay))setSelected(nextDay)
    setLocated(v);setAction(null);setTab(entry||target.kind==='entries'?'program':'route')
    if(stop)setStopDrawer({stop,violation:v})
    else if(entry)setEntryDrawer({kind:entry.kind,entry,violation:v})
    else requestAnimationFrame(()=>{const element=document.getElementById(target.fieldId??'planning-located-error');element?.scrollIntoView({behavior:'smooth',block:'center'});if(element instanceof HTMLInputElement||element instanceof HTMLSelectElement){if(element.disabled)document.getElementById('planning-located-error')?.focus();else element.focus()}else element?.focus()})
  }
  function switchVersion(id:string){if(id===version.versionId)return;if(dirty)setPendingSwitch(id);else onSwitch(id)}
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
  async function transition(){
    if(action!=='finalize'||!editable||uncertain||!can('TRIP_PLAN_VALIDATE'))return
    let transitionStarted=false
    await run(businessCopy('trip.template.FINALIZE_ACTION'),async()=>{
      const target=dirty?await save():version
      const checked=await gateway.validate(target)
      if(checked.versionId!==target.versionId||checked.revision!==target.revision)throw new Error('Phiên bản bạn đang xem không còn mới. Tải lại để đối chiếu trước khi tiếp tục.')
      setReport(checked)
      if(!checked.validForSubmit||checked.violations.some(v=>v.severity==='ERROR')||timingIssues.length){setAction(null);showValidation();return}
      transitionStarted=true
      const saved=await gateway.action(target,'finalize')
      if(saved.status!=='PUBLISHED')throw new Error('Hệ thống chưa xác nhận được kết quả. Vui lòng kiểm tra lại trạng thái trước khi gửi tiếp.')
      accept(saved);setAction(null)
      setTrip(await gateway.getTrip(trip.tripId))
      setMessage(businessCopy('trip.template.PUBLISHED'))
    },()=>transitionStarted)
  }
  async function changeLifecycle(){
    if(!lifecycle||uncertain||gateway.readOnly||trip.status==='ARCHIVED'||lifecycleReason.trim().length>500)return
    if(lifecycle==='cancel'&&(version.status!=='DRAFT'||!can('TRIP_PLAN_WRITE')))return
    if(lifecycle==='withdraw'&&(version.status!=='IN_REVIEW'||(!can('TRIP_PLAN_WRITE')&&!can('TRIP_PLAN_WRITE'))))return
    await run(lifecycle==='cancel'?'Đang hủy bản nháp…':'Đang thu hồi mẫu theo quy trình cũ…',async()=>{
      const saved=await gateway.action(version,lifecycle,lifecycleReason)
      accept(saved);setLifecycle(null);setMessage(lifecycle==='cancel'?'Đã hủy bản nháp. Nội dung và lịch sử vẫn được giữ; bạn có thể tạo phiên bản mới.':'Đã thu hồi mẫu theo quy trình cũ. Phiên bản trở về bản nháp để chỉnh sửa.')
      try{setTrip(await gateway.getTrip(trip.tripId))}catch(e){setFault(failure(e));setUncertain(true)}
    })
  }
  const switchNow=(id:string)=>{guard.allowLeave();setPendingSwitch('');onSwitch(id)}
  return <>
    <div className={styles.editorTop}>
      <header className={styles.editorHeading}>
        <div className={styles.editorTitle}><h1>{trip.name}</h1><div className={styles.editorMeta}><span>{trip.tripCode} · {content.days.length} ngày</span><Badge tone={version.status==='PUBLISHED'?'success':version.status==='IN_REVIEW'?'warning':'neutral'} label={`${versionLabels[version.status]} · V${version.versionNumber}`}/></div></div>
        <div className={styles.editorVersionTools}>
          {(trip.versions?.length??0)>1?<Field htmlFor="planning-version" label="Phiên bản lịch trình"><select id="planning-version" value={version.versionId} disabled={Boolean(busy)} onChange={e=>switchVersion(e.target.value)}>{trip.versions?.toSorted((a,b)=>b.versionNumber-a.versionNumber).map(v=><option key={v.versionId} value={v.versionId}>V{v.versionNumber} · {versionLabels[v.status]}</option>)}</select></Field>:null}
          <Button tone="text" size="compact" disabled={Boolean(busy)} onClick={()=>setHistory(true)}>Lịch sử</Button><Link to={root}>Danh sách chuyến</Link>
        </div>
      </header>
      <div className={styles.versionContext}>
        <span>{versions.published?`Mẫu đã chốt: V${versions.published.versionNumber}`:'Chưa có mẫu đã chốt'}{versions.working?` · ${workingVersionLabel(versions.working.status)}: V${versions.working.versionNumber}`:''}</span>
        <div className={styles.actions}>
          {versions.published&&versions.published.versionId!==version.versionId&&<Button tone="text" size="compact" disabled={Boolean(busy)} onClick={()=>switchVersion(versions.published!.versionId)}>Xem mẫu đã chốt · V{versions.published.versionNumber}</Button>}
          {versions.working&&versions.working.versionId!==version.versionId&&<Button tone="secondary" size="compact" disabled={Boolean(busy)} onClick={()=>switchVersion(versions.working!.versionId)}>{can('TRIP_PLAN_WRITE')&&versions.working.status==='DRAFT'?'Tiếp tục bản nháp':versions.working.status==='DRAFT'?'Xem bản nháp':'Xem bản chờ duyệt'} · V{versions.working.versionNumber}</Button>}
          {onNew&&!versions.working&&!(version.status==='DRAFT'||version.status==='IN_REVIEW')&&<Button tone="secondary" size="compact" disabled={dirty||Boolean(busy)} onClick={onNew}>Tạo bản chỉnh sửa</Button>}
        </div>
      </div>
      <TripSteps stage="schedule" tripId={trip.tripId} status={version.status} compact/>
    </div>
    {uncertain&&<Notice title="Cần đối chiếu dữ liệu trước khi tiếp tục" tone="warning"><Button disabled={Boolean(busy)} onClick={()=>setCompare(true)}>Đối chiếu bản đã lưu</Button></Notice>}
    {!editable&&version.status==='DRAFT'&&!uncertain&&<p className={styles.muted}>Chỉ xem · {trip.status==='ARCHIVED'?'Chuyến đã lưu trữ':'Tài khoản không có quyền chỉnh sửa'}</p>}
    {version.rejectionReason&&<Notice title={version.status==='CANCELLED'?'Lý do hủy bản nháp':'Lý do trả lại'} tone="warning">{version.rejectionReason}</Notice>}
    {trip.durationIssue&&<Notice title="Cần kiểm tra thời lượng" tone="warning">{trip.durationIssue}</Notice>}
    {fault&&<Notice title="Chưa hoàn tất thao tác" tone="error">{fault.message}{uncertain&&<Button onClick={()=>setCompare(true)} disabled={Boolean(busy)}>Đối chiếu bản đã lưu</Button>}</Notice>}

    <div className={styles.tabs} role="tablist" aria-label="Nội dung lịch trình">{(['route','program'] as const).map(value=><button key={value} role="tab" tabIndex={tab===value?0:-1} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'route':e.key==='End'?'program':tab==='route'?'program':'route';setTab(next);document.getElementById(`planning-tab-${next}`)?.focus()}}} aria-selected={tab===value} aria-controls="planning-day-panel" id={`planning-tab-${value}`} onClick={()=>setTab(value)}>{value==='route'?'Tuyến tàu':'Chương trình ngày'}</button>)}</div>
    <div className={styles.layout}><nav className={styles.rail} aria-label="Các ngày của chuyến"><strong className={styles.railTitle}>Các ngày</strong>{content.days.map(d=><button key={d.key} className={styles.dayButton} aria-current={day?.key===d.key} onClick={()=>setSelected(d.dayNumber)}><strong>Ngày {d.dayNumber}</strong>{dayBoundaryLabel(d.dayNumber,content.days.length)&&<small><strong>{dayBoundaryLabel(d.dayNumber,content.days.length)}</strong></small>}<small>{d.dayType==='PORT_DAY'?'Ghé cảng':d.dayType==='SEA_DAY'?'Trên biển':'Chưa chọn loại ngày'}</small><small>{content.entries.filter(e=>e.startDayNumber<=d.dayNumber&&e.endDayNumber>=d.dayNumber).length} mục chương trình</small></button>)}{editable&&<><Button tone="secondary" disabled={Boolean(busy)||!structureAllowed||content.days.length>=(limits?.[1]??0)} title={locked?'Số ngày đã khóa vì khung chuyến có mẫu đã chốt':content.days.length>=(limits?.[1]??0)?'Đã đạt số ngày tối đa của nhóm thời lượng':undefined} onClick={()=>setDayChange({})}>Thêm ngày</Button><Button tone="secondary" disabled={Boolean(busy)||!structureAllowed||content.days.length<=(limits?.[0]??0)||(!gateway.supportsMiddleDayRemoval&&day?.dayNumber!==content.days.length)} title={locked?'Số ngày đã khóa vì khung chuyến có mẫu đã chốt':content.days.length<=(limits?.[0]??0)?'Đã đạt số ngày tối thiểu của nhóm thời lượng':undefined} onClick={()=>setDayChange({remove:day?.dayNumber})}>Xóa ngày đang chọn</Button>{!limits&&<small>Thời lượng hiện có chưa nằm trong nhóm 1–2 hoặc 3–5 ngày.</small>}{!gateway.supportsMiddleDayRemoval&&<small>Chỉ có thể xóa ngày cuối.</small>}</>}</nav>
      <section id="planning-day-panel" role="tabpanel" aria-labelledby={`planning-tab-${tab}`}>{day?<DayPane content={content} day={day} editable={editable} busy={Boolean(busy)} tab={tab} violation={located}
        onTitle={title=>edit({...content,days:content.days.map(d=>d.key===day.key?{...d,title}:d)})}
        onType={dayType=>{if(dayType==='SEA_DAY'&&content.stops.some(s=>s.arrivalDayNumber<=day.dayNumber&&s.departureDayNumber>=day.dayNumber)){setMessage('Ngày còn lần ghé cảng. Hãy xử lý lần ghé và tham quan liên quan trước khi chuyển thành ngày trên biển.');return}edit({...content,days:content.days.map(d=>d.key===day.key?{...d,dayType}:d)})}}
        onStop={stop=>setStopDrawer({stop})} onEntry={(kind,entry,stopClientKey)=>setEntryDrawer({kind,entry,stopClientKey})}
        onRemoveStop={s=>setRemoval({kind:'stop',key:s.clientKey})} onRemoveEntry={e=>setRemoval({kind:'entry',key:e.clientKey})}
        onOrder={(key,target)=>{const ordered=[...content.stops].sort((a,b)=>a.stopOrder-b.stopOrder),from=ordered.findIndex(s=>s.clientKey===key),to=ordered.findIndex(s=>s.clientKey===target);if(from<0||to<0)return;ordered.splice(to,0,...ordered.splice(from,1));edit({...content,stops:ordered.map((s,i)=>({...s,stopOrder:i+1}))})}}/>:<Empty title="Phiên bản chưa có ngày"/>}</section></div>
    {located&&<div id="planning-located-error" tabIndex={-1}><Notice title="Nội dung cần đối chiếu" tone="warning">{located.message}<p>Nếu mục hoặc trường không còn trên màn hình, hãy đối chiếu bản máy chủ. Không tự thay đổi dữ liệu.</p>{(located.entityType==='TRIP'||located.fieldPath?.startsWith('trip.'))&&<Link to={`${root}/${trip.tripId}/info`}>Mở thông tin chuyến</Link>}</Notice></div>}
    {(report||violationRows.length>0)&&<details id="planning-validation" tabIndex={-1} className={styles.validation} open={Boolean(report||fault?.violations.length)}><summary>{blockingRows.length?`${blockingRows.length} mục cần sửa`:report?.validForSubmit?'Kết quả kiểm tra lịch trình':'Kiểm tra lịch trình'}</summary><ValidationPanel report={fault?.violations.length?null:report} serverErrors={Boolean(fault?.violations.length)} violations={violationRows} onLocate={locate}/></details>}
    <footer className={styles.footer} aria-label="Thao tác lịch trình" aria-busy={Boolean(busy)}>
      <div className={styles.saveState} role="status" aria-live="polite"><span className={dirty?styles.unsavedDot:styles.savedDot} aria-hidden="true"/><span>{busy||(message||versionLabels[version.status])}{!busy&&!message&&version.status==='IN_REVIEW'&&version.submitterName&&<small>Người gửi: {version.submitterName}</small>}</span></div>
      <div className={styles.actions}>
        {blockingRows.length>0&&<Button tone="secondary" disabled={Boolean(busy)} onClick={showValidation}>Xem {blockingRows.length} mục cần sửa</Button>}
        {!gateway.readOnly&&trip.status!=='ARCHIVED'&&(can('TRIP_PLAN_VALIDATE')||(version.status==='DRAFT'&&can('TRIP_PLAN_WRITE'))||(version.status==='IN_REVIEW'&&(can('TRIP_PLAN_WRITE')||can('TRIP_PLAN_WRITE'))))&&<details className={styles.editorMenu} onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.removeAttribute('open');e.currentTarget.querySelector('summary')?.focus()}}}><summary>Thao tác khác</summary><div>
          {can('TRIP_PLAN_VALIDATE')&&<Button tone="text" disabled={Boolean(busy)||uncertain||(dirty&&!editable)} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');void checkSchedule()}}>Kiểm tra lịch trình</Button>}
          {version.status==='IN_REVIEW'&&(can('TRIP_PLAN_WRITE')||can('TRIP_PLAN_WRITE'))&&<Button tone="text" disabled={Boolean(busy)||uncertain} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');setLifecycleReason('');setLifecycle('withdraw')}}>Thu hồi để chỉnh sửa</Button>}
          {version.status==='DRAFT'&&can('TRIP_PLAN_WRITE')&&<Button tone="text" disabled={Boolean(busy)||uncertain} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');setLifecycleReason('');setLifecycle('cancel')}}>Hủy bản nháp…</Button>}
        </div></details>}
        {editable&&<Button tone={dirty||!canSubmit?'primary':'secondary'} disabled={Boolean(busy)||!dirty} onClick={()=>void run('Đang lưu nháp…',async()=>{await save();setMessage('Đã lưu nháp')})}>Lưu nháp</Button>}
        {canSubmit&&<Button tone={dirty?'secondary':'primary'} disabled={Boolean(busy)||uncertain||trip.status==='ARCHIVED'||!can('TRIP_PLAN_VALIDATE')||(dirty&&!can('TRIP_PLAN_WRITE'))} title={!can('TRIP_PLAN_VALIDATE')?'Tài khoản chưa có quyền kiểm tra để chốt mẫu':undefined} onClick={()=>setAction('finalize')}>Chốt lịch trình mẫu</Button>}
      </div>
    </footer>
    <DepartureSourceSummary trip={trip} version={version}/>
    {lifecycle&&<Modal title={lifecycle==='cancel'?'Hủy phiên bản nháp?':'Thu hồi mẫu theo quy trình cũ?'} busy={Boolean(busy)} onClose={()=>{if(!busy)setLifecycle(null)}} footer={<><Button tone="secondary" disabled={Boolean(busy)} onClick={()=>setLifecycle(null)}>Giữ nguyên</Button><Button tone={lifecycle==='cancel'?'danger':'primary'} disabled={Boolean(busy)||uncertain||lifecycleReason.trim().length>500} onClick={()=>void changeLifecycle()}>{lifecycle==='cancel'?'Xác nhận hủy bản nháp':'Thu hồi để chỉnh sửa'}</Button></>}>
      <p>{lifecycle==='cancel'?'Bản nháp sẽ ngừng sử dụng, nhưng nội dung đã lưu và lịch sử vẫn được giữ. Mẫu đã chốt không bị ảnh hưởng.':'Phiên bản sẽ rời hàng đợi duyệt và trở lại bản nháp. CRM cần kiểm tra và chốt mẫu sau khi sửa.'}</p>
      {dirty&&<Notice title="Có nội dung chưa lưu" tone="warning">Các thay đổi trên màn hình sẽ bị bỏ khi hủy thành công. Thao tác này không lưu thay đổi trước.</Notice>}
      <Field htmlFor="version-lifecycle-reason" label="Lý do (tùy chọn)"><textarea id="version-lifecycle-reason" value={lifecycleReason} disabled={Boolean(busy)} maxLength={500} rows={3} onChange={e=>setLifecycleReason(e.target.value)}/></Field>
      {fault&&<Notice title="Chưa thay đổi trạng thái" tone="error">{fault.message}</Notice>}
    </Modal>}
    {stopDrawer&&day&&<StopDrawer tripId={trip.tripId} tripRevision={trip.revision} tripInfo={trip.info} key={stopDrawer.stop?.clientKey??'new-stop'} content={content} dayNumber={day.dayNumber} readOnly={!editable||Boolean(busy)} stop={stopDrawer.stop} violation={stopDrawer.violation} onClose={()=>setStopDrawer(null)} onApply={stop=>{edit({...content,stops:content.stops.some(s=>s.clientKey===stop.clientKey)?content.stops.map(s=>s.clientKey===stop.clientKey?stop:s):[...content.stops,stop]});setStopDrawer(null)}}/>}
    {entryDrawer&&day&&<EntryDrawer key={entryDrawer.entry?.clientKey??`${entryDrawer.kind}:${selected}:${entryDrawer.stopClientKey??'new'}`} content={content} dayNumber={day.dayNumber} readOnly={!editable||Boolean(busy)} kind={entryDrawer.kind} entry={entryDrawer.entry} initialStopClientKey={entryDrawer.stopClientKey} violation={entryDrawer.violation} onClose={()=>setEntryDrawer(null)} onApply={entries=>{const keys=new Set(entries.map(e=>e.clientKey));edit({...content,entries:[...content.entries.filter(e=>!keys.has(e.clientKey)),...entries]});setEntryDrawer(null)}}/>}
    {removal&&<Modal title={removal.kind==='stop'?'Xóa lần ghé cảng?':'Xóa mục chương trình?'} onClose={()=>setRemoval(null)} footer={<><Button tone="secondary" onClick={()=>setRemoval(null)}>Giữ lại</Button><Button tone="danger" disabled={!editable||Boolean(busy)||(removal.kind==='stop'&&content.entries.some(e=>e.stopClientKey===removal.key))} onClick={()=>{edit(removal.kind==='stop'?{...content,stops:content.stops.filter(s=>s.clientKey!==removal.key)}:{...content,entries:content.entries.filter(e=>e.clientKey!==removal.key)});setRemoval(null)}}>Xóa khỏi bản nháp</Button></>}><p>Mục này sẽ được bỏ khỏi bản đang chỉnh. Chọn Lưu nháp để lưu thay đổi.</p>{removal.kind==='stop'&&content.entries.some(e=>e.stopClientKey===removal.key)?<Notice title="Còn nội dung liên quan" tone="warning">Hãy xử lý các tham quan gắn với lần ghé này trước. Không tự xóa nội dung liên quan.</Notice>:<p>Mục qua nhiều ngày sẽ được xóa ở cả các ngày tiếp diễn. Các khung phục vụ lặp khác là những mục riêng.</p>}</Modal>}
    {dayChange&&<Modal title={removeDay?`Xóa Ngày ${removeDay}?`:'Thêm ngày vào chuyến?'} onClose={()=>{if(!busy)setDayChange(null)}} footer={<><Button tone="secondary" disabled={Boolean(busy)} onClick={()=>setDayChange(null)}>Hủy</Button><Button disabled={Boolean(busy)||!structureAllowed||Boolean(affectedStops.length||affectedEntries.length||invalidFinal)} onClick={()=>void changeStructure()}>Lưu nháp rồi cập nhật ngày</Button></>}><p>Nội dung đang chỉnh sẽ được lưu trước. Số ngày sẽ thay đổi ở mọi phiên bản nháp của chuyến.</p>{!gateway.supportsMiddleDayRemoval&&<Notice title="Lưu trước khi thay đổi số ngày" tone="warning">Nội dung được lưu trước khi cập nhật số ngày. Nếu cập nhật số ngày thất bại, bản nháp đã lưu vẫn được giữ.</Notice>}{removeDay&&<p>Ảnh hưởng: {affectedStops.length} lần ghé cảng, {affectedEntries.length} mục chương trình bao phủ ngày này. Các mục qua ngày cũng được tính.</p>}{Boolean(affectedStops.length||affectedEntries.length)&&<Notice title="Chưa thể xóa ngày" tone="warning">Hãy xử lý các mục liên quan trước. Không tự xóa dữ liệu hoặc cắt mục qua ngày.</Notice>}{invalidFinal&&<Notice title="Cảng kết thúc chuyến đang ở ngày cuối" tone="warning">Bỏ lựa chọn cảng hành khách kết thúc chuyến trong bản nháp trước khi thêm ngày, rồi chọn lại ở ngày cuối mới.</Notice>}</Modal>}
    {action&&<Modal title={businessCopy('trip.template.FINALIZE_ACTION')} onClose={()=>{if(!busy)setAction(null)}} footer={<><Button tone="secondary" disabled={Boolean(busy)} onClick={()=>setAction(null)}>Hủy</Button><Button disabled={Boolean(busy)} onClick={()=>void transition()}>{busy?'Đang xử lý…':businessCopy('trip.template.FINALIZE_ACTION')}</Button></>}><p>Thao tác áp dụng cho phiên bản {version.versionNumber}. Mẫu đã chốt không thể sửa trực tiếp.</p>{fault&&<Notice title="Yêu cầu chưa hoàn tất" tone="error">{fault.message}</Notice>}</Modal>}
    {pendingSwitch&&<Modal title="Đổi phiên bản khi còn thay đổi?" onClose={()=>setPendingSwitch('')} footer={<><Button tone="secondary" disabled={Boolean(busy)} onClick={()=>setPendingSwitch('')}>Ở lại</Button><Button tone="danger" disabled={Boolean(busy)} onClick={()=>switchNow(pendingSwitch)}>Bỏ thay đổi và chuyển</Button>{editable&&<Button disabled={Boolean(busy)} onClick={()=>void run('Đang lưu nháp…',async()=>{await save();switchNow(pendingSwitch)})}>Lưu rồi chuyển</Button>}</>}><p>Chuyển phiên bản sẽ thay nội dung trên màn hình. Chọn rõ cách xử lý bản nháp hiện tại.</p></Modal>}
    {history&&<HistoryDialog tripId={trip.tripId} versionId={version.versionId} onClose={()=>setHistory(false)}/>}
    {compare&&<ConflictDialog trip={trip} version={version} local={content} onClose={()=>setCompare(false)} onReplace={(serverTrip,serverVersion)=>{setTrip(serverTrip);accept(serverVersion);setUncertain(false);setFault(null);setCompare(false);setSelected(n=>Math.min(n,serverVersion.days.length));setMessage('Đã dùng bản máy chủ theo xác nhận của bạn.')}}/>}{guard.prompt}
  </>
}
