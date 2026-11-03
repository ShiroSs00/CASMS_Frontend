import {useCallback,useRef,useState,type FormEvent} from 'react'
import {ApiError,apiRequest,useReadQuery} from '@/shared/api'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {Button,Field,Loading,Modal,Notice} from '@/shared/ui'
import {SHIP_TIME_ZONE,zonedInput} from '@/shared/lib/journey-time'
import {programInstant} from '../model/program-time'
import styles from './ManagerWorkspace.module.css'

export type EditableProgram={id:string;name:string;serviceId?:string;cruiseStopId?:string|null;supplierId?:string|null;startsAt?:string;endsAt?:string;location?:string|null;capacity?:number|null}
type Excursion={shoreExcursionId:string;cruiseStopId:string;supplierId:string;excursionName:string;meetingPoint:string;startTime:string;plannedReturnTime:string;minimumParticipants:number|null;maximumCapacity:number;price:number|null;currencyCode:string|null}
type Choice={id:string;name:string;scheduled?:boolean;sequence?:number;timeZoneId?:string|null}
export function ScopedProgramEditor({cruiseId,kind,entry,revision,options,onClose,onSaved}:{cruiseId:string;kind:'excursions'|'serving-windows';entry:EditableProgram;revision:number;options:{services:Choice[];suppliers:Choice[];stops:Choice[]};onClose:()=>void;onSaved:()=>void}){
 const root=`/cruise-plans/${encodeURIComponent(cruiseId)}/${kind}`,shore=kind==='excursions'
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[unknown,setUnknown]=useState(false),[deleting,setDeleting]=useState(false),lock=useRef(false)
 const query=useReadQuery(`program-editor:${cruiseId}:${kind}:${entry.id}:${revision}`,useCallback(async signal=>{
  if(!shore)return entry
  const row=await apiRequest<Excursion>(root+'/'+encodeURIComponent(entry.id),{signal})
  if(row.shoreExcursionId!==entry.id||!row.cruiseStopId||!options.stops.some(s=>s.id===row.cruiseStopId))throw new ApiError('',502)
  return row
 },[shore,entry,root,options.stops]))
 const tour=shore?query.data as Excursion|null:null,window=shore?null:query.data as EditableProgram|null
 const stop=tour?.cruiseStopId??window?.cruiseStopId,zone=stop?options.stops.find(s=>s.id===stop)?.timeZoneId:SHIP_TIME_ZONE
 const title=shore?'Chỉnh sửa tour tham quan':'Chỉnh sửa khung phục vụ'
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current||unknown||!query.data)return
  const form=new FormData(event.currentTarget),text=(key:string)=>String(form.get(key)??'').trim(),stopId=text('stop')||null
  if(!shore&&!options.services.some(s=>s.id===text('service')&&s.scheduled)){setError('Chọn dịch vụ khả dụng trên tàu. Ship Manager cần cập nhật nếu dịch vụ đang dùng đã bị gỡ.');return}
  let start:string,end:string
  try{const tz=stopId?options.stops.find(s=>s.id===stopId)?.timeZoneId:undefined;start=programInstant(text('start'),Boolean(stopId),tz);end=programInstant(text('end'),Boolean(stopId),tz)}catch{setError('Kiểm tra giờ bắt đầu, kết thúc và múi giờ cảng.');return}
  const body=shore?{cruiseStopId:stopId,supplierId:text('supplier'),excursionName:text('name'),meetingPoint:text('location'),startTime:start,plannedReturnTime:end,minimumParticipants:tour?.minimumParticipants??null,maximumCapacity:Number(text('capacity')),price:Number(text('price')),currencyCode:'USD'}:{serviceId:text('service'),cruiseStopId:stopId,supplierId:text('supplier')||null,startsAt:start,endsAt:end,location:text('location'),capacity:Number(text('capacity'))}
  lock.current=true;setBusy(true);setError('')
  try{
   const saved=await apiRequest<{id?:string;shoreExcursionId?:string}>(root+'/'+encodeURIComponent(entry.id),{method:'PUT',ifMatch:revision,body})
   const actual=shore?await apiRequest<Excursion>(root+'/'+encodeURIComponent(entry.id)):(await apiRequest<EditableProgram[]>(root)).find(row=>row.id===entry.id)
   if((saved.id??saved.shoreExcursionId)!==entry.id||!actual||Object.entries(body).some(([key,value])=>{
    const stored=(actual as unknown as Record<string,unknown>)[key]??null
    return ['startTime','plannedReturnTime','startsAt','endsAt'].includes(key)?Date.parse(String(stored))!==Date.parse(String(value)):stored!==value
   }))throw new ApiError('',502)
   onSaved()
  }catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUnknown(true)}finally{lock.current=false;setBusy(false)}
 }
 async function remove(){
  if(lock.current||unknown)return;lock.current=true;setBusy(true);setError('')
  try{await apiRequest(root+'/'+encodeURIComponent(entry.id),{method:'DELETE',ifMatch:revision});const rows=await apiRequest<{id:string}[]>(root);if(rows.some(row=>row.id===entry.id))throw new ApiError('',502);onSaved()}
  catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUnknown(true)}finally{lock.current=false;setBusy(false)}
 }
 const wall=(value?:string)=>value&&zone?zonedInput(value,zone):''
 return <Modal wide busy={busy} title={title} onClose={onClose} footer={<><Button tone="secondary" disabled={busy} onClick={onClose}>Đóng</Button>{deleting?<Button tone="danger" disabled={busy||unknown} onClick={()=>void remove()}>Xóa nội dung đã chọn</Button>:<Button type="submit" form="scoped-program-edit" disabled={busy||unknown||!query.data||!zone}>Lưu thay đổi</Button>}</>}>
  {query.loading&&<Loading/>}{query.error&&<Notice title="Chưa tải được nội dung" tone="error">{query.error.message}<Button onClick={query.retry}>Tải lại</Button></Notice>}
  {query.data&&!deleting&&<form id="scoped-program-edit" onSubmit={save} className={styles.modalForm}><fieldset disabled={busy||unknown}>
   {shore?<Field htmlFor="scoped-name" label="Tên tour"><input id="scoped-name" name="name" defaultValue={tour?.excursionName} required/></Field>:<Field htmlFor="scoped-service" label="Dịch vụ"><select id="scoped-service" name="service" defaultValue={window?.serviceId} required><option value="">Chọn dịch vụ khả dụng trên tàu</option>{window?.serviceId&&!options.services.some(s=>s.id===window.serviceId)&&<option value={window.serviceId} disabled>Dịch vụ đang dùng không còn khả dụng trên tàu</option>}{options.services.filter(s=>s.scheduled||s.id===window?.serviceId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
   <Field htmlFor="scoped-stop" label="Lần ghé cảng"><select id="scoped-stop" name="stop" defaultValue={stop??''} required={shore}><option value="">{shore?'Chọn lần ghé cảng':'Trên tàu'}</option>{options.stops.map(s=><option key={s.id} value={s.id}>Lần {s.sequence} · {s.name}</option>)}</select></Field>
   <Field htmlFor="scoped-supplier" label="Nhà cung cấp"><select id="scoped-supplier" name="supplier" defaultValue={tour?.supplierId??window?.supplierId??''} required={shore}><option value="">Chưa chọn nhà cung cấp</option>{options.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
   <Field htmlFor="scoped-location" label={shore?'Điểm tập trung':'Địa điểm phục vụ'}><input id="scoped-location" name="location" defaultValue={tour?.meetingPoint??window?.location??''} required/></Field>
   <p>{stop?'Giờ địa phương cảng; kiểm tra múi giờ khi đổi lần ghé.':'Giờ tàu Việt Nam.'}</p>
   <Field htmlFor="scoped-start" label="Bắt đầu"><input id="scoped-start" name="start" type="datetime-local" step={1} defaultValue={wall(tour?.startTime??window?.startsAt)} required/></Field>
   <Field htmlFor="scoped-end" label="Kết thúc"><input id="scoped-end" name="end" type="datetime-local" step={1} defaultValue={wall(tour?.plannedReturnTime??window?.endsAt)} required/></Field>
   <Field htmlFor="scoped-capacity" label="Sức chứa"><input id="scoped-capacity" name="capacity" type="number" min={1} step={1} defaultValue={tour?.maximumCapacity??window?.capacity??''} required/></Field>
   {shore&&<Field htmlFor="scoped-price" label="Giá tour (USD)"><input id="scoped-price" name="price" type="number" min={0} step="any" defaultValue={tour?.currencyCode==='USD'?tour.price??'':''} required/></Field>}
  </fieldset><Button tone="danger" disabled={busy||unknown} onClick={()=>setDeleting(true)}>Xóa nội dung này</Button></form>}
  {deleting&&<Notice title="Xóa nội dung đã chọn" tone="warning">{entry.name}. Chỉ xóa được nội dung chưa có đăng ký hoặc liên kết sử dụng.<Button onClick={()=>setDeleting(false)}>Quay lại chỉnh sửa</Button></Notice>}
  {error&&<Notice title="Chưa lưu được thay đổi" tone="error">{error}</Notice>}{unknown&&<Notice title="Chưa xác định kết quả">Đóng và tải lại hồ sơ để đối chiếu trước khi gửi tiếp.</Notice>}
 </Modal>
}
