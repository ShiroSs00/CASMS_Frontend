import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'

import { paginateItems } from '../../../shared/pagination.ts'
import { regulationAdapter } from '../api/regulation-adapter'
import type {
  AssignedRegulation,
  AssignmentSnapshot,
  CandidateRegulation,
  ConflictResult,
  HostType,
  RegulationStatus,
} from '../model/regulation'
import {
  formatDateTime,
  scopeLabels,
  typeLabels,
} from '../model/regulation'
import {
  AdminFrame,
  Button,
  ConflictCard,
  Field,
  LoadingPanel,
  Modal,
  Notice,
  Pagination,
  PageHeader,
  Panel,
  StatusBadge,
  TableScroll,
} from '../components/RegulationUI'
import styles from '../components/Regulations.module.css'

const ASSIGNMENT_PAGE_SIZE_OPTIONS = [5, 10, 20] as const

function AssignmentTable({
  rows,
  direct,
  onRemove,
}: {
  rows: AssignedRegulation[]
  direct: boolean
  onRemove: (item: AssignedRegulation) => void
}) {
  const [requestedPage, setRequestedPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(ASSIGNMENT_PAGE_SIZE_OPTIONS[0])
  const page = useMemo(
    () => paginateItems(rows, requestedPage, pageSize),
    [pageSize, requestedPage, rows],
  )

  if (!rows.length) {
    return (
      <div className={styles.emptyState}>
        <strong>Không có quy định đang hiệu lực</strong>
        <p>
          Snapshot không chứa quy định {direct ? 'trực tiếp' : 'kế thừa'} đang hiệu lực tại thời điểm kiểm tra.
        </p>
      </div>
    )
  }

  return (
    <>
      <TableScroll>
        <table className={styles.table}>
        <thead>
          <tr>
            <th>MÃ / TÊN QUY ĐỊNH</th>
            <th>LOẠI</th>
            <th>NGUỒN</th>
            <th>TRẠNG THÁI</th>
            <th>THAO TÁC</th>
          </tr>
        </thead>
        <tbody>
          {page.items.map((item) => (
            <tr key={`${item.sourceLabel}-${item.regulation.id}`}>
              <td><strong>{item.regulation.code}</strong><br />{item.regulation.name}</td>
              <td>{typeLabels[item.regulation.type]}</td>
              <td>{item.sourceLabel}</td>
              <td><StatusBadge status={item.regulation.status} /></td>
              <td>
                {direct ? (
                  <button
                    className={styles.linkButton}
                    disabled={!item.capabilities.canRemove.allowed}
                    onClick={() => onRemove(item)}
                    title={item.capabilities.canRemove.reason}
                    type="button"
                  >
                    Gỡ liên kết
                  </button>
                ) : (
                  <span title={item.capabilities.canRemove.reason}>Chỉ đọc</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </TableScroll>
      {rows.length > ASSIGNMENT_PAGE_SIZE_OPTIONS[0] ? (
        <Pagination
          end={page.end}
          itemLabel={direct ? 'liên kết trực tiếp' : 'quy định kế thừa'}
          onPageChange={setRequestedPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize as typeof pageSize)
            setRequestedPage(1)
          }}
          page={page.page}
          pageSize={page.pageSize}
          pageSizeOptions={ASSIGNMENT_PAGE_SIZE_OPTIONS}
          start={page.start}
          total={page.total}
          totalPages={page.totalPages}
        />
      ) : null}
    </>
  )
}

function AssignmentPage({ type }: { type: HostType }) {
  const params = useParams()
  const routeId = type === 'ship' ? params.shipId : params.cruiseId
  const [snapshot, setSnapshot] = useState<AssignmentSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [candidates, setCandidates] = useState<CandidateRegulation[]>([])
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<RegulationStatus | 'ALL'>('ALL')
  const [candidatePage, setCandidatePage] = useState(1)
  const [candidatePageSize, setCandidatePageSize] = useState<number>(ASSIGNMENT_PAGE_SIZE_OPTIONS[0])
  const [selectedId, setSelectedId] = useState('')
  const [conflict, setConflict] = useState<ConflictResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [removeItem, setRemoveItem] = useState<AssignedRegulation | null>(null)
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const requestSequence = useRef(0)

  const load = useCallback(async () => {
    try {
      const nextSnapshot = await regulationAdapter.getAssignments(type, routeId ?? '')
      setSnapshot(nextSnapshot)
      setLoadError('')
    } catch (error) {
      setSnapshot(null)
      setLoadError(error instanceof Error ? error.message : 'Không tải được danh sách quy định đã gán.')
    } finally {
      setLoading(false)
    }
  }, [routeId, type])

  useEffect(() => {
    let active = true
    void regulationAdapter
      .getAssignments(type, routeId ?? '')
      .then((data) => {
        if (active) setSnapshot(data)
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Không tải được danh sách quy định đã gán.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [routeId, type])

  useEffect(() => {
    if (!success) return
    const timeout = window.setTimeout(() => setSuccess(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [success])

  const openAssign = async () => {
    setAssignOpen(true)
    setCandidateLoading(true)
    setSelectedId('')
    setConflict(null)
    setChecking(false)
    setActionError('')
    setSearch('')
    setStatus('ALL')
    setCandidatePage(1)
    try {
      setCandidates(await regulationAdapter.getCandidates(
        type,
        routeId ?? '',
      ))
    } catch (error) {
      setCandidates([])
      setActionError(error instanceof Error ? error.message : 'Không tải được danh sách ứng viên.')
    } finally {
      setCandidateLoading(false)
    }
  }

  const filteredCandidates = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('vi')
    return candidates.filter(({ regulation }) => {
      const matchesSearch =
        !term ||
        regulation.code.toLocaleLowerCase('vi').includes(term) ||
        regulation.name.toLocaleLowerCase('vi').includes(term)
      return matchesSearch && (status === 'ALL' || regulation.status === status)
    })
  }, [candidates, search, status])

  const candidatePagination = useMemo(
    () => paginateItems(filteredCandidates, candidatePage, candidatePageSize),
    [candidatePage, candidatePageSize, filteredCandidates],
  )

  const changeCandidatePage = (page: number) => {
    requestSequence.current += 1
    setCandidatePage(page)
    setSelectedId('')
    setConflict(null)
    setChecking(false)
  }

  const selectCandidate = async (candidate: CandidateRegulation) => {
    const sequence = ++requestSequence.current
    setSelectedId(candidate.regulation.id)
    setConflict(null)
    setActionError('')
    if (!candidate.capabilities.canAssign.allowed) return
    setChecking(true)
    try {
      const result = await regulationAdapter.checkConflict(
        type,
        routeId ?? '',
        candidate.regulation.id,
      )
      if (requestSequence.current === sequence) setConflict(result)
    } catch {
      if (requestSequence.current === sequence) {
        setConflict({
          severity: 'unavailable',
          title: 'Chưa xác định / kiểm tra thất bại',
          message: 'Không biến lỗi kiểm tra thành “Không có xung đột”.',
          canProceed: false,
          comparedWith: [],
        })
      }
    } finally {
      if (requestSequence.current === sequence) setChecking(false)
    }
  }

  const selected = candidates.find(
    (candidate) => candidate.regulation.id === selectedId,
  )

  const assign = async () => {
    if (!selected || !conflict?.canProceed || submitting) return
    setSubmitting(true)
    setActionError('')
    try {
      const result = await regulationAdapter.assign(
        type,
        routeId ?? '',
        selected.regulation.id,
      )
      setAssignOpen(false)
      setSuccess(result.message)
      await load()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể gán quy định.')
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async () => {
    if (!removeItem || !removeItem.capabilities.canRemove.allowed || submitting) return
    setSubmitting(true)
    setActionError('')
    try {
      const result = await regulationAdapter.remove(
        type,
        routeId ?? '',
        removeItem.regulation.id,
      )
      setRemoveItem(null)
      setSuccess(result.message)
      await load()
    } catch (error) {
      setActionError(
        error instanceof Error && error.message === 'LAST_TARGET'
          ? 'Không thể gỡ đối tượng cuối cùng theo BR-REG-05.'
          : 'Không thể gỡ liên kết. Danh sách cũ vẫn được giữ nguyên.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const title = snapshot?.host.name
    ? `${snapshot.host.name} · Quy định`
    : type === 'ship'
      ? 'Quy định của tàu'
      : 'Quy định của chuyến'

  return (
    <AdminFrame>
      <PageHeader
        title={title}
        description={`${snapshot?.host.description ?? routeId ?? ''} · Backend`}
        actions={<Button disabled={loading || !snapshot || Boolean(loadError)} onClick={() => void openAssign()}>Gán quy định</Button>}
      />
      <div className={styles.twoColumn}>
        <Field label={type === 'ship' ? 'Hiệu lực tại thời điểm' : 'Thời điểm kiểm tra'}>
          <div className={styles.protectedValue}>{snapshot ? formatDateTime(snapshot.checkedAt) : 'Chưa có dữ liệu'}</div>
        </Field>
        <Field label="Múi giờ">
          <div className={styles.protectedValue}>Asia/Ho_Chi_Minh</div>
        </Field>
      </div>

      {snapshot?.sourceNotice ? (
        <Notice title="Backend Regulation chưa khả dụng" tone="warning" role="status">
          {snapshot.sourceNotice}
        </Notice>
      ) : null}

      {loading ? <LoadingPanel label="Đang tải quy định được gán…" /> : null}
      {!loading && loadError ? (
        <Notice title="Không tải được dữ liệu" tone="error" role="alert">
          <p>{loadError}</p>
          <Button
            onClick={() => {
              setLoading(true)
              setLoadError('')
              void load()
            }}
            tone="secondary"
          >
            Thử lại
          </Button>
        </Notice>
      ) : null}
      {!loading && !loadError && snapshot ? (
        <>
          <Panel title={`Gán trực tiếp cho ${type === 'ship' ? 'tàu' : 'chuyến'} · ${snapshot.direct.length}`} subtitle="Snapshot BE chỉ gồm quy định đang hiệu lực tại thời điểm kiểm tra; không phải toàn bộ liên kết đã gán.">
            <AssignmentTable direct onRemove={setRemoveItem} rows={snapshot.direct} />
          </Panel>
          <Panel
            title={`Kế thừa từ ${type === 'ship' ? 'GLOBAL' : 'SHIP / GLOBAL'} · ${snapshot.inherited.length}`}
            subtitle="Quy định kế thừa chỉ đọc; không thể gỡ tại màn hình này."
          >
            <AssignmentTable direct={false} onRemove={setRemoveItem} rows={snapshot.inherited} />
          </Panel>
          <Notice title="Không suy luận ưu tiên" tone="info">
            Có quy định trực tiếp không đồng nghĩa ghi đè quy định từ nguồn khác. Kết quả hiển thị phải đến từ dịch vụ kiểm tra.
          </Notice>
        </>
      ) : null}

      {assignOpen ? (
        <Modal
          description={`${snapshot?.host.name ?? routeId} · ${snapshot?.source === 'backend' ? 'Ứng viên từ backend' : 'Ứng viên demo'}`}
          onClose={() => {
            if (!submitting) {
              requestSequence.current += 1
              setAssignOpen(false)
            }
          }}
          title={`Gán quy định cho ${type === 'ship' ? 'tàu' : 'chuyến'}`}
          wide
        >
          <div className={styles.twoColumn}>
            <Field htmlFor="candidate-search" label="Tìm quy định">
              <input
                id="candidate-search"
                onChange={(event) => {
                  requestSequence.current += 1
                  setSearch(event.target.value)
                  setCandidatePage(1)
                  setSelectedId('')
                  setConflict(null)
                  setChecking(false)
                }}
                placeholder="Nhập mã hoặc tên"
                value={search}
              />
            </Field>
            <Field htmlFor="candidate-status" label="Trạng thái">
              <select
                id="candidate-status"
                onChange={(event) => {
                  requestSequence.current += 1
                  setStatus(event.target.value as RegulationStatus | 'ALL')
                  setCandidatePage(1)
                  setSelectedId('')
                  setConflict(null)
                  setChecking(false)
                }}
                value={status}
              >
                <option value="ALL">Tất cả</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="DRAFT">Bản nháp</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
                <option value="EXPIRED">Hết hạn</option>
              </select>
            </Field>
          </div>
          <Notice title={`Phạm vi cố định: ${type === 'ship' ? 'SHIP' : 'CRUISE'}`} tone="info">
            Chỉ hiển thị ứng viên đúng phạm vi của đối tượng hiện tại.
          </Notice>
          {candidateLoading ? <LoadingPanel label="Đang tải ứng viên…" /> : null}
          {!candidateLoading && actionError ? <Notice title="Không tải được dữ liệu" tone="error" role="alert">{actionError}</Notice> : null}
          {!candidateLoading && !actionError && filteredCandidates.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>Không có kết quả phù hợp</strong>
              <p>Thử mã/tên khác hoặc xóa bộ lọc.</p>
            </div>
          ) : null}
          {!candidateLoading && filteredCandidates.length ? (
            <div className={styles.candidateList} role="radiogroup" aria-label="Ứng viên quy định">
              {candidatePagination.items.map((candidate) => (
                <label className={styles.candidateRow} key={candidate.regulation.id}>
                  <input
                    checked={selectedId === candidate.regulation.id}
                    name="candidate"
                    onChange={() => void selectCandidate(candidate)}
                    type="radio"
                  />
                  <span>
                    <strong>{candidate.regulation.code} · {candidate.regulation.name}</strong>
                    <span className={styles.candidateMeta}>
                      {typeLabels[candidate.regulation.type]} · {scopeLabels[candidate.regulation.scope]} · {candidate.regulation.value} {candidate.regulation.unit}
                    </span>
                  </span>
                  <StatusBadge status={candidate.regulation.status} />
                </label>
              ))}
            </div>
          ) : null}
          {!candidateLoading && !actionError && filteredCandidates.length ? (
            <Pagination
              end={candidatePagination.end}
              itemLabel="ứng viên"
              onPageChange={changeCandidatePage}
              onPageSizeChange={(pageSize) => {
                setCandidatePageSize(pageSize)
                changeCandidatePage(1)
              }}
              page={candidatePagination.page}
              pageSize={candidatePagination.pageSize}
              pageSizeOptions={ASSIGNMENT_PAGE_SIZE_OPTIONS}
              start={candidatePagination.start}
              total={candidatePagination.total}
              totalPages={candidatePagination.totalPages}
            />
          ) : null}
          {selected && !selected.capabilities.canAssign.allowed ? (
            <Notice title="Không thể gán ứng viên này" tone="warning">
              {selected.capabilities.canAssign.reason}
            </Notice>
          ) : null}
          {checking ? <LoadingPanel label="Đang kiểm tra xung đột…" /> : null}
          {conflict ? <ConflictCard result={conflict} /> : null}
          {!selectedId && !checking ? (
            <Notice title="Chưa có kết quả kiểm tra" tone="neutral">
              Chọn một ứng viên để kiểm tra khả năng gán, xung đột và quyền thao tác.
            </Notice>
          ) : null}
          <div className={styles.modalActions}>
            <Button
              disabled={submitting || checking || !selected?.capabilities.canAssign.allowed || !conflict?.canProceed}
              onClick={() => void assign()}
            >
              {submitting ? 'Đang gán…' : 'Gán quy định'}
            </Button>
            <Button disabled={submitting} onClick={() => setAssignOpen(false)} tone="secondary">Hủy</Button>
          </div>
        </Modal>
      ) : null}

      {removeItem ? (
        <Modal
          description="Chỉ gỡ liên kết trực tiếp; không xóa Regulation."
          onClose={() => {
            if (!submitting) setRemoveItem(null)
          }}
          title={`Gỡ ${removeItem.regulation.code} khỏi ${type === 'ship' ? 'tàu' : 'chuyến'}?`}
        >
          <Notice title="Ảnh hưởng của thao tác" tone="warning">
            <p>Đối tượng: {snapshot?.host.id} · {snapshot?.host.name}</p>
            <p>Quy định: {removeItem.regulation.name} · {removeItem.regulation.value} {removeItem.regulation.unit}</p>
            <p>Các nguồn kế thừa khác vẫn được giữ nguyên.</p>
          </Notice>
          {!removeItem.capabilities.canRemove.allowed ? (
            <Notice title="Cần xác nhận chính sách trước khi tiếp tục" tone="error">
              {removeItem.capabilities.canRemove.reason}
            </Notice>
          ) : null}
          {actionError ? <Notice title="Không thể gỡ liên kết" tone="error" role="alert">{actionError}</Notice> : null}
          <div className={styles.modalActions}>
            <Button
              disabled={submitting || !removeItem.capabilities.canRemove.allowed}
              onClick={() => void remove()}
              tone="danger"
            >
              {submitting ? 'Đang gỡ…' : 'Gỡ liên kết'}
            </Button>
            <Button disabled={submitting} onClick={() => setRemoveItem(null)} tone="secondary">Hủy</Button>
          </div>
        </Modal>
      ) : null}

      {success ? (
        <div className={styles.successToast}>
          <Notice title="Thao tác thành công" tone="success" role="status">{success}</Notice>
        </div>
      ) : null}
    </AdminFrame>
  )
}

export function ShipRegulationsPage() {
  const { shipId } = useParams()
  return <AssignmentPage key={shipId} type="ship" />
}

export function CruiseRegulationsPage() {
  const { cruiseId } = useParams()
  return <AssignmentPage key={cruiseId} type="cruise" />
}
