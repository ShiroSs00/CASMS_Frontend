import {PlanSnapshot} from './PlanSnapshot'
import { useCallback, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { businessErrorMessage } from '@/shared/api/business-errors'
import { ApiError } from '@/shared/api'
import { businessCopy, domainStatus } from '@/shared/i18n/business-copy'
import { Badge, Button, Field, Loading, Modal, Notice, Panel, RecordFacts } from '@/shared/ui'
import { mainflowApi, type MainflowAction, type PlanView } from '../api/mainflow-api'
import {preparationWallTime,preparationInstant} from '../model/preparation-time'
import {journeyTime,SHIP_TIME_ZONE} from '@/shared/lib/journey-time'
import styles from './ManagerWorkspace.module.css'
const actionKeys={submit:'cruise.plan.SUBMIT_ACTION',withdraw:'cruise.plan.WITHDRAW_ACTION',approve:'cruise.plan.APPROVE_ACTION',reject:'cruise.plan.REJECT_ACTION','request-revision':'cruise.plan.REQUEST_REVISION_ACTION',ready:'cruise.ready.SET_READY_ACTION'} as const
const safeError=(error:unknown)=>businessErrorMessage(error instanceof ApiError?error.code:undefined,'')
export function CruisePlanReview({cruiseId,refreshKey=0}:{cruiseId:string;refreshKey?:number|string}){
 const access=useSessionAccess(),[epoch,setEpoch]=useState(0)
 const allowed=['CRUISE_MANAGER','OPERATIONS_MANAGER','SHIP_MANAGER'].some(role=>access.roles.includes(role))&&access.has('CRUISE_READ')
 const query=useReadQuery(`plan:${cruiseId}:${epoch}:${refreshKey}:${allowed}`,useCallback(signal=>allowed?mainflowApi.get(cruiseId,signal):Promise.resolve(null),[cruiseId,allowed]))
 const [action,setAction]=useState<MainflowAction|null>(null),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('')
 const [uncertain,setUncertain]=useState(false),lock=useRef(false)
 const crm=access.roles.includes('CRUISE_MANAGER')&&access.has('CRUISE_UPDATE_DRAFT'),ops=access.roles.includes('OPERATIONS_MANAGER')&&access.has('ITINERARY_APPROVE')
 const data=query.data
 async function execute(){
  if(!data||!action||lock.current||uncertain)return
  if(action==='ready'?!(access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_VALIDATE')):['submit','withdraw'].includes(action)?!crm:!ops)return
  lock.current=true;setBusy(true);setError('');setSuccess('')
  try{const actual=await mainflowApi.action(data,action,reason);setAction(null);setSuccess(action==='ready'?domainStatus('cruise.ready',actual.readyStatus):domainStatus('cruise.plan',actual.planStatus));setEpoch(n=>n+1)}
  catch(e){setError(safeError(e));if(!(e instanceof ApiError)||e.status===0||e.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 if(!allowed)return null
 return <Panel title={businessCopy('cruise.plan.title')}><Button disabled={busy||query.loading} onClick={query.retry}>{businessCopy('cruise.plan.check')}</Button>
  {query.loading&&<Loading/>}{query.error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{safeError(query.error)}<Button onClick={query.retry}>Tải lại dữ liệu</Button></Notice>}
  {data&&<>
   <div className={styles.planStatuses}><Badge label={domainStatus('cruise.plan',data.planStatus)}/><Badge label={domainStatus('cruise.ready',data.readyStatus)}/></div>
   <p>{businessCopy('cruise.plan.revision')}: {data.revision}</p>{data.submittedAt&&<p>{businessCopy('cruise.plan.submittedAt')}: {journeyTime(data.submittedAt,SHIP_TIME_ZONE)} · {businessCopy('preparation.shipTime')}</p>}{data.reason&&<p>{data.reason}</p>}
   <div>{(['submit','withdraw','approve','reject','request-revision','ready'] as MainflowAction[]).filter(a=>data.allowedActions.includes(a==='ready'?'SET_READY':a.toUpperCase().replace('-','_'))&&(a==='ready'?access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_VALIDATE'):['submit','withdraw'].includes(a)?crm:ops)&&(a!=='approve'||data.submittedBy!==access.userId)).map(a=><Button key={a} disabled={busy||uncertain||query.loading||(a==='submit'&&data.planBlockers.length>0)} onClick={()=>{setAction(a);setReason('');setSuccess('')}}>{businessCopy(actionKeys[a])}</Button>)}</div>
   {data.planBlockers.length>0&&<Notice title={businessCopy('cruise.plan.missingInputs')}><ul>{data.planBlockers.map(code=><li key={code}>{businessErrorMessage(code,'')}</li>)}</ul></Notice>}
   {data.readyBlockers.length>0&&(data.planStatus==='APPROVED'||access.roles.includes('OPERATIONS_MANAGER')||access.roles.includes('SHIP_MANAGER'))&&<Notice title={businessCopy('cruise.ready.pendingChecks')}><p>{businessCopy('cruise.ready.submitIndependent')}</p><ul>{data.readyBlockers.map(code=><li key={code}>{businessErrorMessage(code,'')}</li>)}</ul></Notice>}
   {crm&&['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(data.planStatus)&&<PlanWindows key={`${cruiseId}:${data.windows.expectedRevision}`} data={data} onSaved={()=>setEpoch(n=>n+1)}/>}
   {data.submittedSnapshot!=null&&<details><summary>{businessCopy('cruise.plan.snapshot')}</summary><p>{businessCopy('cruise.plan.submittedRevision')}: {data.submittedRevision}</p><PlanSnapshot snapshot={data.submittedSnapshot}/></details>}
  </>}
  {success&&<Notice title={success}><span>{success}</span></Notice>} {error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}
  {uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả"><Button onClick={()=>{setUncertain(false);setEpoch(n=>n+1)}}>Tải lại dữ liệu</Button></Notice>}
  {action&&<Modal title={businessCopy(actionKeys[action])} onClose={()=>{if(!busy)setAction(null)}} footer={<><Button disabled={busy} onClick={()=>setAction(null)}>Hủy</Button><Button disabled={busy||uncertain||(['reject','request-revision'].includes(action)&&!reason.trim())} onClick={()=>void execute()}>{businessCopy(actionKeys[action])}</Button></>}>
   <p>{businessCopy('cruise.plan.revision')}: {data?.revision}</p>{['reject','request-revision'].includes(action)&&<Field htmlFor="plan-reason" label={businessCopy(action==='reject'?'cruise.plan.rejectReason':'cruise.plan.revisionFeedback')}><textarea id="plan-reason" value={reason} onChange={e=>setReason(e.target.value)} required/></Field>}
  </Modal>}
 </Panel>
}
function PlanWindows({data,onSaved}:{data:PlanView;onSaved:()=>void}){
 const [open,setOpen]=useState(false)
 const [windows,setWindows]=useState(data.windows),[error,setError]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),lock=useRef(false)
 const fields=[['bookingOpensAt','cruise.window.bookingOpen'],['bookingClosesAt','cruise.window.bookingClose'],['guidanceOpensAt','cruise.window.guidanceOpen'],['guidanceClosesAt','cruise.window.guidanceClose']] as const
 async function save(){if(lock.current||uncertain)return;lock.current=true;setBusy(true);setError('');try{await mainflowApi.windows(data,windows);setOpen(false);onSaved()}catch(e){setError(safeError(e));if(!(e instanceof ApiError)||e.status===0||e.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}}
 return <>
  <RecordFacts entries={fields.map(([key,label])=>[businessCopy(label),data.windows[key]?journeyTime(data.windows[key]!,SHIP_TIME_ZONE):'Chưa thiết lập'] as const)}/>
  <Button tone="secondary" disabled={busy||uncertain} onClick={()=>{setWindows(data.windows);setError('');setOpen(true)}}>Cấu hình thời gian nhận đặt chỗ và hướng dẫn</Button>
  {open&&<Modal wide busy={busy} title={businessCopy('cruise.window.title')} description="Các mốc dưới đây dùng giờ tàu (Việt Nam). Lưu khung thời gian trước khi gửi kế hoạch để duyệt." onClose={()=>setOpen(false)} footer={<><Button tone="secondary" disabled={busy} onClick={()=>setOpen(false)} data-overlay-dismiss>Hủy</Button><Button type="submit" form="plan-windows-form" disabled={busy||uncertain}>{busy?'Đang lưu…':businessCopy('cruise.window.save')}</Button></>}>
   <form id="plan-windows-form" onSubmit={event=>{event.preventDefault();void save()}}>
    <fieldset className={styles.formGroup} disabled={busy||uncertain}><legend>Khung thời gian</legend><div className={styles.fieldGrid}>{fields.map(([key,label])=><Field key={key} htmlFor={key} label={businessCopy(label)}><input id={key} type="datetime-local" step={1} value={preparationWallTime(windows[key])} onChange={e=>{try{setWindows({...windows,[key]:preparationInstant(e.target.value)});setError('')}catch{setError(businessCopy('program.time.invalid'))}}}/></Field>)}</div></fieldset>
   </form>
   {error&&<Notice title="Chưa lưu được khung thời gian" tone="error">{error}</Notice>}
   {uncertain&&<Notice title={businessCopy('cruise.window.unconfirmed')}>{businessCopy('cruise.window.reloadBeforeRetry')}</Notice>}
  </Modal>}
 </>
}
