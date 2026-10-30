import {useCallback,useRef,useState,type FormEvent} from 'react'
import {ApiError,apiRequest,useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy} from '@/shared/i18n/business-copy'
import {Button,Field,Loading,Notice,Panel,Modal} from '@/shared/ui'
import {preparationInstant,preparationWallTime} from '../model/preparation-time'
import {journeyTime,SHIP_TIME_ZONE} from '@/shared/lib/journey-time'
import styles from './ManagerWorkspace.module.css'
type Session={sessionId:string;cruiseId:string;revision:number;sessionName:string;location:string;startAt:string;endAt:string;instructorUserId:string;content:string|null;capacity:number;status:'Scheduled'|'Published'|'Completed'|'Cancelled'}
type Instructor={id:string;username:string}
const keys={Scheduled:'guidance.SCHEDULED',Published:'guidance.PUBLISHED',Completed:'guidance.COMPLETED',Cancelled:'guidance.CANCELLED'} as const
export function CruiseGuidance({cruiseId,onChanged}:{cruiseId:string;onChanged:()=>void}){
 const access=useSessionAccess(),allowed=access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_READ'),root=`/cruise-plans/${cruiseId}/guidance`
 const [epoch,setEpoch]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[success,setSuccess]=useState(''),lock=useRef(false)
 const query=useReadQuery(`guidance-owned:${cruiseId}:${epoch}:${allowed}`,useCallback(signal=>allowed?apiRequest<Session[]>(root,{signal}):Promise.resolve([]),[allowed,root]))
 const [editor,setEditor]=useState<Session|'new'|null>(null),[cancelling,setCancelling]=useState<Session|null>(null)
 const people=useReadQuery(`guidance-instructors:${cruiseId}:${allowed}`,useCallback(signal=>allowed?apiRequest<Instructor[]>(root+'/instructors',{signal}):Promise.resolve([]),[allowed,root]))
 async function mutate(body?:Record<string,unknown>,session?:Session,operation:'save'|'publish'|'cancel'='publish'){
  if(lock.current||uncertain||!allowed)return;lock.current=true;setBusy(true);setError('');setSuccess('')
  try{
   const saved=await apiRequest<Session>(root+(session?`/${session.sessionId}${operation==='save'?'':'/'+operation}`:''),{method:session&&operation==='save'?'PUT':'POST',body,ifMatch:session?.revision})
   const rows=await apiRequest<Session[]>(root),actual=rows.find(row=>row.sessionId===saved.sessionId)
   if(saved.cruiseId!==cruiseId||!actual||actual.revision!==saved.revision||actual.status!==saved.status||actual.status!==(operation==='cancel'?'Cancelled':operation==='publish'&&session?'Published':'Scheduled'))throw new ApiError('',502)
   setEditor(null);setCancelling(null);setSuccess(operation==='cancel'?'Đã hủy buổi hướng dẫn':operation==='save'?'Đã lưu buổi hướng dẫn':businessCopy(keys[actual.status]));setEpoch(n=>n+1);onChanged()
  }catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const f=new FormData(e.currentTarget),data=Object.fromEntries(f) as Record<string,unknown>
  for(const key of ['sessionName','location','content']){data[key]=String(f.get(key)??'').trim();if(!data[key]){setError('Nhập đầy đủ tên, địa điểm và nội dung buổi hướng dẫn.');return}}
  data.capacity=Number(f.get('capacity'))
  try{data.startAt=preparationInstant(String(f.get('startAt')));data.endAt=preparationInstant(String(f.get('endAt')))}catch{setError(businessCopy('program.time.invalid'));return}
  if(String(data.startAt)>=String(data.endAt)){setError('Giờ kết thúc phải sau giờ bắt đầu.');return}
  void mutate(data,editor&&editor!=='new'?editor:undefined,'save')
 }
 const editing=editor&&editor!=='new'?editor:null
 if(!allowed)return null
 return <Panel title={businessCopy('guidance.title')}>
  {(query.loading||people.loading)&&<Loading/>}{(query.error||people.error)&&<Notice title="Chưa tải được buổi hướng dẫn hoặc danh sách người phụ trách"><Button onClick={()=>{query.retry();people.retry()}}>Tải lại dữ liệu</Button></Notice>}
  {!query.loading&&!query.error&&query.data?.length===0&&<p>Chưa có buổi hướng dẫn trước chuyến.</p>}
  <ul className={styles.programList}>{query.data?.map(s=><li key={s.sessionId}>
   <div className={styles.programInfo}><h3>{s.sessionName}</h3><p>{businessCopy(keys[s.status])} · {s.capacity} chỗ</p>
    <p>{journeyTime(s.startAt,SHIP_TIME_ZONE)} → {journeyTime(s.endAt,SHIP_TIME_ZONE)} · Giờ tàu (Việt Nam)</p>
    <p>{s.location}</p><p>{s.content?.trim()||'Chưa có nội dung hướng dẫn'}</p>
    <p>Người phụ trách: {people.data?.find(p=>p.id===s.instructorUserId)?.username??'Không còn trong danh sách nhân sự đủ điều kiện'}</p>
   </div>
   {['Scheduled','Published'].includes(s.status)&&<div className={styles.sectionActions}>
    <Button tone="secondary" aria-label={'Chỉnh sửa buổi hướng dẫn: '+s.sessionName} disabled={busy||uncertain||people.loading||Boolean(people.error)} onClick={()=>{setEditor(s);setError('')}}>Chỉnh sửa</Button>
    {s.status==='Scheduled'&&<Button disabled={busy||uncertain||!s.content?.trim()||people.loading||Boolean(people.error)} onClick={()=>void mutate(undefined,s,'publish')}>{businessCopy('guidance.action.publish')}</Button>}
    <Button tone="danger" aria-label={'Hủy buổi hướng dẫn: '+s.sessionName} disabled={busy||uncertain} onClick={()=>{setCancelling(s);setError('')}}>Hủy buổi</Button>
   </div>}
  </li>)}</ul>
  <Button disabled={busy||uncertain||query.loading||people.loading||Boolean(query.error||people.error)} onClick={()=>{setEditor('new');setError('')}}>Lên lịch buổi hướng dẫn</Button>
  {editor&&<Modal wide busy={busy} title={editing?'Chỉnh sửa buổi hướng dẫn':'Lên lịch buổi hướng dẫn'} onClose={()=>setEditor(null)} footer={<><Button tone="secondary" disabled={busy} onClick={()=>setEditor(null)}>Quay lại</Button><Button type="submit" form="guidance-editor" disabled={busy||uncertain}>{busy?'Đang lưu…':'Lưu buổi hướng dẫn'}</Button></>}>
   {editing?.status==='Published'&&<Notice title="Buổi hướng dẫn sẽ cần công bố lại" tone="warning">Sau khi lưu, buổi hướng dẫn trở về trạng thái đã lên lịch và điều kiện sẵn sàng được kiểm tra lại.</Notice>}
   {!people.loading&&!people.error&&people.data?.length===0&&<Notice title="Chưa có nhân sự đủ điều kiện">Cần có tài khoản nhân sự đang hoạt động để phụ trách buổi hướng dẫn.</Notice>}
   <form id="guidance-editor" className={styles.modalForm} onSubmit={save}><fieldset disabled={busy||uncertain||people.loading||Boolean(people.error)}>
    <Field htmlFor="guide-name" label={businessCopy('guidance.field.name')}><input id="guide-name" name="sessionName" defaultValue={editing?.sessionName??''} required/></Field>
    <Field htmlFor="guide-location" label={businessCopy('guidance.field.location')}><input id="guide-location" name="location" defaultValue={editing?.location??''} required/></Field>
    <Field htmlFor="guide-start" label={businessCopy('guidance.field.startShip')}><input id="guide-start" name="startAt" type="datetime-local" step={1} defaultValue={editing?preparationWallTime(editing.startAt):''} required/></Field>
    <Field htmlFor="guide-end" label={businessCopy('guidance.field.endShip')}><input id="guide-end" name="endAt" type="datetime-local" step={1} defaultValue={editing?preparationWallTime(editing.endAt):''} required/></Field>
    <Field htmlFor="guide-capacity" label={businessCopy('guidance.field.capacity')}><input id="guide-capacity" name="capacity" type="number" min={1} step={1} defaultValue={editing?.capacity??''} required/></Field>
    <Field htmlFor="guide-person" label={businessCopy('guidance.field.instructor')}><select id="guide-person" name="instructorUserId" defaultValue={editing&&people.data?.some(p=>p.id===editing.instructorUserId)?editing.instructorUserId:''} required><option value="">Chọn nhân viên</option>{people.data?.map(p=><option key={p.id} value={p.id}>{p.username}</option>)}</select></Field>
    <Field htmlFor="guide-content" label={businessCopy('guidance.field.content')}><textarea id="guide-content" name="content" defaultValue={editing?.content??''} required/></Field>
   </fieldset></form>
   {error&&<Notice title="Chưa lưu được buổi hướng dẫn" tone="error">{error}</Notice>}
  </Modal>}
  {cancelling&&<Modal busy={busy} title="Hủy buổi hướng dẫn" onClose={()=>setCancelling(null)} footer={<><Button tone="secondary" disabled={busy} onClick={()=>setCancelling(null)}>Quay lại</Button><Button tone="danger" disabled={busy||uncertain} onClick={()=>void mutate(undefined,cancelling,'cancel')}>{busy?'Đang hủy…':'Hủy buổi hướng dẫn'}</Button></>}>
   <p>Hủy “{cancelling.sessionName}”? Buổi này sẽ không còn dùng để xác nhận sẵn sàng vận hành. Lịch sử vẫn được giữ.</p>
   {error&&<Notice title="Chưa hủy được buổi hướng dẫn" tone="error">{error}</Notice>}
  </Modal>}
  {error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}{success&&<Notice title={success}>{success}</Notice>}
  {uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả">Tải lại trang để đối chiếu trước khi gửi tiếp.</Notice>}

 </Panel>
}
