import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { journeyTime } from '@/shared/lib/journey-time'
import { Badge, Button, DataTable, Empty, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import styles from './Cruises.module.css'

const root = '/cruise-preparation-reviews'
const statuses = { SUBMITTED: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', RETURNED: 'Cần bổ sung' } as const
type GroupStatus = keyof typeof statuses
const statusOrder: GroupStatus[] = ['SUBMITTED', 'CONFIRMED', 'RETURNED']
type GroupSortKey = 'oldest' | 'newest' | 'cruise'

export type SubmittedGroupItem = {
  cruiseId: string
  cruiseName: string
  cruiseCode: string
  sectionCode: string
  sectionName: string
  status: GroupStatus
  submittedAt: string
}

type GroupDetail = {
  summary: SubmittedGroupItem
  revision: number
  evidence: string | null
  returnReason: string | null
  checks: { name: string; ready: boolean; required: boolean }[]
  allowedActions: ('CONFIRM' | 'RETURN')[]
}

const groupPath = (group: SubmittedGroupItem) =>
  `${root}/${encodeURIComponent(group.cruiseId)}/${encodeURIComponent(group.sectionCode)}`

function badgeTone(status: GroupStatus) {
  if (status === 'CONFIRMED') return 'success' as const
  return 'warning' as const
}

function StatusTabIcon({ status }: { status: GroupStatus }) {
  if (status === 'SUBMITTED') {
    return (
      <svg className={styles.queueIconSm} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3.25l2.25 1.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  if (status === 'CONFIRMED') {
    return (
      <svg className={styles.queueIconSm} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 8.25l1.75 1.75 3.5-3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg className={styles.queueIconSm} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.5 5.5L4 8l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 8h5a2.5 2.5 0 0 1 0 5H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function handleTabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number, onPick: (key: GroupStatus) => void) {
  let nextIndex = -1
  if (event.key === 'ArrowRight') nextIndex = (index + 1) % statusOrder.length
  else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + statusOrder.length) % statusOrder.length
  else if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = statusOrder.length - 1
  if (nextIndex < 0) return
  event.preventDefault()
  const key = statusOrder[nextIndex]
  onPick(key)
  const list = event.currentTarget.closest('[role="tablist"]')
  list?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
}

export function SubmittedPreparationGroups({
  externalGroups,
  externalLoading,
  externalError,
  onExternalRetry,
}: {
  externalGroups?: SubmittedGroupItem[] | null
  externalLoading?: boolean
  externalError?: Error | null
  onExternalRetry?: () => void
} = {}) {
  const { userId } = useSessionAccess()
  const internalQuery = useReadQuery(
    `submitted-groups:${userId}:${Boolean(externalGroups !== undefined)}`,
    useCallback(
      signal => (externalGroups !== undefined ? Promise.resolve(externalGroups) : apiRequest<SubmittedGroupItem[]>(root, { signal })),
      [externalGroups],
    ),
  )

  const loading = externalLoading ?? internalQuery.loading
  const error = externalError ?? internalQuery.error
  const retry = onExternalRetry ?? internalQuery.retry
  const allGroups = useMemo(() => externalGroups ?? internalQuery.data ?? [], [externalGroups, internalQuery.data])

  const [selected, setSelected] = useState<SubmittedGroupItem | null>(null)
  const [status, setStatus] = useState<GroupStatus>('SUBMITTED')
  const [search, setSearch] = useState('')
  const [sectionFilter, setSectionFilter] = useState('ALL')
  const [cruiseFilter, setCruiseFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState<GroupSortKey>('oldest')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [feedback, setFeedback] = useState('')

  const tabGroups = useMemo(() => allGroups.filter(group => group.status === status), [allGroups, status])

  const sectionOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of allGroups) {
      if (!map.has(item.sectionCode)) map.set(item.sectionCode, item.sectionName)
    }
    return Array.from(map.entries())
  }, [allGroups])

  const cruiseOptions = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>()
    for (const item of allGroups) {
      if (!map.has(item.cruiseId)) {
        map.set(item.cruiseId, { code: item.cruiseCode, name: item.cruiseName })
      }
    }
    return Array.from(map.entries())
  }, [allGroups])

  const normalizedSearch = search.trim().toLowerCase()

  const filteredGroups = useMemo(() => {
    const matched = tabGroups.filter(group => {
      if (sectionFilter !== 'ALL' && group.sectionCode !== sectionFilter) return false
      if (cruiseFilter !== 'ALL' && group.cruiseId !== cruiseFilter) return false
      if (!normalizedSearch) return true
      return [group.cruiseName, group.cruiseCode, group.sectionName].join(' ').toLowerCase().includes(normalizedSearch)
    })

    return [...matched].sort((a, b) => {
      if (sortBy === 'cruise') {
        return a.cruiseCode.localeCompare(b.cruiseCode, 'vi')
      }
      const timeA = Date.parse(a.submittedAt) || 0
      const timeB = Date.parse(b.submittedAt) || 0
      return sortBy === 'oldest' ? timeA - timeB : timeB - timeA
    })
  }, [tabGroups, sectionFilter, cruiseFilter, normalizedSearch, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const pagedGroups = filteredGroups.slice(startIndex, startIndex + pageSize)
  const hasActiveFilters = Boolean(normalizedSearch || sectionFilter !== 'ALL' || cruiseFilter !== 'ALL')

  const resetFilters = () => {
    setSearch('')
    setSectionFilter('ALL')
    setCruiseFilter('ALL')
    setPage(1)
  }

  return (
    <Panel
      title="Nhóm hồ sơ bộ phận đã gửi"
      subtitle="Bước 1: Kiểm tra và xác nhận từng nhóm hồ sơ chuyên môn (Lịch trình, Dịch vụ, Nhân sự, Tàu) trước khi phê duyệt hồ sơ toàn tour."
    >
      {/* Status Tabs */}
      <div className={styles.queueStatusBar}>
        <div className={styles.queueTabs} role="tablist" aria-label="Lọc nhóm hồ sơ theo trạng thái">
          {statusOrder.map((key, index) => {
            const count = allGroups.filter(group => group.status === key).length
            const active = key === status
            return (
              <button
                key={key}
                type="button"
                role="tab"
                className={styles.queueTab}
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => {
                  setStatus(key)
                  setPage(1)
                }}
                onKeyDown={event =>
                  handleTabKeys(event, index, nextKey => {
                    setStatus(nextKey)
                    setPage(1)
                  })
                }
              >
                <StatusTabIcon status={key} />
                <span>{statuses[key]}</span>
                <span className={styles.queueTabCount}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Multi-criteria Filter & Sort Bar */}
      <div className={styles.queueFilterGrid}>
        <div className={styles.queueFilterSearch}>
          <Field htmlFor="ops-group-search" label="Tìm kiếm nhanh">
            <input
              id="ops-group-search"
              type="search"
              placeholder="Mã chuyến, tên chuyến hoặc tên nhóm…"
              value={search}
              onChange={event => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </Field>
        </div>

        <Field htmlFor="ops-group-section-filter" label="Phân mục hồ sơ">
          <select
            id="ops-group-section-filter"
            value={sectionFilter}
            onChange={event => {
              setSectionFilter(event.target.value)
              setPage(1)
            }}
          >
            <option value="ALL">Tất cả phân mục ({sectionOptions.length})</option>
            {sectionOptions.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="ops-group-cruise-filter" label="Chuyến khởi hành">
          <select
            id="ops-group-cruise-filter"
            value={cruiseFilter}
            onChange={event => {
              setCruiseFilter(event.target.value)
              setPage(1)
            }}
          >
            <option value="ALL">Tất cả chuyến ({cruiseOptions.length})</option>
            {cruiseOptions.map(([id, info]) => (
              <option key={id} value={id}>
                {info.code} · {info.name}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="ops-group-sort" label="Thứ tự ưu tiên xử lý">
          <select
            id="ops-group-sort"
            value={sortBy}
            onChange={event => {
              setSortBy(event.target.value as GroupSortKey)
              setPage(1)
            }}
          >
            <option value="oldest">Chờ lâu nhất trước (Ưu tiên SLA)</option>
            <option value="newest">Mới gửi gần đây nhất</option>
            <option value="cruise">Theo mã chuyến (A → Z)</option>
          </select>
        </Field>
      </div>

      {/* Summary & Reset Row */}
      {!loading && !error && (
        <div className={styles.queueSummaryBar}>
          <span className={styles.queueCount}>
            {filteredGroups.length === 0
              ? `0 nhóm hồ sơ ${statuses[status].toLowerCase()}`
              : `Hiển thị ${startIndex + 1}–${Math.min(startIndex + pageSize, filteredGroups.length)} trong số ${filteredGroups.length} nhóm ${statuses[status].toLowerCase()}`}
          </span>
          {hasActiveFilters && (
            <Button tone="secondary" size="compact" autoWidth onClick={resetFilters}>
              Đặt lại bộ lọc
            </Button>
          )}
        </div>
      )}

      {feedback && <Notice tone="success" title={feedback}>{null}</Notice>}
      {loading && <Loading label="Đang tải nhóm hồ sơ…" />}
      {error && (
        <Notice title="Chưa tải được nhóm hồ sơ" tone="error">
          <Button tone="secondary" size="compact" onClick={retry}>
            Thử lại
          </Button>
        </Notice>
      )}
      {!loading && !error && (
        filteredGroups.length === 0 ? (
          <Empty
            title={
              hasActiveFilters
                ? 'Không tìm thấy nhóm hồ sơ khớp điều kiện lọc'
                : `Không có nhóm hồ sơ nào ở trạng thái "${statuses[status]}"`
            }
          >
            {hasActiveFilters && (
              <Button tone="secondary" size="compact" autoWidth onClick={resetFilters}>
                Đặt lại bộ lọc
              </Button>
            )}
          </Empty>
        ) : (
          <>
            <DataTable
              label="Nhóm hồ sơ đã gửi"
              headers={['Chuyến khởi hành', 'Phân mục chuyên môn', 'Thời điểm gửi', 'Trạng thái', 'Thao tác']}
            >
              {pagedGroups.map(group => (
                <tr key={groupPath(group)}>
                  <td>
                    <div className={styles.queuePrimaryCell}>
                      <strong>{group.cruiseName}</strong>
                      <span className={styles.queueCodeBadge}>{group.cruiseCode}</span>
                    </div>
                  </td>
                  <td>
                    <strong>{group.sectionName}</strong>
                  </td>
                  <td>
                    <span className={styles.queueTime}>{journeyTime(group.submittedAt)}</span>
                  </td>
                  <td>
                    <Badge label={statuses[group.status]} tone={badgeTone(group.status)} />
                  </td>
                  <td>
                    <Button
                      tone={group.status === 'SUBMITTED' ? 'primary' : 'secondary'}
                      size="compact"
                      autoWidth
                      onClick={() => setSelected(group)}
                    >
                      {group.status === 'SUBMITTED' ? 'Kiểm tra & xác nhận' : 'Xem chi tiết'}
                    </Button>
                  </td>
                </tr>
              ))}
            </DataTable>

            {/* Pagination Controls */}
            <div className={styles.queuePaginationBar}>
              <div className={styles.queuePageSizeControl}>
                <label htmlFor="ops-group-page-size">Số dòng / trang:</label>
                <select
                  id="ops-group-page-size"
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
        )
      )}

      {selected && (
        <GroupReview
          group={selected}
          onClose={() => setSelected(null)}
          onSaved={action => {
            setSelected(null)
            setFeedback(
              action === 'confirm'
                ? 'Đã xác nhận nhóm hồ sơ thành phần'
                : 'Đã gửi yêu cầu bổ sung cho bộ phận phụ trách',
            )
            retry()
          }}
        />
      )}
    </Panel>
  )
}

function GroupReview({
  group,
  onClose,
  onSaved,
}: {
  group: SubmittedGroupItem
  onClose: () => void
  onSaved: (action: 'confirm' | 'return') => void
}) {
  const { userId } = useSessionAccess()
  const path = groupPath(group)
  const query = useReadQuery(
    `group-review:${userId}:${path}`,
    useCallback(signal => apiRequest<GroupDetail>(path, { signal }), [path]),
  )
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const detail = query.data

  async function decide(action: 'confirm' | 'return') {
    if (!detail || busy || !detail.allowedActions.includes(action === 'confirm' ? 'CONFIRM' : 'RETURN')) return
    if (action === 'return' && !reason.trim()) return
    setBusy(true)
    setError('')
    try {
      await apiRequest<void>(`${path}/${action}`, {
        method: 'POST',
        body: { expectedRevision: detail.revision, ...(action === 'return' ? { reason: reason.trim() } : {}) },
      })
      onSaved(action)
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 409
          ? 'Nhóm hồ sơ vừa thay đổi. Đọc lại nội dung trước khi quyết định.'
          : 'Chưa xác nhận được kết quả. Tải lại nhóm hồ sơ để kiểm tra trạng thái.',
      )
      query.retry()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      variant="drawer"
      title={group.sectionName}
      description={`${group.cruiseName} · ${group.cruiseCode}`}
      busy={busy}
      onClose={onClose}
    >
      {query.loading && <Loading label="Đang tải nội dung đã gửi…" />}
      {query.error && (
        <Notice title="Chưa tải được nội dung đã gửi" tone="error">
          <Button tone="secondary" size="compact" onClick={query.retry}>
            Thử lại
          </Button>
        </Notice>
      )}
      {error && <Notice title="Chưa hoàn tất thao tác" tone="error">{error}</Notice>}
      {!query.loading && !query.error && detail && (
        <>
          <div>
            <Badge label={statuses[detail.summary.status]} tone={badgeTone(detail.summary.status)} />
          </div>
          {detail.evidence && (
            <div className={styles.queueDetailBlock}>
              <h3>Nội dung bộ phận chuyên môn đã gửi</h3>
              <p>{detail.evidence}</p>
            </div>
          )}
          {detail.checks.length > 0 && (
            <div className={styles.queueDetailBlock}>
              <h3>Đối chiếu điều kiện lúc gửi</h3>
              <ul className={styles.queueChecklist}>
                {detail.checks.map(check => (
                  <li key={check.name}>
                    <span>{check.name}</span>
                    <Badge
                      label={check.ready ? 'Đạt' : check.required ? 'Cần bổ sung' : 'Chưa có'}
                      tone={check.ready ? 'success' : check.required ? 'warning' : 'neutral'}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {detail.summary.status === 'RETURNED' && detail.returnReason && (
            <Notice title="Lý do cần bổ sung" tone="warning">
              {detail.returnReason}
            </Notice>
          )}
          {returning && detail.allowedActions.includes('RETURN') && (
            <Field label="Bộ phận phụ trách cần bổ sung nội dung gì?" htmlFor="group-return-reason">
              <textarea
                id="group-return-reason"
                value={reason}
                disabled={busy}
                onChange={event => setReason(event.target.value)}
              />
            </Field>
          )}
          <div className={styles.dialogActions}>
            {!returning && detail.allowedActions.includes('CONFIRM') && (
              <Button autoWidth busy={busy} onClick={() => void decide('confirm')}>
                Xác nhận nhóm hồ sơ
              </Button>
            )}
            {detail.allowedActions.includes('RETURN') &&
              (returning ? (
                <>
                  <Button autoWidth busy={busy} disabled={!reason.trim()} onClick={() => void decide('return')}>
                    Gửi yêu cầu bổ sung
                  </Button>
                  <Button autoWidth tone="secondary" disabled={busy} onClick={() => setReturning(false)}>
                    Hủy
                  </Button>
                </>
              ) : (
                <Button autoWidth tone="secondary" disabled={busy} onClick={() => setReturning(true)}>
                  Yêu cầu bổ sung
                </Button>
              ))}
          </div>
        </>
      )}
    </Modal>
  )
}
