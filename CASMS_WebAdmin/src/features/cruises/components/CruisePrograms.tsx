import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
import {cruiseStaffApi} from '../api/cruise-staff-api'
import {readActivityCatalog} from '@/domain/activity-catalog'
import {packageComponents} from '../api/scoped-package'
import {ActivityTimeRepair} from './ActivityTimeRepair'
import {DeparturePackageManager} from './DeparturePackageManager'
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react'
import {ApiError,apiRequest,useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy} from '@/shared/i18n/business-copy'
import {Button,Field,Loading,Notice,Panel,Modal} from '@/shared/ui'
import {journeyTime,SHIP_TIME_ZONE} from '@/shared/lib/journey-time'
import {programInstant} from '../model/program-time'
import {effectiveActivityAreas,programModelBlocker,programServiceLabel} from '../model/program-options'
import {mainflowApi,type ProgramIssue} from '../api/mainflow-api'
import {decodeActivities,type ScopedActivity} from '../api/scoped-activity'
import {CruiseActivityEditor} from './CruiseActivityEditor'
import {ActivityAreaField,ActivityMeetingPointField,ActivityTimeFields,type CruiseTimeRange,type CruiseVenueOptions} from './CruiseActivityFields'
import {CruisePackageEditor} from './CruisePackageEditor'
import {decodeCommercialExcursions,type ExcursionCommercial} from '../api/scoped-excursion'
import {CruiseExcursionCommercialEditor} from './CruiseExcursionCommercialEditor'
import {ScopedProgramEditor,type EditableProgram} from './ScopedProgramEditor'
import styles from './ManagerWorkspace.module.css'
type Kind='activities'|'excursions'|'packages'|'serving-windows'
type Choice={id:string;name:string;sequence?:number;scheduled?:boolean;timeZoneId?:string|null;defaultRequiredStaff?:number}
type Program={id:string;cruiseId?:string;sourceActivityId?:string|null;responsibleUserId?:string|null;name:string;ownerCruiseId?:string|null;price?:number|null;currency?:string|null;currencyCode?:string|null;capacity?:number|null;requiredStaffCount?:number|null;location?:string;startsAt?:string;endsAt?:string;cruiseStopId?:string|null}
type Options=CruiseVenueOptions&{services:(Choice&{configuredOnShip?:boolean})[];suppliers:Choice[];stops:Choice[]}
const titles:Record<Kind,string>={activities:businessCopy('program.onboardActivity'),excursions:businessCopy('program.SHORE_EXCURSION'),packages:businessCopy('program.TOUR_PACKAGE'),'serving-windows':businessCopy('program.SERVING_WINDOW')}
type ProgramContext = {planStatus:string;unifiedPackageReview?:boolean;mayConfigure?:boolean;completionIssues?:{code:string;kind:string;id:string;message:string}[];programIssues?:ProgramIssue[];windows:{expectedRevision:number}}
export function CruisePrograms({cruiseId,departure,arrival,itineraryMode,onChanged,programWork=false,initialKind,autoOpenCreate=false}:CruiseTimeRange&{cruiseId:string;itineraryMode?:'FIXED'|'CUSTOM';onChanged:()=>void;programWork?:boolean;initialKind?:Kind;autoOpenCreate?:boolean}){
 const access=useSessionAccess(),crm=access.roles.includes('CRUISE_MANAGER')&&access.has('CRUISE_UPDATE_DRAFT'),ops=access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_READ'),allowed=crm||ops||programWork,root=`/cruise-plans/${cruiseId}`
 const readPlan=useCallback((signal?:AbortSignal):Promise<ProgramContext> =>
  ops&&!programWork&&!crm?mainflowApi.get(cruiseId,signal):apiRequest(`/cruise-work/${cruiseId}/program-context`,{signal}),
  [ops,programWork,crm,cruiseId])
 const [epoch,setEpoch]=useState(0),[manualKind,setKind]=useState<Kind|null>(initialKind??null),[editing,setEditing]=useState<{activity:ScopedActivity;revision:number}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),lock=useRef(false)
 const autoOpened=useRef(false)
 const [repairing,setRepairing]=useState<string|null>(null),[repairSuccess,setRepairSuccess]=useState(false)
 const [areaEditing,setAreaEditing]=useState<ScopedActivity|null>(null)
 const [selectedArea,setSelectedArea]=useState('')
 const [creating,setCreating]=useState(false),[search,setSearch]=useState('')
 const [sourceId,setSourceId]=useState('')
 const canReadStaff=allowed&&access.canDo('CRUISE_STAFF_READ')
 const staff=useReadQuery(`program-staff:${access.userId}:${cruiseId}:${canReadStaff}`,useCallback(
  signal=>canReadStaff?cruiseStaffApi.list(cruiseId,signal):Promise.resolve([]),[canReadStaff,cruiseId]))
 const [coordinator,setCoordinator]=useState<{kind:'activities'|'serving-windows';row:Program;revision:number}|null>(null)
 const [responsibleUserId,setResponsibleUserId]=useState('')
 const staffOptions=Array.from(new Map((staff.data??[]).filter(row=>row.status==='ACTIVE').map(row=>[row.userId,row] as const)).values())

 const [editingPackage,setEditingPackage]=useState<string|null>(null)
 const [editingExcursion,setEditingExcursion]=useState<{entry:ExcursionCommercial;revision:number}|null>(null)
 const [editingProgram,setEditingProgram]=useState<{kind:'excursions'|'serving-windows';entry:EditableProgram}|null>(null)
 const [selectedStopId,setSelectedStopId]=useState('')
 const [selectedServiceId,setSelectedServiceId]=useState('')
 const query=useReadQuery(`scoped-programs:${cruiseId}:${epoch}:${allowed}`,useCallback(async signal=>{
  if(!allowed)return null
  const plan=await readPlan(signal)
  const [options,activityRows,excursionRows,packages,windows]=await Promise.all([apiRequest<Options>(root+'/program-options',{signal}),apiRequest<ScopedActivity[]>(root+'/activities',{signal}),apiRequest<ExcursionCommercial[]>(root+'/excursions',{signal}),plan.unifiedPackageReview?Promise.resolve([]):apiRequest<Program[]>(root+'/packages',{signal}),apiRequest<Program[]>(root+'/serving-windows',{signal})])
  const activities=decodeActivities(activityRows,cruiseId)
  const excursions=decodeCommercialExcursions(excursionRows)
  return {plan,options:{...options,activityAreas:effectiveActivityAreas(options)},activities,excursions,programs:{activities:activities.map(a=>({...a,currency:a.currencyCode})),excursions,packages,'serving-windows':windows}}
 },[allowed,cruiseId,root,readPlan]))
 const data=query.data
 const kind:Kind = manualKind ?? (data ? ((['activities','excursions','serving-windows'] as Kind[]).find(k=>data.programs[k].length>0) ?? 'activities') : 'activities')
 const choosingActivity=programWork&&creating&&kind==='activities'
 const catalog=useReadQuery(`program-activity-catalog:${access.userId}:${choosingActivity}`,useCallback(
  signal=>choosingActivity?readActivityCatalog(signal):Promise.resolve([]),[choosingActivity]))
 const source=catalog.data?.find(item=>item.id===sourceId)
 const editable=programWork&&data?.plan.mayConfigure&&['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(data.plan.planStatus),fixed=itineraryMode!=='CUSTOM'&&['activities','excursions'].includes(kind)
 const fixedActivity=itineraryMode==='FIXED'&&kind==='activities'
 const isPackageKind:boolean=kind==='packages'
 const canCreate=Boolean(editable&&!isPackageKind&&(!fixed||fixedActivity&&Boolean(data.options.ship.id)))
 useEffect(()=>{
  if(!autoOpenCreate||autoOpened.current||!data||!canCreate)return
  autoOpened.current=true
  setError('')
  setSourceId('')
  setSelectedStopId('')
  setCreating(true)
 },[autoOpenCreate,data,canCreate])
 async function saveCoordinator(event:FormEvent){
  event.preventDefault()
  if(!editable||!coordinator||lock.current||uncertain||!canReadStaff||!staff.data||staff.error||staff.loading)return
  if(responsibleUserId&&!staffOptions.some(row=>row.userId===responsibleUserId))return
  const userId=responsibleUserId||null
  lock.current=true;setBusy(true);setError('')
  let written=false
  try{
   await apiRequest<null>(`${root}/${coordinator.kind}/${coordinator.row.id}/responsible-user`,
    {method:'PUT',ifMatch:coordinator.revision,body:{userId}})
   written=true
   const [rows,plan]=await Promise.all([apiRequest<Program[]>(root+'/'+coordinator.kind),readPlan()])
   const updated=rows.find(row=>row.id===coordinator.row.id)
   if(!updated||(updated.responsibleUserId??null)!==userId||plan.windows.expectedRevision<=coordinator.revision)throw new ApiError('Chưa đối chiếu được người phụ trách đã lưu.',502)
   setCoordinator(null);setEpoch(n=>n+1);onChanged()
  }catch(reason){
   setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,reason instanceof Error?reason.message:''))
   if(written||mutationOutcomeUnknown(reason))setUncertain(true)
   if(reason instanceof ApiError&&reason.code==='STALE_REVISION'){setCoordinator(null);query.retry()}
  }finally{lock.current=false;setBusy(false)}
 }
 async function saveArea(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(!areaEditing||!editable||!data||lock.current||uncertain
    ||!data.options.activityAreas.some(area=>area.id===selectedArea&&(!areaEditing.deckId||area.deckId===areaEditing.deckId)))return
  lock.current=true
  setBusy(true)
  setError('')
  try{
   const saved=await apiRequest<ScopedActivity>(root+'/activities/'+encodeURIComponent(areaEditing.id)+'/area',{
    method:'PUT',ifMatch:data.plan.windows.expectedRevision,body:{areaId:selectedArea}
   })
   if(saved.id!==areaEditing.id||saved.cruiseId!==cruiseId||saved.areaId!==selectedArea)throw new ApiError('',502)
   setAreaEditing(null)
   setEpoch(value=>value+1)
   onChanged()
  }catch(reason){
   setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,reason instanceof Error?reason.message:''))
   if(reason instanceof ApiError&&(reason.status===409||reason.code==='ACTIVITY_AREA_REQUIRED')){
    setSelectedArea('')
    query.retry()
   }
   if(mutationOutcomeUnknown(reason))setUncertain(true)
  }finally{
   lock.current=false
   setBusy(false)
  }
 }
 async function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!data||lock.current||uncertain||!canCreate||kind==='packages'&&data.plan.unifiedPackageReview)return
  const f=new FormData(e.currentTarget),text=(key:string)=>String(f.get(key)??'').trim(),shore=kind==='excursions'||kind==='serving-windows'&&Boolean(text('stop')),portZone=data.options.stops.find(s=>s.id===text('stop'))?.timeZoneId
  if(kind==='serving-windows'&&!text('service')){setError('Vui lòng chọn dịch vụ cho khung giờ phục vụ.');return}
  if(kind==='excursions'&&!text('stop')){setError('Vui lòng chọn lần ghé cảng cho tour tham quan.');return}
  if(kind==='excursions'&&!text('supplier')){setError('Vui lòng chọn nhà cung cấp cho tour tham quan.');return}
  if(kind!=='serving-windows'&&!(kind==='activities'&&(sourceId||fixedActivity))&&!text('name')){setError('Vui lòng nhập tên nội dung.');return}
  if((kind==='excursions'||kind==='serving-windows')&&!text('location')){setError(kind==='excursions'?'Vui lòng nhập điểm tập trung.':'Vui lòng nhập địa điểm phục vụ.');return}
  if(kind==='packages'&&(!text('type')||!text('price'))){setError('Vui lòng chọn loại gói và nhập đơn giá hợp lệ.');return}
  let instants:Record<string,string>={}
  if(kind!=='packages')try{
   const localTime=(field:'start'|'end')=>text(field+'Day')+'T'+text(field)
   if(!text('startDay')||!text('start')||!text('endDay')||!text('end')){setError('Vui lòng chọn đầy đủ ngày và giờ bắt đầu, kết thúc trong lịch chuyến.');return}
   instants={start:programInstant(localTime('start'),shore,portZone),end:programInstant(localTime('end'),shore,portZone)}
  }catch{setError(businessCopy('program.time.invalid'));return}
  if(kind!=='packages'&&(Date.parse(instants.start)>=Date.parse(instants.end)
    ||Date.parse(instants.start)<Date.parse(departure)||Date.parse(instants.end)>Date.parse(arrival))){
   setError('Chọn giờ bắt đầu trước giờ kết thúc và trong lịch chuyến hiển thị bên trên.')
   return
  }
  const instant=(key:string)=>instants[key]
  let body:Record<string,unknown>
  const fromCatalog=kind==='activities'&&Boolean(sourceId)
  const area=kind==='activities'?data.options.activityAreas?.find(option=>option.id===text('areaId')):undefined
  if(kind==='activities'&&!area){
   setError('Chọn khu vực hoạt động trên tàu.')
   return
  }
  const activityVenue={deckId:area?.deckId,location:area?.name,meetingPoint:text('meetingPoint')||null}
  if((fixedActivity||fromCatalog)&&(!source||catalog.loading||catalog.error)){setError('Chọn hoạt động dùng chung hợp lệ.');return}
  const capacity=text('capacity')?Number(text('capacity')):null
  const requiredStaffRaw=text('requiredStaffCount')
  const requiredStaffCount=requiredStaffRaw?Number(requiredStaffRaw):null
  if(kind!=='packages'&&requiredStaffCount!==null&&(!Number.isSafeInteger(requiredStaffCount)||requiredStaffCount<1||requiredStaffCount>2147483647)){setError('Vui lòng nhập số nhân viên phục vụ là số nguyên từ 1 trở lên.');return}
  if(kind!=='packages'&&!fromCatalog&&(capacity===null||!Number.isSafeInteger(capacity)||capacity<1||capacity>2147483647)){setError('Vui lòng nhập sức chứa nguyên dương.');return}
  if(fromCatalog&&capacity!==null&&(!Number.isSafeInteger(capacity)||capacity<1||capacity>2147483647)){setError('Nhập sức chứa nguyên dương.');return}
  if(fromCatalog&&capacity===null&&source?.capacity==null){setError('Hoạt động nguồn chưa có sức chứa. Nhập sức chứa cho lần phục vụ này.');return}
  if(fromCatalog)body={sourceActivityId:sourceId,...activityVenue,startTime:instant('start'),endTime:instant('end'),capacity,requiredStaffCount:requiredStaffCount??source?.requiredStaffCount??1}
  else if(kind==='activities')body={cruiseId,activityName:text('name'),...activityVenue,description:text('description'),startTime:instant('start'),endTime:instant('end'),capacity:Number(text('capacity')),requiredStaffCount:requiredStaffCount??1,price:null,currencyCode:'VND'}
  else if(kind==='excursions')body={cruiseStopId:text('stop'),supplierId:text('supplier'),excursionName:text('name'),meetingPoint:text('location'),startTime:instant('start'),plannedReturnTime:instant('end'),maximumCapacity:Number(text('capacity')),requiredStaffCount:requiredStaffCount??1,price:null,currencyCode:'VND'}
  else if(kind==='packages')body={name:text('name'),description:text('description'),type:text('type'),price:Number(text('price')),currency:'VND'}
  else body={serviceId:text('service'),cruiseStopId:text('stop')||null,supplierId:text('supplier')||null,startsAt:instant('start'),endsAt:instant('end'),location:text('location'),capacity:Number(text('capacity')),requiredStaffCount:requiredStaffCount??1}
  lock.current=true;setBusy(true);setError('')
  let written=false
  try{
   const saved=await apiRequest<{id?:string;shoreExcursionId?:string}>(root+'/'+kind+(fromCatalog?'/from-catalog':''),{method:'POST',ifMatch:data.plan.windows.expectedRevision,query:area?{areaId:area.id}:undefined,body})
   written=true
   const rows=await apiRequest<Program[]>(root+'/'+kind),id=saved.id??saved.shoreExcursionId
   const actual=rows.find(row=>row.id===id)
   if(!id||!actual)throw new ApiError('',502)
   if(kind==='activities'){
    const activity=actual as ScopedActivity
    if(activity.areaId!==area?.id||(activity.meetingPoint??null)!==activityVenue.meetingPoint){
     throw new ApiError('Chưa đối chiếu được khu vực và điểm tập trung đã lưu.',502)
    }
   }
   if(fromCatalog){
    const activity=decodeActivities(rows as ScopedActivity[],cruiseId).find(row=>row.id===id)
    const plan=await readPlan()
    if(!activity||activity.sourceActivityId!==sourceId||activity.location!==body.location
      ||(activity.deckId??null)!==(body.deckId??null)||(activity.cabinId??null)!==(body.cabinId??null)
      ||Date.parse(activity.startTime)!==Date.parse(instant('start'))||Date.parse(activity.endTime)!==Date.parse(instant('end'))
      ||activity.capacity!==(capacity??source?.capacity)||plan.windows.expectedRevision<=data.plan.windows.expectedRevision)
     throw new ApiError('Chưa đối chiếu được hoạt động nguồn đã lưu.',502)
   }
   setCreating(false);setEpoch(n=>n+1);onChanged()
  }catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(written||mutationOutcomeUnknown(reason))setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 if(!allowed)return null
 return <Panel className={styles.programPanel} title={ops?'Chương trình và dịch vụ đã cấu hình':programWork?businessCopy('program.configuration'):'Chương trình của chuyến'}>
  {data?.plan.completionIssues && data.plan.completionIssues.length > 0 && <Notice title="Cần bổ sung trước khi hoàn tất chương trình" tone="warning">
    <ul>{data.plan.completionIssues.map((issue,index)=><li key={`${issue.code}:${issue.id}:${index}`}>{issue.message}</li>)}</ul>
    {data.plan.completionIssues.some(issue=>issue.kind==='SERVICE_WINDOW')&&<Button tone="secondary" autoWidth onClick={()=>{setKind('serving-windows');setSearch('')}}>Xem khung giờ phục vụ</Button>}
  </Notice>}
  {repairSuccess&&<Notice title="Đã sửa giờ hoạt động" tone="success">Giờ hợp lệ đã được khóa lại theo lịch trình cố định.</Notice>}
  {query.loading&&<Loading label="Đang tải chương trình của chuyến khởi hành…"/>}{query.error&&<Notice title={query.error instanceof ApiError&&query.error.status===403?'Chưa có quyền xem chương trình':'Chưa tải được chương trình'} tone="error"><p>{query.error instanceof ApiError&&query.error.status===403?'Tài khoản hiện tại chưa được cấp đủ quyền đọc chương trình của chuyến khởi hành.':query.error.message}</p><Button onClick={query.retry}>Tải lại dữ liệu</Button></Notice>}
  {data&&<>
   {programWork&&!data.plan.mayConfigure&&<Notice title="Chương trình chỉ cho phép xem">Bạn cần được giao việc và đang xử lý để chỉnh sửa. Nếu đã bàn giao, liên hệ Quản lý lịch trình để yêu cầu bổ sung, rồi nhận lại việc.</Notice>}
   {editable&&kind==='activities'&&(creating||Boolean(editing))&&programModelBlocker(data.options)&&<Notice title="Chưa thể chọn khu vực hoạt động" tone="warning">
    {programModelBlocker(data.options)}
   </Notice>}
   <div className={styles.programKindTabs} role="tablist" aria-label={businessCopy('program.field.content')}>
    {((Object.keys(titles) as Kind[]).filter(k=>!data.plan.unifiedPackageReview||k!=='packages')).map(k=>{
     const active=kind===k
     const count=data.programs[k].length
     return <button key={k} type="button" role="tab" aria-selected={active} className={`${styles.programKindTab} ${active?styles.programKindTabActive:''}`} disabled={busy||Boolean(editing)||Boolean(editingPackage)||Boolean(editingExcursion)} onClick={()=>{setKind(k);setSearch('');setError('')}}>
      <span>{titles[k]}</span>
      <span className={styles.programKindCount}>{count}</span>
     </button>
    })}
   </div>
   {(data.programs[kind].length>0||canCreate)&&<div className={styles.programToolbar}>
    {data.programs[kind].length>0&&<div>
     <Field htmlFor="program-search" label="Tìm trong danh sách">
      <input id="program-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Tìm ${titles[kind].toLocaleLowerCase('vi')}…`}/>
     </Field>
    </div>}
    <div className={styles.programToolbarRight}>
     {data.programs[kind].length>0&&<p role="status">Hiển thị {data.programs[kind].filter(p=>p.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))).length} / {data.programs[kind].length} mục</p>}
     {canCreate&&!editing&&!editingPackage&&!editingExcursion&&!editingProgram&&<Button autoWidth disabled={busy||uncertain||kind==='serving-windows'&&!data.options.services.some(s=>s.scheduled)} onClick={()=>{setError('');setSourceId('');setSelectedStopId('');setSelectedServiceId('');setCreating(true)}}>+ Thêm {titles[kind].toLocaleLowerCase('vi')}</Button>}
    </div>
   </div>}
   <ul className={styles.programList}>{data.programs[kind].filter(p=>p.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))).map(p=>{
    const activity=kind==='activities'?data.activities.find(a=>a.id===p.id):null
    const invalidArea=activity&&(!data.options.activityAreas.some(area=>area.id===activity.areaId)
      ||data.plan.programIssues?.some(issue=>issue.itemId===activity.id&&issue.code==='ACTIVITY_AREA_REQUIRED'))
    const invalidTime=activity&&data.plan.programIssues?.some(issue=>issue.itemId===activity.id&&issue.code==='ACTIVITY_OUTSIDE_CRUISE')
    const servingWindow=kind==='serving-windows'?data.programs['serving-windows'].find(window=>window.id===p.id):null
    const excursion=kind==='excursions'?data.excursions.find(e=>e.id===p.id):null
    const excursionStop=excursion?.cruiseStopId?data.options.stops.find(stop=>stop.id===excursion.cruiseStopId):null
    const servingZone=servingWindow?.cruiseStopId?data.options.stops.find(stop=>stop.id===servingWindow.cruiseStopId)?.timeZoneId:SHIP_TIME_ZONE
    return <li key={p.id}><div className={styles.programInfo}><h3>{p.name}</h3>
      {servingWindow&&<><p>{servingWindow.startsAt&&servingWindow.endsAt&&servingZone?`${journeyTime(servingWindow.startsAt,servingZone)} → ${journeyTime(servingWindow.endsAt,servingZone)}`:'Chưa đủ thời gian hoặc múi giờ'} · {servingWindow.cruiseStopId?'Giờ cảng':'Giờ tàu (Việt Nam)'}</p><p>{servingWindow.location||'Chưa có địa điểm'}</p></>}
      {excursion&&<><p>{excursion.startsAt&&excursion.endsAt&&excursionStop?.timeZoneId?`${journeyTime(excursion.startsAt,excursionStop.timeZoneId)} → ${journeyTime(excursion.endsAt,excursionStop.timeZoneId)}`:'Chưa đủ thời gian hoặc múi giờ'} · Giờ cảng</p><p>{excursionStop?`Lần ${excursionStop.sequence} · ${excursionStop.name}`:'Chưa xác định lần ghé cảng'} · {excursion.location||'Chưa có điểm tập trung'}</p></>}
      {(activity||servingWindow)&&<p>Người phụ trách · {(p as Program).responsibleUserId
        ? staff.data?.find(row=>row.userId===(p as Program).responsibleUserId)?.username??'Đã gán nhân viên'
        : 'Chưa phân công'}</p>}
      {activity&&<><p>{journeyTime(activity.startTime)} → {journeyTime(activity.endTime)} · Giờ Việt Nam</p>{activity.meetingPoint&&<p>Điểm tập trung · {activity.meetingPoint}</p>}</>}
      {activity&&<p>Khu vực hoạt động · {invalidArea?'Chưa có khu vực hợp lệ':data.options.activityAreas?.find(area=>area.id===activity.areaId)?.name??'Đã chọn khu vực'}</p>}
      <div className={styles.programMeta}>{p.price!=null&&p.price>0?<span>{new Intl.NumberFormat('vi-VN').format(p.price)} {p.currency??'VND'}</span>:(kind==='activities'||kind==='excursions')?<span>Chưa thiết lập giá riêng · Theo gói du thuyền</span>:null}{p.capacity!=null?<span>{p.capacity} chỗ</span>:kind==='activities'?<span>Chưa có sức chứa</span>:null}{kind!=='packages'&&<span>Cần {p.requiredStaffCount??1} nhân viên phục vụ</span>}</div>{ops&&kind==='packages'&&<PackageContents cruiseId={cruiseId} packageId={p.id}/>}</div>
      {editable&&<div className={styles.sectionActions}>
       {(activity||servingWindow)&&canReadStaff&&<Button tone="secondary" disabled={busy||uncertain} onClick={()=>{
        setError('');setResponsibleUserId((p as Program).responsibleUserId??'');setCoordinator({kind:activity?'activities':'serving-windows',row:p as Program,revision:data.plan.windows.expectedRevision})
       }}>Chọn người phụ trách</Button>}
       {activity&&invalidArea&&<Button tone="secondary" disabled={busy||uncertain} onClick={()=>{
        setError('');setSelectedArea('');setAreaEditing(activity)
       }}>Chọn khu vực hoạt động</Button>}
       {activity&&invalidTime&&itineraryMode==='FIXED'&&<Button disabled={busy||uncertain} onClick={()=>{setRepairSuccess(false);setRepairing(activity.id)}}>Sửa giờ không hợp lệ</Button>}
       {activity&&!editing&&<Button tone="secondary" aria-label={'Chỉnh sửa hoạt động: '+p.name} disabled={busy||uncertain} onClick={()=>setEditing({activity,revision:data.plan.windows.expectedRevision})}>Chỉnh sửa hoạt động</Button>}
       {kind==='packages'&&'ownerCruiseId' in p&&p.ownerCruiseId===cruiseId&&!editingPackage&&<Button tone="secondary" aria-label={'Chỉnh sửa gói: '+p.name} disabled={busy||uncertain} onClick={()=>setEditingPackage(p.id)}>Chỉnh sửa gói</Button>}
       {kind==='excursions'&&!editingExcursion&&<Button tone="secondary" aria-label={'Cập nhật số chỗ: '+p.name} disabled={busy||uncertain} onClick={()=>{const entry=data.excursions.find(e=>e.id===p.id);if(entry)setEditingExcursion({entry,revision:data.plan.windows.expectedRevision})}}>Cập nhật số chỗ</Button>}
       {!editingProgram&&(kind==='serving-windows'||kind==='excursions'&&itineraryMode==='CUSTOM')&&<Button tone="secondary" aria-label={'Chỉnh sửa lịch: '+p.name} disabled={busy||uncertain} onClick={()=>setEditingProgram({kind,entry:p})}>Chỉnh sửa lịch</Button>}
      </div>}
    </li>
   })}</ul>
   {!data.programs[kind].length&&(
    <div className={styles.emptyProgram}>
     <strong>Chưa có {titles[kind].toLocaleLowerCase('vi')} trong chuyến khởi hành này.</strong>
     {crm&&!programWork&&<p style={{margin:'4px 0 0'}}>Bộ phận Quản lý hoạt động và dịch vụ chịu trách nhiệm cấu hình chi tiết {titles[kind].toLocaleLowerCase('vi')} theo yêu cầu chuẩn bị của chuyến.</p>}
    </div>
   )}
   {data.programs[kind].length>0&&!data.programs[kind].some(p=>p.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))&&<p className={styles.emptyProgram}>Không có nội dung khớp với “{search}”. <Button tone="text" onClick={()=>setSearch('')}>Xóa tìm kiếm</Button></p>}
   {areaEditing&&editable&&<Modal busy={busy} title="Chọn khu vực hoạt động"
      description={areaEditing.name} onClose={()=>setAreaEditing(null)} footer={<>
        <Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={()=>setAreaEditing(null)}>Hủy</Button>
        <Button type="submit" form="cruise-activity-area" disabled={busy||uncertain||!selectedArea}>Lưu khu vực</Button>
      </>}>
      <form id="cruise-activity-area" onSubmit={saveArea}>
        <Field htmlFor="existing-activity-area" label="Khu vực hoạt động *" hint="Khu vực chưa phân loại sẽ được ghi nhận cho hoạt động khi lưu.">
          <select id="existing-activity-area" value={selectedArea} required disabled={busy||uncertain}
            onChange={event=>setSelectedArea(event.target.value)}>
            <option value="">Chọn khu vực</option>
            {data.options.activityAreas?.filter(area=>!areaEditing.deckId||area.deckId===areaEditing.deckId).map(area=>
              <option key={area.id} value={area.id}>{area.name}</option>)}
          </select>
        </Field>
        {!data.options.activityAreas?.some(area=>!areaEditing.deckId||area.deckId===areaEditing.deckId)&&
          <p>Boong của hoạt động không có khu vực phù hợp.</p>}
      </form>
      {error&&<Notice title="Chưa lưu được khu vực" tone="error">{error}</Notice>}
   </Modal>}
   {repairing&&editable&&<ActivityTimeRepair cruiseId={cruiseId} activityId={repairing} onClose={()=>setRepairing(null)} onSaved={()=>{setRepairing(null);setRepairSuccess(true);setEpoch(n=>n+1);onChanged()}}/>}
   {editing&&editable&&<CruiseActivityEditor key={editing.activity.id} activity={editing.activity} revision={editing.revision} fixed={itineraryMode!=='CUSTOM'} departure={departure} arrival={arrival} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);setEpoch(n=>n+1);onChanged()}}/>}

   {editingPackage&&<CruisePackageEditor cruiseId={cruiseId} packageId={editingPackage} onClose={()=>setEditingPackage(null)} onSaved={()=>{setEditingPackage(null);setEpoch(n=>n+1);onChanged()}}/>}

   {editingExcursion&&editable&&<CruiseExcursionCommercialEditor key={editingExcursion.entry.id} cruiseId={cruiseId} entry={editingExcursion.entry} revision={editingExcursion.revision} onClose={()=>setEditingExcursion(null)} onSaved={()=>{setEditingExcursion(null);setEpoch(n=>n+1);onChanged()}}/>}

   {editingProgram&&editable&&<ScopedProgramEditor cruiseId={cruiseId} kind={editingProgram.kind} entry={editingProgram.entry} options={data.options} revision={data.plan.windows.expectedRevision} departure={departure} arrival={arrival} onClose={()=>setEditingProgram(null)} onSaved={()=>{setEditingProgram(null);setEpoch(n=>n+1);onChanged()}}/>}
   {kind==='packages'&&editable&&access.canDo('TOUR_PACKAGE_ASSIGN')&&<div className={styles.disclosureBody}><DeparturePackageManager cruiseId={cruiseId} onChanged={()=>{setEpoch(n=>n+1);onChanged()}}/></div>}
   {crm&&!programWork&&data.programs[kind].length>0&&<div className={styles.programRoleHint}><strong>Phân công nghiệp vụ:</strong> Bộ phận Quản lý hoạt động và dịch vụ chịu trách nhiệm cấu hình chi tiết {titles[kind].toLocaleLowerCase('vi')} theo yêu cầu chuẩn bị của chuyến.</div>}
   {crm&&fixed&&(!fixedActivity||!data.options.ship.id)&&<Notice title={businessCopy('cruise.itinerary.FIXED')}>{fixedActivity?'Phân công tàu trước khi thêm hoạt động.':businessErrorMessage('FIXED_ITINERARY_READ_ONLY','')}</Notice>}
   {crm&&kind==='serving-windows'&&data.options.services.filter(s=>s.scheduled).length===0&&<Notice title={data.options.ship.id?'Tàu chưa có dịch vụ cần xếp khung phục vụ':'Chưa phân công tàu'}>{data.options.ship.id?'Quản lý tàu cần gán dịch vụ cho tàu trước khi Quản lý lịch trình xếp khung phục vụ.':'Phân công tàu tại mục Tàu và quy định trước khi chọn dịch vụ.'}</Notice>}
   {coordinator&&editable&&<Modal title="Người phụ trách" busy={busy} onClose={()=>setCoordinator(null)} footer={
    <Button type="submit" form="program-coordinator" disabled={busy||uncertain||staff.loading||Boolean(staff.error)||!staff.data}>Lưu người phụ trách</Button>}>
    <p>{coordinator.row.name}</p>
    {staff.error&&<Notice title="Chưa tải được nhân sự" tone="error">{staff.error.message}<Button onClick={staff.retry}>Tải lại</Button></Notice>}
    <form id="program-coordinator" onSubmit={saveCoordinator}>
      <Field htmlFor="program-responsible-user" label="Nhân viên đang được phân công cho chuyến">
        <select id="program-responsible-user" value={responsibleUserId} disabled={busy||uncertain||staff.loading||Boolean(staff.error)} onChange={e=>setResponsibleUserId(e.target.value)}>
          <option value="">Không phân công</option>
          {responsibleUserId&&!staffOptions.some(row=>row.userId===responsibleUserId)&&<option value={responsibleUserId} disabled>Người đã gán không có trong danh sách hiện tại</option>}
          {staffOptions.map(row=><option key={row.userId} value={row.userId}>{row.username}</option>)}
        </select>
      </Field>
    </form>
    {error&&<Notice title="Chưa lưu được người phụ trách" tone="error">{error}</Notice>}
   </Modal>}
   {creating&&canCreate&&<Modal wide quiet={kind==='activities'} variant={kind==='activities'?'drawer':'modal'} busy={busy} title={'Thêm '+titles[kind].toLocaleLowerCase('vi')} onClose={()=>{setSelectedStopId('');setCreating(false)}} footer={<><Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={()=>{setSelectedStopId('');setCreating(false)}}>Hủy</Button><Button type="submit" form="cruise-program-create" disabled={busy||uncertain||fixedActivity&&!source}>{busy?'Đang lưu…':kind==='activities'?'Thêm hoạt động':businessCopy('program.action.saveDraft')}</Button></>}>
   <form id="cruise-program-create" className={styles.modalForm} key={kind} noValidate onSubmit={create}><fieldset disabled={busy||uncertain}>
    {kind==='activities'&&<div className={styles.activityFull}>
    <Field htmlFor="program-activity-source" label={fixedActivity?'Hoạt động mẫu *':'Hoạt động mẫu'} hint={!fixedActivity?'Có thể chọn mẫu hoặc nhập hoạt động riêng.':undefined}>
      <select id="program-activity-source" value={sourceId} required={fixedActivity} onChange={e=>setSourceId(e.target.value)} disabled={catalog.loading||Boolean(catalog.error)}>
        <option value="">{fixedActivity?"Chọn hoạt động từ Kho mẫu":"Tự nhập hoạt động riêng cho chuyến này"}</option>
        {catalog.data?.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </Field>
    {catalog.loading&&<p className={styles.activitySourcePrice} role="status">Đang tải kho hoạt động mẫu…</p>}
    {catalog.error&&<Button tone="secondary" autoWidth onClick={catalog.retry}>Tải lại kho mẫu</Button>}
    {source&&<p className={styles.activitySourcePrice}>Giá từ mẫu: <strong>{source.price == null || source.price === 0 ? 'Chưa thiết lập giá riêng · Theo gói du thuyền' :
      new Intl.NumberFormat('vi-VN', {maximumFractionDigits:4}).format(source.price)+' '+(source.currencyCode??'VND')}</strong></p>}
    </div>}
    {kind!=='serving-windows'&&!(kind==='activities'&&(sourceId||fixedActivity))&&<Field htmlFor="program-name" label={businessCopy('program.field.name')}><input id="program-name" name="name" required/></Field>}
    {(kind==='activities'&&!sourceId&&!fixedActivity||kind==='packages')&&<Field htmlFor="program-description" label={businessCopy('program.field.description')}><textarea id="program-description" name="description"/></Field>}
    {kind==='activities'&&<>
      <div className={styles.activityFull}><ActivityAreaField options={data.options}/></div>
      <ActivityMeetingPointField id="program-meeting-point"/>
      <Field htmlFor="program-capacity" label="Sức chứa">
        <input id="program-capacity" name="capacity" type="number" min={1} max={2147483647} step={1}
          placeholder={source?.capacity!=null?`Mặc định ${source.capacity} người`:undefined} required={!sourceId||source?.capacity==null}/>
      </Field>
      <Field htmlFor="program-required-staff" label="Số nhân viên phục vụ cần *" hint="HR sẽ phân công đủ số nhân viên này cho ca hoạt động.">
        <input key={`act-staff:${sourceId}`} id="program-required-staff" name="requiredStaffCount" type="number" min={1} max={2147483647} step={1}
          defaultValue={source?.requiredStaffCount??1} required/>
      </Field>
    </>}
    {kind==='packages'&&<Field htmlFor="program-type" label={businessCopy('program.field.type')}><select id="program-type" name="type" required><option value="">Chọn loại gói</option><option value="BASIC">Cơ bản</option><option value="ADD_ON">Dịch vụ bổ sung</option></select></Field>}
    {kind==='serving-windows'&&<Field htmlFor="program-service" label={businessCopy('program.field.service')} hint="Dịch vụ đã gán trên boong vẫn cần Quản lý tàu kiểm tra khu vực và POS."><select id="program-service" name="service" value={selectedServiceId} onChange={e=>setSelectedServiceId(e.target.value)} required><option value="">Chọn dịch vụ</option>{data.options.services.filter(s=>s.scheduled).map(s=><option key={s.id} value={s.id}>{programServiceLabel(s)}</option>)}</select></Field>}
    {(kind==='excursions'||kind==='serving-windows')&&<>
     <Field htmlFor="program-stop" label={businessCopy('program.field.stop')}><select id="program-stop" name="stop" value={selectedStopId} onChange={e=>setSelectedStopId(e.target.value)} required={kind==='excursions'}><option value="">{kind==='excursions'?'Chọn lần ghé':'Trên tàu'}</option>{data.options.stops.map(s=><option key={s.id} value={s.id}>Lần {s.sequence} · {s.name}</option>)}</select></Field>
     <Field htmlFor="program-supplier" label={businessCopy('program.field.supplier')}><select id="program-supplier" name="supplier" required={kind==='excursions'}><option value="">Chọn nhà cung cấp</option>{data.options.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
    </>}
    {kind!=='packages'&&<>
     {kind!=='activities'&&<Field htmlFor="program-location" label={businessCopy(kind==='excursions'?'program.field.meetingPoint':'program.field.location')}><input id="program-location" name="location" maxLength={250} required/></Field>}
     {kind==='activities'?<ActivityTimeFields departure={departure} arrival={arrival}/>:(()=>{
      const stopZone=selectedStopId?data.options.stops.find(s=>s.id===selectedStopId)?.timeZoneId:undefined
      return <ActivityTimeFields
        key={`${kind}:${stopZone??'ship'}`}
        departure={departure}
        arrival={arrival}
        title={kind==='excursions'?'Thời gian tour tham quan':'Thời gian khung phục vụ'}
        timezoneNote={selectedStopId?'Giờ địa phương cảng đã chọn':kind==='excursions'?'Giờ địa phương cảng':'Giờ tàu (Việt Nam)'}
        timeZone={stopZone??undefined}
      />
     })()}
     {kind!=='activities'&&<Field htmlFor="program-capacity" label={businessCopy('program.field.capacity')}><input id="program-capacity" name="capacity" type="number" min={1} max={2147483647} step={1} required/></Field>}
     {kind!=='activities'&&(()=>{
       const pickedService = kind === 'serving-windows' ? data.options.services.find(s => s.id === selectedServiceId) : undefined
       return (
         <Field
           htmlFor="program-required-staff"
           label="Số nhân viên phục vụ cần *"
           hint={kind === 'serving-windows'
             ? `Mặc định theo danh mục dịch vụ: ${pickedService?.defaultRequiredStaff ?? 1} nhân viên. Có thể điều chỉnh theo quy mô khách chuyến này.`
             : 'HR sẽ phân công đủ số nhân viên này phụ trách tour tham quan.'}
         >
           <input
             key={`staff:${kind}:${selectedServiceId}`}
             id="program-required-staff"
             name="requiredStaffCount"
             type="number"
             min={1}
             max={2147483647}
             step={1}
             defaultValue={pickedService?.defaultRequiredStaff ?? 1}
             required
           />
         </Field>
       )
     })()}
    </>}
    {kind==='packages'&&<Field htmlFor="program-price" label={businessCopy('program.field.priceUsd')}><input id="program-price" name="price" type="number" min={0} step="any" required/></Field>}
    </fieldset></form>
    {error&&<Notice title="Chưa lưu được nội dung" tone="error">{error}</Notice>}
    {uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả">Đối chiếu bản đã lưu trước khi gửi tiếp.</Notice>}
   </Modal>}
  </>}{!creating&&!areaEditing&&!coordinator&&error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}{!creating&&!areaEditing&&!coordinator&&uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả">Tải lại trang để đối chiếu trước khi gửi tiếp.</Notice>}
 </Panel>
}

function PackageContents({cruiseId,packageId}:{cruiseId:string;packageId:string}){
 const [open,setOpen]=useState(false)
 const query=useReadQuery(`ops-package-contents:${cruiseId}:${packageId}:${open}`,useCallback(signal=>open?packageComponents(cruiseId,packageId,signal):Promise.resolve(null),[open,cruiseId,packageId]))
 const labels={services:businessCopy('program.package.kind.services'),activities:businessCopy('program.onboardActivity'),excursions:businessCopy('program.SHORE_EXCURSION')}
 return <details onToggle={event=>setOpen(event.currentTarget.open)}><summary>Xem quyền lợi trong gói</summary>
  {query.loading&&<Loading label="Đang tải quyền lợi trong gói…"/>}
  {query.error&&<Notice title="Chưa tải được quyền lợi trong gói" tone="error"><Button tone="secondary" onClick={query.retry}>Tải lại</Button></Notice>}
  {query.data&&<>{query.data.length?<ul>{query.data.map(c=><li key={c.kind+':'+c.referenceId}>{c.name} · {labels[c.kind]} · {businessCopy(c.benefitType==='INCLUDED'?'program.package.benefit.INCLUDED':'program.package.benefit.OPTIONAL')}</li>)}</ul>:<p>Chưa cấu hình quyền lợi trong gói.</p>}</>}
 </details>
}
