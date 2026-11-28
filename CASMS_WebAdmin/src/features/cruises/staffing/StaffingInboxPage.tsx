import { useCallback, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, DataTable, Empty, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { formatOperatingBudget } from '../api/preparation-api'
import { cruiseStaffApi } from '../api/cruise-staff-api'
import { CruiseStaffAssignments } from '../components/CruiseStaffAssignments'
import { CruiseFrame } from '../components/CruiseUI'
import { PreparationEvidence } from '../components/PreparationEvidence'
import { candidateStatusCopy, positionLabels, staffingApi, staffingError, staffingMissing, staffingStageGuidance, staffingStatusLabel, type StaffingAction, type StaffingRequest, type WorkPlan } from './staffing-api'
import { StaffingV2 } from './StaffingV2'
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
  const canAssignShipManager = hr && access.roles.includes('HR_MANAGER') && access.canDo('CRUISE_STAFF_ASSIGN')
  const inbox = useReadQuery(`staffing-inbox:${access.userId}`, staffingApi.inbox)
  const pipeline = useReadQuery(`staffing-pipeline:${access.userId}`, staffingApi.pipeline)
  const loadShipManagerQueue = useCallback(
    (signal: AbortSignal) => (canAssignShipManager ? staffingApi.cruisesWithoutShipManager(signal) : Promise.resolve([])),
    [canAssignShipManager],
  )
  const shipManagerQueue = useReadQuery(
    `ship-manager-needed:${canAssignShipManager ? access.userId : 'none'}`,
    loadShipManagerQueue,
  )
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [manualTab, setManualTab] = useState<'ship_manager' | 'actionable' | 'tracking' | null>(() =>
    location.hash === '#ship-manager-assign' ? 'ship_manager' : null,
  )
  const [shipManagerSaved, setShipManagerSaved] = useState('')
  const [cruiseSearch, setCruiseSearch] = useState('')
  const [progressFilter, setProgressFilter] = useState<'ALL' | 'MISSING' | 'COVERED'>('ALL')
  const [statusFilter, setStatusFilter] = useState('')
  const [lastReviewedId, setLastReviewedId] = useState('')
  const selectedId = searchParams.get('requestId') ?? ''
  const items = (inbox.data ?? []).filter(request => hr ? (
    request.status === 'SENT_TO_HR' || (request.workflowVersion !== 'V2' && request.shipReviewWorkflow && request.status === 'SHIP_CONFIRMED')
  ) : (ship && (request.status === 'PENDING_SHIP_REVIEW' || request.status === 'HR_SUBMITTED'))
    || (operations && (request.status === 'PLANNER_CONFIRMED' || request.status === 'HR_APPROVED')))
  const actionableIds = new Set(items.map(item => item.id))
  const trackingItems = (pipeline.data ?? []).filter(request => {
    if (actionableIds.has(request.id)) return false
    if (!hr && ship && !operations && request.status === 'PENDING_ASM') return false
    return true
  })
  const shipManagerItems = shipManagerQueue.data ?? []
  const defaultTab: 'ship_manager' | 'actionable' | 'tracking' = canAssignShipManager && items.length === 0 && shipManagerItems.length > 0
    ? 'ship_manager'
    : 'actionable'
  const tabParam = searchParams.get('tab')
  const urlTab: 'ship_manager' | 'actionable' | 'tracking' | null =
    tabParam === 'ship-manager' && canAssignShipManager ? 'ship_manager'
      : tabParam === 'assign' ? 'actionable'
        : tabParam === 'tracking' ? 'tracking'
          : null
  const activeTab: 'ship_manager' | 'actionable' | 'tracking' = urlTab ?? manualTab ?? defaultTab
  const isSingleListShip = ship && !hr && !operations
  const visiblePool = isSingleListShip
    ? [...items, ...trackingItems]
    : activeTab === 'actionable' ? items : trackingItems
  const selectedRequest = items.find(item => item.id === selectedId)
  const shipWorkspace = !hr && ship && (!operations || selectedRequest?.status === 'PENDING_SHIP_REVIEW'
    || selectedRequest?.status === 'HR_SUBMITTED')
  const hrSubtaskTitle = activeTab === 'ship_manager'
    ? 'Gắn Quản lý tàu'
    : activeTab === 'tracking'
      ? 'Theo dõi tiến độ'
      : 'Phân công nhân viên'
  const title = hr ? (canAssignShipManager ? hrSubtaskTitle : 'Phân công nhân sự') : shipWorkspace ? 'Phương án khu vực & nhân sự'
    : ship && operations && !selectedId ? 'Phương án tàu và nhân sự' : 'Duyệt phương án nhân sự'

  function refreshAll() {
    inbox.retry()
    pipeline.retry()
    if (canAssignShipManager) shipManagerQueue.retry()
  }

  function openRequest(id: string) {
    const next = new URLSearchParams(searchParams)
    if (id) next.set('requestId', id)
    else next.delete('requestId')
    setSearchParams(next)
  }

  if (selectedId) {
    const inInbox = items.some(item => item.id === selectedId)
    const inTracking = trackingItems.some(item => item.id === selectedId)
    const canOpen = lastReviewedId === selectedId || inInbox || inTracking
    const readOnlyMode = !inInbox && inTracking
    return (
      <CruiseFrame>
        <div className={styles.workspace}>
          <div className={styles.detailHeader}><PageHeader
            breadcrumb=""
            title={title}
            actions={
              <Button tone="secondary" size="compact" autoWidth onClick={() => openRequest('')}>
                Quay lại danh sách
              </Button>
            }
          /></div>
          {canOpen ? (
            <StaffingDetail
              key={selectedId}
              requestId={selectedId}
              review={review}
              readOnly={readOnlyMode}
              onCompleted={() => { openRequest(''); refreshAll() }}
              onChanged={() => {
                setLastReviewedId(selectedId)
                refreshAll()
              }}
            />
          ) : inbox.loading || pipeline.loading ? (
            <Loading label="Đang kiểm tra yêu cầu nhân sự…" />
          ) : inbox.error ? (
            <Notice tone="error" title="Chưa tải được danh sách">
              <Button tone="secondary" onClick={inbox.retry}>Thử lại</Button>
            </Notice>
          ) : (
            <Notice tone="warning" title="Yêu cầu này chưa đến bước bạn xử lý">
              <p>{hr ? 'Phương án nhân sự chỉ hiển thị cho Quản lý nhân sự sau khi Quản lý tàu và Quản lý lịch trình chuyển bước phân công.' : 'Yêu cầu này hiện không còn nằm trong hàng chờ xử lý của bạn.'}</p>
              <Button tone="secondary" size="compact" autoWidth onClick={() => openRequest('')}>Quay lại danh sách</Button>
            </Notice>
          )}
        </div>
      </CruiseFrame>
    )
  }

  const normalizedQuery = cruiseSearch.trim().toLowerCase()
  const availableStatuses = [...new Set(visiblePool.map(item => item.status))]
  const filtered = visiblePool.filter(request => {
    const missing = staffingMissing(request)
    if (!isSingleListShip && activeTab === 'actionable' && progressFilter === 'MISSING' && missing === 0) return false
    if (!isSingleListShip && activeTab === 'actionable' && progressFilter === 'COVERED' && missing > 0) return false
    if (statusFilter && request.status !== statusFilter) return false
    if (!normalizedQuery) return true
    return request.cruiseName.toLowerCase().includes(normalizedQuery) || request.cruiseCode.toLowerCase().includes(normalizedQuery)
  }).sort((a, b) => {
    if (isSingleListShip) {
      const aPending = actionableIds.has(a.id) ? 0 : 1
      const bPending = actionableIds.has(b.id) ? 0 : 1
      if (aPending !== bPending) return aPending - bPending
    }
    return (Date.parse(b.departure) || 0) - (Date.parse(a.departure) || 0) || b.cruiseCode.localeCompare(a.cruiseCode, 'vi', { numeric: true })
  })
  const hasFilters = Boolean(cruiseSearch.trim() || (activeTab === 'actionable' && progressFilter !== 'ALL') || statusFilter)
  const pipelineByCruiseId = new Map((pipeline.data ?? []).map(item => [item.cruiseId, item]))
  const visibleTabs: ('ship_manager' | 'actionable' | 'tracking')[] = canAssignShipManager
    ? ['ship_manager', 'actionable', 'tracking']
    : ['actionable', 'tracking']

  function resetFilters() {
    setCruiseSearch('')
    setProgressFilter('ALL')
    setStatusFilter('')
  }

  function switchTab(next: 'ship_manager' | 'actionable' | 'tracking') {
    setManualTab(next)
    setStatusFilter('')
    setProgressFilter('ALL')
    if (canAssignShipManager) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('tab', next === 'ship_manager' ? 'ship-manager' : next === 'tracking' ? 'tracking' : 'assign')
      setSearchParams(nextParams)
    }
  }

  return (
    <CruiseFrame>
      <div className={styles.workspace}>
        <div className={styles.stack}>
          <PageHeader
            breadcrumb={hr ? 'Quản lý nhân sự / Phân công nhân sự' : ship ? 'Phối hợp & duyệt chuyến' : 'Quản lý vận hành'}
            title={hr ? title : shipWorkspace ? 'Khu vực & nhân sự' : title}
            description=""
            actions={
              <Button tone="secondary" size="compact" autoWidth onClick={refreshAll}>Làm mới</Button>
            }
          />
          <Panel title={hr || shipWorkspace ? undefined : ship && operations ? 'Yêu cầu chờ xử lý' : 'Phương án nhân sự chờ duyệt'}>
            {!isSingleListShip && !canAssignShipManager && (
              <div
                className={styles.tourChipBar}
                role="tablist"
                aria-label="Phân loại công việc nhân sự"
                onKeyDown={event => {
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault()
                    const currentIndex = visibleTabs.indexOf(activeTab)
                    const delta = event.key === 'ArrowRight' ? 1 : -1
                    const nextIndex = (currentIndex + delta + visibleTabs.length) % visibleTabs.length
                    switchTab(visibleTabs[nextIndex])
                  }
                }}
              >
                {canAssignShipManager && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'ship_manager'}
                    tabIndex={activeTab === 'ship_manager' ? 0 : -1}
                    className={styles.tourChip}
                    onClick={() => switchTab('ship_manager')}
                  >
                    <span>Gắn Quản lý tàu</span>
                    <span className={styles.tourChipCount}>{shipManagerItems.length}</span>
                  </button>
                )}
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'actionable'}
                  tabIndex={activeTab === 'actionable' ? 0 : -1}
                  className={styles.tourChip}
                  onClick={() => switchTab('actionable')}
                >
                  <span>{hr ? 'Phân công nhân viên' : 'Chờ xác nhận'}</span>
                  <span className={styles.tourChipCount}>{items.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'tracking'}
                  tabIndex={activeTab === 'tracking' ? 0 : -1}
                  className={styles.tourChip}
                  onClick={() => switchTab('tracking')}
                >
                  <span>{hr ? 'Theo dõi tiến độ' : 'Đã xử lý'}</span>
                  <span className={styles.tourChipCount}>{trackingItems.length}</span>
                </button>
              </div>
            )}

            {activeTab === 'ship_manager' ? (
              <div className={styles.section}>
                {shipManagerSaved && (
                  <Notice tone="success" title="Đã gắn Quản lý tàu">
                    {shipManagerSaved}
                  </Notice>
                )}
                {shipManagerQueue.loading ? (
                  <Loading label="Đang tải danh sách chuyến chưa có Quản lý tàu…" />
                ) : shipManagerQueue.error ? (
                  <Notice tone="error" title="Chưa tải được danh sách chuyến">
                    <p>{staffingError(shipManagerQueue.error)}</p>
                    <Button tone="secondary" size="compact" autoWidth onClick={shipManagerQueue.retry}>Thử lại</Button>
                  </Notice>
                ) : !shipManagerItems.length ? (
                  <Empty title="Tất cả chuyến đã có Quản lý tàu phụ trách">
                    <p>Khi có chuyến khởi hành mới chưa gắn Quản lý tàu, chuyến sẽ xuất hiện tại đây để bạn chỉ định người phụ trách.</p>
                    {items.length > 0 ? (
                      <Button tone="secondary" size="compact" autoWidth onClick={() => switchTab('actionable')}>
                        Chuyển sang Phân công nhân viên ({items.length})
                      </Button>
                    ) : trackingItems.length > 0 ? (
                      <Button tone="secondary" size="compact" autoWidth onClick={() => switchTab('tracking')}>
                        Xem tiến độ {trackingItems.length} chuyến đang chuẩn bị
                      </Button>
                    ) : null}
                  </Empty>
                ) : (
                  <DataTable
                    label="Chuyến khởi hành cần gắn Quản lý tàu"
                    headers={['Chuyến khởi hành', 'Thời gian chạy', 'Quản lý tàu phụ trách', 'Thao tác']}
                  >
                    {shipManagerItems.map(cruise => {
                      const match = pipelineByCruiseId.get(cruise.cruiseId)
                      return (
                        <ShipManagerRow
                          key={cruise.cruiseId}
                          cruise={cruise}
                          scheduleLabel={match ? `${date(match.departure)} – ${date(match.returning)}` : '—'}
                          onAssigned={() => {
                            setShipManagerSaved(`${cruise.cruiseCode} · ${cruise.cruiseName}`)
                            refreshAll()
                          }}
                        />
                      )
                    })}
                  </DataTable>
                )}
              </div>
            ) : (
              <>
                {visiblePool.length > 0 && (
                  <>
                    <section className={styles.filterBar} aria-label="Bộ lọc yêu cầu nhân sự">
                      <Field htmlFor="staffing-cruise-search" label="Tìm kiếm chuyến khởi hành">
                        <input
                          id="staffing-cruise-search"
                          type="search"
                          placeholder="Tên hoặc mã chuyến…"
                          value={cruiseSearch}
                          onChange={event => setCruiseSearch(event.target.value)}
                        />
                      </Field>
                      {!isSingleListShip && activeTab === 'actionable' && (
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
                      )}
                      <Field htmlFor="staffing-status-filter" label="Trạng thái">
                        <select
                          id="staffing-status-filter"
                          value={statusFilter}
                          onChange={event => setStatusFilter(event.target.value)}
                        >
                          <option value="">Tất cả</option>
                          {availableStatuses.map(status => (
                            <option key={status} value={status}>
                              {staffingStatusLabel(visiblePool.find(item => item.status === status)!)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {hasFilters && (
                        <div className={styles.filterActions}>
                          <Button tone="secondary" autoWidth onClick={resetFilters}>
                            Xóa lọc
                          </Button>
                        </div>
                      )}
                    </section>

                    {!(activeTab === 'actionable' ? inbox.loading : pipeline.loading) && !(activeTab === 'actionable' ? inbox.error : pipeline.error) && (
                      <div className={styles.resultsHead}>
                        <span className={styles.resultCount}>
                          Hiển thị {filtered.length} / {visiblePool.length} chuyến
                        </span>
                      </div>
                    )}
                  </>
                )}

                {(activeTab === 'actionable' ? inbox.loading : pipeline.loading) ? (
                  <Loading label="Đang tải danh sách yêu cầu nhân sự…" />
                ) : (activeTab === 'actionable' ? inbox.error : pipeline.error) ? (
                  <Notice tone="error" title="Chưa tải được danh sách">
                    <p>{staffingError(activeTab === 'actionable' ? inbox.error : pipeline.error)}</p>
                    <Button tone="secondary" size="compact" autoWidth onClick={refreshAll}>Thử lại</Button>
                  </Notice>
                ) : !visiblePool.length ? (
                  <Empty title={activeTab === 'tracking' ? (hr ? 'Chưa có chuyến nào trong quy trình nhân sự' : 'Chưa có phương án nào đã xử lý') : hr ? 'Chưa có chuyến nào tới bước phân công nhân viên' : 'Chưa có phương án nhân sự nào chờ xác nhận'}>
                    <p>
                      {activeTab === 'tracking'
                        ? (hr
                          ? 'Khi Quản lý lịch trình khởi tạo yêu cầu chuẩn bị nhân sự cho chuyến khởi hành, tiến độ từng bước sẽ hiển thị tại đây.'
                          : 'Các phương án bạn đã xác nhận hoặc trả bổ sung sẽ được lưu tại đây để tra cứu lại.')
                        : hr
                          ? 'Chuyến chuyển vào hàng chờ này sau khi Quản lý dịch vụ hoàn tất chương trình, Quản lý tàu lập phương án khu vực phục vụ và Quản lý lịch trình chuyển sang Quản lý nhân sự.'
                          : ship
                            ? 'Chuyến thuộc tàu bạn phụ trách sẽ xuất hiện tại đây để xác định nhu cầu nhân sự theo khu vực, gửi Quản lý nhân sự phân công và xác nhận phương án trước khi chuyển Quản lý lịch trình.'
                            : 'Chưa có phương án nhân sự nào từ các bộ phận gửi lên chờ phê duyệt.'}
                    </p>
                    {!isSingleListShip && activeTab === 'actionable' && trackingItems.length > 0 && (
                      <Button tone="secondary" size="compact" autoWidth onClick={() => switchTab('tracking')}>
                        Xem tiến độ {trackingItems.length} chuyến ở các bước khác
                      </Button>
                    )}
                  </Empty>
                ) : !filtered.length ? (
                  <Empty title="Không tìm thấy chuyến phù hợp với bộ lọc">
                    <Button tone="secondary" size="compact" autoWidth onClick={resetFilters}>
                      Xóa bộ lọc
                    </Button>
                  </Empty>
                ) : activeTab === 'tracking' ? (
                  <DataTable
                    label="Tiến độ yêu cầu nhân sự các chuyến"
                    headers={['Chuyến khởi hành', 'Thời gian chạy', 'Trạng thái hiện tại', 'Tiến độ quy trình', 'Thao tác']}
                  >
                    {filtered.map(request => {
                      const canViewReadOnly = (hr && ['SENT_TO_HR', 'HR_SUBMITTED', 'SHIP_CONFIRMED', 'PLANNER_CONFIRMED', 'OPS_APPROVED'].includes(request.status))
                        || (operations && ['PLANNER_CONFIRMED', 'OPS_APPROVED'].includes(request.status))
                      return (
                        <tr key={request.id}>
                          <td>
                            <span className={styles.tableCellTitle}>{request.cruiseName}</span>
                            <span className={styles.tableCellSub}>{request.cruiseCode}</span>
                          </td>
                          <td>
                            <span className={styles.tableCellSub}>{date(request.departure)} – {date(request.returning)}</span>
                          </td>
                          <td>
                            <Badge
                              label={staffingStatusLabel(request)}
                              tone={request.status === 'OPS_APPROVED' ? 'success' : request.status === 'RETURNED' ? 'warning' : 'info'}
                            />
                          </td>
                          <td>
                            <span className={styles.tableCellSub}>{staffingStageGuidance(request)}</span>
                          </td>
                          <td>
                            {canViewReadOnly ? (
                              <Button
                                tone="secondary"
                                size="compact"
                                autoWidth
                                className={styles.tableActionBtn}
                                onClick={() => openRequest(request.id)}
                              >
                                Xem chi tiết
                              </Button>
                            ) : <span className={styles.tableCellSub}>Chưa đến bước</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </DataTable>
                ) : (
                  <DataTable
                    label="Danh sách yêu cầu nhân sự theo chuyến"
                    headers={['Chuyến khởi hành', 'Thời gian chạy', 'Nhu cầu nhân sự', 'Tiến độ', 'Trạng thái', 'Thao tác']}
                  >
                    {filtered.map(request => {
                      const missing = staffingMissing(request)
                      const servicesLabel = request.workflowVersion === 'V2' ? [
                        ...(request.serviceNeeds ?? []).map(item => `${item.serviceName} (${item.assignedUserIds.length}/${item.requiredCount})`),
                        ...(request.needs ?? []).map(need => `${need.areaName} · ${positionLabels[need.positionCode] ?? need.positionCode} (${need.assignedUserIds.length}/${need.requiredCount})`),
                      ].join(', ')
                        : request.requirements.map(item => `${item.serviceName} (${item.assigned}/${item.required})`).join(', ')
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
                              {request.status === 'PENDING_SHIP_REVIEW' ? 'Chờ xác nhận nhu cầu'
                                : missing > 0 ? `Còn thiếu ${missing} người` : request.workflowVersion === 'V2' ? 'Đủ theo nhu cầu khu vực' : 'Đủ dịch vụ · Kiểm tra thêm phân ca'}
                            </span>
                          </td>
                          <td>
                            <Badge
                              label={staffingStatusLabel(request)}
                              tone={request.status === 'SENT_TO_HR' ? 'warning' : 'info'}
                            />
                          </td>
                          <td>
                            <Button
                              tone={isSingleListShip && actionableIds.has(request.id) ? 'primary' : 'secondary'}
                              size="compact"
                              autoWidth
                              className={styles.tableActionBtn}
                              onClick={() => openRequest(request.id)}
                            >
                              {hr && request.status === 'SENT_TO_HR'
                                ? 'Phân công'
                                : isSingleListShip && actionableIds.has(request.id)
                                  ? 'Xử lý'
                                  : 'Xem chi tiết'}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </DataTable>
                )}
              </>
            )}
          </Panel>
        </div>
      </div>
    </CruiseFrame>
  )
}

function ShipManagerRow({
  cruise,
  scheduleLabel,
  onAssigned,
}: {
  cruise: Pick<StaffingRequest, 'cruiseId' | 'cruiseName' | 'cruiseCode'>
  scheduleLabel: string
  onAssigned: () => void
}) {
  const options = useReadQuery(
    `ship-manager-options:${cruise.cruiseId}`,
    useCallback(signal => cruiseStaffApi.options(cruise.cruiseId, signal), [cruise.cruiseId]),
  )
  const [selectedUserId, setSelectedUserId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const candidates = options.data?.users.filter(user => user.allowedRoles.includes('SHIP_MANAGER')) ?? []
  const effectiveUserId = selectedUserId || (candidates.length === 1 ? candidates[0].userId : '')
  const selected = candidates.find(user => user.userId === effectiveUserId)

  async function assign() {
    if (lock.current || !selected) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await cruiseStaffApi.assign(cruise.cruiseId, { userId: selected.userId, roleInCruise: 'SHIP_MANAGER', notes: '' })
      onAssigned()
    } catch (cause) {
      setError(staffingError(cause))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <tr>
      <td>
        <span className={styles.tableCellTitle}>{cruise.cruiseName}</span>
        <span className={styles.tableCellSub}>{cruise.cruiseCode}</span>
      </td>
      <td>
        <span className={styles.tableCellSub}>{scheduleLabel}</span>
      </td>
      <td>
        {options.loading ? (
          <span className={styles.tableCellSub}>Đang tải danh sách Quản lý tàu…</span>
        ) : options.error ? (
          <div className={styles.inlineRowFeedback}>
            <span className={styles.queueGap}>Chưa tải được ứng viên</span>
            <Button tone="text" size="compact" onClick={options.retry}>Thử lại</Button>
          </div>
        ) : !candidates.length ? (
          <span className={styles.tableCellSub}>Chưa có Quản lý tàu trống lịch</span>
        ) : (
          <div className={styles.inlineRowControl}>
            <select
              aria-label={`Chọn Quản lý tàu cho ${cruise.cruiseCode}`}
              className={styles.inlineSelect}
              value={effectiveUserId}
              disabled={busy}
              onChange={event => setSelectedUserId(event.target.value)}
            >
              {candidates.length > 1 && <option value="">Chọn Quản lý tàu</option>}
              {candidates.map(user => (
                <option key={user.userId} value={user.userId}>{`Quản lý tàu (${user.username})`}</option>
              ))}
            </select>
            {error && <span className={styles.queueGap} role="alert">{error}</span>}
          </div>
        )}
      </td>
      <td>
        <Button
          tone="primary"
          size="compact"
          autoWidth
          className={styles.tableActionBtn}
          busy={busy}
          disabled={!selected || options.loading}
          onClick={() => void assign()}
        >
          Phân công
        </Button>
      </td>
    </tr>
  )
}

function StaffingDetail({ requestId, onChanged, onCompleted, review, readOnly = false }: {
  requestId: string; onChanged: () => void; onCompleted: () => void; review: boolean; readOnly?: boolean
}) {
  const access = useSessionAccess()
  const [refreshTick, setRefreshTick] = useState(0)
  const request = useReadQuery(
    'staffing-request:' + requestId,
    useCallback(signal => staffingApi.detail(requestId, signal), [requestId]),
  )
  if (request.loading) return <Panel><Loading label="Đang mở thông tin tour…" /></Panel>
  if (request.error || !request.data) {
    return (
      <Notice tone="error" title="Chưa mở được yêu cầu">
        <p>{staffingError(request.error)}</p>
        <Button tone="secondary" size="compact" autoWidth onClick={request.retry}>Thử lại</Button>
      </Notice>
    )
  }
  if (request.data.workflowVersion === 'V2' || request.data.status === 'PENDING_SHIP_REVIEW') {
    const syncAll = () => {
      setRefreshTick(tick => tick + 1)
      request.retry()
      onChanged()
    }
    return (
      <div className={styles.stack}>
        <RequestHeader request={request.data} />
        {review && access.roles.includes('SHIP_MANAGER') && request.data.status === 'PENDING_SHIP_REVIEW' && (
          <div className={styles.rowMeta}>
            <ButtonLink tone="secondary" size="compact" autoWidth to={`/admin/service-locations?cruiseId=${encodeURIComponent(request.data.cruiseId)}`}>
              Xem đề nghị bố trí dịch vụ của chuyến
            </ButtonLink>
            <ButtonLink tone="secondary" size="compact" autoWidth to={`/admin/cruises/${encodeURIComponent(request.data.cruiseId)}?section=preparation`}>
              Xem toàn bộ hồ sơ chuẩn bị
            </ButtonLink>
          </div>
        )}
        <StaffingV2
          request={request.data}
          refreshKey={refreshTick}
          readOnly={readOnly}
          onChanged={syncAll}
          onCompleted={onCompleted}
          activitySection={!review && !readOnly && request.data.status === 'SENT_TO_HR'
            ? <Assignments request={request.data} refresh={syncAll} activityOnly />
            : undefined}
        />
        {review && access.roles.includes('SHIP_MANAGER') && request.data.status === 'PENDING_SHIP_REVIEW' && (
          <PreparationEvidence cruiseId={request.data.cruiseId} sectionCode="TECHNICAL_NAUTICAL"
            refreshKey={refreshTick} onChanged={syncAll} />
        )}
      </div>
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
          <Badge label={staffingStatusLabel(request)} tone={tone} />
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
        <Notice tone="warning" title="Yêu cầu cần bổ sung">{request.returnReason}</Notice>
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
  if (!review && request.status !== 'SHIP_CONFIRMED') return <RequestHeader request={request} />
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
  const ops = (request.status === 'PLANNER_CONFIRMED' || request.status === 'HR_APPROVED') && access.roles.includes('OPERATIONS_MANAGER') && access.has('CRUISE_VALIDATE')
  const hrApproval = request.status === 'SHIP_CONFIRMED' && request.shipReviewWorkflow
    && access.roles.includes('HR_MANAGER') && access.has('CRUISE_STAFF_ASSIGN')

  async function review(action: StaffingAction) {
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
          {hrApproval && <Button busy={busy} onClick={() => void review('HR_APPROVED')}>Duyệt phân công</Button>}
          {hrApproval && !returning && <Button tone="secondary" disabled={busy} onClick={() => setReturning(true)}>Yêu cầu bổ sung</Button>}
          {hrApproval && returning && <Button busy={busy} disabled={!reason.trim()} onClick={() => void review('HR_RETURN_STAFF')}>Trả về bước phân công</Button>}
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

function Assignments({ request, refresh, activityOnly = false }: { request: StaffingRequest; refresh: () => void; activityOnly?: boolean }) {
  const access = useSessionAccess()
  const { cruiseId } = request
  const plan = useReadQuery('staffing-work:' + cruiseId, useCallback(signal => staffingApi.workPlan(cruiseId, signal), [cruiseId]))
  const optionsQuery = useReadQuery(
    `staffing-cruise-options:${cruiseId}`,
    useCallback(signal => cruiseStaffApi.options(cruiseId, signal), [cruiseId]),
  )
  const shifts = (plan.data?.windows ?? []).filter(w => w.kind === 'ONBOARD' || w.kind === 'SHORE')
  const firstOpenService = activityOnly
    ? (shifts.find(item => item.userIds.length < (item.requiredStaffCount ?? 1))?.windowId ?? shifts[0]?.windowId ?? '')
    : (request.requirements.find(item => item.assigned < item.required)?.serviceId ?? request.requirements[0]?.serviceId ?? shifts[0]?.windowId ?? '')
  const [selectedTarget, setSelectedTarget] = useState('')
  const [staffSearch, setStaffSearch] = useState('')
  const [staffStatusFilter, setStaffStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'EXTERNAL' | 'BLOCKED'>('ALL')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)

  const editable = request.status === 'SENT_TO_HR'
  const target = selectedTarget || firstOpenService
  const requirement = activityOnly ? undefined : request.requirements.find(item => item.serviceId === target)
  const shift = shifts.find(item => item.windowId === target)
  const candidateQuery = useStaffCandidates(cruiseId, requirement ? 'SERVICE' : shift?.kind, requirement?.serviceId ?? shift?.resourceId)
  const candidates = candidateQuery.data ?? []
  const externalOnboardStaff = (optionsQuery.data?.users ?? []).filter(
    person => person.allowedRoles.includes('ONBOARD_STAFF') && !candidates.some(c => c.userId === person.userId),
  )

  const missingServices = request.requirements.filter(item => item.assigned < item.required)
  const missingShifts = shifts.filter(shift => shift.userIds.length < (shift.requiredStaffCount ?? 1))
  const covered = Boolean(plan.data) && (request.requirements.length > 0 || shifts.length > 0)
    && missingServices.length === 0 && !plan.loading && !plan.error && missingShifts.length === 0

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

  return (
    <div className={styles.stack}>
      {(!activityOnly || shifts.length > 0) && (
      <Panel title={activityOnly ? '2. Phân ca hoạt động và tour bờ' : undefined}>
        <div className={styles.section}>
          {!activityOnly && <RequestHeader request={request} tone={editable ? 'warning' : 'success'} />}

          {editable && (!activityOnly || shifts.length > 0) && (
            <div className={styles.assignGrid}>
              {/* Left column inside cruise: Services & Shifts to staff */}
              <div className={styles.section}>
                {!activityOnly && (
                  <>
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
                  </>
                )}

                {shifts.length > 0 && (
                  <>
                    <div className={styles.sectionHeadingRow}>
                      <h3>{activityOnly ? '1. Chọn ca hoạt động / tour bờ' : 'Ca hoạt động / tour bờ'}</h3>
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
                              <Badge
                                label={`${window.userIds.length}/${window.requiredStaffCount ?? 1} nhân sự`}
                                tone={window.userIds.length >= (window.requiredStaffCount ?? 1) ? 'success' : 'warning'}
                              />
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
                    ? 'Chỉ nhân viên có vai trò Nhân viên phục vụ trên tàu của chuyến mới xếp được vào dịch vụ này.'
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
                          const assignedToCurrentService = Boolean(
                            person.status === 'ALREADY_ASSIGNED'
                            && requirement
                            && plan.data?.serviceAssignments.some(a => a.userId === person.userId && a.serviceId === requirement.serviceId),
                          )
                          const assignedToCurrentShift = Boolean(
                            person.status === 'ALREADY_ASSIGNED'
                            && shift
                            && (shift.kind === 'ONBOARD' || shift.kind === 'SHORE')
                            && shift.userIds.includes(person.userId),
                          )
                          const reasonLabel = canAssignNow
                            ? 'Sẵn sàng phân công'
                            : assignedToCurrentService
                              ? `Đang phụ trách "${requirement?.serviceName}"`
                              : assignedToCurrentShift
                                ? `Đã xếp vào ca "${shift?.name}"`
                                : person.status === 'MISSING_QUALIFICATION' && shift
                                  ? `Chưa đánh dấu phụ trách "${shift.name}"`
                                  : person.status === 'ALREADY_ASSIGNED' && requirement
                                    ? 'Đang phụ trách dịch vụ khác trên chuyến'
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
                              ) : assignedToCurrentService ? (
                                <Button
                                  tone="secondary"
                                  size="compact"
                                  autoWidth
                                  disabled={busy}
                                  onClick={() => void run(() => staffingApi.unassignService(cruiseId, person.userId))}
                                >
                                  Gỡ phân công
                                </Button>
                              ) : assignedToCurrentShift && shift && (shift.kind === 'ONBOARD' || shift.kind === 'SHORE') ? (
                                <Button
                                  tone="secondary"
                                  size="compact"
                                  autoWidth
                                  disabled={busy}
                                  onClick={() => {
                                    const kind = shift.kind as 'ONBOARD' | 'SHORE'
                                    void run(() => staffingApi.unassignShift(cruiseId, person.userId, kind, shift.resourceId))
                                  }}
                                >
                                  Gỡ ca
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
                          Hiện trong hệ thống không còn tài khoản vai trò Nhân viên phục vụ trên tàu nào khác chưa được bố trí. Tạo thêm tài khoản có vai trò Nhân viên phục vụ trên tàu để đủ người xếp vào chuyến.
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

          {editable && !activityOnly && (
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
                  {plan.loading ? 'Đang đối chiếu phân ca…' : plan.error ? 'Chưa đọc được phân ca. Tải lại trước khi gửi.'
                    : <>Cần hoàn thiện trước khi gửi: {[...missingServices.map(s => `${s.required - s.assigned} người cho ${s.serviceName}`), ...missingShifts.map(shift => `phân ca ${shift.name}`)].join('; ') || 'nhu cầu dịch vụ'}.</>}
                </span>
              )}
            </div>
          )}
        </div>
      </Panel>
      )}

      {editable && (
        <Panel title="Nhân sự đã phân công vào chuyến">
          <CruiseStaffAssignments
            cruiseId={cruiseId}
            embedded
            onChanged={() => {
              candidateQuery.retry()
              optionsQuery.retry()
              plan.retry()
              refresh()
            }}
          />
        </Panel>
      )}
    </div>
  )
}
