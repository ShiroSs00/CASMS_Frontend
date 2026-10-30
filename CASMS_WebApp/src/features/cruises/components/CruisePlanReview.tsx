import {allowedDepartureSections,type DepartureSection} from '../model/preparation'
import {operationsConditionTarget} from '../model/operations-workflow'
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
import {journeyTime,SHIP_TIME_ZONE,validTimeZone} from '@/shared/lib/journey-time'
import styles from './ManagerWorkspace.module.css'
import {planReviewActions,planReviewStates} from '../model/plan-review'
const actionKeys={submit:'cruise.plan.SUBMIT_ACTION',withdraw:'cruise.plan.WITHDRAW_ACTION',approve:'cruise.plan.APPROVE_ACTION',reject:'cruise.plan.REJECT_ACTION','request-revision':'cruise.plan.REQUEST_REVISION_ACTION',ready:'cruise.ready.SET_READY_ACTION'} as const
const safeError=(error:unknown)=>businessErrorMessage(error instanceof ApiError?error.code:undefined,'')
export function CruisePlanReview({cruiseId,refreshKey=0,onChanged,onSection,onReview,itineraryMode,mode='all'}:{cruiseId:string;refreshKey?:number|string;onChanged?:()=>void;onSection?:(section:DepartureSection)=>void;onReview?:()=>void;itineraryMode?:'FIXED'|'CUSTOM';mode?:'all'|'prepare'|'submit'|'review'|'ready'|'summary'}){
 const access=useSessionAccess(),[epoch,setEpoch]=useState(0)
 const allowed=['CRUISE_MANAGER','OPERATIONS_MANAGER','SHIP_MANAGER'].some(role=>access.roles.includes(role))&&access.has('CRUISE_READ')
 const query=useReadQuery(`plan:${cruiseId}:${epoch}:${refreshKey}:${allowed}`,useCallback(signal=>allowed?mainflowApi.get(cruiseId,signal):Promise.resolve(null),[cruiseId,allowed]))
 const [action,setAction]=useState<MainflowAction|null>(null),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('')
 const [uncertain,setUncertain]=useState(false),lock=useRef(false)
 const crm=access.roles.includes('CRUISE_MANAGER')&&access.canDo('CRUISE_UPDATE_DRAFT'),ops=access.roles.includes('OPERATIONS_MANAGER')&&access.canDo('ITINERARY_APPROVE')
 const data=query.data
 const manager=access.roles.includes('CRUISE_MANAGER')&&!access.roles.includes('OPERATIONS_MANAGER')
 const availableActions=data?planReviewActions(data,access).filter(action=>mode==='ready'?action==='ready':mode==='review'?['approve','reject','request-revision'].includes(action):true):[]
 const approvalNeedsReview=data?.planStatus==='APPROVED'&&(data.planBlockers.length>0||data.readyBlockers.includes('PLAN_APPROVAL_REQUIRED'))
 const readyToSubmit=Boolean(data&&availableActions.includes('submit')&&data.planBlockers.length===0)
 async function execute(){
  if(!data||!action||lock.current||uncertain||!availableActions.includes(action))return
  if(action==='ready'?!(access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_VALIDATE')):['submit','withdraw'].includes(action)?!crm:!ops)return
  lock.current=true;setBusy(true);setError('');setSuccess('')
  try{const actual=await mainflowApi.action(data,action,reason);setAction(null);setSuccess(action==='ready'?domainStatus('cruise.ready',actual.readyStatus):domainStatus('cruise.plan',actual.planStatus));setEpoch(n=>n+1);onChanged?.()}
  catch(e){setError(safeError(e));if(!(e instanceof ApiError)||e.status===0||e.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 if(!allowed)return null
 if(mode==='summary')return <Panel title="Trạng thái kế hoạch khởi hành">
  {query.loading&&<Loading label="Đang tải trạng thái kế hoạch…"/>}
  {query.error&&<Notice title="Chưa tải được trạng thái kế hoạch" tone="error"><Button tone="secondary" onClick={query.retry}>Tải lại trạng thái</Button></Notice>}
  {data&&!query.loading&&!query.error&&<>
   <Badge label={planReviewStates[data.planStatus].title} tone={planReviewStates[data.planStatus].tone}/>
   {data.reason&&<p>Phản hồi OPS: {data.reason}</p>}
   {!['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(data.planStatus)&&<p>Kế hoạch hiện chỉ cho xem. Thao tác thu hồi và phản hồi nằm ở bước “Kiểm tra và gửi OPS”.</p>}
   {onReview&&data.planStatus!=='DRAFT'&&<Button tone="text" onClick={onReview}>Xem kết quả và phản hồi OPS</Button>}
  </>}
 </Panel>
 if(mode==='prepare')return <Panel title="Thời gian nhận đặt chỗ và hướng dẫn">
  {query.loading&&<Loading/>}{query.error&&<Notice title="Chưa tải được khung thời gian" tone="error">{safeError(query.error)}<Button tone="secondary" onClick={query.retry}>Thử lại</Button></Notice>}
  {data&&<PlanWindows key={`${cruiseId}:${data.windows.expectedRevision}`} data={data} onSaved={()=>setEpoch(n=>n+1)} editable={crm&&['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(data.planStatus)}/>}
 </Panel>
 const actionDialog=action&&<Modal busy={busy} title={action==='submit'?'Gửi kế hoạch cho OPS phê duyệt':businessCopy(actionKeys[action])} onClose={()=>{if(!busy)setAction(null)}} footer={<><Button tone="secondary" disabled={busy} onClick={()=>setAction(null)}>Quay lại</Button><Button disabled={busy||uncertain||(['reject','request-revision'].includes(action)&&!reason.trim())} onClick={()=>void execute()}>{busy?'Đang gửi…':action==='submit'?'Xác nhận gửi kế hoạch':businessCopy(actionKeys[action])}</Button></>}>
   {action==='submit'&&<><p><strong>{data?.cruiseCode}</strong> sẽ chuyển sang trạng thái <strong>Chờ OPS phê duyệt</strong>.</p><p>OPS sẽ xét duyệt bản kế hoạch hiện tại. Chính sách giá được phê duyệt riêng; thao tác này chưa mở bán chuyến.</p></>}
   {action==='request-revision'&&data?.planStatus==='APPROVED'&&<p>Kế hoạch sẽ mở lại cho CRM chỉnh sửa và gửi duyệt lại. Xác nhận sẵn sàng trước đó sẽ mất hiệu lực; quyết định giá đã lưu vẫn được giữ riêng.</p>}
   <p>{businessCopy('cruise.plan.revision')}: {data?.revision}</p>{['reject','request-revision'].includes(action)&&<Field htmlFor="plan-reason" label={businessCopy(action==='reject'?'cruise.plan.rejectReason':'cruise.plan.revisionFeedback')}><textarea id="plan-reason" value={reason} onChange={e=>setReason(e.target.value)} required/></Field>}
  </Modal>
 if(mode==='ready')return <Panel title="Xác nhận sẵn sàng vận hành">
  {query.loading&&<Loading label="Đang kiểm tra điều kiện sẵn sàng…"/>}
  {query.error&&<Notice title="Chưa kiểm tra được điều kiện sẵn sàng" tone="error">{safeError(query.error)}</Notice>}
  {data&&<>
   <Badge label={domainStatus('cruise.ready',data.readyStatus)}/>
   {data.readyAt&&<p className={styles.sectionMeta}>Xác nhận lúc {journeyTime(data.readyAt,SHIP_TIME_ZONE)} · Giờ tàu (Việt Nam)</p>}
   {data.readyBlockers.length>0?<ul className={styles.conditionList}>{[...new Map(data.readyBlockers.map(code=>[businessErrorMessage(code,''),code])).entries()].map(([message,code])=>{
    const target=operationsConditionTarget(code)
    const destination=target&&target!=='review'?allowedDepartureSections(access).find(([key])=>key===target):null
    return <li key={message}><ProgramBlocker code={code} data={data} fixed={itineraryMode==='FIXED'}/>{target==='review'&&onReview?<Button tone="text" onClick={onReview}>Xem xét duyệt</Button>:destination&&onSection?<Button tone="text" onClick={()=>onSection(destination[0])}>Mở {destination[1].toLocaleLowerCase('vi-VN')}</Button>:null}</li>
   })}</ul>:data.readyStatus!=='READY'&&<p>Đủ điều kiện kiểm tra. OPS chưa xác nhận sẵn sàng.</p>}
   <div className={styles.planActions}><Button tone="secondary" disabled={busy||query.loading} onClick={query.retry}>Kiểm tra lại điều kiện</Button>{availableActions.includes('ready')&&data.readyStatus!=='READY'&&<Button disabled={busy||uncertain||query.loading||Boolean(query.error)} onClick={()=>{setAction('ready');setReason('')}}>Xác nhận sẵn sàng vận hành</Button>}</div>
  </>}
  {success&&<Notice title={success} tone="success">Đã ghi nhận xác nhận sẵn sàng.</Notice>}{error&&<Notice title="Chưa xác nhận được chuyến sẵn sàng" tone="error">{error}</Notice>}
  {uncertain&&<Notice title="Chưa xác định kết quả">Tải lại trang để đối chiếu trước khi thao tác tiếp.</Notice>}
  {actionDialog}
 </Panel>
 return <Panel className={styles.reviewPanel} title={manager?'Kiểm tra và gửi kế hoạch':'Xét duyệt kế hoạch khởi hành'}><Button tone="secondary" disabled={busy||query.loading} onClick={query.retry}>Tải lại kế hoạch</Button>
  {query.loading&&<Loading/>}{query.error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{safeError(query.error)}<Button onClick={query.retry}>Tải lại dữ liệu</Button></Notice>}
  {data&&<>
   <div className={styles.reviewSummary}>
    <Badge label={approvalNeedsReview?'Phê duyệt trước đó cần xét lại':planReviewStates[data.planStatus].title} tone={approvalNeedsReview?'warning':planReviewStates[data.planStatus].tone}/>
    <p>{approvalNeedsReview?'Nội dung kế hoạch đã thay đổi hoặc còn thiếu. Cần yêu cầu CRM bổ sung trước khi phê duyệt lại.':readyToSubmit?'Kế hoạch đã đủ thông tin để gửi đến Quản lý vận hành (OPS). Gửi bản kế hoạch hiện tại để chờ phê duyệt.':planReviewStates[data.planStatus].description}</p>
    {data.submittedAt&&<p className={styles.sectionMeta}>Đã gửi lúc {journeyTime(data.submittedAt,SHIP_TIME_ZONE)} · Giờ Việt Nam{data.submittedByName?' · Người gửi: '+data.submittedByName:''}</p>}
    {data.reviewedAt&&<p className={styles.sectionMeta}>Phản hồi lúc {journeyTime(data.reviewedAt,SHIP_TIME_ZONE)} · Giờ Việt Nam</p>}
    {readyToSubmit&&<p className={styles.submitReady}>Sẵn sàng gửi xét duyệt</p>}
    <div className={styles.planActions}>{availableActions.map(a=><Button key={a} tone={a==='submit'||a==='approve'?'primary':a==='reject'?'danger':'secondary'} disabled={busy||uncertain||query.loading||Boolean(query.error)||(a==='submit'&&data.planBlockers.length>0)} onClick={()=>{setAction(a);setReason('');setSuccess('')}}>{a==='submit'?(data.planStatus==='DRAFT'?'Gửi kế hoạch cho OPS duyệt':'Gửi lại kế hoạch cho OPS duyệt'):businessCopy(actionKeys[a])}</Button>)}</div>

   </div>
   {!manager&&mode!=='review'&&<Badge label={domainStatus('cruise.ready',data.readyStatus)}/>}
   {data.reason&&<Notice title="Phản hồi từ OPS" tone={data.planStatus==='REJECTED'?'error':'warning'}>{data.reason}</Notice>}
   {data.planBlockers.length>0&&<Notice title={businessCopy('cruise.plan.missingInputs')}><ul className={styles.conditionList}>{data.planBlockers.map(code=>{const target=manager?code.startsWith('PRICING_')||code.endsWith('WINDOW_REQUIRED')?'overview':operationsConditionTarget(code):null;const destination=target&&target!=='review'?allowedDepartureSections(access).find(([key])=>key===target):null;return <li key={code}><ProgramBlocker code={code} data={data} fixed={itineraryMode==='FIXED'}/>{destination&&onSection&&<Button tone="text" onClick={()=>onSection(destination[0])}>Mở {destination[1].toLocaleLowerCase('vi-VN')}</Button>}</li>})}</ul></Notice>}

   {crm&&mode!=='submit'&&['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(data.planStatus)&&<PlanWindows key={`${cruiseId}:${data.windows.expectedRevision}`} data={data} onSaved={()=>setEpoch(n=>n+1)} editable/>}
   <details><summary>Thông tin phiên bản kế hoạch</summary><p>{businessCopy('cruise.plan.revision')}: {data.revision}</p></details>
   {data.submittedSnapshot!=null&&<details open={mode==='review'}><summary>{businessCopy('cruise.plan.snapshot')}</summary><p>{businessCopy('cruise.plan.submittedRevision')}: {data.submittedRevision}</p><PlanSnapshot snapshot={data.submittedSnapshot} includePricing={mode!=='review'}/></details>}
  </>}
  {success&&<Notice title={success}><span>{success}</span></Notice>} {error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}
  {uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả"><Button onClick={()=>{setUncertain(false);setEpoch(n=>n+1)}}>Tải lại dữ liệu</Button></Notice>}
  {actionDialog}
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

function ProgramBlocker({code,data,fixed}:{code:string;data:PlanView;fixed:boolean}){
 const issues=data.programIssues?.filter(issue=>issue.code===code)??[]
 const timeIssue=['ACTIVITY_OUTSIDE_CRUISE','EXCURSION_OUTSIDE_PORT_CALL'].includes(code)
 return <div className={styles.conditionBody}><p>{businessErrorMessage(code,'')}</p>
  {issues.length>0&&<ul className={styles.issueDetails}>{issues.map(issue=>{
   const showTime=(instant:string|null)=>instant&&validTimeZone(issue.timeZoneId)?new Intl.DateTimeFormat('vi-VN',{timeZone:issue.timeZoneId,dateStyle:'short',timeStyle:'medium'}).format(new Date(instant)):'Chưa đủ thời gian hoặc múi giờ'
   return <li key={issue.itemId}><strong>{issue.name}</strong>{timeIssue&&<>
    <p>Đang cấu hình: {showTime(issue.startsAt)} → {showTime(issue.endsAt)}</p>
    <p>{issue.kind==='ACTIVITY'?'Thời gian chuyến':'Khoảng thời gian cho phép của lần ghé cảng'}: {showTime(issue.earliestStart)} → {showTime(issue.latestEnd)}</p>
    <p>{issue.kind==='ACTIVITY'?'Giờ tàu (Việt Nam)':'Giờ địa phương của cảng'}</p>
   </>}</li>
  })}</ul>}
  {timeIssue&&fixed&&<p className={styles.issueHint}>{code==='ACTIVITY_OUTSIDE_CRUISE'?'Lịch trình cố định: mở Chương trình và dịch vụ, chọn “Sửa giờ không hợp lệ” cho hoạt động này. Giờ hợp lệ vẫn khóa chỉnh sửa.':'Lịch trình cố định: giờ tour đang khóa chỉnh sửa. Cần đối chiếu lịch trình nguồn để xử lý lỗi thời gian.'}</p>}
 </div>
}
