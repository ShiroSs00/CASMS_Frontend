import {useCallback,useRef,useState,type FormEvent} from 'react'
import {ApiError,apiRequest,useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy} from '@/shared/i18n/business-copy'
import {Button,Field,Loading,Notice,Panel} from '@/shared/ui'
import {preparationInstant} from '../model/preparation-time'
import {journeyTime,SHIP_TIME_ZONE} from '@/shared/lib/journey-time'
type Session={sessionId:string;cruiseId:string;revision:number;sessionName:string;location:string;startAt:string;endAt:string;instructorUserId:string;content:string|null;capacity:number;status:'Scheduled'|'Published'|'Completed'|'Cancelled'}
type Instructor={id:string;username:string}
const keys={Scheduled:'guidance.SCHEDULED',Published:'guidance.PUBLISHED',Completed:'guidance.COMPLETED',Cancelled:'guidance.CANCELLED'} as const
export function CruiseGuidance({cruiseId,onChanged}:{cruiseId:string;onChanged:()=>void}){
 const access=useSessionAccess(),allowed=access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_READ'),root=`/cruise-plans/${cruiseId}/guidance`
 const [epoch,setEpoch]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[success,setSuccess]=useState(''),lock=useRef(false)
 const query=useReadQuery(`guidance-owned:${cruiseId}:${epoch}:${allowed}`,useCallback(signal=>allowed?apiRequest<Session[]>(root,{signal}):Promise.resolve([]),[allowed,root]))
 const people=useReadQuery(`guidance-instructors:${cruiseId}:${allowed}`,useCallback(signal=>allowed?apiRequest<Instructor[]>(root+'/instructors',{signal}):Promise.resolve([]),[allowed,root]))
 async function mutate(body?:Record<string,unknown>,session?:Session){
  if(lock.current||uncertain||!allowed)return;lock.current=true;setBusy(true);setError('');setSuccess('')
  try{
   const saved=await apiRequest<Session>(root+(session?`/${session.sessionId}/publish`:''),{method:'POST',body,ifMatch:session?.revision})
   const rows=await apiRequest<Session[]>(root),actual=rows.find(row=>row.sessionId===saved.sessionId)
   if(saved.cruiseId!==cruiseId||!actual||actual.revision!==saved.revision||actual.status!==saved.status||session&&actual.status!=='Published')throw new ApiError('',502)
   setSuccess(businessCopy(keys[actual.status]));setEpoch(n=>n+1);onChanged()
  }catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 function create(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const data=Object.fromEntries(f) as Record<string,unknown>;data.capacity=Number(f.get('capacity'));try{data.startAt=preparationInstant(String(f.get('startAt')));data.endAt=preparationInstant(String(f.get('endAt')))}catch{setError(businessCopy('program.time.invalid'));return}void mutate(data)}
 if(!allowed)return null
 return <Panel title={businessCopy('guidance.title')}>
  {(query.loading||people.loading)&&<Loading/>}{(query.error||people.error)&&<Notice title="Không thể hoàn tất thao tác"><Button onClick={()=>{query.retry();people.retry()}}>Tải lại dữ liệu</Button></Notice>}
  {query.data?.map(s=><section key={s.sessionId}><h3>{s.sessionName}</h3><p>{businessCopy(keys[s.status])} · {journeyTime(s.startAt,SHIP_TIME_ZONE)} · {businessCopy('preparation.shipTime')} · {s.capacity} chỗ</p><p>{s.content}</p><p>{people.data?.find(p=>p.id===s.instructorUserId)?.username??'Chưa tải được người phụ trách'}</p>{s.status==='Scheduled'&&<Button disabled={busy||uncertain||!s.content?.trim()} onClick={()=>void mutate(undefined,s)}>{businessCopy('guidance.action.publish')}</Button>}</section>)}
  <details><summary>{businessCopy('guidance.action.schedule')}</summary><form onSubmit={create}><fieldset disabled={busy||uncertain||query.loading||people.loading||Boolean(query.error||people.error)}>
   <Field htmlFor="guide-name" label={businessCopy('guidance.field.name')}><input id="guide-name" name="sessionName" required/></Field>
   <Field htmlFor="guide-location" label={businessCopy('guidance.field.location')}><input id="guide-location" name="location" required/></Field>
   <Field htmlFor="guide-start" label={businessCopy('guidance.field.startShip')}><input id="guide-start" name="startAt" type="datetime-local" step={1} required/></Field>
   <Field htmlFor="guide-end" label={businessCopy('guidance.field.endShip')}><input id="guide-end" name="endAt" type="datetime-local" step={1} required/></Field>
   <Field htmlFor="guide-capacity" label={businessCopy('guidance.field.capacity')}><input id="guide-capacity" name="capacity" type="number" min={1} step={1} required/></Field>
   <Field htmlFor="guide-person" label={businessCopy('guidance.field.instructor')}><select id="guide-person" name="instructorUserId" required><option value="">Chọn nhân viên</option>{people.data?.map(p=><option key={p.id} value={p.id}>{p.username}</option>)}</select></Field>
   <Field htmlFor="guide-content" label={businessCopy('guidance.field.content')}><textarea id="guide-content" name="content" required/></Field>
   <Button type="submit">{businessCopy('guidance.action.save')}</Button></fieldset></form></details>
  {error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}{success&&<Notice title={success}>{success}</Notice>}
  {uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả">Tải lại trang để đối chiếu trước khi gửi tiếp.</Notice>}
  <p>{businessCopy('guidance.notReadyConfirmation')}</p>
 </Panel>
}
