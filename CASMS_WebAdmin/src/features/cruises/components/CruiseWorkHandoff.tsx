import { useCallback, useId, useRef, useState } from 'react'
import { useShipPackageTemplates } from '@/domain/cruise-package'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { cabinTypeLabel } from '@/shared/i18n/business-copy'
import { journeyTime } from '@/shared/lib/journey-time'
import { canRoleOpenAdminPath } from '@/shared/ui/admin-v3'
import { Badge, Button, ButtonLink, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { formatOperatingBudget } from '../api/preparation-api'
import { staffingApi } from '../staffing/staffing-api'
import { CruiseFrame } from './CruiseUI'
import { PreparationEvidence } from './PreparationEvidence'
import styles from '../staffing/Staffing.module.css'
import workspaceStyles from './ManagerWorkspace.module.css'
import { showStandaloneHandoff } from '../model/handoff-presentation'

type Group = 'ASM' | 'SHIP'
type Action = 'ACCEPT' | 'COMPLETE' | 'RETURN'
type Task = {
  cruiseId: string
  cruiseName: string
  cruiseCode: string
  group: Group
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'RETURNED'
  request: string
  response: string | null
  assignee: string | null
  operatingBudgetVnd: string | null
  revision: number
  canAccept: boolean
  canRespond: boolean
  shipId?: string | null
  shipName?: string | null
  shipCapacity?: number | null
  departureAt?: string | null
  returnAt?: string | null
  expectedPassengerCount?: number | null
  sourceTripCode?: string | null
  sourceTripName?: string | null
  sourceVersionNumber?: number | null
  staffingStatus?: string | null
  shipAssigned?: boolean
}
export type Work = { canDispatch: boolean; shipAssigned: boolean; tasks: Task[]; staffingRequestId?: string | null; canReopenAsm?: boolean }
const labels = { ASM: 'Hoạt động, dịch vụ và tour bờ', SHIP: 'Cabin, khu vực và khả năng phục vụ' }
const teams = { ASM: 'Quản lý dịch vụ', SHIP: 'Quản lý tàu' }
const statuses = {
  PENDING: 'Chờ tiếp nhận',
  IN_PROGRESS: 'Đang chuẩn bị',
  COMPLETED: 'Đã bàn giao',
  RETURNED: 'Cần bổ sung',
}
const statusTones = {
  PENDING: 'neutral',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  RETURNED: 'warning',
} as const
const root = '/cruise-work'
const inbox = (signal: AbortSignal) => apiRequest<Task[]>(root + '/inbox', { signal })

export function CruiseWorkHandoff({
  cruiseId,
  budgetAmount,
  budgetLoading,
  budgetUnavailable,
  coordinated = false,
  providedQuery,
}: {
  cruiseId: string
  budgetAmount: string | null
  budgetLoading: boolean
  budgetUnavailable: boolean
  coordinated?: boolean
  providedQuery?: { data: Work | null; loading: boolean; error: Error | null; retry: () => void }
}) {
  const access = useSessionAccess()
  const path = `${root}/${encodeURIComponent(cruiseId)}`
  const provided = Boolean(providedQuery)
  const fallback = useReadQuery(
    `${path}:${access.userId}`,
    useCallback(signal => provided ? Promise.resolve(null) : apiRequest<Work>(path, { signal }), [path, provided]),
  )
  const read = providedQuery ?? fallback
  if (read.error instanceof ApiError && read.error.status === 403) return null
  return (
    <>
      {read.loading && <Loading label="Đang tải tiến độ…" />}
      {read.error && (
        <Notice title="Chưa tải được tiến độ" tone="error">
          <Button onClick={read.retry}>Thử lại</Button>
        </Notice>
      )}
      {read.data && (
        <>
          {(budgetLoading || budgetUnavailable) && read.data.canDispatch && (
            <div className={styles.handoffBudgetWrap}>
              <Notice title={budgetLoading ? 'Đang kiểm tra ngân sách vận hành…' : 'Cần nhập ngân sách vận hành trước khi giao việc'} tone={budgetUnavailable ? 'warning' : 'info'}>
                {budgetLoading ? (
                  'Hệ thống đang kiểm tra trạng thái ngân sách.'
                ) : budgetUnavailable ? (
                  'Chưa xác nhận được ngân sách hiện tại. Kiểm tra lại mục Ngân sách vận hành trước khi giao việc.'
                ) : (
                  <>
                    Thiết lập ngân sách ở mục trên để gửi yêu cầu chuẩn bị cho các bộ phận.{' '}
                    <a className={styles.budgetAnchorLink} href="#operating-budget">Đến mục ngân sách ↑</a>
                  </>
                )}
              </Notice>
            </div>
          )}
          {(['ASM', 'SHIP'] as const).map(group => {
            if (group === 'SHIP' && read.data?.staffingRequestId) return null
            const task = read.data?.tasks.find(item => item.group === group)
            if (providedQuery && !task) return null
            if (coordinated && !task && (group === 'ASM' || read.data?.shipAssigned)) return null
            const canSend = showStandaloneHandoff(Boolean(read.data?.canDispatch), coordinated, task?.status, read.data?.staffingRequestId)
            return (
              <section className={workspaceStyles.deptUnitBox} key={group} aria-label={teams[group]}>
                <header className={workspaceStyles.deptUnitHeader}>
                  <div>
                    <div className={workspaceStyles.deptUnitTitle}>
                      <h4>{teams[group]}</h4>
                  <Badge
                    tone={task ? statusTones[task.status] : 'neutral'}
                    label={task ? statuses[task.status] : group === 'SHIP' && !read.data?.shipAssigned ? 'Chưa phân công Quản lý tàu' : 'Chưa gửi yêu cầu'}
                  />
                    </div>
                    <p className={workspaceStyles.sectionMeta}>{labels[group]}</p>
                  </div>
                </header>
                {task ? <TaskStatus task={task} compact /> : null}
                {task && group === 'ASM' && read.data?.canReopenAsm && (
                  <ReopenProgram task={task} onChanged={read.retry} />
                )}
                {task && group === 'ASM' && task.status === 'COMPLETED' && read.data?.staffingRequestId && read.data.canDispatch && (
                  <p className={workspaceStyles.sectionMeta}>Nếu cần bổ sung chương trình, trả phương án qua yêu cầu chuẩn bị tàu và nhân sự để đồng bộ các bộ phận.</p>
                )}
                {canSend && budgetAmount && !budgetLoading && !budgetUnavailable && (group === 'ASM' || read.data?.shipAssigned) ? (
                  <ComposeRequest key={task?.revision ?? 0} path={`${path}/${group}`} group={group} task={task} onChanged={read.retry} />
                ) : (
                  group === 'SHIP' && !read.data?.shipAssigned && <p className={workspaceStyles.sectionMeta}>Phụ trách phân công: Quản lý nhân sự. Bạn có thể bắt đầu chuẩn bị chuyến ở trên; hệ thống chuyển tiếp theo tiến độ chương trình và phương án tàu. Yêu cầu xác nhận tàu riêng chỉ gửi được khi đã có người phụ trách.</p>
                )}
              </section>
            )
          })}
        </>
      )}
    </>
  )
}

function ReopenProgram({ task, onChanged }: { task: Task; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const id = useId()
  async function submit() {
    if (lock.current || !reason.trim()) return
    lock.current = true; setBusy(true); setError('')
    try {
      const saved = await apiRequest<Work>(`${root}/${encodeURIComponent(task.cruiseId)}/ASM/reopen`, {
        method: 'POST', body: { expectedRevision: task.revision, reason: reason.trim() },
      })
      const actual = await apiRequest<Work>(`${root}/${encodeURIComponent(task.cruiseId)}`)
      const reopened = actual.tasks.find(item => item.group === 'ASM')
      if (!saved.tasks.some(item => item.group === 'ASM' && item.status === 'PENDING' && item.revision === task.revision + 1)
        || !reopened || reopened.status !== 'PENDING' || reopened.revision !== task.revision + 1)
        throw new Error('Chưa đối chiếu được kết quả trả bổ sung. Tải lại tiến độ trước khi thao tác tiếp.')
      setOpen(false); setReason(''); onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa trả được yêu cầu bổ sung.')
    } finally { lock.current = false; setBusy(false) }
  }
  return <>
    <Button tone="secondary" autoWidth onClick={() => { setOpen(true); setError('') }}>Yêu cầu bổ sung chương trình</Button>
    {open && <Modal title="Yêu cầu Quản lý dịch vụ bổ sung" busy={busy} dirty={Boolean(reason)} onClose={() => { if (!busy) setOpen(false) }} footer={<>
      <Button tone="secondary" disabled={busy} onClick={() => setOpen(false)}>Quay lại</Button>
      <Button busy={busy} disabled={!reason.trim()} onClick={() => void submit()}>Trả chương trình để bổ sung</Button>
    </>}>
      <p>Yêu cầu đã hoàn thành sẽ chuyển về chờ nhận việc. Quản lý dịch vụ cần nhận lại, bổ sung và gửi kết quả mới.</p>
      <p>Thay đổi lịch phục vụ có thể làm phương án nhân sự cần được kiểm tra lại. Hồ sơ đã gửi xét duyệt phải được mở lại theo quy trình trước khi sửa.</p>
      <Field htmlFor={id} label="Nội dung cần bổ sung"><textarea id={id} rows={4} maxLength={2000} required disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></Field>
      {error && <Notice title="Chưa xác nhận được thao tác" tone="error"><p>{error}</p><Button tone="secondary" onClick={onChanged}>Tải lại tiến độ</Button></Notice>}
    </Modal>}
  </>
}

function TaskStatus({ task, compact = false }: { task: Task; compact?: boolean }) {
  const progress =
    task.status === 'RETURNED'
      ? 'Quản lý lịch trình cần bổ sung và gửi lại yêu cầu.'
      : task.status === 'COMPLETED'
        ? `Đã nhận kết quả từ ${task.assignee ?? teams[task.group]}.`
        : `${task.status === 'PENDING' ? 'Chờ' : 'Đang xử lý bởi'} ${task.assignee ?? teams[task.group]}.`
  const details = (
    <dl className={styles.handoffMessages}>
      <div>
        <dt>Yêu cầu đã gửi</dt>
        <dd>{task.request}</dd>
      </div>

      {!compact && task.operatingBudgetVnd && (
        <div>
          <dt>Ngân sách vận hành</dt>
          <dd>{formatOperatingBudget(task.operatingBudgetVnd)}</dd>
        </div>
      )}
    </dl>
  )
  if (compact) return <div className={workspaceStyles.handoffSummary}>
    {task.assignee && <p className={workspaceStyles.sectionMeta}>Người xử lý: {task.assignee}</p>}
    <p><span className={workspaceStyles.sectionMeta}>Yêu cầu đã gửi: </span>{task.request}</p>
    {task.response && <div className={workspaceStyles.deptResponseBox}>
      <strong>{task.status === 'RETURNED' ? 'Lý do cần bổ sung' : 'Kết quả'}</strong><p>{task.response}</p>
    </div>}
  </div>
  return (
    <div className={styles.section}>
      {!compact && (
        <div>
          <Badge tone={statusTones[task.status]} label={statuses[task.status]} />
        </div>
      )}
      <p className={workspaceStyles.sectionMeta}>{progress}</p>
      {task.response && (
        <div className={workspaceStyles.deptResponseBox}>
          <strong>{task.status === 'RETURNED' ? 'Lý do cần bổ sung' : 'Kết quả'}</strong>
          <p>{task.response}</p>
        </div>
      )}
      {details}
    </div>
  )
}

function ComposeRequest({ path, group, task, onChanged }: { path: string; group: Group; task?: Task; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const formId = useId()
  return <div className={workspaceStyles.handoffAction}>
    <Button tone="secondary" size="compact" autoWidth aria-expanded={open} aria-controls={formId} onClick={() => setOpen(!open)}>
      {task?.status === 'RETURNED' ? 'Bổ sung và gửi lại yêu cầu' : `Gửi yêu cầu riêng cho ${teams[group]}`}
    </Button>
    {!task && <p className={workspaceStyles.sectionMeta}>Dùng khi cần giao nội dung riêng cho bộ phận này.</p>}
    <div id={formId} hidden={!open}>
      <SendRequest path={path} group={group} initialMessage={task?.request ?? ''} onChanged={onChanged} />
    </div>
  </div>
}

function SendRequest({ path, group, initialMessage, onChanged }: {
  path: string
  group: Group
  initialMessage: string
  onChanged: () => void
}) {
  const [message, setMessage] = useState(initialMessage)
  const id = useId()
  const send = useWorkMutation(path, onChanged)
  return (
    <form
      className={styles.form}
      onSubmit={event => {
        event.preventDefault()
        if (message.trim()) void send.run('POST', { request: message.trim() })
      }}
    >
      <Field
        htmlFor={id}
        label={group === 'ASM' ? 'Hoạt động, dịch vụ hoặc tour bờ cần chuẩn bị' : 'Nội dung cần xác nhận'}
        hint={
          group === 'ASM'
            ? undefined
            : 'Ghi rõ yêu cầu về tàu, boong, cabin hoặc khả năng phục vụ.'
        }
      >
        <textarea
          id={id}
          rows={3}
          maxLength={2000}
          value={message}
          required
          disabled={send.busy}
          onChange={event => setMessage(event.target.value)}
        />
      </Field>
      <Button type="submit" autoWidth busy={send.busy} disabled={!message.trim()}>
        Gửi yêu cầu chuẩn bị
      </Button>
      {send.error && (
        <Notice title="Chưa gửi được yêu cầu" tone="error">
          {send.error.message}
        </Notice>
      )}
    </form>
  )
}

function useWorkMutation(path: string, onChanged: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const lock = useRef(false)
  return {
    busy,
    error,
    async run(method: 'POST' | 'PUT', body: object) {
      if (lock.current) return
      lock.current = true
      setBusy(true)
      setError(null)
      try {
        await apiRequest(path, { method, body })
        onChanged()
      } catch (cause) {
        setError(cause instanceof Error ? cause : new Error('Chưa thực hiện được thao tác.'))
      } finally {
        lock.current = false
        setBusy(false)
      }
    },
  }
}

type ServiceLocationInboxItem = { cruiseId: string; name: string; code: string; pending: number }
const loadServiceLocationInbox = (signal: AbortSignal) =>
  apiRequest<ServiceLocationInboxItem[]>('/cruise/service-locations/inbox', { signal })

export function CruiseWorkInboxPage() {
  const access = useSessionAccess()
  const isShipManager = access.roles.includes('SHIP_MANAGER') && access.has('CRUISE_PREPARATION_READ')
  const query = useReadQuery('cruise-work-inbox:' + access.userId, inbox)
  const locationInbox = useReadQuery(
    `ship-hub-locations:${access.userId}:${isShipManager}`,
    useCallback(signal => (isShipManager ? loadServiceLocationInbox(signal) : Promise.resolve([])), [isShipManager]),
  )
  const staffingInbox = useReadQuery(
    `ship-hub-staffing:${access.userId}:${isShipManager}`,
    useCallback(signal => (isShipManager ? staffingApi.inbox(signal) : Promise.resolve([])), [isShipManager]),
  )
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'DONE'>('ALL')
  const [selectedKey, setSelectedKey] = useState<string>('')

  const statusPriority = (s: Task['status']) =>
    s === 'RETURNED' ? 0 : s === 'PENDING' ? 1 : s === 'IN_PROGRESS' ? 2 : 3
  const allTasks = [...(query.data ?? [])].sort((a, b) => {
    const pDiff = statusPriority(a.status) - statusPriority(b.status)
    if (pDiff !== 0) return pDiff
    return (Date.parse(b.departureAt ?? '') || 0) - (Date.parse(a.departureAt ?? '') || 0)
      || b.cruiseCode.localeCompare(a.cruiseCode, 'vi', { numeric: true })
  })
  const openCount = allTasks.filter(t => t.status !== 'COMPLETED').length
  const doneCount = allTasks.filter(t => t.status === 'COMPLETED').length
  const q = search.trim().toLowerCase()
  const rows = allTasks.filter(task => {
    if (statusFilter === 'OPEN' && task.status === 'COMPLETED') return false
    if (statusFilter === 'DONE' && task.status !== 'COMPLETED') return false
    if (!q) return true
    return task.cruiseName.toLowerCase().includes(q)
      || task.cruiseCode.toLowerCase().includes(q)
      || (task.shipName ?? '').toLowerCase().includes(q)
  })
  const taskKey = (task: Task) => `${task.cruiseId}:${task.group}`
  const activeTask = rows.find(task => taskKey(task) === selectedKey) ?? rows[0] ?? null

  const pendingLocationCount = (locationInbox.data ?? []).reduce((sum, item) => sum + (item.pending ?? 0), 0)
  const pendingStaffingCount = (staffingInbox.data ?? []).filter(
    req => req.status === 'PENDING_SHIP_REVIEW' || (req.workflowVersion !== 'V2' && req.status === 'HR_SUBMITTED'),
  ).length

  function refreshAll() {
    query.retry()
    if (isShipManager) {
      locationInbox.retry()
      staffingInbox.retry()
    }
  }

  return (
    <CruiseFrame>
      <div className={styles.workspace}>
        <div className={styles.stack}>
          <PageHeader
            breadcrumb={isShipManager ? 'Phối hợp & duyệt chuyến' : 'Quản lý hoạt động và dịch vụ'}
            title={isShipManager ? 'Xác nhận tàu' : 'Yêu cầu chuẩn bị chương trình'}
            description=""
            actions={<Button tone="secondary" size="compact" autoWidth onClick={refreshAll}>Làm mới</Button>}
          />

          <Panel>
            <div className={styles.section}>
              {allTasks.length > 0 && (
                <div className={styles.inboxToolbar}>
                  <div className={styles.inboxTabs} role="tablist" aria-label="Lọc trạng thái công việc">
                    <Button size="compact" autoWidth tone={statusFilter === 'ALL' ? 'primary' : 'secondary'} onClick={() => setStatusFilter('ALL')}>
                      Tất cả ({allTasks.length})
                    </Button>
                    <Button size="compact" autoWidth tone={statusFilter === 'OPEN' ? 'primary' : 'secondary'} onClick={() => setStatusFilter('OPEN')}>
                      Cần xử lý ({openCount})
                    </Button>
                    <Button size="compact" autoWidth tone={statusFilter === 'DONE' ? 'primary' : 'secondary'} onClick={() => setStatusFilter('DONE')}>
                      Đã bàn giao ({doneCount})
                    </Button>
                  </div>
                  <div className={styles.inboxSearch}>
                    <input
                      type="search"
                      aria-label="Tìm nhanh theo mã chuyến, tên chuyến hoặc tên tàu"
                      placeholder="Tìm theo mã chuyến, tên chuyến hoặc tên tàu…"
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                    />
                  </div>
                </div>
              )}

          {query.loading && <Loading label="Đang tải danh sách yêu cầu…" />}
          {query.error && (
            <Notice tone="error" title="Chưa tải được danh sách yêu cầu">
              <Button tone="secondary" size="compact" autoWidth onClick={query.retry}>Tải lại</Button>
            </Notice>
          )}
          {query.data && !rows.length && (
            <Empty
              title={
                q
                  ? 'Không tìm thấy yêu cầu phù hợp từ khóa'
                  : isShipManager
                    ? 'Chưa có yêu cầu xác nhận tàu nào'
                    : 'Chưa có yêu cầu chuẩn bị chương trình nào'
              }
            >
              {q ? (
                <Button tone="secondary" size="compact" autoWidth onClick={() => setSearch('')}>
                  Xóa từ khóa tìm kiếm
                </Button>
              ) : isShipManager && pendingLocationCount > 0 ? (
                <>
                  <p>Hiện có <strong>{pendingLocationCount} đề nghị bố trí dịch vụ</strong> từ Quản lý dịch vụ đang chờ bạn duyệt.</p>
                  <ButtonLink to="/admin/service-locations" autoWidth>
                    Chuyển tới Đề nghị bố trí dịch vụ →
                  </ButtonLink>
                </>
              ) : isShipManager && pendingStaffingCount > 0 ? (
                <>
                  <p>Hiện có <strong>{pendingStaffingCount} phương án tàu</strong> đang chờ bạn xác nhận.</p>
                  <ButtonLink to="/admin/staffing-reviews" autoWidth>
                    Mở Chuẩn bị phương án tàu →
                  </ButtonLink>
                </>
              ) : isShipManager ? (
                <p>Yêu cầu xác nhận tàu sẽ xuất hiện tại đây khi Quản lý lịch trình gửi chuẩn bị chuyến cho tàu bạn phụ trách.</p>
              ) : null}
            </Empty>
          )}
          {rows.length > 0 && activeTask && (
            <div className={styles.masterDetail}>
              <aside className={styles.queueRail} aria-label="Danh sách chuyến cần xử lý">
                {rows.map(task => {
                  const key = taskKey(task)
                  const isSelected = key === taskKey(activeTask)
                  return (
                    <button
                      key={`${key}:${task.revision}`}
                      type="button"
                      aria-pressed={isSelected}
                      className={`${styles.queueItem} ${isSelected ? styles.queueItemActive : ''}`}
                      onClick={() => setSelectedKey(key)}
                    >
                      <div className={styles.queueItemTop}>
                        <span className={styles.queueItemCode}>{task.cruiseCode}</span>
                        <Badge tone={statusTones[task.status]} label={statuses[task.status]} />
                      </div>
                      <span className={styles.queueItemName}>{task.cruiseName}</span>
                      <span className={styles.queueItemMeta}>
                        {task.shipName ?? 'Chưa phân công tàu'}
                        {task.departureAt ? ` · ${journeyTime(task.departureAt)}` : ''}
                      </span>
                    </button>
                  )
                })}
              </aside>
              <div className={styles.detailPane}>
                <WorkItem
                  key={`${activeTask.cruiseId}:${activeTask.group}:${activeTask.revision}`}
                  task={activeTask}
                  onChanged={refreshAll}
                />
              </div>
            </div>
          )}
            </div>
          </Panel>
        </div>
      </div>
    </CruiseFrame>
  )
}

function WorkItem({ task, onChanged }: { task: Task; onChanged: () => void }) {
  const access = useSessionAccess()
  const cruisePath = `/admin/cruises/${encodeURIComponent(task.cruiseId)}`
  const programContext = '?work=program'
  const canOpenProgram = task.group === 'ASM' && canRoleOpenAdminPath(access.roles, cruisePath, programContext, access)
  const canOpenLocations = task.group === 'SHIP' && canRoleOpenAdminPath(access.roles, '/admin/service-locations', '', access)
  const canOpenStaffingReview = task.group === 'SHIP' && canRoleOpenAdminPath(access.roles, '/admin/staffing-reviews', '', access)
  const shipTemplates = useShipPackageTemplates(task.group === 'ASM' ? task.shipId : null)
  const [response, setResponse] = useState('')
  const field = useId()
  const action = useWorkMutation(`${root}/${task.cruiseId}/${task.group}`, onChanged)
  const respond = (type: Action) => void action.run('PUT', { action: type, revision: task.revision, response: response.trim() })
  const details = action.error instanceof ApiError && action.error.code === 'ITINERARY_PROGRAMS_INCOMPLETE'
    ? action.error.details : null
  const issues = details && typeof details === 'object' && 'issues' in details && Array.isArray(details.issues)
    ? [...new Set(details.issues.flatMap(issue => typeof issue?.message === 'string' ? [issue.message as string] : []))]
    : []

  const sourcePlanLabel = task.sourceTripCode
    ? `${task.sourceTripCode}${task.sourceTripName ? ` · ${task.sourceTripName}` : ''}`
    : 'Chưa gắn lịch trình mẫu'
  const shipLabel = task.shipName
    ? `${task.shipName}${task.shipCapacity != null ? ` · ${task.shipCapacity} hành khách` : ''}`
    : 'Chưa gán tàu'
  const scheduleRange =
    task.departureAt && task.returnAt
      ? `${journeyTime(task.departureAt)} → ${journeyTime(task.returnAt)}`
      : task.departureAt
        ? journeyTime(task.departureAt)
        : 'Chưa có lịch khởi hành'
  const scaleBudget = [
    task.expectedPassengerCount != null ? `${task.expectedPassengerCount} hành khách` : null,
    task.operatingBudgetVnd ? `Ngân sách ${formatOperatingBudget(task.operatingBudgetVnd)}` : null,
  ].filter(Boolean).join(' · ') || 'Chưa cập nhật'

  const templateList = shipTemplates.data ?? []

  return (
    <Panel>
      <div className={styles.section}>
        <header className={styles.workCardHeader}>
          <div className={styles.workCardTitleGroup}>
            <h3 className={styles.workCardTitle}>{task.cruiseName}</h3>
            <p className={styles.workCardSub}>
              <strong>{task.cruiseCode}</strong> · {labels[task.group]}
              {task.assignee ? ` · Phụ trách: ${task.assignee}` : ''}
            </p>
          </div>
          <Badge tone={statusTones[task.status]} label={statuses[task.status]} />
        </header>

        <div className={styles.workMetaGrid}>
          <div className={styles.workMetaItem}>
            <span className={styles.workMetaLabel}>Tàu &amp; sức chứa tàu</span>
            <span className={styles.workMetaValue}>{shipLabel}</span>
          </div>
          <div className={styles.workMetaItem}>
            <span className={styles.workMetaLabel}>Thời gian chạy</span>
            <span className={styles.workMetaValue}>{scheduleRange}</span>
          </div>
          <div className={styles.workMetaItem}>
            <span className={styles.workMetaLabel}>Quy mô chuyến &amp; ngân sách</span>
            <span className={styles.workMetaValue}>{scaleBudget}</span>
          </div>
          <div className={styles.workMetaItem}>
            <span className={styles.workMetaLabel}>Lịch trình mẫu</span>
            <span className={styles.workMetaValue}>{sourcePlanLabel}</span>
          </div>
        </div>

        {task.status === 'RETURNED' && task.response && (
          <Notice tone="warning" title="Yêu cầu bổ sung">
            {task.response}
          </Notice>
        )}

        <div className={styles.workBriefBox}>
          <span className={styles.workBriefLabel}>Yêu cầu từ Quản lý lịch trình</span>
          <p className={styles.workBriefText}>{task.request}</p>
        </div>

        {task.status !== 'RETURNED' && task.response && (
          <div className={workspaceStyles.deptResponseBox}>
            <strong>Kết quả đã bàn giao</strong>
            <p>{task.response}</p>
          </div>
        )}

        {task.group === 'ASM' && task.shipId && (
          <details className={styles.templateCollapse}>
            <summary>
              {shipTemplates.loading
                ? 'Đang tải mẫu gói tham khảo theo tàu…'
                : shipTemplates.error
                  ? 'Chưa tải được danh sách mẫu gói theo tàu'
                  : templateList.length > 0
                    ? `Mẫu gói tham khảo theo tàu (${templateList.length} mẫu đã phát hành)`
                    : 'Chưa có mẫu gói phát hành cho tàu này'}
            </summary>
            {templateList.length > 0 && (
              <ul className={styles.templateList}>
                {templateList.map((tpl, index) => (
                  <li key={`${tpl.name}:${index}`}>
                    <strong>{tpl.name}</strong>
                    <span className={styles.subtle}>{tpl.cabinTypes.map(cabinTypeLabel).join(', ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </details>
        )}

        {task.group === 'ASM' && (task.staffingStatus === 'PENDING_ASM' || task.staffingStatus === 'PENDING_SHIP_REVIEW') && (
          task.shipAssigned === false ? (
            <Notice tone="warning" title="Lưu ý về Quản lý tàu">
              Chuyến chưa phân công Quản lý tàu. Bạn có thể chuẩn bị chương trình. Khi đã phân công, Quản lý tàu sẽ nhận kết quả trong mục Chuẩn bị phương án tàu.
            </Notice>
          ) : (
            <p className={styles.statusNote}>
              Sau khi bạn hoàn tất chương trình, Quản lý tàu sẽ nhận được thông tin trong mục Chuẩn bị phương án tàu.
            </p>
          )
        )}

        {task.group === 'ASM' && task.status === 'COMPLETED' && task.staffingStatus === null && (
          <Notice tone="info" title="Đã gửi kết quả chương trình cho Quản lý lịch trình">
            Để bàn giao sang luồng phân công nhân sự, Quản lý lịch trình sẽ khởi tạo yêu cầu trong mục Chuẩn bị nhân sự.
          </Notice>
        )}

        {task.group === 'SHIP' && <PreparationEvidence cruiseId={task.cruiseId} sectionCode="TECHNICAL_NAUTICAL" refreshKey={task.revision} onChanged={onChanged} />}

        {task.canAccept && (
          <div className={styles.inlineActions}>
            <Button autoWidth busy={action.busy} onClick={() => respond('ACCEPT')}>
              Tiếp nhận yêu cầu
            </Button>
          </div>
        )}

        {task.canRespond && (
          <div className={styles.stepGrid}>
            {task.group === 'ASM' && canOpenProgram && (
              <div className={styles.stepBox}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNum}>1</span>
                  <h4 className={styles.stepTitle}>Thiết lập chương trình & dịch vụ</h4>
                </div>
                <div className={styles.inlineActions}>
                  <ButtonLink to={cruisePath + programContext} tone="secondary" autoWidth>
                    Mở chương trình chuyến →
                  </ButtonLink>
                </div>
              </div>
            )}

            {task.group === 'SHIP' && (canOpenLocations || canOpenStaffingReview) && (
              <div className={styles.stepBox}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNum}>1</span>
                  <h4 className={styles.stepTitle}>Kiểm tra các đề nghị liên quan trên tàu</h4>
                </div>
                <div className={styles.inlineActions}>
                  {canOpenLocations && (
                    <ButtonLink to={`/admin/service-locations?cruiseId=${encodeURIComponent(task.cruiseId)}`} tone="secondary" size="compact" autoWidth>
                      Xem đề nghị bố trí dịch vụ
                    </ButtonLink>
                  )}
                  {canOpenStaffingReview && (
                    <ButtonLink to="/admin/staffing-reviews" tone="secondary" size="compact" autoWidth>
                      Chuẩn bị phương án tàu
                    </ButtonLink>
                  )}
                </div>
              </div>
            )}

            <div className={styles.stepBox}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNum}>{task.group === 'ASM' && canOpenProgram ? '2' : '1'}</span>
                <h4 className={styles.stepTitle}>
                  {task.group === 'ASM' ? 'Gửi kết quả bàn giao hoặc yêu cầu bổ sung' : 'Gửi quyết định xác nhận tàu'}
                </h4>
              </div>
              <Field
                htmlFor={field}
                label={task.group === 'ASM' ? 'Tóm tắt kết quả đã chuẩn bị (hoặc nội dung cần bổ sung) *' : 'Ghi chú xác nhận (hoặc lý do trả lại)'}
                hint={
                  task.group === 'ASM'
                    ? 'Nhập ngắn gọn các hạng mục đã hoàn tất để bật nút gửi phản hồi.'
                    : 'Có thể xác nhận ngay; bắt buộc nhập lý do nếu chọn Yêu cầu bổ sung.'
                }
              >
                <textarea
                  id={field}
                  rows={3}
                  maxLength={2000}
                  placeholder={
                    task.group === 'ASM'
                      ? 'VD: Đã hoàn tất lịch hoạt động trên tàu, tour bờ và gửi đề nghị bố trí dịch vụ trên boong.'
                      : 'VD: Tàu, cabin và các boong dịch vụ đáp ứng đủ điều kiện khai thác.'
                  }
                  value={response}
                  disabled={action.busy}
                  onChange={event => setResponse(event.target.value)}
                />
              </Field>
              <div className={styles.inlineActions}>
                <Button autoWidth busy={action.busy} disabled={task.group === 'ASM' && !response.trim()} onClick={() => respond('COMPLETE')}>
                  {task.group === 'ASM'
                    ? task.staffingStatus === 'PENDING_ASM' ? 'Hoàn tất chương trình' : 'Gửi kết quả cho Quản lý lịch trình'
                    : 'Xác nhận đáp ứng'}
                </Button>
                <Button tone="secondary" autoWidth disabled={action.busy || !response.trim()} onClick={() => respond('RETURN')}>
                  Yêu cầu bổ sung
                </Button>
              </div>
            </div>
          </div>
        )}

        {action.error && (
          <Notice title="Chưa thể gửi phản hồi" tone="error">
            <p>{action.error.message}</p>
            {issues.length > 0 && <ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
          </Notice>
        )}
      </div>
    </Panel>
  )
}
