import {useEffect,useRef,useState,type FormEvent} from 'react'
import {ApiError} from '@/shared/api'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy} from '@/shared/i18n/business-copy'
import {Button,Field,Notice,Modal} from '@/shared/ui'
import {activityCapacityConflict,activityScheduleConflict,updateScopedActivity,type ScopedActivity,type ActivityInput} from '../api/scoped-activity'
import {journeyTime,SHIP_TIME_ZONE,zonedInput,wallTimeToInstant} from '@/shared/lib/journey-time'
import {ActivityMeetingPointField} from './CruiseActivityFields'
import styles from './ManagerWorkspace.module.css'

const shipTime=(value:string)=>zonedInput(value,SHIP_TIME_ZONE).slice(0,16)
export function CruiseActivityEditor({activity,revision,fixed,departure,arrival,onSaved,onClose}:{activity:ScopedActivity;revision:number;fixed:boolean;departure?:string;arrival?:string;onSaved:()=>void;onClose:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[allocated,setAllocated]=useState<number|null>(null),lock=useRef(false),capacityField=useRef<HTMLInputElement>(null)
 const [scheduleField,setScheduleField]=useState<'startTime'|'endTime'|null>(null),startField=useRef<HTMLInputElement>(null),endField=useRef<HTMLInputElement>(null)
 useEffect(()=>{if(busy)return;if(allocated!==null)capacityField.current?.focus();else if(scheduleField==='startTime')startField.current?.focus();else if(scheduleField==='endTime')endField.current?.focus()},[allocated,busy,scheduleField])
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current||uncertain)return
  const form=new FormData(event.currentTarget),text=(key:string)=>String(form.get(key)??'').trim()
  if(!fixed&&!text('name')){setError('Vui lòng nhập tên hoạt động.');return}
  const capacity=Number(text('capacity'))
  if(!Number.isSafeInteger(capacity)||capacity<1){setError('Vui lòng nhập sức chứa nguyên dương.');return}
  const requiredStaffCount=Number(text('requiredStaffCount'))
  if(!Number.isSafeInteger(requiredStaffCount)||requiredStaffCount<1){setError('Vui lòng nhập số nhân viên phục vụ từ 1 trở lên.');return}
  let start=activity.startTime,end=activity.endTime
  if(!fixed){
   try{start=wallTimeToInstant(text('start'),SHIP_TIME_ZONE);end=wallTimeToInstant(text('end'),SHIP_TIME_ZONE)}catch{setError(businessCopy('program.time.invalid'));return}
   if(Date.parse(start)>=Date.parse(end)||(departure&&Date.parse(start)<Date.parse(departure))||(arrival&&Date.parse(end)>Date.parse(arrival))){
    setError('Chọn giờ bắt đầu trước giờ kết thúc và nằm trong khoảng thời gian của chuyến đi.')
    return
   }
  }
  // FIXED retains exact source fields, including seconds, null description and location IDs.
  const body:ActivityInput={cruiseId:activity.cruiseId,activityName:fixed?activity.name:text('name'),description:fixed?activity.description:text('description'),location:activity.location,meetingPoint:text('meetingPoint'),startTime:start,endTime:end,deckId:activity.deckId,cabinId:activity.cabinId,capacity,requiredStaffCount,price:activity.price??0,currencyCode:activity.currencyCode??'VND'}
  lock.current=true;setBusy(true);setError('');setAllocated(null);setScheduleField(null)
  try{await updateScopedActivity(activity.cruiseId,activity.id,revision,body);onSaved()}
  catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));setAllocated(activityCapacityConflict(reason));setScheduleField(activityScheduleConflict(reason));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUncertain(true)}
  finally{lock.current=false;setBusy(false)}
 }
 const editorTitle=fixed?'Cập nhật hoạt động':businessCopy('program.activity.edit')
 return <Modal wide={!fixed} busy={busy} title={editorTitle} onClose={onClose} footer={<><Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={onClose}>Hủy</Button><Button type="submit" form="activity-edit-form" disabled={busy||uncertain}>{busy?'Đang lưu…':fixed?'Lưu thay đổi':businessCopy('program.action.saveDraft')}</Button></>}><form id="activity-edit-form" className={styles.modalForm} noValidate onSubmit={save} aria-label={editorTitle}>
  {fixed&&<h3>{activity.name}</h3>}
  <fieldset disabled={busy||uncertain}>
   {!fixed&&<>
   <Field htmlFor="activity-edit-name" label={businessCopy('program.field.name')+' *'}><input id="activity-edit-name" name="name" defaultValue={activity.name} disabled={fixed} required/></Field>
   <Field htmlFor="activity-edit-description" label={businessCopy('program.field.description')}><textarea id="activity-edit-description" name="description" defaultValue={activity.description??''} disabled={fixed}/></Field>
   {departure&&arrival&&<p className={styles.activityTimeRange}><strong>Trong lịch chuyến · Giờ tàu (Việt Nam)</strong> {journeyTime(departure,SHIP_TIME_ZONE)} – {journeyTime(arrival,SHIP_TIME_ZONE)}</p>}
   <Field htmlFor="activity-edit-start" label={businessCopy('program.field.startShip')+' *'} error={scheduleField==='startTime'?businessErrorMessage('ACTIVITY_OUTSIDE_CRUISE',''):undefined}><input ref={startField} id="activity-edit-start" name="start" type="datetime-local" step={60} min={departure?shipTime(departure):undefined} max={arrival?shipTime(arrival):undefined} defaultValue={shipTime(activity.startTime)} disabled={fixed} required/></Field>
   <Field htmlFor="activity-edit-end" label={businessCopy('program.field.endShip')+' *'} error={scheduleField==='endTime'?businessErrorMessage('ACTIVITY_OUTSIDE_CRUISE',''):undefined}><input ref={endField} id="activity-edit-end" name="end" type="datetime-local" step={60} min={departure?shipTime(departure):undefined} max={arrival?shipTime(arrival):undefined} defaultValue={shipTime(activity.endTime)} disabled={fixed} required/></Field>
   </>}
   <ActivityMeetingPointField id="activity-edit-meeting-point" value={activity.meetingPoint}/>
   <Field htmlFor="activity-edit-capacity" label={fixed?'Số người tham gia tối đa':businessCopy('program.field.capacity')} error={allocated===null?undefined:businessCopy('program.activity.capacityAllocated')+': '+allocated}><input ref={capacityField} id="activity-edit-capacity" name="capacity" type="number" min={1} step={1} defaultValue={activity.capacity??''} required/></Field>
   <Field htmlFor="activity-edit-staff" label="Số nhân viên phục vụ cần *"><input id="activity-edit-staff" name="requiredStaffCount" type="number" min={1} step={1} defaultValue={activity.requiredStaffCount??1} required/></Field>
   <p>Giá danh mục: <strong>{activity.price!=null&&activity.price>0?`${new Intl.NumberFormat('vi-VN').format(activity.price)} ${activity.currencyCode??'VND'}`:'Chưa thiết lập giá riêng · Theo gói du thuyền'}</strong> (do Quản lý dịch vụ & hoạt động cấu hình)</p>

  </fieldset>

  {error&&<Notice title={businessCopy('program.activity.saveFailed')} tone="error">{error}</Notice>}
  {uncertain&&<Notice title={businessCopy('program.activity.unconfirmed')}>{businessCopy('program.activity.reloadBeforeRetry')}</Notice>}
 </form></Modal>
}
