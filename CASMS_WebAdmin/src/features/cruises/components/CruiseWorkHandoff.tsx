import { useCallback, useId, useRef, useState } from 'react'
import { useShipPackageTemplates } from '@/domain/cruise-package'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { cabinTypeLabel } from '@/shared/i18n/business-copy'
import { journeyTime } from '@/shared/lib/journey-time'
import { canRoleOpenAdminPath } from '@/shared/ui/admin-v3'
import { Badge, Button, ButtonLink, Empty, Field, Loading, Notice, PageHeader, Panel, RecordFacts } from '@/shared/ui'
import { formatOperatingBudget } from '../api/preparation-api'
import { CruiseFrame } from './CruiseUI'
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
type Work = { canDispatch: boolean; shipAssigned: boolean; tasks: Task[]; staffingRequestId?: string | null }
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
                  budgetAmount && <p className={workspaceStyles.sectionMeta}>Phân công Quản lý tàu cho tour để gửi yêu cầu xác nhận.</p>
                )}
              </section>
            )
          })}
        </>
      )}
    </>
  )
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

export function CruiseWorkInboxPage() {
  const access = useSessionAccess()
  const query = useReadQuery('cruise-work-inbox:' + access.userId, inbox)
  const [showDone, setShowDone] = useState(false)
  const rows = (query.data ?? []).filter(task => (task.status === 'COMPLETED' || task.status === 'RETURNED') === showDone)
  return (
    <CruiseFrame>
      <div className={styles.workspace}>
        <PageHeader title="Xét duyệt tàu cho chuyến" breadcrumb=""
          actions={<Button tone="secondary" size="compact" onClick={query.retry}>Cập nhật</Button>} />
        {access.roles.includes('SHIP_MANAGER') && access.has('CRUISE_PREPARATION_READ') && (
          <Notice tone="info" title="Công việc từ Quản lý dịch vụ">
            <div className={styles.actions}>
              <ButtonLink to="/admin/staffing-reviews" tone="secondary" size="compact">Xét phương án nhân sự</ButtonLink>
              <ButtonLink to="/admin/service-locations" tone="secondary" size="compact">Bố trí dịch vụ</ButtonLink>
            </div>
          </Notice>
        )}
        <div className={styles.actions}>
          <Button tone={!showDone ? 'primary' : 'secondary'} aria-pressed={!showDone} onClick={() => setShowDone(false)}>
            Đang mở
          </Button>
          <Button tone={showDone ? 'primary' : 'secondary'} aria-pressed={showDone} onClick={() => setShowDone(true)}>
            Đã phản hồi
          </Button>
        </div>
        {query.loading && <Loading label="Đang tải yêu cầu…" />}
        {query.error && (
          <Notice tone="error" title="Chưa tải được yêu cầu">
            <Button onClick={query.retry}>Tải lại</Button>
          </Notice>
        )}
        {query.data && !rows.length && (
          <Empty title={showDone ? 'Chưa có yêu cầu đã phản hồi' : 'Không có yêu cầu đang mở'} />
        )}
        <div className={styles.section}>
          {rows.map(task => (
            <WorkItem key={`${task.cruiseId}:${task.group}:${task.revision}`} task={task} onChanged={query.retry} />
          ))}
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
    ? `${task.sourceTripCode}${task.sourceTripName ? ` · ${task.sourceTripName}` : ''}${task.sourceVersionNumber != null ? ` (Phiên bản ${task.sourceVersionNumber})` : ''}`
    : 'Chưa có'
  const shipLabel = task.shipName
    ? `${task.shipName}${task.shipCapacity != null ? ` (${task.shipCapacity} chỗ)` : ''}`
    : 'Chưa có'

  return (
    <Panel title={task.cruiseName} subtitle={`${task.cruiseCode} · ${labels[task.group]}`}>
      <RecordFacts
        entries={[
          ['Tàu phân công', shipLabel],
          ['Khởi hành (giờ Việt Nam)', task.departureAt ? journeyTime(task.departureAt) : 'Chưa có'],
          ['Kết thúc (giờ Việt Nam)', task.returnAt ? journeyTime(task.returnAt) : 'Chưa có'],
          ['Số khách dự kiến', task.expectedPassengerCount != null ? `${task.expectedPassengerCount} khách` : 'Chưa có'],
          ['Lịch trình nguồn', sourcePlanLabel],
          ...(task.group === 'ASM'
            ? [
                [
                  'Mẫu gói tham khảo theo tàu',
                  !task.shipId
                    ? 'Chưa phân công tàu'
                    : shipTemplates.loading
                      ? 'Đang tải mẫu gói…'
                      : shipTemplates.error
                        ? 'Chưa tải được mẫu gói'
                        : shipTemplates.data?.length
                          ? shipTemplates.data
                              .map(tpl => `${tpl.name} (${tpl.cabinTypes.map(cabinTypeLabel).join(', ')})`)
                              .join(' · ')
                          : 'Chưa có mẫu gói phát hành cho tàu này',
                ] as const,
              ]
            : []),
        ]}
      />
      <TaskStatus task={task} />
      {task.group === 'ASM' && (task.staffingStatus === 'PENDING_ASM' || task.staffingStatus === 'PENDING_SHIP_REVIEW') && (
        task.shipAssigned === false
          ? <Notice tone="warning" title="Chuyến chưa có Quản lý tàu">
              Kết quả được lưu cho chuyến. Quản lý tàu sẽ thấy yêu cầu trong mục Xét phương án nhân sự sau khi được phân công.
            </Notice>
          : <p>Quản lý tàu của chuyến nhận chương trình trong mục Xét phương án nhân sự.</p>
      )}
      {task.group === 'ASM' && task.status === 'COMPLETED' && task.staffingStatus === null && (
        <Notice tone="info" title="Đã gửi kết quả chương trình cho Quản lý lịch trình">
          Để bàn giao theo luồng nhân sự, Quản lý lịch trình khởi tạo yêu cầu trong mục Chuẩn bị nhân sự.
        </Notice>
      )}
      {task.canAccept && (
        <Button busy={action.busy} onClick={() => respond('ACCEPT')}>
          Nhận yêu cầu
        </Button>
      )}
      {task.canRespond && (
        <div className={styles.section}>
          <div className={styles.actions}>
            {canOpenProgram && (
              <ButtonLink to={cruisePath + programContext} tone="secondary">
                Mở chương trình của tour
              </ButtonLink>
            )}
            {canOpenLocations && (
              <ButtonLink to={`/admin/service-locations?cruiseId=${encodeURIComponent(task.cruiseId)}`} tone="secondary">
                Xem đề nghị bố trí dịch vụ
              </ButtonLink>
            )}
            {canOpenStaffingReview && (
              <ButtonLink to="/admin/staffing-reviews" tone="secondary">
                Xét phương án nhân sự
              </ButtonLink>
            )}
          </div>
          <Field
            htmlFor={field}
            label={task.group === 'ASM' ? 'Kết quả hoặc nội dung cần bổ sung' : 'Ghi chú xác nhận hoặc lý do trả lại'}
          >
            <textarea
              id={field}
              rows={3}
              maxLength={2000}
              value={response}
              disabled={action.busy}
              onChange={event => setResponse(event.target.value)}
            />
          </Field>
          <div className={styles.actions}>
            <Button busy={action.busy} disabled={task.group === 'ASM' && !response.trim()} onClick={() => respond('COMPLETE')}>
              {task.group === 'ASM'
                ? task.staffingStatus === 'PENDING_ASM' ? 'Hoàn tất chương trình' : 'Gửi kết quả cho Quản lý lịch trình'
                : 'Xác nhận đáp ứng'}
            </Button>
            <Button tone="secondary" disabled={action.busy || !response.trim()} onClick={() => respond('RETURN')}>
              Yêu cầu bổ sung
            </Button>
          </div>
        </div>
      )}
      {action.error && (
        <Notice title="Chưa phản hồi được" tone="error">
          {action.error.message}
          {issues.length > 0 && <ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        </Notice>
      )}
    </Panel>
  )
}
