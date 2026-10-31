import {packageComponents} from '../api/scoped-package'
import {ActivityTimeRepair} from './ActivityTimeRepair'
import {DeparturePackageManager} from './DeparturePackageManager'
import {useCallback,useRef,useState,type FormEvent} from 'react'
import {ApiError,apiRequest,useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy} from '@/shared/i18n/business-copy'
import {Button,Field,Loading,Notice,Panel,Modal} from '@/shared/ui'
import {journeyTime,SHIP_TIME_ZONE} from '@/shared/lib/journey-time'
import {programInstant} from '../model/program-time'
import {mainflowApi} from '../api/mainflow-api'
import {decodeActivities,type ScopedActivity} from '../api/scoped-activity'
import {CruiseActivityEditor} from './CruiseActivityEditor'
import {CruiseDeckField,type CruiseVenueOptions} from './CruiseDeckField'
import {CruisePackageEditor} from './CruisePackageEditor'
import {decodeCommercialExcursions,type ExcursionCommercial} from '../api/scoped-excursion'
import {CruiseExcursionCommercialEditor} from './CruiseExcursionCommercialEditor'
import {ScopedProgramEditor,type EditableProgram} from './ScopedProgramEditor'
import styles from './ManagerWorkspace.module.css'
type Kind='activities'|'excursions'|'packages'|'serving-windows'
type Choice={id:string;name:string;sequence?:number;scheduled?:boolean;timeZoneId?:string|null}
type Program={id:string;name:string;ownerCruiseId?:string|null;price?:number|null;currency?:string|null;currencyCode?:string|null;capacity?:number|null;location?:string;startsAt?:string;endsAt?:string;cruiseStopId?:string|null}
type Options=CruiseVenueOptions&{services:Choice[];suppliers:Choice[];stops:Choice[]}
const titles:Record<Kind,string>={activities:businessCopy('program.onboardActivity'),excursions:businessCopy('program.SHORE_EXCURSION'),packages:businessCopy('program.TOUR_PACKAGE'),'serving-windows':businessCopy('program.SERVING_WINDOW')}
export function CruisePrograms({cruiseId,itineraryMode,onChanged}:{cruiseId:string;itineraryMode?:'FIXED'|'CUSTOM';onChanged:()=>void}){
 const access=useSessionAccess(),crm=access.roles.includes('CRUISE_MANAGER')&&access.has('CRUISE_UPDATE_DRAFT'),ops=access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_READ'),allowed=crm||ops,root=`/cruise-plans/${cruiseId}`
 const [epoch,setEpoch]=useState(0),[kind,setKind]=useState<Kind>('activities'),[editing,setEditing]=useState<{activity:ScopedActivity;revision:number}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),lock=useRef(false)
 const [repairing,setRepairing]=useState<string|null>(null),[repairSuccess,setRepairSuccess]=useState(false)
 const [creating,setCreating]=useState(false),[search,setSearch]=useState('')
 const [editingPackage,setEditingPackage]=useState<string|null>(null)
 const [editingExcursion,setEditingExcursion]=useState<{entry:ExcursionCommercial;revision:number}|null>(null)
 const [editingProgram,setEditingProgram]=useState<{kind:'excursions'|'serving-windows';entry:EditableProgram}|null>(null)
 const query=useReadQuery(`scoped-programs:${cruiseId}:${epoch}:${allowed}`,useCallback(async signal=>{
  if(!allowed)return null
  const [plan,options,activityRows,excursionRows,packages,windows]=await Promise.all([mainflowApi.get(cruiseId,signal),apiRequest<Options>(root+'/program-options',{signal}),apiRequest<ScopedActivity[]>(root+'/activities',{signal}),apiRequest<ExcursionCommercial[]>(root+'/excursions',{signal}),apiRequest<Program[]>(root+'/packages',{signal}),apiRequest<Program[]>(root+'/serving-windows',{signal})])
  const activities=decodeActivities(activityRows,cruiseId)
  const excursions=decodeCommercialExcursions(excursionRows)
  return {plan,options,activities,excursions,programs:{activities:activities.map(a=>({...a,currency:a.currencyCode})),excursions,packages,'serving-windows':windows}}
 },[allowed,cruiseId,root]))
 const data=query.data,editable=crm&&data&&['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(data.plan.planStatus),fixed=itineraryMode!=='CUSTOM'&&['activities','excursions'].includes(kind)
 async function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!data||lock.current||uncertain||!editable)return
  const f=new FormData(e.currentTarget),text=(key:string)=>String(f.get(key)??'').trim(),shore=kind==='excursions'||kind==='serving-windows'&&Boolean(text('stop')),portZone=data.options.stops.find(s=>s.id===text('stop'))?.timeZoneId
  let instants:Record<string,string>={}
  if(kind!=='packages')try{instants={start:programInstant(text('start'),shore,portZone),end:programInstant(text('end'),shore,portZone)}}catch{setError(businessCopy('program.time.invalid'));return}
  const instant=(key:string)=>instants[key]
  let body:Record<string,unknown>
  if(kind==='activities')body={cruiseId,activityName:text('name'),deckId:text('deckId')||null,cabinId:null,location:text('location'),description:text('description'),startTime:instant('start'),endTime:instant('end'),capacity:Number(text('capacity')),price:Number(text('price')),currencyCode:'USD'}
  else if(kind==='excursions')body={cruiseStopId:text('stop'),supplierId:text('supplier'),excursionName:text('name'),meetingPoint:text('location'),startTime:instant('start'),plannedReturnTime:instant('end'),maximumCapacity:Number(text('capacity')),price:Number(text('price')),currencyCode:'USD'}
  else if(kind==='packages')body={name:text('name'),description:text('description'),type:text('type'),price:Number(text('price')),currency:'USD'}
  else body={serviceId:text('service'),cruiseStopId:text('stop')||null,supplierId:text('supplier')||null,startsAt:instant('start'),endsAt:instant('end'),location:text('location'),capacity:Number(text('capacity'))}
  lock.current=true;setBusy(true);setError('')
  try{
   const saved=await apiRequest<{id?:string;shoreExcursionId?:string}>(root+'/'+kind,{method:'POST',ifMatch:data.plan.windows.expectedRevision,body})
   const rows=await apiRequest<Program[]>(root+'/'+kind),id=saved.id??saved.shoreExcursionId
   if(!id||!rows.some(row=>row.id===id))throw new ApiError('',502)
   setCreating(false);setEpoch(n=>n+1);onChanged()
  }catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 if(!allowed)return null
 return <Panel className={styles.programPanel} title={ops?'Chương trình và dịch vụ đã cấu hình':businessCopy('program.configuration')}>
  {repairSuccess&&<Notice title="Đã sửa giờ hoạt động" tone="success">Giờ hợp lệ đã được khóa lại theo lịch trình cố định.</Notice>}
  {query.loading&&<Loading label="Đang tải chương trình của chuyến khởi hành…"/>}{query.error&&<Notice title={query.error instanceof ApiError&&query.error.status===403?'Chưa có quyền xem chương trình':'Chưa tải được chương trình'} tone="error"><p>{query.error instanceof ApiError&&query.error.status===403?'Tài khoản hiện tại chưa được cấp đủ quyền đọc chương trình của chuyến khởi hành.':query.error.message}</p><Button onClick={query.retry}>Tải lại dữ liệu</Button></Notice>}
  {data&&<><Field htmlFor="program-kind" label={businessCopy('program.field.content')}><select id="program-kind" value={kind} disabled={busy||Boolean(editing)||Boolean(editingPackage)||Boolean(editingExcursion)} onChange={e=>{setKind(e.target.value as Kind);setSearch('');setError('')}}>{(Object.keys(titles) as Kind[]).map(k=><option key={k} value={k}>{titles[k]}</option>)}</select></Field>
   <div className={styles.programToolbar}><Field htmlFor="program-search" label="Tìm trong danh sách"><input id="program-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nhập tên nội dung…"/></Field><p role="status">{data.programs[kind].filter(p=>p.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))).length} / {data.programs[kind].length} mục</p></div>
   <ul className={styles.programList}>{data.programs[kind].filter(p=>p.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))).map(p=>{
    const activity=kind==='activities'?data.activities.find(a=>a.id===p.id):null
    const invalidTime=activity&&data.plan.programIssues?.some(issue=>issue.itemId===activity.id&&issue.code==='ACTIVITY_OUTSIDE_CRUISE')
    const servingWindow=kind==='serving-windows'?data.programs['serving-windows'].find(window=>window.id===p.id):null
    const excursion=kind==='excursions'?data.excursions.find(e=>e.id===p.id):null
    const excursionStop=excursion?.cruiseStopId?data.options.stops.find(stop=>stop.id===excursion.cruiseStopId):null
    const servingZone=servingWindow?.cruiseStopId?data.options.stops.find(stop=>stop.id===servingWindow.cruiseStopId)?.timeZoneId:SHIP_TIME_ZONE
    return <li key={p.id}><div className={styles.programInfo}><h3>{p.name}</h3>
      {servingWindow&&<><p>{servingWindow.startsAt&&servingWindow.endsAt&&servingZone?`${journeyTime(servingWindow.startsAt,servingZone)} → ${journeyTime(servingWindow.endsAt,servingZone)}`:'Chưa đủ thời gian hoặc múi giờ'} · {servingWindow.cruiseStopId?'Giờ cảng':'Giờ tàu (Việt Nam)'}</p><p>{servingWindow.location||'Chưa có địa điểm'}</p></>}
      {excursion&&<><p>{excursion.startsAt&&excursion.endsAt&&excursionStop?.timeZoneId?`${journeyTime(excursion.startsAt,excursionStop.timeZoneId)} → ${journeyTime(excursion.endsAt,excursionStop.timeZoneId)}`:'Chưa đủ thời gian hoặc múi giờ'} · Giờ cảng</p><p>{excursionStop?`Lần ${excursionStop.sequence} · ${excursionStop.name}`:'Chưa xác định lần ghé cảng'} · {excursion.location||'Chưa có điểm tập trung'}</p></>}
      {activity&&<><p>{journeyTime(activity.startTime)} → {journeyTime(activity.endTime)} · Giờ Việt Nam</p><p>{activity.location||'Chưa xác định địa điểm'}</p></>}
      <div className={styles.programMeta}>{p.price!=null?<span>{new Intl.NumberFormat('vi-VN').format(p.price)} {p.currency??'Chưa xác định tiền tệ'}</span>:kind==='activities'?<span>Chưa có giá</span>:null}{p.capacity!=null?<span>{p.capacity} chỗ</span>:kind==='activities'?<span>Chưa có sức chứa</span>:null}</div>{ops&&kind==='packages'&&<PackageContents cruiseId={cruiseId} packageId={p.id}/>}</div>
      {editable&&<div className={styles.sectionActions}>
       {activity&&invalidTime&&itineraryMode==='FIXED'&&<Button disabled={busy||uncertain} onClick={()=>{setRepairSuccess(false);setRepairing(activity.id)}}>Sửa giờ không hợp lệ</Button>}
       {activity&&!editing&&<Button tone="secondary" aria-label={(itineraryMode!=='CUSTOM'?'Cập nhật giá và số chỗ: ':'Chỉnh sửa hoạt động: ')+p.name} disabled={busy||uncertain} onClick={()=>setEditing({activity,revision:data.plan.windows.expectedRevision})}>{itineraryMode!=='CUSTOM'?'Cập nhật giá và số chỗ':'Chỉnh sửa hoạt động'}</Button>}
       {kind==='packages'&&'ownerCruiseId' in p&&p.ownerCruiseId===cruiseId&&!editingPackage&&<Button tone="secondary" aria-label={'Chỉnh sửa gói: '+p.name} disabled={busy||uncertain} onClick={()=>setEditingPackage(p.id)}>Chỉnh sửa gói</Button>}
       {kind==='excursions'&&!editingExcursion&&<Button tone="secondary" aria-label={'Chỉnh sửa giá và sức chứa: '+p.name} disabled={busy||uncertain} onClick={()=>{const entry=data.excursions.find(e=>e.id===p.id);if(entry)setEditingExcursion({entry,revision:data.plan.windows.expectedRevision})}}>Giá và sức chứa</Button>}
       {!editingProgram&&(kind==='serving-windows'||kind==='excursions'&&itineraryMode==='CUSTOM')&&<Button tone="secondary" aria-label={'Chỉnh sửa lịch: '+p.name} disabled={busy||uncertain} onClick={()=>setEditingProgram({kind,entry:p})}>Chỉnh sửa lịch</Button>}
      </div>}
    </li>
   })}</ul>
   {!data.programs[kind].length&&<p className={styles.emptyProgram}>Chưa có {titles[kind].toLocaleLowerCase('vi')} trong chuyến khởi hành này.</p>}
   {data.programs[kind].length>0&&!data.programs[kind].some(p=>p.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))&&<p className={styles.emptyProgram}>Không có nội dung khớp với “{search}”. <Button tone="text" onClick={()=>setSearch('')}>Xóa tìm kiếm</Button></p>}
   {repairing&&editable&&<ActivityTimeRepair cruiseId={cruiseId} activityId={repairing} onClose={()=>setRepairing(null)} onSaved={()=>{setRepairing(null);setRepairSuccess(true);setEpoch(n=>n+1);onChanged()}}/>}
   {editing&&editable&&<CruiseActivityEditor key={editing.activity.id} activity={editing.activity} venueOptions={data.options} revision={editing.revision} fixed={itineraryMode!=='CUSTOM'} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);setEpoch(n=>n+1);onChanged()}}/>}

   {editingPackage&&<CruisePackageEditor cruiseId={cruiseId} packageId={editingPackage} onClose={()=>setEditingPackage(null)} onSaved={()=>{setEditingPackage(null);setEpoch(n=>n+1);onChanged()}}/>}

   {editingExcursion&&editable&&<CruiseExcursionCommercialEditor key={editingExcursion.entry.id} cruiseId={cruiseId} entry={editingExcursion.entry} revision={editingExcursion.revision} onClose={()=>setEditingExcursion(null)} onSaved={()=>{setEditingExcursion(null);setEpoch(n=>n+1);onChanged()}}/>}

   {editingProgram&&editable&&<ScopedProgramEditor cruiseId={cruiseId} kind={editingProgram.kind} entry={editingProgram.entry} options={data.options} revision={data.plan.windows.expectedRevision} onClose={()=>setEditingProgram(null)} onSaved={()=>{setEditingProgram(null);setEpoch(n=>n+1);onChanged()}}/>}
   {kind==='packages'&&editable&&access.canDo('TOUR_PACKAGE_ASSIGN')&&<details className={styles.disclosure}><summary>Gắn hoặc gỡ gói dịch vụ có sẵn</summary><div className={styles.disclosureBody}><DeparturePackageManager cruiseId={cruiseId} onChanged={()=>{setEpoch(n=>n+1);onChanged()}}/></div></details>}
   {crm&&!editable&&<Notice title={businessCopy('program.locked')}>{businessErrorMessage('PLAN_FROZEN','')}</Notice>}
   {crm&&fixed&&<Notice title={businessCopy('cruise.itinerary.FIXED')}>{kind==='activities'?'Giờ hợp lệ vẫn khóa. Hoạt động đang lỗi có thao tác “Sửa giờ không hợp lệ” riêng.':businessErrorMessage('FIXED_ITINERARY_READ_ONLY','')}</Notice>}
   {crm&&kind==='serving-windows'&&data.options.services.filter(s=>s.scheduled).length===0&&<Notice title={data.options.ship.id?'Tàu chưa có dịch vụ cần xếp khung phục vụ':'Chưa phân công tàu'}>{data.options.ship.id?'Ship Manager cần gán dịch vụ cho tàu trước khi Quản lý lịch trình xếp khung phục vụ.':'Phân công tàu tại mục Tàu và quy định trước khi chọn dịch vụ.'}</Notice>}
   {editable&&!fixed&&!editing&&!editingPackage&&!editingExcursion&&!editingProgram&&<Button disabled={busy||uncertain||fixed||kind==='serving-windows'&&!data.options.services.some(s=>s.scheduled)} onClick={()=>{setError('');setCreating(true)}}>Thêm {titles[kind].toLocaleLowerCase('vi')}</Button>}
   {creating&&editable&&<Modal wide busy={busy} title={'Thêm '+titles[kind].toLocaleLowerCase('vi')} onClose={()=>setCreating(false)} footer={<><Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={()=>setCreating(false)}>Hủy</Button><Button type="submit" form="cruise-program-create" disabled={busy||uncertain||fixed}>{busy?'Đang lưu…':businessCopy('program.action.saveDraft')}</Button></>}>
   <form id="cruise-program-create" className={styles.modalForm} key={kind} onSubmit={create}><fieldset disabled={busy||uncertain||fixed}>
    {kind!=='serving-windows'&&<Field htmlFor="program-name" label={businessCopy('program.field.name')}><input id="program-name" name="name" required/></Field>}
    {(kind==='activities'||kind==='packages')&&<Field htmlFor="program-description" label={businessCopy('program.field.description')}><textarea id="program-description" name="description"/></Field>}
    {kind==='activities'&&<CruiseDeckField options={data.options}/>}
    {kind==='packages'&&<Field htmlFor="program-type" label={businessCopy('program.field.type')}><select id="program-type" name="type" required><option value="">Chọn loại gói</option><option value="BASIC">Cơ bản</option><option value="ADD_ON">Dịch vụ bổ sung</option></select></Field>}
    {kind==='serving-windows'&&<Field htmlFor="program-service" label={businessCopy('program.field.service')}><select id="program-service" name="service" required><option value="">Chọn dịch vụ</option>{data.options.services.filter(s=>s.scheduled).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
    {(kind==='excursions'||kind==='serving-windows')&&<>
     <Field htmlFor="program-stop" label={businessCopy('program.field.stop')}><select id="program-stop" name="stop" required={kind==='excursions'}><option value="">{kind==='excursions'?'Chọn lần ghé':'Trên tàu'}</option>{data.options.stops.map(s=><option key={s.id} value={s.id}>Lần {s.sequence} · {s.name}</option>)}</select></Field>
     <Field htmlFor="program-supplier" label={businessCopy('program.field.supplier')}><select id="program-supplier" name="supplier" required={kind==='excursions'}><option value="">Chọn nhà cung cấp</option>{data.options.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
    </>}
    {kind!=='packages'&&<>
     <Field htmlFor="program-location" label={businessCopy(kind==='excursions'?'program.field.meetingPoint':'program.field.location')}><input id="program-location" name="location" required/></Field>
     <Field htmlFor="program-start" label={businessCopy(kind==='excursions'?'program.field.startPort':kind==='serving-windows'?'program.field.startVenue':'program.field.startShip')}><input id="program-start" name="start" type="datetime-local" required/></Field>
     <Field htmlFor="program-end" label={businessCopy(kind==='excursions'?'program.field.returnPort':kind==='serving-windows'?'program.field.endVenue':'program.field.endShip')}><input id="program-end" name="end" type="datetime-local" required/></Field>
     <Field htmlFor="program-capacity" label={businessCopy('program.field.capacity')}><input id="program-capacity" name="capacity" type="number" min={1} step={1} required/></Field>
    </>}
    {kind!=='serving-windows'&&<Field htmlFor="program-price" label={businessCopy('program.field.priceUsd')}><input id="program-price" name="price" type="number" min={0} step="any" required/></Field>}
    </fieldset></form>
    {error&&<Notice title="Chưa lưu được nội dung" tone="error">{error}</Notice>}
    {uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả">Đối chiếu bản đã lưu trước khi gửi tiếp.</Notice>}
   </Modal>}
  </>}{error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}{uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả">Tải lại trang để đối chiếu trước khi gửi tiếp.</Notice>}
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
