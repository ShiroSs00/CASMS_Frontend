import {useCallback,useRef,useState,type FormEvent} from 'react'
import {ApiError,apiRequest,useReadQuery} from '@/shared/api'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {Button,Field,Loading,Modal,Notice} from '@/shared/ui'
import {SHIP_TIME_ZONE,zonedInput,wallTimeToInstant} from '@/shared/lib/journey-time'
import styles from './ManagerWorkspace.module.css'

type Context={cruiseId:string;activityId:string;revision:number;name:string;startsAt:string|null;endsAt:string|null;earliestStart:string|null;latestEnd:string|null;canRepair:boolean;blocker:string|null}
export function ActivityTimeRepair({cruiseId,activityId,onClose,onSaved}:{cruiseId:string;activityId:string;onClose:()=>void;onSaved:()=>void}){
 const root=`/cruise-plans/${encodeURIComponent(cruiseId)}/activities/${encodeURIComponent(activityId)}/time-repair`
 const decode=useCallback((value:Context)=>{if(!value||value.cruiseId!==cruiseId||value.activityId!==activityId||!Number.isSafeInteger(value.revision)||typeof value.canRepair!=='boolean'||typeof value.name!=='string'||[value.startsAt,value.endsAt,value.earliestStart,value.latestEnd].some(t=>t!==null&&(typeof t!=='string'||!Number.isFinite(Date.parse(t)))))throw new ApiError('Chưa xác định được điều kiện sửa giờ.',502);return value},[cruiseId,activityId])
 const query=useReadQuery(`activity-time-repair:${cruiseId}:${activityId}`,useCallback(signal=>apiRequest<Context>(root,{signal}).then(decode),[root,decode]))
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),lock=useRef(false),data=query.data
 const show=(value:string|null)=>value?new Intl.DateTimeFormat('vi-VN',{timeZone:SHIP_TIME_ZONE,dateStyle:'short',timeStyle:'medium'}).format(new Date(value)):'Chưa có giờ'
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!data?.canRepair||busy||uncertain||lock.current||query.loading||query.error)return
  const form=new FormData(event.currentTarget);let startsAt:string,endsAt:string
  try{startsAt=wallTimeToInstant(String(form.get('start')),SHIP_TIME_ZONE);endsAt=wallTimeToInstant(String(form.get('end')),SHIP_TIME_ZONE)}catch{setError('Nhập đầy đủ ngày và giờ hợp lệ theo giờ tàu Việt Nam.');return}
  if(!data.earliestStart||!data.latestEnd||Date.parse(endsAt)<=Date.parse(startsAt)||Date.parse(startsAt)<Date.parse(data.earliestStart)||Date.parse(endsAt)>Date.parse(data.latestEnd)){setError(businessErrorMessage('ACTIVITY_OUTSIDE_CRUISE',''));return}
  lock.current=true;setBusy(true);setError('')
  try{
   const saved=decode(await apiRequest<Context>(root,{method:'PUT',ifMatch:data.revision,body:{startsAt,endsAt}}))
   const actual=decode(await apiRequest<Context>(root))
   if(saved.revision!==data.revision+1||actual.revision!==saved.revision||Date.parse(actual.startsAt??'')!==Date.parse(startsAt)||Date.parse(actual.endsAt??'')!==Date.parse(endsAt)||actual.canRepair)throw new ApiError('Chưa xác nhận được giờ đã lưu.',502)
   onSaved()
  }catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 return <Modal wide busy={busy} title="Sửa giờ không hợp lệ" onClose={onClose} footer={<><Button tone="secondary" disabled={busy} onClick={onClose}>Quay lại</Button><Button type="submit" form="activity-time-repair-form" disabled={busy||uncertain||query.loading||Boolean(query.error)||!data?.canRepair}>{busy?'Đang lưu…':'Lưu giờ hoạt động'}</Button></>}>
  {query.loading&&<Loading label="Đang kiểm tra điều kiện sửa giờ…"/>}
  {query.error&&<Notice title="Chưa kiểm tra được điều kiện sửa giờ" tone="error"><Button tone="secondary" onClick={query.retry}>Tải lại</Button></Notice>}
  {data&&!query.loading&&!query.error&&<>
   <h3>{data.name}</h3><p>Giờ hiện tại: {show(data.startsAt)} → {show(data.endsAt)}</p>
   <p>Thời gian chuyến: {show(data.earliestStart)} → {show(data.latestEnd)} · Giờ tàu (Việt Nam)</p>
   {data.canRepair?<><p>Chỉ sửa giờ đang sai của bản nháp. Sau khi lưu hợp lệ, giờ hoạt động sẽ khóa lại theo lịch trình cố định.</p>
    <form id="activity-time-repair-form" className={styles.modalForm} onSubmit={save}><fieldset disabled={busy||uncertain}>
     <Field htmlFor="repair-activity-start" label="Giờ bắt đầu mới · Giờ Việt Nam"><input id="repair-activity-start" name="start" type="datetime-local" step={1} min={data.earliestStart?zonedInput(data.earliestStart,SHIP_TIME_ZONE):undefined} max={data.latestEnd?zonedInput(data.latestEnd,SHIP_TIME_ZONE):undefined} required/></Field>
     <Field htmlFor="repair-activity-end" label="Giờ kết thúc mới · Giờ Việt Nam"><input id="repair-activity-end" name="end" type="datetime-local" step={1} min={data.earliestStart?zonedInput(data.earliestStart,SHIP_TIME_ZONE):undefined} max={data.latestEnd?zonedInput(data.latestEnd,SHIP_TIME_ZONE):undefined} required/></Field>
    </fieldset></form></>:<Notice title="Không thể sửa giờ bằng thao tác này">{businessErrorMessage(data.blocker??undefined,'')}</Notice>}
  </>}
  {error&&<Notice title="Chưa lưu được giờ hoạt động" tone="error">{error}</Notice>}
  {uncertain&&<Notice title="Chưa xác định kết quả lưu">Đóng cửa sổ và tải lại chương trình để đối chiếu trước khi thao tác tiếp.</Notice>}
 </Modal>
}
