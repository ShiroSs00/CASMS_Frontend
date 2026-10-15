import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'

import { Badge, Button, ButtonLink, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'

import { CruiseFrame, CruiseStatusBadge } from '../components/CruiseUI'
import { ShipAssignmentDialog, type AssignmentMode } from '../components/ShipAssignmentDialog'
import { cruiseApi } from '../api/cruise-api'
import styles from '../components/Cruises.module.css'
import { useCruiseDetail } from '../hooks/useCruiseDetail'
import { cruiseTypeLabels, type ReadinessCheck } from '../model/cruise-view'

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function checkTone(state: ReadinessCheck['state']) {
  if (state === 'PASS') return 'success' as const
  if (state === 'BLOCKED') return 'error' as const
  return 'warning' as const
}

export function CruiseDetailPage() {
  const { cruiseId } = useParams()
  const { state, refresh } = useCruiseDetail(cruiseId)
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode | null>(null)
  const [lifecycleAction, setLifecycleAction] = useState<'publish' | 'start' | 'complete' | 'cancel' | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [lifecycleError, setLifecycleError] = useState('')
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const [lifecycleSuccess, setLifecycleSuccess] = useState('')
  const mutationLock = useRef(false)

  async function confirmLifecycle() {
    if (!cruiseId || !lifecycleAction || mutationLock.current) return
    mutationLock.current = true
    setLifecycleSuccess('')
    setLifecycleBusy(true)
    setLifecycleError('')
    try {
      if (lifecycleAction === 'publish') {
        const readiness = await cruiseApi.readiness(cruiseId)
        if (!readiness.ready) throw new Error(readiness.issues?.join(' · ') || 'Cruise chưa sẵn sàng phát hành.')
      }
      if (lifecycleAction === 'cancel') await cruiseApi.cancel(cruiseId, cancelReason.trim())
      else await cruiseApi[lifecycleAction](cruiseId)
      setLifecycleAction(null)
      setCancelReason('')
      await refresh()
      setLifecycleSuccess('Đã cập nhật trạng thái cruise.')
    } catch (error) {
      setLifecycleError(error instanceof Error ? error.message : 'Không cập nhật được vòng đời cruise.')
    } finally {
      mutationLock.current = false
      setLifecycleBusy(false)
    }
  }

  return <CruiseFrame>
    <div className={styles.content}>
      {lifecycleSuccess && <Notice title="Đã cập nhật" tone="success">{lifecycleSuccess}</Notice>}
      {state.status === 'loading' && !state.data && <Loading label="Đang tải chi tiết cruise…" />}
      {state.status === 'error' && <Notice title="Không tải được cruise" tone="error"><p>{state.error}</p><Button onClick={refresh}>Thử lại</Button></Notice>}
      {state.data && (() => {
        const detail = state.data
        const cruise = detail.cruise
        const assignmentReason = detail.ship
          ? detail.assignmentCapabilities.change.reason ?? detail.assignmentCapabilities.unassign.reason
          : detail.assignmentCapabilities.assign.reason
        return <>
          <PageHeader breadcrumb="VẬN HÀNH / CRUISE" title={`${cruise.cruiseCode} · ${cruise.cruiseName}`} description={`${formatDateTime(cruise.departureDatetime)} → ${formatDateTime(cruise.returnDatetime)} · ${detail.ship?.shipName ?? 'Chưa phân công'}`} actions={cruise.status === 'DRAFT' && <ButtonLink to={`/admin/cruises/${cruise.cruiseId}/edit`} tone="secondary">Chỉnh sửa cruise</ButtonLink>} />
          <section className={styles.detailMetrics} aria-label="Trạng thái cruise"><div><span>CRUISE</span><CruiseStatusBadge status={cruise.status} /></div><div><span>HẢI TRÌNH</span><Badge label={detail.readiness.checks.find((check) => check.key === 'ITINERARY')?.state === 'PASS' ? 'Đã cấu hình' : 'Chưa cấu hình'} tone={detail.readiness.checks.find((check) => check.key === 'ITINERARY')?.state === 'PASS' ? 'success' : 'warning'} /></div><div><span>TÀU</span><Badge label={detail.ship?.shipName ?? 'Chưa phân công'} tone={detail.ship?.status === 'ACTIVE' ? 'info' : 'warning'} /></div><div><span>HÀNH KHÁCH</span><Badge label={detail.capacity.activePassengerCount === null ? 'Chưa xác định' : `${detail.capacity.activePassengerCount} khách`} tone={detail.bookingHasData ? 'warning' : 'neutral'} /></div></section>
          <div className={styles.detailColumns}>
            <div>
              <Panel title="Thông tin chuyến"><dl className={styles.definitionGrid}><dt>Mã chuyến</dt><dd>{cruise.cruiseCode}</dd><dt>Loại chuyến</dt><dd>{cruiseTypeLabels[cruise.cruiseType]} · {cruise.cruiseType}</dd><dt>Khởi hành</dt><dd>{formatDateTime(cruise.departureDatetime)}</dd><dt>Kết thúc</dt><dd>{formatDateTime(cruise.returnDatetime)}</dd><dt>Cảng đi</dt><dd>{detail.departurePort.portName}</dd><dt>Cảng về</dt><dd>{detail.returnPort.portName}</dd></dl></Panel>
              <Panel title="Lịch trình" subtitle="Ngày, điểm dừng và trạng thái phê duyệt được quản lý tại hải trình."><ButtonLink tone="secondary" to="/admin/itineraries">Mở danh sách hải trình</ButtonLink></Panel>
            </div>
            <div>
              <Panel title="Tàu được phân công" subtitle={detail.ship ? `${detail.ship.status} · ${detail.ship.totalCapacity} khách` : 'Cruise chưa có tàu'}>
                {!detail.ship && <Button disabled={!detail.assignmentCapabilities.assign.allowed} onClick={() => setAssignmentMode('assign')}>Phân công tàu</Button>}
                {detail.ship && <><Button disabled={!detail.assignmentCapabilities.change.allowed} onClick={() => setAssignmentMode('change')}>Đổi tàu</Button><Button tone="danger" disabled={!detail.assignmentCapabilities.unassign.allowed} onClick={() => setAssignmentMode('unassign')}>Gỡ tàu</Button></>}
                {assignmentReason && <p className={styles.muted}>{assignmentReason}</p>}
              </Panel>
              <Panel title="Điều khiển vòng đời" subtitle="Mỗi chuyển trạng thái đều cần xác nhận.">
                <div className={styles.lifecycleActions}>
                  {cruise.status === 'DRAFT' && <Button disabled={lifecycleBusy || state.status !== 'ready' || detail.readiness.state !== 'READY'} onClick={() => setLifecycleAction('publish')}>Phát hành cruise</Button>}
                  {cruise.status === 'PUBLISHED' && <Button disabled={lifecycleBusy || detail.ship?.status !== 'ACTIVE'} onClick={() => setLifecycleAction('start')}>Bắt đầu vận hành</Button>}
                  {cruise.status === 'IN_PROGRESS' && <Button onClick={() => setLifecycleAction('complete')}>Hoàn thành cruise</Button>}
                  {!['COMPLETED', 'CANCELLED'].includes(cruise.status) && <Button tone="danger" onClick={() => setLifecycleAction('cancel')}>Hủy cruise</Button>}
                  {['COMPLETED', 'CANCELLED'].includes(cruise.status) && <p className={styles.muted}>Cruise đã ở trạng thái kết thúc, không còn thao tác vòng đời.</p>}
                </div>
              </Panel>
              <Panel title="Sức chứa hành khách"><div className={styles.capacityValue}>{detail.capacity.activePassengerCount ?? '—'} / {detail.capacity.shipTotalCapacity ?? '—'}</div><p>Còn {detail.capacity.remainingPassengerHeadroom ?? '—'} chỗ theo sức chứa tàu.</p><p className={styles.muted}>Không đồng nghĩa cabin hoặc hạng cabin còn khả dụng.</p></Panel>
            </div>
          </div>
          <Panel title={`Quy định vận hành · ${detail.regulations.length}`} subtitle="Quy định trực tiếp và kế thừa được hiển thị riêng; nguồn kế thừa chỉ đọc tại đây.">
            {detail.regulations.length ? <ul className={styles.compactList}>{detail.regulations.map((regulation) => <li key={regulation.regulationId}><strong>{regulation.code} · {regulation.name}</strong><span>{regulation.source} · {regulation.status}</span></li>)}</ul> : <Empty title="Chưa có quy định áp dụng" />}
            <ButtonLink to={`/admin/cruises/${cruise.cruiseId}/regulations`}>Quản lý quy định</ButtonLink>
          </Panel>
          <Panel title={`Sẵn sàng vận hành · ${detail.readiness.state}`} subtitle="Kết quả kiểm tra sẵn sàng mới nhất từ hệ thống."><ul className={styles.compactList}>{detail.readiness.checks.map((check) => <li key={check.key}><span><Badge label={check.state} tone={checkTone(check.state)} /> <strong>{check.label}</strong></span><span>{check.reason}</span></li>)}</ul>{detail.readiness.issues?.map((issue) => <Notice key={issue} title="Cần kiểm tra" tone="warning">{issue}</Notice>)}</Panel>
          <Panel title={`Sự cố liên quan · ${detail.issues.filter((issue) => issue.status === 'OPEN' || issue.status === 'IN_PROGRESS').length} đang mở`}>
            {detail.issues.length ? <ul className={styles.compactList}>{detail.issues.map((issue) => <li key={issue.issueId}><span><Badge label={issue.severity} tone={issue.severity === 'CRITICAL' ? 'error' : 'warning'} /> <strong>{issue.issueCode}</strong></span><span>{issue.description} · {issue.status}</span></li>)}</ul> : <Empty title="Không có sự cố liên quan" />}
            <Link className={styles.inlineLink} to={`/admin/issues?cruise=${cruise.cruiseId}`}>Xem danh sách sự cố →</Link>
          </Panel>
          {assignmentMode && <ShipAssignmentDialog detail={detail} mode={assignmentMode} onClose={() => setAssignmentMode(null)} onChanged={() => { void refresh(); setLifecycleSuccess('Đã cập nhật phân công tàu.') }} />}
          {lifecycleAction && <Modal busy={lifecycleBusy} title="Xác nhận chuyển trạng thái" onClose={() => { if (!lifecycleBusy) setLifecycleAction(null) }}>
            <p>{cruise.cruiseCode} · thao tác {lifecycleAction.toUpperCase()}</p>
            {lifecycleAction === 'cancel' && <Field htmlFor="cancel-reason" label="Lý do hủy"><textarea id="cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} /></Field>}
            {lifecycleError && <Notice title="Không thể cập nhật" tone="error"><p>{lifecycleError}</p></Notice>}
            <div className={styles.dialogActions}><Button tone={lifecycleAction === 'cancel' ? 'danger' : 'primary'} disabled={lifecycleBusy || (lifecycleAction === 'cancel' && !cancelReason.trim())} onClick={() => void confirmLifecycle()}>{lifecycleBusy ? 'Đang xử lý…' : 'Xác nhận'}</Button><Button tone="secondary" disabled={lifecycleBusy} onClick={() => setLifecycleAction(null)}>Quay lại</Button></div>
          </Modal>}
        </>
      })()}
    </div>
  </CruiseFrame>
}
