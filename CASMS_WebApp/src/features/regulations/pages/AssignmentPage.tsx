import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useSessionAccess } from '@/shared/auth'

import { regulationsApi } from '../api/regulations-api'
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
  PageHeader,
  Panel,
  StatusBadge,
  TableScroll,
} from '../components/RegulationUI'
import styles from '../components/Regulations.module.css'

function AssignmentTable({
  rows,
  direct,
  onRemove,
  removePermission,
}: {
  rows: AssignedRegulation[]
  direct: boolean
  onRemove: (item: AssignedRegulation) => void
  removePermission: string
}) {
  const access = useSessionAccess()
  if (!rows.length) {
    return (
      <div className={styles.emptyState}>
        <strong>Chưa có quy định được gán</strong>
        <p>
          Đối tượng chưa có liên kết {direct ? 'trực tiếp' : 'kế thừa'}.
        </p>
      </div>
    )
  }

  return (
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
          {rows.map((item) => (
            <tr key={`${item.sourceLabel}-${item.regulation.id}`}>
              <td><strong>{item.regulation.code}</strong><br />{item.regulation.name}</td>
              <td>{typeLabels[item.regulation.type]}</td>
              <td>{item.sourceLabel}</td>
              <td><StatusBadge status={item.regulation.status} /></td>
              <td>
                {direct ? (
                  (access.canDo(removePermission) ? <button
                    className={styles.linkButton}
                    disabled={!item.capabilities.canRemove.allowed || !access.canDo(removePermission)}
                    onClick={() => onRemove(item)}
                    title={item.capabilities.canRemove.reason}
                    type="button"
                  >
                    Gỡ liên kết
                  </button> : null)
                ) : (
                  <span title={item.capabilities.canRemove.reason}>Chỉ đọc</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  )
}

function AssignmentPage({ type }: { type: HostType }) {
  const access = useSessionAccess()
  const prefix = type === 'ship' ? 'SHIP_REGULATION' : 'CRUISE_REGULATION'
  const params = useParams()
  const routeId = type === 'ship' ? params.shipId : params.cruiseId
  const [loadedSnapshot, setSnapshot] = useState<AssignmentSnapshot | null>(null)
  const snapshot = loadedSnapshot?.host.id === routeId ? loadedSnapshot : null
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [candidates, setCandidates] = useState<CandidateRegulation[]>([])
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<RegulationStatus | 'ALL'>('ALL')
  const [selectedId, setSelectedId] = useState('')
  const [conflict, setConflict] = useState<ConflictResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [removeItem, setRemoveItem] = useState<AssignedRegulation | null>(null)
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const requestSequence = useRef(0)
  const mutationLock = useRef(false)

  const load = useCallback(async () => {
    try {
      setSnapshot(await regulationsApi.getAssignments(type, routeId ?? ''))
    } catch {
      setLoadError('Không tải được danh sách quy định đã gán.')
    } finally {
      setLoading(false)
    }
  }, [routeId, type])

  useEffect(() => {
    let active = true
    void regulationsApi
      .getAssignments(type, routeId ?? '')
      .then((data) => {
        if (active) setSnapshot(data)
      })
      .catch(() => {
        if (active) setLoadError('Không tải được danh sách quy định đã gán.')
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
    if (!access.canDo(`${prefix}_ASSIGN`) || !snapshot) return
    requestSequence.current += 1
    setAssignOpen(true)
    setChecking(false)
    setCandidateLoading(true)
    setSelectedId('')
    setConflict(null)
    setActionError('')
    setSearch('')
    setStatus('ALL')
    try {
      setCandidates(await regulationsApi.getCandidates(type, routeId ?? ''))
    } catch {
      setActionError('Không tải được danh sách ứng viên.')
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

  const checkCandidate = async (candidate: CandidateRegulation) => {
    if (!access.canDo(`${prefix}_READ`)) return
    const sequence = ++requestSequence.current
    setSelectedId(candidate.regulation.id)
    setConflict(null)
    setActionError('')
    if (!candidate.capabilities.canAssign.allowed) { setChecking(false); return }
    setChecking(true)
    try {
      const result = await regulationsApi.checkConflict(type, routeId ?? '', candidate.regulation.id)
      if (requestSequence.current === sequence) setConflict(result)
    } catch {
      if (requestSequence.current === sequence) {
        setConflict({
          severity: 'unavailable',
          title: 'Chưa xác định / kiểm tra thất bại',
          message: 'Chưa kiểm tra được xung đột. Vui lòng thử lại.',
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
    if (!selected || !conflict?.canProceed || mutationLock.current || !access.canDo(`${prefix}_ASSIGN`) || !snapshot) return
    mutationLock.current = true
    setSubmitting(true)
    setActionError('')
    try {
      const result = await regulationsApi.assign(
        type,
        routeId ?? '',
        selected.regulation.id,
      )
      setAssignOpen(false)
      setSuccess(result.message)
      await load()
    } catch {
      setActionError('Không thể gán quy định. Danh sách cũ vẫn được giữ nguyên.')
    } finally {
      mutationLock.current = false
      setSubmitting(false)
    }
  }

  const remove = async () => {
    if (!removeItem || !removeItem.capabilities.canRemove.allowed || mutationLock.current || !access.canDo(`${prefix}_REMOVE`) || !snapshot) return
    mutationLock.current = true
    setSubmitting(true)
    setActionError('')
    try {
      const result = await regulationsApi.remove(
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
      mutationLock.current = false
      setSubmitting(false)
    }
  }

  const title = `${snapshot?.host.name ?? (type === 'ship' ? 'Tàu' : 'Chuyến')} · Quy định`

  return (
    <AdminFrame>
      <PageHeader
        title={title}
        description={snapshot?.host.description ?? 'Quy định trực tiếp và kế thừa của đối tượng.'}
        actions={(access.canDo(`${prefix}_ASSIGN`) ? <Button disabled={loading || !snapshot || !access.canDo(`${prefix}_ASSIGN`)} onClick={() => void openAssign()}>Gán quy định</Button> : null)}
      />
      <div className={styles.twoColumn}>
        <Field label={type === 'ship' ? 'Hiệu lực tại thời điểm' : 'Thời điểm kiểm tra'}>
          <div className={styles.protectedValue}>{snapshot?.checkedAt ? formatDateTime(snapshot.checkedAt) : '—'}</div>
        </Field>
        <Field label="Múi giờ">
          <div className={styles.protectedValue}>{Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
        </Field>
      </div>

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
      {!loading && snapshot ? (
        <>
          <Panel title={`Gán trực tiếp cho ${type === 'ship' ? 'tàu' : 'chuyến'} · ${snapshot.direct.length}`}>
            <AssignmentTable direct removePermission={`${prefix}_REMOVE`} onRemove={setRemoveItem} rows={snapshot.direct} />
          </Panel>
          <Panel
            title={`Kế thừa từ ${type === 'ship' ? 'GLOBAL' : 'SHIP / GLOBAL'} · ${snapshot.inherited.length}`}

          >
            <AssignmentTable direct={false} removePermission={`${prefix}_REMOVE`} onRemove={setRemoveItem} rows={snapshot.inherited} />
          </Panel>
        </>
      ) : null}

      {assignOpen && access.canDo(`${prefix}_ASSIGN`) ? (
        <Modal busy={submitting}
          description={snapshot?.host.name ?? 'Chưa tải được tên đối tượng liên kết'}
          onClose={() => {
            if (!submitting) {
              requestSequence.current += 1
              setAssignOpen(false)
            }
          }}
          title={`Gán quy định cho ${type === 'ship' ? 'tàu' : 'chuyến'}`}
          wide
         footer={<div className={styles.modalActions}>
<Button disabled={submitting} onClick={() => setAssignOpen(false)} tone="secondary" data-overlay-dismiss>Hủy</Button>
{access.canDo(`${prefix}_ASSIGN`) && <Button
              disabled={submitting || !access.canDo(`${prefix}_ASSIGN`) || checking || !selected?.capabilities.canAssign.allowed || !conflict?.canProceed}
              onClick={() => void assign()}
            >
              {submitting ? 'Đang gán…' : 'Gán quy định'}
            </Button>}
</div>}>
          <div className={styles.twoColumn}>
            <Field htmlFor="candidate-search" label="Tìm quy định">
              <input
                id="candidate-search"
                onChange={(event) => {
                  requestSequence.current += 1
                  setSearch(event.target.value)
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
              {filteredCandidates.map((candidate) => (
                <label className={styles.candidateRow} key={candidate.regulation.id}>
                  <input
                    checked={selectedId === candidate.regulation.id}
                    name="candidate"
                    onChange={() => { requestSequence.current++; setSelectedId(candidate.regulation.id); setConflict(null); setChecking(false); setActionError('') }}
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
          {selected && !selected.capabilities.canAssign.allowed ? (
            <Notice title="Không thể gán ứng viên này" tone="warning">
              {selected.capabilities.canAssign.reason}
            </Notice>
          ) : null}
          {access.canDo(`${prefix}_READ`) && <Button tone="secondary" disabled={checking || submitting || !selected || !access.canDo(`${prefix}_READ`)} onClick={() => { if (selected) void checkCandidate(selected) }}>Kiểm tra trước khi gán</Button>}{checking ? <LoadingPanel label="Đang kiểm tra xung đột…" /> : null}
          {conflict ? <ConflictCard result={conflict} /> : null}
          {!selectedId && !checking ? (
            <Notice title="Chưa có kết quả kiểm tra" tone="neutral">
              Chọn một ứng viên để kiểm tra khả năng gán, xung đột và quyền thao tác.
            </Notice>
          ) : null}

        </Modal>
      ) : null}

      {removeItem && access.canDo(`${prefix}_REMOVE`) ? (
        <Modal busy={submitting}
          description="Chỉ gỡ liên kết trực tiếp; không xóa Regulation."
          onClose={() => {
            if (!submitting) setRemoveItem(null)
          }}
          title={`Gỡ ${removeItem.regulation.code} khỏi ${type === 'ship' ? 'tàu' : 'chuyến'}?`}
         footer={<div className={styles.modalActions}>
<Button disabled={submitting} onClick={() => setRemoveItem(null)} tone="secondary" data-overlay-dismiss>Hủy</Button>
{access.canDo(`${prefix}_REMOVE`) && <Button
              disabled={submitting || !access.canDo(`${prefix}_REMOVE`) || !removeItem.capabilities.canRemove.allowed}
              onClick={() => void remove()}
              tone="danger"
            >
              {submitting ? 'Đang gỡ…' : 'Gỡ liên kết'}
            </Button>}
</div>}>
          <Notice title="Ảnh hưởng của thao tác" tone="warning">
            <p>Đối tượng: {snapshot?.host.name}</p>
            <p>Quy định: {removeItem.regulation.name} · {removeItem.regulation.value} {removeItem.regulation.unit}</p>
            <p>Các nguồn kế thừa khác vẫn được giữ nguyên.</p>
          </Notice>
          {!removeItem.capabilities.canRemove.allowed ? (
            <Notice title="Cần xác nhận chính sách trước khi tiếp tục" tone="error">
              {removeItem.capabilities.canRemove.reason}
            </Notice>
          ) : null}
          {actionError ? <Notice title="Không thể gỡ liên kết" tone="error" role="alert">{actionError}</Notice> : null}

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
  return <AssignmentPage type="ship" />
}

export function CruiseRegulationsPage() {
  return <AssignmentPage type="cruise" />
}
