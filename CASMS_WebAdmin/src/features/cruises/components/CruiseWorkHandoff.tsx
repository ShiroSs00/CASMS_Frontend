import { useCallback, useId, useRef, useState } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, Empty, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { formatOperatingBudget } from '../api/preparation-api'
import { CruiseFrame } from './CruiseUI'
import styles from '../staffing/Staffing.module.css'
import workspaceStyles from './ManagerWorkspace.module.css'

type Group = 'ASM' | 'SHIP'
type Action = 'ACCEPT' | 'COMPLETE' | 'RETURN'
type Task = {
  cruiseId: string; cruiseName: string; cruiseCode: string; group: Group
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'RETURNED'
  request: string; response: string | null; assignee: string | null; operatingBudgetVnd: string | null
  revision: number; canAccept: boolean; canRespond: boolean
}
type Work = { canDispatch: boolean; shipAssigned: boolean; tasks: Task[] }
const labels = { ASM: 'Hoạt động, dịch vụ và tour bờ', SHIP: 'Cabin, khu vực và khả năng phục vụ' }
const teams = { ASM: 'Quản lý dịch vụ', SHIP: 'Quản lý tàu' }
const statuses = { PENDING:'Đã gửi', IN_PROGRESS:'Đang xử lý', COMPLETED:'Đã hoàn tất', RETURNED:'Cần bổ sung' }
const statusTones = { PENDING:'neutral', IN_PROGRESS:'warning', COMPLETED:'success', RETURNED:'warning' } as const
const root = '/cruise-work'
const inbox = (signal: AbortSignal) => apiRequest<Task[]>(root+'/inbox',{signal})

export function CruiseWorkHandoff({ cruiseId, budgetAmount, budgetLoading, budgetUnavailable }: {
  cruiseId: string; budgetAmount: string | null; budgetLoading: boolean; budgetUnavailable: boolean
}) {
  const access = useSessionAccess()
  const path = `${root}/${encodeURIComponent(cruiseId)}`
  const read = useReadQuery(`${path}:${access.userId}`, useCallback(signal => apiRequest<Work>(path,{signal}),[path]))
  if (read.error instanceof ApiError && read.error.status === 403) return null
  return <Panel className={workspaceStyles.departmentPanel} title="Dịch vụ và tàu">
    {read.loading && <Loading label="Đang tải tiến độ…" />}
    {read.error && <Notice title="Chưa tải được tiến độ" tone="error"><Button onClick={read.retry}>Thử lại</Button></Notice>}
    {read.data && <>
      {!budgetAmount && read.data.canDispatch && <p className={styles.handoffBudget} role="status">{budgetLoading ? 'Đang kiểm tra ngân sách…' :
          budgetUnavailable ? 'Kiểm tra lại ngân sách trước khi giao việc.' : <> <a href="#operating-budget">Nhập ngân sách</a> để gửi yêu cầu.</>}</p>}
      <div className={styles.handoffList}>{(['ASM','SHIP'] as const).map(group => {
      const task = read.data?.tasks.find(item => item.group === group)
      const canSend = read.data?.canDispatch && (!task || task.status === 'RETURNED')
      return <section className={styles.handoffItem} key={group} aria-label={teams[group]}>
        <header className={styles.handoffHeading}>
          <div><h3>{teams[group]}</h3><p>{labels[group]}</p></div>
          <Badge tone={task ? statusTones[task.status] : 'neutral'} label={task ? statuses[task.status] : 'Chưa gửi'}/>
        </header>
        {task && <TaskStatus task={task} compact/>}
        {canSend && budgetAmount && (group === 'ASM' || read.data?.shipAssigned)
          ? <details className={styles.handoffCompose} key={task?.revision ?? 0}>
              <summary>{task?.status==='RETURNED'?'Bổ sung và gửi lại':group==='ASM'?'Ghi yêu cầu về hoạt động và tour bờ':'Ghi yêu cầu xác nhận cho Quản lý tàu'}</summary>
              <SendRequest path={`${path}/${group}`} group={group} onChanged={read.retry}/>
            </details>
          : canSend && budgetAmount && <p>Phân công Quản lý tàu cho tour để gửi yêu cầu xác nhận.</p>}
      </section>
    })}</div></>}
  </Panel>
}

function TaskStatus({ task, compact = false }: { task: Task; compact?: boolean }) {
  const details = <dl className={styles.handoffMessages}>
    <div><dt>Yêu cầu đã gửi</dt><dd>{task.request}</dd></div>
    {task.assignee && <div><dt>Người xử lý</dt><dd>{task.assignee}</dd></div>}
    {!compact && task.operatingBudgetVnd && <div><dt>Ngân sách vận hành</dt><dd>{formatOperatingBudget(task.operatingBudgetVnd)}</dd></div>}
  </dl>
  return <div className={styles.section}>
    {!compact && <div><Badge tone={statusTones[task.status]} label={statuses[task.status]}/></div>}
    {task.response && <div className={styles.handoffResponse}><strong>Phản hồi</strong><p>{task.response}</p></div>}
    {compact ? <details className={styles.handoffCompose}><summary>Xem yêu cầu đã gửi</summary>{details}</details> : details}
  </div>
}

function SendRequest({ path, group, onChanged }: { path:string; group:Group; onChanged:()=>void }) {
  const [message, setMessage] = useState('')
  const id = useId()
  const send = useWorkMutation(path, onChanged)
  return <form className={styles.form} onSubmit={event => {
    event.preventDefault()
    if (message.trim()) void send.run('POST',{ request:message.trim() })
  }}>
    <Field htmlFor={id} label={group==='ASM'?'Hoạt động, dịch vụ hoặc tour bờ cần chuẩn bị':'Nội dung cần xác nhận'}
      hint={group==='ASM'?'Ghi hoạt động, tour bờ hoặc dịch vụ cần chuẩn bị.':'Ghi yêu cầu về tàu, boong, cabin hoặc khả năng phục vụ.'}>
      <textarea id={id} rows={3} maxLength={2000} value={message} required disabled={send.busy}
        onChange={event=>setMessage(event.target.value)}/>
    </Field>
    <Button type="submit" busy={send.busy} disabled={!message.trim()}>Gửi cho {teams[group]}</Button>
    {send.error&&<Notice title="Chưa gửi được yêu cầu" tone="error">{send.error}</Notice>}
  </form>
}

function useWorkMutation(path:string,onChanged:()=>void) {
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const lock = useRef(false)
  return { busy,error,async run(method:'POST'|'PUT',body:object) {
    if (lock.current) return
    lock.current=true
    setBusy(true)
    setError('')
    try { await apiRequest(path,{method,body}); onChanged() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa thực hiện được thao tác.') }
    finally { lock.current=false; setBusy(false) }
  } }
}

export function CruiseWorkInboxPage() {
  const access = useSessionAccess()
  const query = useReadQuery('cruise-work-inbox:'+access.userId,inbox)
  const [showDone,setShowDone] = useState(false)
  const rows = (query.data??[]).filter(task=>(task.status==='COMPLETED'||task.status==='RETURNED')===showDone)
  return <CruiseFrame><div className={styles.workspace}>
    <PageHeader title="Yêu cầu chuẩn bị tour" breadcrumb="" />
    <div className={styles.actions}>
      <Button tone={!showDone?'primary':'secondary'} aria-pressed={!showDone} onClick={()=>setShowDone(false)}>Đang mở</Button>
      <Button tone={showDone?'primary':'secondary'} aria-pressed={showDone} onClick={()=>setShowDone(true)}>Đã phản hồi</Button>
    </div>
    {query.loading&&<Loading label="Đang tải yêu cầu…" />}
    {query.error&&<Notice tone="error" title="Chưa tải được yêu cầu"><Button onClick={query.retry}>Tải lại</Button></Notice>}
    {query.data&&!rows.length&&<Empty title={showDone?'Chưa có yêu cầu đã phản hồi':'Không có yêu cầu đang mở'}/>}
    <div className={styles.section}>{rows.map(task=><WorkItem key={`${task.cruiseId}:${task.group}:${task.revision}`} task={task} onChanged={query.retry}/>)}</div>
  </div></CruiseFrame>
}

function WorkItem({ task,onChanged }: {task:Task;onChanged:()=>void}) {
  const [response,setResponse] = useState('')
  const field = useId()
  const action = useWorkMutation(`${root}/${task.cruiseId}/${task.group}`,onChanged)
  const respond = (type:Action) => void action.run('PUT',{action:type,revision:task.revision,response:response.trim()})
  return <Panel title={task.cruiseName} subtitle={`${task.cruiseCode} · ${labels[task.group]}`}>
    <TaskStatus task={task} />
    {task.canAccept&&<Button busy={action.busy} onClick={()=>respond('ACCEPT')}>Nhận yêu cầu</Button>}
    {task.canRespond&&<div className={styles.section}>
      {task.group==='ASM'&&<ButtonLink to={`/admin/cruises/${task.cruiseId}?work=program`} tone="secondary">Mở chương trình của tour</ButtonLink>}
      <Field htmlFor={field} label={task.group==='ASM'?'Kết quả hoặc nội dung cần bổ sung':'Ghi chú xác nhận hoặc lý do trả lại'}>
        <textarea id={field} rows={3} maxLength={2000} value={response} disabled={action.busy} onChange={event=>setResponse(event.target.value)}/>
      </Field>
      <div className={styles.actions}>
        <Button busy={action.busy} disabled={task.group==='ASM'&&!response.trim()} onClick={()=>respond('COMPLETE')}>
          {task.group==='ASM'?'Gửi kết quả cho CRM':'Xác nhận đáp ứng'}
        </Button>
        <Button tone="secondary" disabled={action.busy||!response.trim()} onClick={()=>respond('RETURN')}>Yêu cầu bổ sung</Button>
      </div>
    </div>}
    {action.error&&<Notice title="Chưa phản hồi được" tone="error">{action.error}</Notice>}
  </Panel>
}
