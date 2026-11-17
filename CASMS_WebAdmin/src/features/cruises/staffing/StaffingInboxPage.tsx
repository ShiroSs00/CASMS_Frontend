import { useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, DataTable, Empty, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { formatOperatingBudget } from '../api/preparation-api'
import { cruiseStaffApi } from '../api/cruise-staff-api'
import { CruiseStaffAssignments } from '../components/CruiseStaffAssignments'
import { CruiseFrame } from '../components/CruiseUI'
import { candidateStatusCopy, staffingApi, staffingError, staffingStatus, type StaffingRequest, type WorkPlan } from './staffing-api'
import styles from './Staffing.module.css'

const clock = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
function date(value: string) {
  return clock.format(new Date(value))
}

export function StaffingInboxPage() {
  return <StaffingInbox review={false} />
}

export function StaffingReviewInboxPage() {
  return <StaffingInbox review />
}

function StaffingInbox({ review }: { review: boolean }) {
  const access = useSessionAccess()
  const ship = access.roles.includes('SHIP_MANAGER') && access.has('CRUISE_PREPARATION_READ')
  const operations = access.roles.includes('OPERATIONS_MANAGER') && access.has('CRUISE_VALIDATE')
  const hr = !review
  const title = hr ? 'Phân công nhân sự' : 'Xét phương án nhân sự'
  const inbox = useReadQuery(`staffing-inbox:${access.userId}`, staffingApi.inbox)
  const [searchParams, setSearchParams] = useSearchParams()
  const [cruiseSearch, setCruiseSearch] = useState('')
  const [progressFilter, setProgressFilter] = useState<'ALL' | 'MISSING' | 'COVERED'>('ALL')
  const [statusFilter, setStatusFilter] = useState('')
  const [lastReviewedId, setLastReviewedId] = useState('')
  const selectedId = searchParams.get('requestId') ?? ''
  const items = (inbox.data ?? []).filter(request => hr ? request.status === 'SENT_TO_HR'
    : (ship && request.status === 'HR_SUBMITTED') || (operations && request.status === 'PLANNER_CONFIRMED'))

  function openRequest(id: string) {
    const next = new URLSearchParams(searchParams)
    if (id) next.set('requestId', id)
    else next.delete('requestId')
    setSearchParams(next)
  }

  if (selectedId) {
    const canOpen = !review || lastReviewedId === selectedId || items.some(item => item.id === selectedId)
    return (
      <CruiseFrame>
        <div className={styles.workspace}>
          <PageHeader
            breadcrumb=""
            title={title}
            actions={
              <Button tone="secondary" size="compact" onClick={() => openRequest('')}>
                Quay lại danh sách
              </Button>
            }
          />
          {canOpen ? (
            <StaffingDetail
              key={selectedId}
              requestId={selectedId}
              review={review}
              onChanged={() => {
                if (review) setLastReviewedId(selectedId)
                inbox.retry()
              }}
            />
          ) : inbox.loading ? (
            <Loading label="Đang kiểm tra yêu cầu nhân sự…" />
          ) : inbox.error ? (
            <Notice tone="error" title="Chưa tải được danh sách">
              <Button tone="secondary" onClick={inbox.retry}>Thử lại</Button>
            </Notice>
          ) : (
            <Empty title="Yêu cầu này không còn chờ bạn xử lý" />
          )}
        </div>
      </CruiseFrame>
    )
  }

  const normalizedQuery = cruiseSearch.trim().toLowerCase()
  const availableStatuses = [...new Set(items.map(item => item.status))]
  const filtered = items.filter(request => {
    const missing = request.requirements.reduce((sum, item) => sum + Math.max(0, item.required - item.assigned), 0)
    if (progressFilter === 'MISSING' && missing === 0) return false
    if (progressFilter === 'COVERED' && missing > 0) return false
    if (statusFilter && request.status !== statusFilter) return false
    if (!normalizedQuery) return true
    return request.cruiseName.toLowerCase().includes(normalizedQuery)
  })
  const hasFilters = Boolean(cruiseSearch.trim() || progressFilter !== 'ALL' || statusFilter)

  function resetFilters() {
    setCruiseSearch('')
    setProgressFilter('ALL')
    setStatusFilter('')
  }

  return (
    <CruiseFrame>
      <div className={styles.workspace}>
        <PageHeader
          breadcrumb=""
          title={title}
          actions={<Button tone="secondary" size="compact" onClick={inbox.retry}>Cập nhật</Button>}
        />
        <Panel title={hr ? 'Tour chờ phân công' : 'Phương án chờ xử lý'}>
          <section className={styles.filterBar} aria-label="Bộ lọc yêu cầu nhân sự">
            <Field htmlFor="staffing-cruise-search" label="Tìm kiếm chuyến tour">
              <input
                id="staffing-cruise-search"
                type="search"
                placeholder="Nhập tên chuyến…"
                value={cruiseSearch}
                onChange={event => setCruiseSearch(event.target.value)}
              />
            </Field>
            <Field htmlFor="staffing-progress-filter" label="Tiến độ nhân sự">
              <select
                id="staffing-progress-filter"
                value={progressFilter}
                onChange={event => setProgressFilter(event.target.value as 'ALL' | 'MISSING' | 'COVERED')}
              >
                <option value="ALL">Tất cả</option>
                <option value="MISSING">Còn thiếu nhân sự</option>
                <option value="COVERED">Đã đủ nhân sự</option>
              </select>
            </Field>
            <Field htmlFor="staffing-status-filter" label="Trạng thái">
              <select
                id="staffing-status-filter"
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
              >
                <option value="">Tất cả</option>
                {availableStatuses.map(status => (
                  <option key={status} value={status}>
                    {staffingStatus[status] ?? 'Chưa xác định'}
                  </option>
                ))}
              </select>
            </Field>
            <div className={styles.filterActions}>
              <Button tone="secondary" autoWidth disabled={!hasFilters} onClick={resetFilters}>
                Xóa bộ lọc
              </Button>
            </div>
          </section>

          {!inbox.loading && !inbox.error && (
            <div className={styles.resultsHead}>
              <span className={styles.resultCount}>
                Hiển thị {filtered.length} / {items.length} yêu cầu
              </span>
            </div>
          )}

          {inbox.loading ? (
            <Loading label="Đang tải danh sách yêu cầu nhân sự…" />
          ) : inbox.error ? (
            <Notice tone="error" title="Chưa tải được danh sách">{staffingError(inbox.error)}</Notice>
          ) : !items.length ? (
            <Empty title={hr ? 'Chưa có chuyến nào chờ phân công nhân sự' : 'Chưa có phương án nào chờ xác nhận'} />
          ) : !filtered.length ? (
            <Empty title="Không tìm thấy chuyến phù hợp với bộ lọc">
              <Button tone="secondary" size="compact" autoWidth onClick={resetFilters}>
                Xóa bộ lọc
              </Button>
            </Empty>
          ) : (
            <DataTable
              label="Danh sách yêu cầu nhân sự theo chuyến"
              headers={['Chuyến khởi hành', 'Thời gian chạy', 'Nhu cầu dịch vụ', 'Tiến độ', 'Trạng thái', 'Thao tác']}
            >
              {filtered.map(request => {
                const missing = request.requirements.reduce((sum, item) => sum + Math.max(0, item.required - item.assigned), 0)
                const servicesLabel = request.requirements.map(item => `${item.serviceName} (${item.assigned}/${item.required})`).join(', ')
                return (
                  <tr key={request.id}>
                    <td>
                      <span className={styles.tableCellTitle}>{request.cruiseName}</span>
                      <span className={styles.tableCellSub}>{request.cruiseCode}</span>
                    </td>
                    <td>
                      <span className={styles.tableCellSub}>{date(request.departure)} – {date(request.returning)}</span>
                    </td>
                    <td>{servicesLabel || '—'}</td>
                    <td>
                      <span className={missing > 0 ? styles.queueGap : styles.queueReady}>
                        {missing > 0 ? `Còn thiếu ${missing} vị trí` : 'Đã đủ người'}
                      </span>
                    </td>
                    <td>
                      <Badge
                        label={staffingStatus[request.status] ?? 'Trạng thái chưa xác định'}
                        tone={request.status === 'SENT_TO_HR' ? 'warning' : 'info'}
                      />
                    </td>
                    <td>
                      <Button
                        tone="secondary"
                        size="compact"
                        autoWidth
                        onClick={() => openRequest(request.id)}
                      >
                        {hr && request.status === 'SENT_TO_HR' ? 'Phân công' : 'Xem chi tiết'}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </DataTable>
          )}
        </Panel>
      </div>
    </CruiseFrame>
  )
}

function StaffingDetail({ requestId, onChanged, review }: { requestId: string; onChanged: () => void; review: boolean }) {
  const request = useReadQuery(
    'staffing-request:' + requestId,
    useCallback(signal => staffingApi.detail(requestId, signal), [requestId]),
  )
  if (request.loading) return <Panel><Loading label="Đang mở thông tin tour…" /></Panel>
  if (request.error || !request.data) {
    return (
      <Notice tone="error" title="Chưa mở được yêu cầu">
        {staffingError(request.error)} <Button tone="secondary" onClick={request.retry}>Thử lại</Button>
      </Notice>
    )
  }
  return <RequestView request={request.data} review={review} refresh={() => { request.retry(); onChanged() }} />
}

function RequestHeader({ request, tone }: { request: StaffingRequest; tone?: 'neutral' | 'success' | 'warning' | 'info' | 'error' }) {
  return (
    <div className={styles.requestHeader}>
      <div className={styles.requestTitleRow}>
        <h2>{request.cruiseName}</h2>
        <div role="status">
          <Badge label={staffingStatus[request.status] ?? 'Trạng thái chưa xác định'} tone={tone} />
        </div>
      </div>
      <div className={styles.metaStrip}>
        <span>{request.cruiseCode} · {date(request.departure)} – {date(request.returning)} (giờ Việt Nam)</span>
        {request.operatingBudgetVnd && (
          <span>
            Ngân sách vận hành: <strong className={styles.metaBudget}>{formatOperatingBudget(request.operatingBudgetVnd)}</strong>
          </span>
        )}
      </div>
      {request.returnReason && (
        <Notice tone="warning" title="Quản lý tàu yêu cầu bổ sung">{request.returnReason}</Notice>
      )}
    </div>
  )
}

function RequestView({ request, refresh, review }: { request: StaffingRequest; refresh: () => void; review: boolean }) {
  const access = useSessionAccess()
  if (!review && access.roles.includes('HR_MANAGER') && access.canDo('CRUISE_STAFF_ASSIGN') &&
      ['SENT_TO_HR', 'HR_SUBMITTED'].includes(request.status)) {
    return <Assignments request={request} refresh={refresh} />
  }
  if (!review) return <RequestHeader request={request} />
  return <StaffingReview request={request} refresh={refresh} />
}

function StaffingReview({ request, refresh }: { request: StaffingRequest; refresh: () => void }) {
  const access = useSessionAccess()
  const [reason, setReason] = useState('')
  const [returning, setReturning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const ship = request.status === 'HR_SUBMITTED' && access.roles.includes('SHIP_MANAGER') && access.has('CRUISE_PREPARATION_READ')
  const ops = request.status === 'PLANNER_CONFIRMED' && access.roles.includes('OPERATIONS_MANAGER') && access.has('CRUISE_VALIDATE')

  async function review(action: 'SHIP_CONFIRMED' | 'RETURNED' | 'OPS_APPROVED') {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await staffingApi.transition(request, action, reason.trim() || undefined)
      refresh()
    } catch (cause) {
      setError(staffingError(cause))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <Panel>
      <div className={styles.section}>
        <RequestHeader request={request} tone="info" />
        <ul className={styles.rows}>
          {request.requirements.map(item => (
            <li className={styles.row} key={item.serviceId}>
              <strong>{item.serviceName}</strong>
              <span>{item.assigned}/{item.required} đã bố trí</span>
            </li>
          ))}
        </ul>
        {error && <Notice tone="error" title="Chưa xử lý được phương án">{error}</Notice>}
        {returning && (
          <Field htmlFor="staffing-return-reason" label="Điều cần bổ sung">
            <textarea id="staffing-return-reason" value={reason} disabled={busy} onChange={event => setReason(event.target.value)} />
          </Field>
        )}
        <div className={styles.actions}>
          {ship && !returning && (
            <>
              <Button busy={busy} onClick={() => void review('SHIP_CONFIRMED')}>Xác nhận phương án</Button>
              <Button tone="secondary" disabled={busy} onClick={() => setReturning(true)}>Yêu cầu bổ sung</Button>
            </>
          )}
          {ship && returning && (
            <>
              <Button busy={busy} disabled={!reason.trim()} onClick={() => void review('RETURNED')}>Gửi yêu cầu bổ sung</Button>
              <Button tone="secondary" disabled={busy} onClick={() => setReturning(false)}>Hủy</Button>
            </>
          )}
          {ops && <Button busy={busy} onClick={() => void review('OPS_APPROVED')}>Duyệt phương án nhân sự</Button>}
        </div>
      </div>
    </Panel>
  )
}

function useStaffCandidates(cruiseId: string, kind: WorkPlan['windows'][number]['kind'] | undefined, resourceId: string | undefined) {
  return useReadQuery(
    `staffing-candidates:${cruiseId}:${kind}:${resourceId}`,
    useCallback(
      signal => (kind && resourceId ? staffingApi.candidates(cruiseId, kind, resourceId, signal) : Promise.resolve([])),
      [cruiseId, kind, resourceId],
    ),
  )
}

function Assignments({ request, refresh }: { request: StaffingRequest; refresh: () => void }) {
  const access = useSessionAccess()
  const { cruiseId } = request
  const plan = useReadQuery('staffing-work:' + cruiseId, useCallback(signal => staffingApi.workPlan(cruiseId, signal), [cruiseId]))
  const optionsQuery = useReadQuery(
    `staffing-cruise-options:${cruiseId}`,
    useCallback(signal => cruiseStaffApi.options(cruiseId, signal), [cruiseId]),
  )
  const firstOpenService = request.requirements.find(item => item.assigned < item.required)?.serviceId ?? request.requirements[0]?.serviceId ?? ''
  const [selectedTarget, setSelectedTarget] = useState('')
  const [staffSearch, setStaffSearch] = useState('')
  const [staffStatusFilter, setStaffStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'EXTERNAL' | 'BLOCKED'>('ALL')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)

  const editable = request.status === 'SENT_TO_HR'
  const target = selectedTarget || firstOpenService
  const requirement = request.requirements.find(item => item.serviceId === target)
  const shift = plan.data?.windows.find(item => item.windowId === target && (item.kind === 'ONBOARD' || item.kind === 'SHORE'))
  const candidateQuery = useStaffCandidates(cruiseId, requirement ? 'SERVICE' : shift?.kind, requirement?.serviceId ?? shift?.resourceId)
  const candidates = candidateQuery.data ?? []
  const externalOnboardStaff = (optionsQuery.data?.users ?? []).filter(
    person => person.allowedRoles.includes('ONBOARD_STAFF') && !candidates.some(c => c.userId === person.userId),
  )

  const missingServices = request.requirements.filter(item => item.assigned < item.required)
  const covered = request.requirements.length > 0 && missingServices.length === 0

  const normalizedStaffQuery = staffSearch.trim().toLowerCase()
  const matchesStaffSearch = (username: string) => !normalizedStaffQuery || username.toLowerCase().includes(normalizedStaffQuery)
  const visibleCandidates = candidates.filter(person => {
    if (!matchesStaffSearch(person.username)) return false
    if (staffStatusFilter === 'EXTERNAL') return false
    if (staffStatusFilter === 'AVAILABLE') return person.status === 'AVAILABLE'
    if (staffStatusFilter === 'BLOCKED') return person.status !== 'AVAILABLE'
    return true
  })
  const visibleExternalOnboard = staffStatusFilter === 'AVAILABLE' || staffStatusFilter === 'BLOCKED'
    ? []
    : externalOnboardStaff.filter(person => matchesStaffSearch(person.username))
  const hasStaffFilter = Boolean(staffSearch.trim() || staffStatusFilter !== 'ALL')
  const availableCount = candidates.filter(person => person.status === 'AVAILABLE').length

  async function run(operation: () => Promise<unknown>) {
    if (lock.current || !editable) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await operation()
      candidateQuery.retry()
      optionsQuery.retry()
      plan.retry()
      refresh()
    } catch (cause) {
      setError(staffingError(cause))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  async function allowShiftDuty(userId: string) {
    if (lock.current || !editable || !shift || (shift.kind !== 'ONBOARD' && shift.kind !== 'SHORE')) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await staffingApi.grantQualification(userId, shift.kind, shift.definitionId)
      candidateQuery.retry()
    } catch (cause) {
      setError(staffingError(cause))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  async function addOnboardToCruise(userId: string) {
    await run(() => cruiseStaffApi.assign(cruiseId, { userId, roleInCruise: 'ONBOARD_STAFF', notes: '' }))
  }

  const shifts = (plan.data?.windows ?? []).filter(w => w.kind === 'ONBOARD' || w.kind === 'SHORE')

  return (
    <div className={styles.stack}>
      <Panel>
        <div className={styles.section}>
          <RequestHeader request={request} tone={editable ? 'warning' : 'success'} />

          {editable && (
            <div className={styles.assignGrid}>
              {/* Left column inside cruise: Services & Shifts to staff */}
              <div className={styles.section}>
                <div className={styles.sectionHeadingRow}>
                  <h3>1. Chọn dịch vụ / ca cần xếp</h3>
                </div>
                <ul className={styles.targetList}>
                  {request.requirements.map(item => {
                    const gap = Math.max(0, item.required - item.assigned)
                    const active = target === item.serviceId
                    return (
                      <li key={item.serviceId}>
                        <button
                          type="button"
                          className={styles.targetButton}
                          aria-pressed={active}
                          onClick={() => {
                            setSelectedTarget(item.serviceId)
                            setError('')
                          }}
                        >
                          <div className={styles.rowMain}>
                            <strong>{item.serviceName}</strong>
                            <small className={styles.subtle}>{item.assigned}/{item.required} đã bố trí</small>
                          </div>
                          <Badge label={gap > 0 ? `Thiếu ${gap}` : 'Đủ người'} tone={gap > 0 ? 'warning' : 'success'} />
                        </button>
                      </li>
                    )
                  })}
                </ul>

                {shifts.length > 0 && (
                  <>
                    <div className={styles.sectionHeadingRow}>
                      <h3>Ca hoạt động / tour bờ</h3>
                    </div>
                    <ul className={styles.targetList}>
                      {shifts.map(window => {
                        const active = target === window.windowId
                        return (
                          <li key={window.windowId}>
                            <button
                              type="button"
                              className={styles.targetButton}
                              aria-pressed={active}
                              onClick={() => {
                                setSelectedTarget(window.windowId)
                                setError('')
                              }}
                            >
                              <div className={styles.rowMain}>
                                <strong>{window.name}</strong>
                                <small className={styles.subtle}>{date(window.startsAt)} – {date(window.endsAt)}</small>
                              </div>
                              <Badge label={`${window.userIds.length} đã phân ca`} tone="neutral" />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </div>

              {/* Right column inside cruise: Search & assign staff */}
              <div className={styles.inlineAssign}>
                <div className={styles.inlineAssignHeader}>
                  <strong>2. Tìm và phân công cho: {requirement?.serviceName ?? shift?.name ?? '—'}</strong>
                </div>
                <p className={styles.requirementRule}>
                  {requirement
                    ? 'Chỉ nhân viên có vai trò Nhân viên phục vụ trên tàu (Onboard Staff) của chuyến mới xếp được vào dịch vụ này.'
                    : shift
                      ? `Chọn Nhân viên phục vụ trên tàu trống lịch ${date(shift.startsAt)} – ${date(shift.endsAt)}. Nếu chưa đánh dấu phụ trách, bấm "Cho phép phụ trách".`
                      : ''}
                </p>

                <div className={styles.candidateFilterBar}>
                  <Field htmlFor="staffing-candidate-search" label="Tìm kiếm nhân viên">
                    <input
                      id="staffing-candidate-search"
                      type="search"
                      placeholder="Nhập tên tài khoản nhân viên…"
                      value={staffSearch}
                      onChange={event => setStaffSearch(event.target.value)}
                    />
                  </Field>
                  <Field htmlFor="staffing-candidate-filter" label="Lọc trạng thái">
                    <select
                      id="staffing-candidate-filter"
                      value={staffStatusFilter}
                      onChange={event => setStaffStatusFilter(event.target.value as 'ALL' | 'AVAILABLE' | 'EXTERNAL' | 'BLOCKED')}
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="AVAILABLE">Sẵn sàng phân công</option>
                      <option value="EXTERNAL">Chưa vào chuyến</option>
                      <option value="BLOCKED">Chưa đủ điều kiện</option>
                    </select>
                  </Field>
                  <div className={styles.filterActions}>
                    <Button
                      tone="secondary"
                      autoWidth
                      disabled={!hasStaffFilter}
                      onClick={() => {
                        setStaffSearch('')
                        setStaffStatusFilter('ALL')
                      }}
                    >
                      Xóa lọc
                    </Button>
                  </div>
                </div>

                {error && (
                  <Notice tone="error" title="Chưa hoàn tất" role="alert">
                    {error} <Button tone="text" size="compact" onClick={refresh}>Tải lại</Button>
                  </Notice>
                )}

                {candidateQuery.loading ? (
                  <Loading label="Đang tải danh sách nhân viên…" />
                ) : candidateQuery.error ? (
                  <Notice tone="error" title="Chưa tải được danh sách nhân viên">
                    <Button tone="secondary" size="compact" onClick={candidateQuery.retry}>Thử lại</Button>
                  </Notice>
                ) : (
                  <>
                    {visibleCandidates.length > 0 && (
                      <ul className={styles.candidateList} aria-label="Nhân viên trên chuyến">
                        {visibleCandidates.map(person => {
                          const canAssignNow = person.status === 'AVAILABLE'
                          const canAllowShift = person.status === 'MISSING_QUALIFICATION' && shift && (shift.kind === 'ONBOARD' || shift.kind === 'SHORE')
                          const reasonLabel = canAssignNow
                            ? 'Sẵn sàng phân công'
                            : person.status === 'MISSING_QUALIFICATION' && shift
                              ? `Chưa đánh dấu phụ trách "${shift.name}"`
                              : person.status === 'ALREADY_ASSIGNED' && requirement
                                ? 'Đang phụ trách dịch vụ trên chuyến'
                                : candidateStatusCopy[person.status]
                          return (
                            <li key={person.userId} className={styles.candidateItem}>
                              <div className={styles.candidateInfo}>
                                <strong>{person.username}</strong>
                                <small>{reasonLabel}</small>
                              </div>
                              {canAssignNow ? (
                                <Button
                                  tone="primary"
                                  size="compact"
                                  autoWidth
                                  disabled={busy}
                                  onClick={() => {
                                    if (requirement) void run(() => staffingApi.assignService(cruiseId, person.userId, requirement.serviceId))
                                    else if (shift && (shift.kind === 'ONBOARD' || shift.kind === 'SHORE')) {
                                      const kind = shift.kind
                                      void run(() => staffingApi.assignShift(cruiseId, person.userId, kind, shift.resourceId))
                                    }
                                  }}
                                >
                                  {requirement ? 'Phân công' : 'Phân ca'}
                                </Button>
                              ) : canAllowShift ? (
                                <Button
                                  tone="secondary"
                                  size="compact"
                                  autoWidth
                                  disabled={busy}
                                  onClick={() => void allowShiftDuty(person.userId)}
                                >
                                  Cho phép phụ trách
                                </Button>
                              ) : (
                                <Badge label={candidateStatusCopy[person.status]} tone="neutral" />
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}

                    {visibleExternalOnboard.length > 0 && (
                      <>
                        <div className={styles.sectionHeadingRow}>
                          <h3>Nhân viên phục vụ trên tàu chưa vào chuyến ({visibleExternalOnboard.length})</h3>
                        </div>
                        <ul className={styles.candidateList} aria-label="Nhân viên chưa vào chuyến">
                          {visibleExternalOnboard.map(person => (
                            <li key={person.userId} className={styles.candidateItem}>
                              <div className={styles.candidateInfo}>
                                <strong>{person.username}</strong>
                                <small>Nhân viên phục vụ trên tàu · Chưa gán vào chuyến</small>
                              </div>
                              <Button
                                tone="secondary"
                                size="compact"
                                autoWidth
                                disabled={busy}
                                onClick={() => void addOnboardToCruise(person.userId)}
                              >
                                Thêm vào chuyến
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {availableCount === 0 && externalOnboardStaff.length === 0 && (
                      <Notice tone="info" title="Chưa có thêm Nhân viên phục vụ trên tàu khả dụng">
                        <p>
                          Hiện trong hệ thống không còn tài khoản role Nhân viên phục vụ trên tàu (Onboard Staff) nào khác chưa được bố trí. Tạo thêm tài khoản có role Nhân viên phục vụ trên tàu để đủ người xếp vào chuyến.
                        </p>
                        {access.canDo('USER_READ') && (
                          <div style={{ marginTop: '8px' }}>
                            <ButtonLink to="/admin/system" tone="secondary" size="compact" autoWidth>
                              Mở Tài khoản nhân sự
                            </ButtonLink>
                          </div>
                        )}
                      </Notice>
                    )}

                    {hasStaffFilter && visibleCandidates.length === 0 && visibleExternalOnboard.length === 0 && (
                      <Empty title="Không có nhân viên nào khớp bộ lọc hiện tại">
                        <Button
                          tone="secondary"
                          size="compact"
                          autoWidth
                          onClick={() => {
                            setStaffSearch('')
                            setStaffStatusFilter('ALL')
                          }}
                        >
                          Xóa lọc
                        </Button>
                      </Empty>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {editable && (
            <div className={styles.actions}>
              <Button
                busy={busy}
                disabled={!covered}
                onClick={() => void run(() => staffingApi.transition(request, 'HR_SUBMITTED'))}
              >
                Gửi phương án
              </Button>
              {!covered && (
                <span className={styles.subtle}>
                  Cần bố trí thêm {missingServices.map(s => `${s.required - s.assigned} người cho ${s.serviceName}`).join(', ')} trước khi gửi.
                </span>
              )}
            </div>
          )}
        </div>
      </Panel>

      {editable && (
        <Panel title="Nhân sự đã phân công vào chuyến">
          <CruiseStaffAssignments
            cruiseId={cruiseId}
            embedded
            onChanged={() => {
              candidateQuery.retry()
              optionsQuery.retry()
              plan.retry()
            }}
          />
        </Panel>
      )}
    </div>
  )
}
