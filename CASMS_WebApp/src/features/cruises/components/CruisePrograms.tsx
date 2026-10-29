import {useCallback,useRef,useState,type FormEvent} from 'react'
import {ApiError,apiRequest,useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy} from '@/shared/i18n/business-copy'
import {Button,Field,Loading,Notice,Panel} from '@/shared/ui'
import {programInstant} from '../model/program-time'
import {mainflowApi} from '../api/mainflow-api'
import {decodeActivities,type ScopedActivity} from '../api/scoped-activity'
import {CruiseActivityEditor} from './CruiseActivityEditor'
import {CruiseDeckField,type CruiseVenueOptions} from './CruiseDeckField'
import {CruisePackageEditor} from './CruisePackageEditor'
import {decodeCommercialExcursions,type ExcursionCommercial} from '../api/scoped-excursion'
import {CruiseExcursionCommercialEditor} from './CruiseExcursionCommercialEditor'
type Kind='activities'|'excursions'|'packages'|'serving-windows'
type Choice={id:string;name:string;sequence?:number;scheduled?:boolean;timeZoneId?:string|null}
type Program={id:string;name:string;ownerCruiseId?:string|null;price?:number|null;currency?:string|null;currencyCode?:string|null;capacity?:number|null;location?:string;startsAt?:string;endsAt?:string}
type Options=CruiseVenueOptions&{services:Choice[];suppliers:Choice[];stops:Choice[]}
const titles:Record<Kind,string>={activities:businessCopy('program.onboardActivity'),excursions:businessCopy('program.SHORE_EXCURSION'),packages:businessCopy('program.TOUR_PACKAGE'),'serving-windows':businessCopy('program.SERVING_WINDOW')}
export function CruisePrograms({cruiseId,itineraryMode,onChanged}:{cruiseId:string;itineraryMode?:'FIXED'|'CUSTOM';onChanged:()=>void}){
 const access=useSessionAccess(),allowed=access.roles.includes('CRUISE_MANAGER')&&access.has('CRUISE_UPDATE_DRAFT'),root=`/cruise-plans/${cruiseId}`
 const [epoch,setEpoch]=useState(0),[kind,setKind]=useState<Kind>('activities'),[editing,setEditing]=useState<{activity:ScopedActivity;revision:number}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),lock=useRef(false)
 const [editingPackage,setEditingPackage]=useState<string|null>(null)
 const [editingExcursion,setEditingExcursion]=useState<{entry:ExcursionCommercial;revision:number}|null>(null)
 const query=useReadQuery(`scoped-programs:${cruiseId}:${epoch}:${allowed}`,useCallback(async signal=>{
  if(!allowed)return null
  const [plan,options,activityRows,excursionRows,packages,windows]=await Promise.all([mainflowApi.get(cruiseId,signal),apiRequest<Options>(root+'/program-options',{signal}),apiRequest<ScopedActivity[]>(root+'/activities',{signal}),apiRequest<ExcursionCommercial[]>(root+'/excursions',{signal}),apiRequest<Program[]>(root+'/packages',{signal}),apiRequest<Program[]>(root+'/serving-windows',{signal})])
  const activities=decodeActivities(activityRows,cruiseId)
  const excursions=decodeCommercialExcursions(excursionRows)
  return {plan,options,activities,excursions,programs:{activities:activities.map(a=>({...a,currency:a.currencyCode})),excursions,packages,'serving-windows':windows}}
 },[allowed,cruiseId,root]))
 const data=query.data,editable=data&&['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(data.plan.planStatus),fixed=itineraryMode!=='CUSTOM'&&['activities','excursions'].includes(kind)
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
   setEpoch(n=>n+1);onChanged()
  }catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 if(!allowed)return null
 return <Panel title={businessCopy('program.configuration')}>
  {query.loading&&<Loading/>}{query.error&&<Notice title="Không thể hoàn tất thao tác"><Button onClick={query.retry}>Tải lại dữ liệu</Button></Notice>}
  {data&&<><Field htmlFor="program-kind" label={businessCopy('program.field.content')}><select id="program-kind" value={kind} disabled={busy||Boolean(editing)||Boolean(editingPackage)||Boolean(editingExcursion)} onChange={e=>{setKind(e.target.value as Kind);setError('')}}>{(Object.keys(titles) as Kind[]).map(k=><option key={k} value={k}>{titles[k]}</option>)}</select></Field>
   <ul>{data.programs[kind].map(p=><li key={p.id}>{p.name}{kind==='activities'&&p.price==null&&<> · {businessCopy('program.activity.priceUnknown')}</>}{kind==='activities'&&p.capacity==null&&<> · {businessCopy('program.activity.capacityUnknown')}</>}{p.price!=null&&<> · {p.price} {p.currency??businessCopy('program.price.currencyUnknown')}</>}{p.capacity!=null&&<> · {p.capacity} chỗ</>}{kind==='activities'&&editable&&!editing&&<Button disabled={busy||uncertain} onClick={()=>{const activity=data.activities.find(a=>a.id===p.id);if(activity)setEditing({activity,revision:data.plan.windows.expectedRevision})}}>{businessCopy('program.activity.edit')}</Button>}</li>)}</ul>
   {editing&&editable&&<CruiseActivityEditor key={editing.activity.id} activity={editing.activity} venueOptions={data.options} revision={editing.revision} fixed={itineraryMode!=='CUSTOM'} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);setEpoch(n=>n+1);onChanged()}}/>}
   {kind==='packages'&&editable&&!editingPackage&&data.programs.packages.filter(p=>p.ownerCruiseId===cruiseId).map(p=><Button key={p.id} disabled={busy||uncertain} onClick={()=>setEditingPackage(p.id)}>{businessCopy('program.package.edit')}: {p.name}</Button>)}
   {editingPackage&&<CruisePackageEditor cruiseId={cruiseId} packageId={editingPackage} onClose={()=>setEditingPackage(null)} onSaved={()=>{setEditingPackage(null);setEpoch(n=>n+1);onChanged()}}/>}
   {kind==='excursions'&&editable&&!editingExcursion&&data.excursions.map(entry=><Button key={entry.id} disabled={busy||uncertain} onClick={()=>setEditingExcursion({entry,revision:data.plan.windows.expectedRevision})}>{businessCopy('program.excursion.editCommercial')}: {entry.name}</Button>)}
   {editingExcursion&&editable&&<CruiseExcursionCommercialEditor key={editingExcursion.entry.id} cruiseId={cruiseId} entry={editingExcursion.entry} revision={editingExcursion.revision} onClose={()=>setEditingExcursion(null)} onSaved={()=>{setEditingExcursion(null);setEpoch(n=>n+1);onChanged()}}/>}
   {!editable&&<Notice title={businessCopy('program.locked')}>{businessErrorMessage('PLAN_FROZEN','')}</Notice>}
   {fixed&&<Notice title={businessCopy('cruise.itinerary.FIXED')}>{businessErrorMessage('FIXED_ITINERARY_READ_ONLY','')}</Notice>}
   {editable&&!editing&&!editingPackage&&!editingExcursion&&<form key={kind} onSubmit={create}><fieldset disabled={busy||uncertain||fixed}>
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
    <Button type="submit">{businessCopy('program.action.saveDraft')}</Button></fieldset></form>}
  </>}{error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}{uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả">Tải lại trang để đối chiếu trước khi gửi tiếp.</Notice>}
 </Panel>
}
