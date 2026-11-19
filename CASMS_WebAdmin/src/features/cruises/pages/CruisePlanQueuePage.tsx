import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { domainStatus } from '@/shared/i18n/business-copy'
import { journeyTime } from '@/shared/lib/journey-time'
import { Badge, Button, ButtonLink, DataTable, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { mainflowApi, type PlanView } from '../api/mainflow-api'
import { saleTermsApi, type SaleTermsSetup } from '../api/sale-terms'
import { CruiseFrame } from '../components/CruiseUI'
import { DepartureSaleTerms } from '../components/DepartureSaleTerms'
import { SubmittedPreparationGroups, type SubmittedGroupItem } from '../components/SubmittedPreparationGroups'
import styles from '../components/Cruises.module.css'

type QueueMode = 'tour-dossiers' | 'section-groups' | 'port-fees'
type FilterKey = 'pending' | 'reviewed' | 'returned'
type SortKey = 'oldest' | 'newest' | 'code'
type ReadinessFilter = 'ALL' | 'CLEAN' | 'HAS_BLOCKERS'
type TimeWindowFilter = 'ALL' | '24H' | '7D' | '30D'

const filterOrder: FilterKey[] = ['pending', 'reviewed', 'returned']
const filterLabels: Record<FilterKey, string> = {
  pending: 'Chờ xét duyệt',
  reviewed: 'Đã xét duyệt',
  returned: 'Trả bổ sung',
}

function matchesFilter(plan: PlanView, key: FilterKey) {
  if (key === 'pending') return plan.planStatus === 'SUBMITTED'
  if (key === 'returned') return plan.planStatus === 'REVISION_REQUESTED'
  return plan.planStatus === 'APPROVED' || plan.planStatus === 'REJECTED'
}

function statusTone(status: PlanView['planStatus']): 'neutral' | 'success' | 'warning' | 'info' | 'error' {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'error'
  if (status === 'SUBMITTED' || status === 'REVISION_REQUESTED') return 'warning'
  return 'neutral'
}

function QueueStepIcon({ kind }: { kind: 'groups' | 'tour' | 'fees' | 'clock' | 'check' | 'return' | 'refresh' }) {
  if (kind === 'groups') {
    return (
      <svg className={styles.queueIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="3.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
        <rect x="11" y="3.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
        <rect x="3" y="11.5" width="6" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M11 14h6M14 11.5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'tour') {
    return (
      <svg className={styles.queueIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 3.5h9l3 3v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M6.5 9.5h7M6.5 12.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'fees') {
    return (
      <svg className={styles.queueIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2.5" y="5" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }
  if (kind === 'clock') {
    return (
      <svg className={styles.queueIconSm} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3.25l2.25 1.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'check') {
    return (
      <svg className={styles.queueIconSm} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 8.25l1.75 1.75 3.5-3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'return') {
    return (
      <svg className={styles.queueIconSm} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M6.5 5.5L4 8l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4.5 8h5a2.5 2.5 0 0 1 0 5H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg className={styles.queueIconSm} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.88M13.5 3v3.5H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function handleTabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number, onPick: (key: FilterKey) => void) {
  let nextIndex = -1
  if (event.key === 'ArrowRight') nextIndex = (index + 1) % filterOrder.length
  else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + filterOrder.length) % filterOrder.length
  else if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = filterOrder.length - 1
  if (nextIndex < 0) return
  event.preventDefault()
  const key = filterOrder[nextIndex]
  onPick(key)
  const list = event.currentTarget.closest('[role="tablist"]')
  list?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
}

export function CruisePlanQueuePage() {
  const access = useSessionAccess()
  const allowed = access.roles.includes('OPERATIONS_MANAGER') && access.has('CRUISE_READ')
  const canConfirmGroups = allowed && access.has('CRUISE_PREPARATION_CONFIRM')
  const canSetFees = allowed && access.has('CRUISE_PRICING_APPROVE')

  const query = useReadQuery(
    `received-plans:${access.userId}:${allowed}`,
    useCallback(signal => (allowed ? mainflowApi.queue(signal, true) : Promise.resolve(null)), [allowed]),
  )
  const groupsQuery = useReadQuery(
    `submitted-groups-overview:${access.userId}:${canConfirmGroups}`,
    useCallback(
      signal => (canConfirmGroups ? apiRequest<SubmittedGroupItem[]>('/cruise-preparation-reviews', { signal }) : Promise.resolve(null)),
      [canConfirmGroups],
    ),
  )
  const requests = useReadQuery(
    `sale-terms-requests:${access.userId}:${canSetFees}`,
    useCallback(signal => (canSetFees ? saleTermsApi.setupRequests(signal) : Promise.resolve(null)), [canSetFees]),
  )

  const [manualMode, setManualMode] = useState<QueueMode | null>(null)
  const [selected, setSelected] = useState<SaleTermsSetup | null>(null)
  const [saved, setSaved] = useState('')
  const [filter, setFilter] = useState<FilterKey>('pending')
  const [search, setSearch] = useState('')
  const [senderFilter, setSenderFilter] = useState('ALL')
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>('ALL')
  const [timeWindow, setTimeWindow] = useState<TimeWindowFilter>('ALL')
  const [sortBy, setSortBy] = useState<SortKey>('oldest')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  const allPlans = useMemo(() => query.data ?? [], [query.data])
  const allGroups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])
  const feeRequests = useMemo(() => requests.data ?? [], [requests.data])

  const pendingPlansCount = useMemo(() => allPlans.filter(p => p.planStatus === 'SUBMITTED').length, [allPlans])
  const pendingGroupsCount = useMemo(() => allGroups.filter(g => g.status === 'SUBMITTED').length, [allGroups])
  const pendingFeesCount = feeRequests.length

  // Smart default queue selection: prioritize whichever queue has pending work, defaulting to 'tour-dossiers' when equal
  const activeMode: QueueMode = useMemo(() => {
    if (manualMode) return manualMode
    if (pendingPlansCount > 0) return 'tour-dossiers'
    if (canConfirmGroups && pendingGroupsCount > 0) return 'section-groups'
    if (canSetFees && pendingFeesCount > 0) return 'port-fees'
    return 'tour-dossiers'
  }, [manualMode, pendingPlansCount, canConfirmGroups, pendingGroupsCount, canSetFees, pendingFeesCount])

  const senderOptions = useMemo(() => {
    const set = new Set<string>()
    for (const plan of allPlans) {
      if (plan.submittedByName) set.add(plan.submittedByName)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [allPlans])

  const tabPlans = useMemo(() => allPlans.filter(plan => matchesFilter(plan, filter)), [allPlans, filter])
  const normalizedSearch = search.trim().toLowerCase()

  const filteredPlans = useMemo(() => {
    const latestTimestamp = allPlans.reduce((max, item) => {
      const parsed = item.submittedAt ? Date.parse(item.submittedAt) : 0
      return Number.isFinite(parsed) && parsed > max ? parsed : max
    }, 0)

    const matched = tabPlans.filter(plan => {
      if (senderFilter !== 'ALL' && (plan.submittedByName ?? '') !== senderFilter) return false

      const blockerCount = (plan.planBlockers?.length ?? 0) + (plan.programIssues?.length ?? 0)
      if (readinessFilter === 'CLEAN' && blockerCount > 0) return false
      if (readinessFilter === 'HAS_BLOCKERS' && blockerCount === 0) return false

      if (timeWindow !== 'ALL' && latestTimestamp > 0) {
        const submittedMs = plan.submittedAt ? Date.parse(plan.submittedAt) : 0
        const windowMs =
          timeWindow === '24H'
            ? 24 * 3600 * 1000
            : timeWindow === '7D'
              ? 7 * 24 * 3600 * 1000
              : 30 * 24 * 3600 * 1000
        if (!submittedMs || latestTimestamp - submittedMs > windowMs) return false
      }

      if (!normalizedSearch) return true
      return [plan.cruiseCode, plan.submittedByName ?? '', plan.reason ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })

    return [...matched].sort((a, b) => {
      if (sortBy === 'code') {
        return a.cruiseCode.localeCompare(b.cruiseCode, 'vi')
      }
      const timeA = a.submittedAt ? Date.parse(a.submittedAt) : 0
      const timeB = b.submittedAt ? Date.parse(b.submittedAt) : 0
      return sortBy === 'oldest' ? timeA - timeB : timeB - timeA
    })
  }, [allPlans, tabPlans, senderFilter, readinessFilter, timeWindow, normalizedSearch, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const pagedPlans = filteredPlans.slice(startIndex, startIndex + pageSize)
  const hasActiveFilters = Boolean(
    normalizedSearch || senderFilter !== 'ALL' || readinessFilter !== 'ALL' || timeWindow !== 'ALL',
  )

  const resetFilters = () => {
    setSearch('')
    setSenderFilter('ALL')
    setReadinessFilter('ALL')
    setTimeWindow('ALL')
    setPage(1)
  }

  function refreshAll() {
    query.retry()
    if (canConfirmGroups) groupsQuery.retry()
    if (canSetFees) requests.retry()
  }

  return (
    <CruiseFrame>
      <div className={styles.content}>
        <PageHeader
          breadcrumb="Vận hành"
          title="Hồ sơ chuyến khởi hành"
          actions={
            allowed ? (
              <Button tone="secondary" size="compact" onClick={refreshAll}>
                <QueueStepIcon kind="refresh" />
                <span>Làm mới dữ liệu</span>
              </Button>
            ) : undefined
          }
        />

        {!allowed ? (
          <Notice title="Bạn không có quyền xem hồ sơ">{null}</Notice>
        ) : (
          <>
            {saved && <Notice tone="success" title={`Đã lưu thuế và phí cảng cho ${saved}`}>{null}</Notice>}

            {/* BỘ CHUYỂN HÀNG ĐỢI NGHIỆP VỤ (KHÔNG XẾP CHỒNG NHIỀU BẢNG DÀI) */}
            <nav className={styles.opsQueueSwitcher} aria-label="Trình tự nghiệp vụ xét duyệt hồ sơ">
              {canConfirmGroups && (
                <button
                  type="button"
                  className={`${styles.opsQueueSwitchBtn} ${activeMode === 'section-groups' ? styles.opsQueueSwitchBtnActive : ''}`}
                  aria-current={activeMode === 'section-groups' ? 'page' : undefined}
                  onClick={() => setManualMode('section-groups')}
                >
                  <div className={styles.opsQueueSwitchTop}>
                    <span className={styles.opsQueueStepBadge}>Bước 1</span>
                    <QueueStepIcon kind="groups" />
                    <strong>Nhóm hồ sơ bộ phận</strong>
                    <Badge
                      label={pendingGroupsCount > 0 ? `${pendingGroupsCount} chờ xác nhận` : `${allGroups.length} nhóm`}
                      tone={pendingGroupsCount > 0 ? 'warning' : 'neutral'}
                    />
                  </div>
                  <span className={styles.opsQueueSwitchDesc}>
                    Xác nhận từng nhóm chuyên môn (Lịch trình, Dịch vụ, Nhân sự, Tàu) trước khi duyệt toàn tour
                  </span>
                </button>
              )}

              <button
                type="button"
                className={`${styles.opsQueueSwitchBtn} ${activeMode === 'tour-dossiers' ? styles.opsQueueSwitchBtnActive : ''}`}
                aria-current={activeMode === 'tour-dossiers' ? 'page' : undefined}
                onClick={() => setManualMode('tour-dossiers')}
              >
                <div className={styles.opsQueueSwitchTop}>
                  <span className={styles.opsQueueStepBadge}>{canConfirmGroups ? 'Bước 2' : 'Bước 1'}</span>
                  <QueueStepIcon kind="tour" />
                  <strong>Hồ sơ toàn tour</strong>
                  <Badge
                    label={pendingPlansCount > 0 ? `${pendingPlansCount} chờ xét duyệt` : `${allPlans.length} hồ sơ`}
                    tone={pendingPlansCount > 0 ? 'warning' : 'neutral'}
                  />
                </div>
                <span className={styles.opsQueueSwitchDesc}>
                  Xét duyệt tổng thể kế hoạch chuyến khởi hành để cho phép mở bán thương mại
                </span>
              </button>

              {canSetFees && (
                <button
                  type="button"
                  className={`${styles.opsQueueSwitchBtn} ${activeMode === 'port-fees' ? styles.opsQueueSwitchBtnActive : ''}`}
                  aria-current={activeMode === 'port-fees' ? 'page' : undefined}
                  onClick={() => setManualMode('port-fees')}
                >
                  <div className={styles.opsQueueSwitchTop}>
                    <span className={styles.opsQueueStepBadge}>Phụ trợ</span>
                    <QueueStepIcon kind="fees" />
                    <strong>Thuế và phí cảng</strong>
                    <Badge
                      label={pendingFeesCount > 0 ? `${pendingFeesCount} yêu cầu` : '0 yêu cầu'}
                      tone={pendingFeesCount > 0 ? 'warning' : 'neutral'}
                    />
                  </div>
                  <span className={styles.opsQueueSwitchDesc}>
                    Cấu hình biểu phí cảng đi, cảng về và thuế áp dụng theo yêu cầu của chuyến
                  </span>
                </button>
              )}
            </nav>

            {/* HÀNG ĐỢI 1: NHÓM HỒ SƠ BỘ PHẬN */}
            {activeMode === 'section-groups' && canConfirmGroups && (
              <SubmittedPreparationGroups
                externalGroups={groupsQuery.data}
                externalLoading={groupsQuery.loading}
                externalError={groupsQuery.error}
                onExternalRetry={groupsQuery.retry}
              />
            )}

            {/* HÀNG ĐỢI 2: HỒ SƠ TOÀN TOUR */}
            {activeMode === 'tour-dossiers' && (
              <Panel
                title="Hồ sơ toàn tour"
                subtitle="Bước 2: Xét duyệt hồ sơ tổng thể của chuyến khởi hành sau khi các bộ phận đã hoàn tất chuẩn bị."
              >
                {/* Status Tabs */}
                <div className={styles.queueStatusBar}>
                  <div className={styles.queueTabs} role="tablist" aria-label="Lọc theo tiến độ xét duyệt">
                    {filterOrder.map((key, index) => {
                      const count = allPlans.filter(plan => matchesFilter(plan, key)).length
                      const active = filter === key
                      return (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          className={styles.queueTab}
                          aria-selected={active}
                          tabIndex={active ? 0 : -1}
                          onClick={() => {
                            setFilter(key)
                            setPage(1)
                          }}
                          onKeyDown={event =>
                            handleTabKeys(event, index, nextKey => {
                              setFilter(nextKey)
                              setPage(1)
                            })
                          }
                        >
                          <QueueStepIcon
                            kind={key === 'pending' ? 'clock' : key === 'reviewed' ? 'check' : 'return'}
                          />
                          <span>{filterLabels[key]}</span>
                          <span className={styles.queueTabCount}>{count}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Multi-criteria Filter & Sort Grid */}
                <div className={styles.queueFilterGrid}>
                  <div className={styles.queueFilterSearch}>
                    <Field htmlFor="ops-plan-search" label="Tìm kiếm hồ sơ">
                      <input
                        id="ops-plan-search"
                        type="search"
                        placeholder="Nhập mã chuyến, người gửi hoặc ghi chú…"
                        value={search}
                        onChange={event => {
                          setSearch(event.target.value)
                          setPage(1)
                        }}
                      />
                    </Field>
                  </div>

                  <Field htmlFor="ops-plan-sender" label="Người gửi hồ sơ">
                    <select
                      id="ops-plan-sender"
                      value={senderFilter}
                      onChange={event => {
                        setSenderFilter(event.target.value)
                        setPage(1)
                      }}
                    >
                      <option value="ALL">Tất cả người gửi ({senderOptions.length})</option>
                      {senderOptions.map(sender => (
                        <option key={sender} value={sender}>
                          {sender}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field htmlFor="ops-plan-readiness" label="Đối chiếu điều kiện">
                    <select
                      id="ops-plan-readiness"
                      value={readinessFilter}
                      onChange={event => {
                        setReadinessFilter(event.target.value as ReadinessFilter)
                        setPage(1)
                      }}
                    >
                      <option value="ALL">Tất cả tình trạng</option>
                      <option value="CLEAN">Đạt kiểm tra tự động</option>
                      <option value="HAS_BLOCKERS">Có cảnh báo / Cần kiểm tra</option>
                    </select>
                  </Field>

                  <Field htmlFor="ops-plan-time" label="Thời gian gửi">
                    <select
                      id="ops-plan-time"
                      value={timeWindow}
                      onChange={event => {
                        setTimeWindow(event.target.value as TimeWindowFilter)
                        setPage(1)
                      }}
                    >
                      <option value="ALL">Mọi thời điểm</option>
                      <option value="24H">Trong 24 giờ gần nhất</option>
                      <option value="7D">7 ngày gần nhất</option>
                      <option value="30D">30 ngày gần nhất</option>
                    </select>
                  </Field>

                  <Field htmlFor="ops-plan-sort" label="Thứ tự ưu tiên xử lý">
                    <select
                      id="ops-plan-sort"
                      value={sortBy}
                      onChange={event => {
                        setSortBy(event.target.value as SortKey)
                        setPage(1)
                      }}
                    >
                      <option value="oldest">Chờ lâu nhất trước</option>
                      <option value="newest">Mới gửi gần đây nhất</option>
                      <option value="code">Theo mã chuyến (A → Z)</option>
                    </select>
                  </Field>
                </div>

                {/* Summary & Reset Row */}
                {!query.loading && !query.error && (
                  <div className={styles.queueSummaryBar}>
                    <span className={styles.queueCount}>
                      {filteredPlans.length === 0
                        ? `0 hồ sơ ${filterLabels[filter].toLowerCase()}`
                        : `Hiển thị ${startIndex + 1}–${Math.min(startIndex + pageSize, filteredPlans.length)} trong số ${filteredPlans.length} hồ sơ ${filterLabels[filter].toLowerCase()}`}
                    </span>
                    {hasActiveFilters && (
                      <Button tone="secondary" size="compact" autoWidth onClick={resetFilters}>
                        Đặt lại bộ lọc
                      </Button>
                    )}
                  </div>
                )}

                {query.loading && <Loading label="Đang tải hồ sơ chuyến khởi hành…" />}
                {query.error && (
                  <Notice title="Chưa tải được hồ sơ" tone="error">
                    <Button tone="secondary" size="compact" onClick={query.retry}>
                      Thử lại
                    </Button>
                  </Notice>
                )}
                {!query.loading && !query.error && filteredPlans.length === 0 && (
                  <Empty
                    title={
                      hasActiveFilters
                        ? 'Không tìm thấy hồ sơ khớp điều kiện lọc'
                        : `Chưa có hồ sơ ${filterLabels[filter].toLowerCase()}`
                    }
                  >
                    {hasActiveFilters && (
                      <Button tone="secondary" size="compact" autoWidth onClick={resetFilters}>
                        Đặt lại bộ lọc
                      </Button>
                    )}
                  </Empty>
                )}
                {pagedPlans.length > 0 && (
                  <>
                    <DataTable
                      label="Hồ sơ chuyến khởi hành"
                      headers={[
                        'Chuyến khởi hành',
                        'Người gửi hồ sơ',
                        'Thời điểm gửi',
                        'Kiểm tra điều kiện',
                        'Trạng thái xét duyệt',
                        'Thao tác',
                      ]}
                    >
                      {pagedPlans.map(plan => {
                        const blockerCount = (plan.planBlockers?.length ?? 0) + (plan.programIssues?.length ?? 0)
                        const revNumber = plan.submittedRevision ?? plan.revision
                        return (
                          <tr key={plan.cruiseId}>
                            <td>
                              <div className={styles.queuePrimaryCell}>
                                <strong>{plan.cruiseCode}</strong>
                                <span className={styles.queueCodeBadge}>Lần gửi #{revNumber}</span>
                              </div>
                            </td>
                            <td>
                              <strong>{plan.submittedByName ?? '—'}</strong>
                            </td>
                            <td>
                              <span className={styles.queueTime}>
                                {plan.submittedAt ? journeyTime(plan.submittedAt) : '—'}
                              </span>
                            </td>
                            <td>
                              {blockerCount === 0 ? (
                                <Badge label="Đạt kiểm tra tự động" tone="success" />
                              ) : (
                                <Badge label={`${blockerCount} điểm cần lưu ý`} tone="warning" />
                              )}
                            </td>
                            <td>
                              <div className={styles.queuePrimaryCell}>
                                <Badge
                                  label={domainStatus('cruise.plan', plan.planStatus)}
                                  tone={statusTone(plan.planStatus)}
                                />
                                {plan.reason && <span className={styles.muted}>Ghi chú: {plan.reason}</span>}
                              </div>
                            </td>
                            <td>
                              <ButtonLink
                                tone={filter === 'pending' ? 'primary' : 'secondary'}
                                size="compact"
                                autoWidth
                                to={`/admin/cruises/${encodeURIComponent(plan.cruiseId)}?work=review&step=review&section=overview`}
                              >
                                {filter === 'pending' ? 'Xét duyệt hồ sơ' : 'Mở hồ sơ'}
                              </ButtonLink>
                            </td>
                          </tr>
                        )
                      })}
                    </DataTable>

                    {/* Pagination Controls */}
                    <div className={styles.queuePaginationBar}>
                      <div className={styles.queuePageSizeControl}>
                        <label htmlFor="ops-plan-page-size">Số dòng / trang:</label>
                        <select
                          id="ops-plan-page-size"
                          value={pageSize}
                          onChange={e => {
                            setPageSize(Number(e.target.value))
                            setPage(1)
                          }}
                        >
                          <option value={10}>10 dòng</option>
                          <option value={20}>20 dòng</option>
                          <option value={50}>50 dòng</option>
                          <option value={100}>100 dòng</option>
                        </select>
                      </div>

                      <div className={styles.queuePageButtons}>
                        <Button
                          tone="secondary"
                          size="compact"
                          autoWidth
                          disabled={safePage <= 1}
                          onClick={() => setPage(1)}
                        >
                          Đầu
                        </Button>
                        <Button
                          tone="secondary"
                          size="compact"
                          autoWidth
                          disabled={safePage <= 1}
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                          Trước
                        </Button>
                        <span className={styles.queuePageIndicator}>
                          Trang {safePage} / {totalPages}
                        </span>
                        <Button
                          tone="secondary"
                          size="compact"
                          autoWidth
                          disabled={safePage >= totalPages}
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        >
                          Tiếp
                        </Button>
                        <Button
                          tone="secondary"
                          size="compact"
                          autoWidth
                          disabled={safePage >= totalPages}
                          onClick={() => setPage(totalPages)}
                        >
                          Cuối
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Panel>
            )}

            {/* HÀNG ĐỢI 3: YÊU CẦU CẤU HÌNH THUẾ VÀ PHÍ CẢNG */}
            {activeMode === 'port-fees' && canSetFees && (
              <Panel
                title="Yêu cầu cấu hình thuế và phí cảng"
                subtitle="Thiết lập biểu phí cảng đi, cảng về và thuế áp dụng cho các chuyến khởi hành đang chuẩn bị mở bán."
              >
                {requests.loading && <Loading label="Đang tải yêu cầu…" />}
                {requests.error && (
                  <Notice title="Chưa tải được yêu cầu" tone="error">
                    <Button tone="secondary" size="compact" onClick={requests.retry}>
                      Thử lại
                    </Button>
                  </Notice>
                )}
                {!requests.loading && !requests.error && feeRequests.length === 0 && (
                  <Empty title="Chưa có yêu cầu cấu hình thuế và phí cảng nào đang chờ" />
                )}
                {feeRequests.length > 0 && (
                  <DataTable
                    label="Yêu cầu cấu hình thuế và phí cảng"
                    headers={['Chuyến khởi hành', 'Cảng đi và cảng về', 'Thao tác']}
                  >
                    {feeRequests.map(item => (
                      <tr key={item.cruiseId}>
                        <td>
                          <div className={styles.queuePrimaryCell}>
                            <strong>{item.cruiseName}</strong>
                            <span className={styles.queueCodeBadge}>{item.cruiseCode}</span>
                          </div>
                        </td>
                        <td>
                          {item.departurePort} · {item.returnPort}
                        </td>
                        <td>
                          <Button tone="primary" size="compact" autoWidth onClick={() => setSelected(item)}>
                            Cấu hình thuế và phí
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                )}
              </Panel>
            )}
          </>
        )}

        {selected && canSetFees && (
          <Modal
            variant="drawer"
            title="Thuế và phí cảng"
            description={`${selected.cruiseName} · ${selected.cruiseCode}`}
            onClose={() => setSelected(null)}
          >
            <div>
              <p>
                <strong>Cảng đi</strong> · {selected.departurePort}
              </p>
              <p>
                <strong>Cảng về</strong> · {selected.returnPort}
              </p>
              {selected.ports.length > 0 && (
                <p>
                  <strong>Cảng ghé</strong> · {selected.ports.join(', ')}
                </p>
              )}
            </div>
            <DepartureSaleTerms
              cruiseId={selected.cruiseId}
              refreshKey={0}
              setupOnly
              unified
              onChanged={() => {
                setSaved(selected.cruiseCode)
                setSelected(null)
                requests.retry()
              }}
            />
          </Modal>
        )}
      </div>
    </CruiseFrame>
  )
}
