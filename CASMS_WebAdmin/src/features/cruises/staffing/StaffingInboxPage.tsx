import { useCallback, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, Empty, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { formatOperatingBudget } from '../api/preparation-api'
import { CruiseStaffAssignments } from '../components/CruiseStaffAssignments'
import { CruiseFrame } from '../components/CruiseUI'
import { candidateStatusCopy, staffingApi, staffingError, staffingStatus, type StaffingRequest, type WorkPlan } from './staffing-api'
import styles from './Staffing.module.css'

const clock = new Intl.DateTimeFormat('vi-VN', {dateStyle:'short',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'})
function date(value: string) {
  return clock.format(new Date(value))
}

export function StaffingInboxPage() {
  const access=useSessionAccess()
  const hr=access.roles.includes('HR_MANAGER')&&access.canDo('CRUISE_STAFF_ASSIGN')
  const inbox = useReadQuery(`staffing-inbox:${access.userId}`, staffingApi.inbox)
  const [selected, setSelected] = useState('')
  const current = selected || inbox.data?.[0]?.id || ''
  return <CruiseFrame><div className={styles.workspace}>
    <PageHeader breadcrumb="" title="Yêu cầu nhân sự" actions={<Button tone="secondary" onClick={inbox.retry}>Cập nhật danh sách</Button>} />
    <div className={styles.layout}>
      <Panel title={hr?'Chờ phân công':'Chờ xác nhận'}>
        {inbox.loading ? <Loading label="Đang tải yêu cầu nhân sự…" /> : inbox.error
          ? <Notice tone="error" title="Chưa tải được yêu cầu">{staffingError(inbox.error)}</Notice>
          : !inbox.data?.length ? <Empty title="Không có yêu cầu đang chờ" />
          : <ul className={styles.queue}>{inbox.data.map(request => {
            const missing = request.requirements.reduce((sum, item) => sum + Math.max(0,item.required-item.assigned),0)
            return <li key={request.id}><button type="button" aria-current={current===request.id}
              onClick={()=>setSelected(request.id)}>
              <strong>{request.cruiseName}</strong>
              <small>{request.cruiseCode} · {date(request.departure)}</small>
              <small>{missing ? `Còn ${missing} vị trí cần bố trí` : 'Đã đủ người theo yêu cầu'}</small>
            </button></li>
          })}</ul>}
      </Panel>
      {current && <StaffingDetail key={current} requestId={current} onChanged={() => {
        setSelected(current)
        inbox.retry()
      }}/>}
    </div>
  </div></CruiseFrame>
}

function StaffingDetail({requestId,onChanged}:{requestId:string;onChanged:()=>void}) {
  const request = useReadQuery('staffing-request:'+requestId, useCallback(signal=>staffingApi.detail(requestId,signal),[requestId]))
  if (request.loading) return <Loading label="Đang mở yêu cầu…" />
  if (request.error || !request.data) return <Notice tone="error" title="Chưa mở được yêu cầu">
    {staffingError(request.error)} <Button tone="secondary" onClick={request.retry}>Thử lại</Button>
  </Notice>
  return <div className={styles.section}>
    {request.data.operatingBudgetVnd && <p>Ngân sách vận hành của tour <strong>{formatOperatingBudget(request.data.operatingBudgetVnd)}</strong></p>}
    {request.data.returnReason && <Notice title="Quản lý tàu yêu cầu bổ sung">{request.data.returnReason}</Notice>}
    <RequestView request={request.data} refresh={()=>{request.retry();onChanged()}} />
  </div>
}

function RequestView({request,refresh}:{request:StaffingRequest;refresh:()=>void}) {
  const access=useSessionAccess()
  if(access.roles.includes('HR_MANAGER')&&access.canDo('CRUISE_STAFF_ASSIGN')&&
    (request.status==='SENT_TO_HR'||request.status==='HR_SUBMITTED'&&!access.roles.includes('SHIP_MANAGER'))) return <Assignments request={request} refresh={refresh}/>
  return <StaffingReview request={request} refresh={refresh}/>
}

function StaffingReview({request,refresh}:{request:StaffingRequest;refresh:()=>void}) {
  const access=useSessionAccess()
  const [reason,setReason]=useState('')
  const [returning,setReturning]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const lock=useRef(false)
  const ship=request.status==='HR_SUBMITTED'&&access.roles.includes('SHIP_MANAGER')&&access.has('CRUISE_PREPARATION_READ')
  const ops=request.status==='PLANNER_CONFIRMED'&&access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_VALIDATE')
  async function review(action:'SHIP_CONFIRMED'|'RETURNED'|'OPS_APPROVED') {
    if(lock.current)return
    lock.current=true;setBusy(true);setError('')
    try{await staffingApi.transition(request,action,reason.trim()||undefined);refresh()}
    catch(cause){setError(staffingError(cause))}
    finally{lock.current=false;setBusy(false)}
  }
  return <Panel title={request.cruiseName}>
    <p className={styles.subtle}>{request.cruiseCode} · {date(request.departure)} – {date(request.returning)}</p>
    <Badge label={staffingStatus[request.status]??'Trạng thái chưa xác định'} />
    <ul className={styles.rows}>{request.requirements.map(item=><li className={styles.row} key={item.serviceId}>
      <strong>{item.serviceName}</strong><span>{item.assigned}/{item.required} đã bố trí</span>
    </li>)}</ul>
    {error&&<Notice tone="error" title="Chưa xử lý được phương án">{error}</Notice>}
    {returning&&<Field htmlFor="staffing-return-reason" label="Điều cần bổ sung">
      <textarea id="staffing-return-reason" value={reason} disabled={busy} onChange={event=>setReason(event.target.value)}/>
    </Field>}
    <div className={styles.actions}>
      {ship&&!returning&&<><Button busy={busy} onClick={()=>void review('SHIP_CONFIRMED')}>Xác nhận phương án</Button><Button tone="secondary" disabled={busy} onClick={()=>setReturning(true)}>Yêu cầu bổ sung</Button></>}
      {ship&&returning&&<><Button busy={busy} disabled={!reason.trim()} onClick={()=>void review('RETURNED')}>Gửi yêu cầu bổ sung</Button><Button tone="secondary" disabled={busy} onClick={()=>setReturning(false)}>Hủy</Button></>}
      {ops&&<Button busy={busy} onClick={()=>void review('OPS_APPROVED')}>Duyệt phương án nhân sự</Button>}
    </div>
  </Panel>
}

function useStaffCandidates(cruiseId:string,kind:WorkPlan['windows'][number]['kind']|undefined,resourceId:string|undefined) {
  return useReadQuery(`staffing-candidates:${cruiseId}:${kind}:${resourceId}`,useCallback(
    signal=>kind&&resourceId?staffingApi.candidates(cruiseId,kind,resourceId,signal):Promise.resolve([]),
    [cruiseId,kind,resourceId]))
}

function Assignments({request,refresh}:{request:StaffingRequest;refresh:()=>void}) {
  const {cruiseId}=request
  const plan = useReadQuery('staffing-work:'+cruiseId,useCallback(signal=>staffingApi.workPlan(cruiseId,signal),[cruiseId]))
  const [target,setTarget]=useState('')
  const [user,setUser]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const lock=useRef(false)
  const editable=request.status==='SENT_TO_HR'
  const requirement=request.requirements.find(item=>item.serviceId===target)
  const shift=plan.data?.windows.find(item=>item.windowId===target&&(item.kind==='ONBOARD'||item.kind==='SHORE'))
  const candidateQuery=useStaffCandidates(cruiseId,requirement?'SERVICE':shift?.kind,requirement?.serviceId??shift?.resourceId)
  const candidates=candidateQuery.data??[]
  const available=candidates.filter(person=>person.status==='AVAILABLE')
  const covered=request.requirements.length>0 && request.requirements.every(item=>item.assigned>=item.required)

  async function run(operation:()=>Promise<unknown>) {
    if (lock.current || !editable) return
    lock.current=true
    setBusy(true);setError('')
    try {await operation();refresh()}
    catch (cause) {setError(staffingError(cause))}
    finally {lock.current=false;setBusy(false)}
  }
  function chooseTarget(id: string) {
    setTarget(id);setUser('');setError('')
  }

  return <Panel title={request.cruiseName}>
    <div className={styles.section}>
      <p className={styles.subtle}>{request.cruiseCode} · {date(request.departure)} – {date(request.returning)} (giờ Việt Nam)</p>
      <div role="status"><Badge label={staffingStatus[request.status] ?? 'Trạng thái chưa xác định'} tone={editable ? 'warning' : 'success'}/></div>
      <h3>Nhu cầu theo dịch vụ</h3>
      <ul className={styles.rows}>{request.requirements.map(item=><li key={item.serviceId} className={styles.row}>
        <strong>{item.serviceName}</strong><span>{item.assigned}/{item.required} đã bố trí</span>
        {editable&&item.assigned<item.required&&<Button tone="secondary" size="compact" autoWidth disabled={busy} onClick={()=>chooseTarget(item.serviceId)}>Bố trí người</Button>}
      </li>)}</ul>
      {plan.loading ? <Loading label="Đang tải lịch phục vụ…" /> : plan.error &&
        <Notice tone="error" title="Chưa tải được lịch phục vụ"><Button tone="secondary" onClick={plan.retry}>Thử lại</Button></Notice>}
      {plan.data?.windows.length ? <details className={styles.details}><summary>Lịch phục vụ và ca</summary>
        <ul className={styles.rows}>{plan.data.windows.map(window=><li key={window.windowId} className={styles.row}>
          <div><strong>{window.name}</strong><br/><small>{date(window.startsAt)} – {date(window.endsAt)}</small></div>
          <span>{window.userIds.length} đã phân ca</span>
          {editable&&window.kind!=='SERVICE'&&<Button tone="secondary" autoWidth size="compact" disabled={busy} onClick={()=>chooseTarget(window.windowId)}>Phân ca</Button>}
        </li>)}</ul>
      </details> : null}
      {editable&&(requirement||shift)&&(candidateQuery.loading
        ? <Loading label="Đang kiểm tra lịch và năng lực…" />
        : candidateQuery.error
        ? <Notice tone="error" title="Chưa tải được nhân viên khả dụng"><Button tone="secondary" onClick={candidateQuery.retry}>Thử lại</Button></Notice>
        :
        <form className={styles.form} onSubmit={event=>{
          event.preventDefault()
          if (!available.some(person=>person.userId===user)) return
          if (requirement) void run(()=>staffingApi.assignService(cruiseId,user,requirement.serviceId))
          else if (shift?.kind==='ONBOARD'||shift?.kind==='SHORE') {
            const kind=shift.kind
            void run(()=>staffingApi.assignShift(cruiseId,user,kind,shift.resourceId))
          }
        }}>
          <Field htmlFor="staffing-person" label={`Nhân viên cho ${requirement?.serviceName ?? shift?.name}`}>
            <select id="staffing-person" value={user} disabled={busy||!candidates.length} onChange={event=>setUser(event.target.value)}>
              <option value="">Chọn nhân viên</option>
              {available.map(person=><option key={person.userId} value={person.userId}>{person.username}</option>)}
              {candidates.filter(person=>person.status!=='AVAILABLE').map(person=><option key={person.userId} value={person.userId} disabled>
                {person.username} · {candidateStatusCopy[person.status]}
              </option>)}
            </select>
          </Field>
          <p role="status" className={styles.subtle}>{available.length
            ? `${available.length} nhân viên có thể phân công.`
            : 'Chưa có nhân viên phù hợp. Mở danh sách bên dưới để bổ sung người cho chuyến.'}</p>
          <Button type="submit" disabled={busy||!available.some(person=>person.userId===user)}>Xác nhận phân công</Button>
        </form>)}
      {error && <Notice tone="error" title="Chưa hoàn tất" role="alert">{error} <Button tone="text" onClick={refresh}>Tải lại yêu cầu</Button></Notice>}
      {editable && <div className={styles.actions}>
        <Button busy={busy} disabled={!covered} onClick={()=>void run(()=>staffingApi.transition(request,'HR_SUBMITTED'))}>Gửi phương án</Button>
        {!covered && <span className={styles.subtle}>Bố trí đủ người theo từng dịch vụ để gửi.</span>}
      </div>}
    </div>
    {editable && <details className={styles.details}><summary>Danh sách nhân viên của chuyến</summary>
      <CruiseStaffAssignments cruiseId={cruiseId} onChanged={()=>{candidateQuery.retry();plan.retry()}} />
    </details>}
  </Panel>
}
