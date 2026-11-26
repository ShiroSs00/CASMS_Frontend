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
type Work = { canDispatch: boolean; shipAssigned: boolean; tasks: Task[]; staffingRequestId?: string | null; canReopenAsm?: boolean }
const labels = { ASM: 'Hoạt động, dịch vụ và tour bờ', SHIP: 'Cabin, khu vực và khả năng phục vụ' }
const teams = { ASM: 'Quản lý dịch vụ', SHIP: 'Quản lý tàu' }
const statuses = {
  PENDING: 'Chờ xử lý',
  IN_PROGRESS: 'Đang xử lý',
  COMPLETED: 'Đã phản hồi',
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
}: {
  cruiseId: string
  budgetAmount: string | null
  budgetLoading: boolean
  budgetUnavailable: boolean
}) {
  const access = useSessionAccess()
  const path = `${root}/${encodeURIComponent(cruiseId)}`
  const read = useReadQuery(
    `${path}:${access.userId}`,
    useCallback(signal => apiRequest<Work>(path, { signal }), [path]),
  )
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
          {!budgetAmount && read.data.canDispatch && (
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
            const canSend = read.data?.canDispatch && (!task || task.status === 'RETURNED')
            return (
              <section className={workspaceStyles.deptUnitBox} key={group} aria-label={teams[group]}>
                <header className={workspaceStyles.deptUnitHeader}>
                  <div>
                    <h4>{teams[group]}</h4>
                    <p className={workspaceStyles.sectionMeta}>{labels[group]}</p>
                  </div>
                  <Badge
                    tone={task ? statusTones[task.status] : 'neutral'}
                    label={task ? statuses[task.status] : 'Chưa gửi'}
                  />
                </header>
                {task ? <TaskStatus task={task} compact /> : (
                  <p className={workspaceStyles.sectionMeta}>Chưa gửi yêu cầu chuẩn bị.</p>
                )}
                {task && group === 'ASM' && read.data?.canReopenAsm && (
                  <ReopenProgram task={task} onChanged={read.retry} />
                )}
                {task && group === 'ASM' && task.status === 'COMPLETED' && read.data?.staffingRequestId && read.data.canDispatch && (
                  <p className={workspaceStyles.sectionMeta}>Nếu cần bổ sung chương trình, trả phương án qua yêu cầu chuẩn bị tàu và nhân sự để đồng bộ các bộ phận.</p>
                )}
                {canSend && budgetAmount && (group === 'ASM' || read.data?.shipAssigned) ? (
                  <details className={styles.handoffCompose} key={task?.revision ?? 0}>
                    <summary>
                      {task?.status === 'RETURNED'
                        ? 'Bổ sung và gửi lại yêu cầu'
                        : group === 'ASM'
                          ? 'Soạn yêu cầu cho Quản lý dịch vụ'
                          : 'Soạn yêu cầu cho Quản lý tàu'}
                    </summary>
                    <SendRequest path={`${path}/${group}`} group={group} initialMessage={task?.request ?? ''} onChanged={read.retry} />
                  </details>
                ) : (
                  canSend &&
                  budgetAmount && <p className={workspaceStyles.sectionMeta}>Phân công Quản lý tàu cho chuyến để gửi yêu cầu xác nhận.</p>
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
      {compact ? (
        <details className={styles.handoffCompose}>
          <summary>Xem nội dung yêu cầu đã gửi</summary>
          {details}
        </details>
      ) : (
        details
      )}
    </div>
  )
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
  const isAsm = access.roles.includes('ACTIVITY_SERVICE_MANAGER') && !isShipManager
  const query = useReadQuery('cruise-work-inbox:' + access.userId, inbox)
  const locationInbox = useReadQuery(
    `ship-hub-locations:${access.userId}:${isShipManager}`,
    useCallback(signal => (isShipManager ? loadServiceLocationInbox(signal) : Promise.resolve([])), [isShipManager]),
  )
  const staffingInbox = useReadQuery(
    `ship-hub-staffing:${access.userId}:${isShipManager}`,
    useCallback(signal => (isShipManager ? staffingApi.inbox(signal) : Promise.resolve([])), [isShipManager]),
  )
  const [showDone, setShowDone] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState<string>('')

  const allTasks = query.data ?? []
  const openTasks = allTasks.filter(task => task.status === 'PENDING' || task.status === 'IN_PROGRESS')
  const doneTasks = allTasks.filter(task => task.status === 'COMPLETED' || task.status === 'RETURNED')
  const activePool = showDone ? doneTasks : openTasks
  const q = search.trim().toLowerCase()
  const rows = q
    ? activePool.filter(
        task =>
          task.cruiseName.toLowerCase().includes(q)
          || task.cruiseCode.toLowerCase().includes(q)
          || (task.shipName ?? '').toLowerCase().includes(q),
      )
    : activePool
  const taskKey = (task: Task) => `${task.cruiseId}:${task.group}`
  const activeTask = rows.find(task => taskKey(task) === selectedKey) ?? rows[0] ?? null

  const pendingLocationTours = (locationInbox.data ?? []).length
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
            breadcrumb={isAsm ? 'Quản lý hoạt động và dịch vụ' : 'Quản lý tàu'}
            title={isAsm ? 'Yêu cầu chuẩn bị chương trình' : 'Xét duyệt tàu cho chuyến'}
            description={
              isAsm
                ? 'Nhận yêu cầu từ Quản lý lịch trình, mở chương trình để thiết lập hoạt động & dịch vụ theo tàu rồi gửi xác nhận hoàn tất.'
                : 'Tổng hợp toàn bộ đầu việc cần Quản lý tàu phản hồi cho các chuyến khởi hành: xác nhận khả năng đáp ứng tàu, duyệt bố trí dịch vụ trên boong và xét phương án nhân sự.'
            }
            actions={<Button tone="secondary" size="compact" autoWidth onClick={refreshAll}>Cập nhật</Button>}
          />

          {isShipManager && (
            <section className={styles.hubGrid} aria-label="Tổng hợp đầu việc của Quản lý tàu">
              <div className={`${styles.hubCard} ${styles.hubCardCurrent}`}>
                <div className={styles.hubCardTop}>
                  <h2 className={styles.hubCardTitle}>1. Xác nhận đáp ứng tàu</h2>
                  <Badge
                    tone={openTasks.length > 0 ? 'warning' : 'neutral'}
                    label={openTasks.length > 0 ? `${openTasks.length} đang chờ` : 'Đang xem'}
                  />
                </div>
                <div className={styles.hubCardCount}>{openTasks.length}</div>
                <p className={styles.hubCardDesc}>
                  Yêu cầu từ Quản lý lịch trình xác nhận tàu, cabin và khả năng phục vụ của chuyến.
                </p>
                <div className={styles.hubCardFoot}>
                  <span className={styles.subtle}>Hiển thị ngay bên dưới</span>
                </div>
              </div>

              <div className={`${styles.hubCard} ${pendingLocationCount > 0 ? styles.hubCardAlert : ''}`}>
                <div className={styles.hubCardTop}>
                  <h2 className={styles.hubCardTitle}>2. Đề nghị bố trí dịch vụ</h2>
                  <Badge
                    tone={pendingLocationCount > 0 ? 'warning' : 'success'}
                    label={pendingLocationCount > 0 ? `${pendingLocationCount} đề nghị chờ` : 'Đã xử lý hết'}
                  />
                </div>
                <div className={styles.hubCardCount}>
                  {locationInbox.loading ? '…' : pendingLocationCount}
                </div>
                <p className={styles.hubCardDesc}>
                  {pendingLocationCount > 0
                    ? `Có ${pendingLocationCount} đề nghị bố trí dịch vụ trên boong tại ${pendingLocationTours} chuyến cần bạn duyệt.`
                    : 'Chưa có đề nghị bố trí dịch vụ nào từ Quản lý dịch vụ đang chờ duyệt.'}
                </p>
                <div className={styles.hubCardFoot}>
                  <ButtonLink
                    to="/admin/service-locations"
                    tone={pendingLocationCount > 0 ? 'primary' : 'secondary'}
                    size="compact"
                    autoWidth
                  >
                    {pendingLocationCount > 0 ? `Mở ${pendingLocationCount} đề nghị cần duyệt →` : 'Xem bố trí dịch vụ'}
                  </ButtonLink>
                </div>
              </div>

              <div className={`${styles.hubCard} ${pendingStaffingCount > 0 ? styles.hubCardAlert : ''}`}>
                <div className={styles.hubCardTop}>
                  <h2 className={styles.hubCardTitle}>3. Chuẩn bị phương án tàu</h2>
                  <Badge
                    tone={pendingStaffingCount > 0 ? 'warning' : 'success'}
                    label={pendingStaffingCount > 0 ? `${pendingStaffingCount} chờ xử lý` : 'Đã xử lý hết'}
                  />
                </div>
                <div className={styles.hubCardCount}>
                  {staffingInbox.loading ? '…' : pendingStaffingCount}
                </div>
                <p className={styles.hubCardDesc}>
                  {pendingStaffingCount > 0
                    ? `Có ${pendingStaffingCount} phương án khu vực, POS và định biên nhân sự chờ bạn xác nhận.`
                    : 'Chưa có phương án tàu nào chờ bạn xử lý. Các chuyến mới xong chương trình cần HR gắn Quản lý tàu trước khi hiển thị tại đây.'}
                </p>
                <div className={styles.hubCardFoot}>
                  <ButtonLink
                    to="/admin/staffing-reviews"
                    tone={pendingStaffingCount > 0 ? 'primary' : 'secondary'}
                    size="compact"
                    autoWidth
                  >
                    {pendingStaffingCount > 0 ? `Mở ${pendingStaffingCount} phương án →` : 'Xem phương án tàu'}
                  </ButtonLink>
                </div>
              </div>
            </section>
          )}

          <div className={styles.inboxToolbar}>
            <div className={styles.inboxTabs} role="tablist" aria-label="Bộ lọc trạng thái yêu cầu">
              <Button
                tone={!showDone ? 'primary' : 'secondary'}
                size="compact"
                autoWidth
                aria-pressed={!showDone}
                onClick={() => setShowDone(false)}
              >
                Đang mở ({openTasks.length})
              </Button>
              <Button
                tone={showDone ? 'primary' : 'secondary'}
                size="compact"
                autoWidth
                aria-pressed={showDone}
                onClick={() => setShowDone(true)}
              >
                Đã phản hồi ({doneTasks.length})
              </Button>
            </div>
            {activePool.length > 0 && (
              <div className={styles.inboxSearch}>
                <input
                  type="search"
                  aria-label="Tìm nhanh theo mã chuyến, tên chuyến hoặc tên tàu"
                  placeholder="Tìm theo mã chuyến, tên chuyến hoặc tên tàu…"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
              </div>
            )}
          </div>

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
                  : showDone
                    ? 'Chưa có yêu cầu nào đã phản hồi'
                    : isShipManager
                      ? 'Không có yêu cầu xác nhận đáp ứng tàu đang mở'
                      : 'Chưa có yêu cầu chuẩn bị chương trình nào đang mở'
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
                <p>Chuyến mới hoàn tất chương trình cần Quản lý nhân sự phân công bạn làm Quản lý tàu phụ trách trước khi xuất hiện tại đây.</p>
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
    ? `${task.sourceTripCode}${task.sourceVersionNumber != null ? ` (v${task.sourceVersionNumber})` : ''}${task.sourceTripName ? ` · ${task.sourceTripName}` : ''}`
    : 'Chưa gắn lịch trình nguồn'
  const shipLabel = task.shipName
    ? `${task.shipName}${task.shipCapacity != null ? ` · ${task.shipCapacity} chỗ` : ''}`
    : 'Chưa phân công tàu'
  const scheduleRange =
    task.departureAt && task.returnAt
      ? `${journeyTime(task.departureAt)} → ${journeyTime(task.returnAt)}`
      : task.departureAt
        ? journeyTime(task.departureAt)
        : 'Chưa có lịch khởi hành'
  const scaleBudget = [
    task.expectedPassengerCount != null ? `${task.expectedPassengerCount} khách` : null,
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
            <span className={styles.workMetaLabel}>Tàu phân công</span>
            <span className={styles.workMetaValue}>{shipLabel}</span>
          </div>
          <div className={styles.workMetaItem}>
            <span className={styles.workMetaLabel}>Thời gian chạy (giờ VN)</span>
            <span className={styles.workMetaValue}>{scheduleRange}</span>
          </div>
          <div className={styles.workMetaItem}>
            <span className={styles.workMetaLabel}>Quy mô & ngân sách</span>
            <span className={styles.workMetaValue}>{scaleBudget}</span>
          </div>
          <div className={styles.workMetaItem}>
            <span className={styles.workMetaLabel}>Lịch trình nguồn</span>
            <span className={styles.workMetaValue}>{sourcePlanLabel}</span>
          </div>
        </div>

        <div className={styles.workBriefBox}>
          <span className={styles.workBriefLabel}>Yêu cầu từ Quản lý lịch trình</span>
          <p className={styles.workBriefText}>{task.request}</p>
        </div>

        {task.response && (
          <div className={workspaceStyles.deptResponseBox}>
            <strong>{task.status === 'RETURNED' ? 'Nội dung đã yêu cầu bổ sung' : 'Kết quả đã phản hồi'}</strong>
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
          <div className={styles.stepBox}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNum}>1</span>
              <h4 className={styles.stepTitle}>Tiếp nhận yêu cầu chuẩn bị</h4>
            </div>
            <p className={styles.stepHint}>
              Bấm nhận yêu cầu để mở không gian thiết lập chương trình và gửi phản hồi cho Quản lý lịch trình.
            </p>
            <div className={styles.inlineActions}>
              <Button autoWidth busy={action.busy} onClick={() => respond('ACCEPT')}>
                Nhận yêu cầu
              </Button>
            </div>
          </div>
        )}

        {task.canRespond && (
          <div className={styles.stepGrid}>
            {task.group === 'ASM' && canOpenProgram && (
              <div className={styles.stepBox}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNum}>1</span>
                  <h4 className={styles.stepTitle}>Thiết lập chương trình, hoạt động & bố trí dịch vụ</h4>
                </div>
                <p className={styles.stepHint}>
                  Mở không gian chương trình của chuyến để xếp lịch hoạt động trên tàu, tour bờ, gói áp dụng và gửi đề nghị bố trí dịch vụ tại các boong.
                </p>
                <div className={styles.inlineActions}>
                  <ButtonLink to={cruisePath + programContext} tone="secondary" autoWidth>
                    Mở chương trình chuyến khởi hành →
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
