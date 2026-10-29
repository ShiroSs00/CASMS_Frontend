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
import {planReviewActions,planReviewStates} from '../model/plan-review'
const actionKeys={submit:'cruise.plan.SUBMIT_ACTION',withdraw:'cruise.plan.WITHDRAW_ACTION',approve:'cruise.plan.APPROVE_ACTION',reject:'cruise.plan.REJECT_ACTION','request-revision':'cruise.plan.REQUEST_REVISION_ACTION',ready:'cruise.ready.SET_READY_ACTION'} as const
const safeError=(error:unknown)=>businessErrorMessage(error instanceof ApiError?error.code:undefined,'')
export function CruisePlanReview({cruiseId,refreshKey=0,onChanged,mode='all'}:{cruiseId:string;refreshKey?:number|string;onChanged?:()=>void;mode?:'all'|'prepare'|'submit'}){
 const access=useSessionAccess(),[epoch,setEpoch]=useState(0)
 const allowed=['CRUISE_MANAGER','OPERATIONS_MANAGER','SHIP_MANAGER'].some(role=>access.roles.includes(role))&&access.has('CRUISE_READ')
 const query=useReadQuery(`plan:${cruiseId}:${epoch}:${refreshKey}:${allowed}`,useCallback(signal=>allowed?mainflowApi.get(cruiseId,signal):Promise.resolve(null),[cruiseId,allowed]))
 const [action,setAction]=useState<MainflowAction|null>(null),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('')
 const [uncertain,setUncertain]=useState(false),lock=useRef(false)
 const crm=access.roles.includes('CRUISE_MANAGER')&&access.canDo('CRUISE_UPDATE_DRAFT'),ops=access.roles.includes('OPERATIONS_MANAGER')&&access.canDo('ITINERARY_APPROVE')
 const data=query.data
 const manager=access.roles.includes('CRUISE_MANAGER')&&!access.roles.includes('OPERATIONS_MANAGER')
 const availableActions=data?planReviewActions(data,access):[]
 const readyToSubmit=Boolean(data&&availableActions.includes('submit')&&data.planBlockers.length===0)
 async function execute(){
  if(!data||!action||lock.current||uncertain||!planReviewActions(data,access).includes(action))return
  if(action==='ready'?!(access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_VALIDATE')):['submit','withdraw'].includes(action)?!crm:!ops)return
  lock.current=true;setBusy(true);setError('');setSuccess('')
  try{const actual=await mainflowApi.action(data,action,reason);setAction(null);setSuccess(action==='ready'?domainStatus('cruise.ready',actual.readyStatus):domainStatus('cruise.plan',actual.planStatus));setEpoch(n=>n+1);onChanged?.()}
  catch(e){setError(safeError(e));if(!(e instanceof ApiError)||e.status===0||e.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 if(!allowed)return null
 if(mode==='prepare')return <Panel title="Thời gian nhận đặt chỗ và hướng dẫn" subtitle="Lưu các mốc thời gian trong bước 2 trước khi chuyển sang kiểm tra và gửi duyệt.">
  {query.loading&&<Loading/>}{query.error&&<Notice title="Chưa tải được khung thời gian" tone="error">{safeError(query.error)}<Button tone="secondary" onClick={query.retry}>Thử lại</Button></Notice>}
  {data&&<PlanWindows key={`${cruiseId}:${data.windows.expectedRevision}`} data={data} onSaved={()=>setEpoch(n=>n+1)} editable={crm&&['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(data.planStatus)}/>}
 </Panel>
 return <Panel className={styles.reviewPanel} title="Xét duyệt kế hoạch khởi hành"><Button tone="secondary" disabled={busy||query.loading} onClick={query.retry}>{businessCopy('cruise.plan.check')}</Button>
  {query.loading&&<Loading/>}{query.error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{safeError(query.error)}<Button onClick={query.retry}>Tải lại dữ liệu</Button></Notice>}
  {data&&<>
   <div className={styles.reviewSummary}>
    <Badge label={planReviewStates[data.planStatus].title} tone={planReviewStates[data.planStatus].tone}/>
    <p>{readyToSubmit?'Kế hoạch đã đủ thông tin để gửi đến Quản lý vận hành (OPS). Gửi bản kế hoạch hiện tại để chờ phê duyệt.':planReviewStates[data.planStatus].description}</p>
    {data.submittedAt&&<p className={styles.sectionMeta}>Đã gửi lúc {journeyTime(data.submittedAt,SHIP_TIME_ZONE)} · Giờ Việt Nam{data.submittedByName?' · Người gửi: '+data.submittedByName:''}</p>}
    {data.reviewedAt&&<p className={styles.sectionMeta}>Phản hồi lúc {journeyTime(data.reviewedAt,SHIP_TIME_ZONE)} · Giờ Việt Nam</p>}
    {readyToSubmit&&<p className={styles.submitReady}>Sẵn sàng gửi xét duyệt</p>}
    <div className={styles.planActions}>{availableActions.map(a=><Button key={a} tone={a==='submit'?'primary':a==='reject'?'danger':'secondary'} disabled={busy||uncertain||query.loading||Boolean(query.error)||(a==='submit'&&data.planBlockers.length>0)} onClick={()=>{setAction(a);setReason('');setSuccess('')}}>{a==='submit'?(data.planStatus==='DRAFT'?'Gửi kế hoạch cho OPS duyệt':'Gửi lại kế hoạch cho OPS duyệt'):businessCopy(actionKeys[a])}</Button>)}</div>
    <p className={styles.sectionMeta}>Xem lại kế hoạch → Gửi OPS phê duyệt → Theo dõi kết quả. Chính sách giá được duyệt riêng.</p>
   </div>
   {!manager&&<Badge label={domainStatus('cruise.ready',data.readyStatus)}/>}
   {data.reason&&<Notice title="Phản hồi từ OPS" tone={data.planStatus==='REJECTED'?'error':'warning'}>{data.reason}</Notice>}
   {data.planBlockers.length>0&&<Notice title={businessCopy('cruise.plan.missingInputs')}><ul>{data.planBlockers.map(code=><li key={code}>{businessErrorMessage(code,'')}</li>)}</ul></Notice>}
   {!manager&&data.readyBlockers.length>0&&(data.planStatus==='APPROVED'||access.roles.includes('OPERATIONS_MANAGER')||access.roles.includes('SHIP_MANAGER'))&&<Notice title={businessCopy('cruise.ready.pendingChecks')}><p>{businessCopy('cruise.ready.submitIndependent')}</p><ul>{data.readyBlockers.map(code=><li key={code}>{businessErrorMessage(code,'')}</li>)}</ul></Notice>}
   {crm&&(mode==='submit'||['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(data.planStatus))&&<PlanWindows key={`${cruiseId}:${data.windows.expectedRevision}`} data={data} onSaved={()=>setEpoch(n=>n+1)} editable={mode!=='submit'}/>}
   <details><summary>Thông tin phiên bản kế hoạch</summary><p>{businessCopy('cruise.plan.revision')}: {data.revision}</p></details>
   {data.submittedSnapshot!=null&&<details><summary>{businessCopy('cruise.plan.snapshot')}</summary><p>{businessCopy('cruise.plan.submittedRevision')}: {data.submittedRevision}</p><PlanSnapshot snapshot={data.submittedSnapshot}/></details>}
  </>}
  {success&&<Notice title={success}><span>{success}</span></Notice>} {error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}
  {uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả"><Button onClick={()=>{setUncertain(false);setEpoch(n=>n+1)}}>Tải lại dữ liệu</Button></Notice>}
  {action&&<Modal busy={busy} title={action==='submit'?'Gửi kế hoạch cho OPS phê duyệt':businessCopy(actionKeys[action])} onClose={()=>{if(!busy)setAction(null)}} footer={<><Button tone="secondary" disabled={busy} onClick={()=>setAction(null)}>Quay lại</Button><Button disabled={busy||uncertain||(['reject','request-revision'].includes(action)&&!reason.trim())} onClick={()=>void execute()}>{busy?'Đang gửi…':action==='submit'?'Xác nhận gửi kế hoạch':businessCopy(actionKeys[action])}</Button></>}>
   {action==='submit'&&<><p><strong>{data?.cruiseCode}</strong> sẽ chuyển sang trạng thái <strong>Chờ OPS phê duyệt</strong>.</p><p>OPS sẽ xét duyệt bản kế hoạch hiện tại. Chính sách giá được phê duyệt riêng; thao tác này chưa mở bán chuyến.</p></>}
   <p>{businessCopy('cruise.plan.revision')}: {data?.revision}</p>{['reject','request-revision'].includes(action)&&<Field htmlFor="plan-reason" label={businessCopy(action==='reject'?'cruise.plan.rejectReason':'cruise.plan.revisionFeedback')}><textarea id="plan-reason" value={reason} onChange={e=>setReason(e.target.value)} required/></Field>}
  </Modal>}
 </Panel>
}
function PlanWindows({data,onSaved,editable=true}:{data:PlanView;onSaved:()=>void;editable?:boolean}){
 const [open,setOpen]=useState(false)
 const [windows,setWindows]=useState(data.windows),[error,setError]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),lock=useRef(false)
 const fields=[['bookingOpensAt','cruise.window.bookingOpen'],['bookingClosesAt','cruise.window.bookingClose'],['guidanceOpensAt','cruise.window.guidanceOpen'],['guidanceClosesAt','cruise.window.guidanceClose']] as const
 async function save(){if(lock.current||uncertain)return;lock.current=true;setBusy(true);setError('');try{await mainflowApi.windows(data,windows);setOpen(false);onSaved()}catch(e){setError(safeError(e));if(!(e instanceof ApiError)||e.status===0||e.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}}
 return <>
  <RecordFacts entries={fields.map(([key,label])=>[businessCopy(label),data.windows[key]?journeyTime(data.windows[key]!,SHIP_TIME_ZONE):'Chưa thiết lập'] as const)}/>
  {editable&&<Button tone="secondary" disabled={busy||uncertain} onClick={()=>{setWindows(data.windows);setError('');setOpen(true)}}>Cấu hình thời gian nhận đặt chỗ và hướng dẫn</Button>}
  {open&&<Modal wide busy={busy} title={businessCopy('cruise.window.title')} description="Các mốc dưới đây dùng giờ tàu (Việt Nam). Lưu khung thời gian trước khi gửi kế hoạch để duyệt." onClose={()=>setOpen(false)} footer={<><Button tone="secondary" disabled={busy} onClick={()=>setOpen(false)} data-overlay-dismiss>Hủy</Button><Button type="submit" form="plan-windows-form" disabled={busy||uncertain}>{busy?'Đang lưu…':businessCopy('cruise.window.save')}</Button></>}>
   <form id="plan-windows-form" onSubmit={event=>{event.preventDefault();void save()}}>
    <fieldset className={styles.formGroup} disabled={busy||uncertain}><legend>Khung thời gian</legend><div className={styles.fieldGrid}>{fields.map(([key,label])=><Field key={key} htmlFor={key} label={businessCopy(label)}><input id={key} type="datetime-local" step={1} value={preparationWallTime(windows[key])} onChange={e=>{try{setWindows({...windows,[key]:preparationInstant(e.target.value)});setError('')}catch{setError(businessCopy('program.time.invalid'))}}}/></Field>)}</div></fieldset>
   </form>
   {error&&<Notice title="Chưa lưu được khung thời gian" tone="error">{error}</Notice>}
   {uncertain&&<Notice title={businessCopy('cruise.window.unconfirmed')}>{businessCopy('cruise.window.reloadBeforeRetry')}</Notice>}
  </Modal>}
 </>
}
