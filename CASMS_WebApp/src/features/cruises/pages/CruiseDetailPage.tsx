import { journeyTime } from '@/shared/lib/journey-time'
import { PermissionLink as Link } from '@/shared/ui'
import { CruiseOperations } from '../components/CruiseOperations'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useSessionAccess } from '@/shared/auth'

import { Badge, Button, ButtonLink, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'

import { CruiseFrame, CruiseStatusBadge } from '../components/CruiseUI'
import { ShipAssignmentDialog, type AssignmentMode } from '../components/ShipAssignmentDialog'
import { cruiseApi } from '../api/cruise-api'
import styles from '../components/Cruises.module.css'
import { useCruiseDetail } from '../hooks/useCruiseDetail'
import { cruiseTypeLabels, itineraryStatusLabels, type ReadinessCheck } from '../model/cruise-view'
import { CruiseChecks } from '../components/CruiseChecks'

const lifecyclePermissions = { publish: 'CRUISE_PUBLISH', start: 'CRUISE_START', complete: 'CRUISE_COMPLETE', cancel: 'CRUISE_CANCEL', deleteDraft: 'CRUISE_DELETE_DRAFT' } as const

function formatDateTime(value: string) {
  return journeyTime(value)
}

function checkTone(state: ReadinessCheck['state']) {
  if (state === 'PASS') return 'success' as const
  if (state === 'BLOCKED') return 'error' as const
  return 'warning' as const
}

export function CruiseDetailPage() {
  const access = useSessionAccess()
  const { cruiseId } = useParams()
  const navigate = useNavigate()
  const { state, refresh } = useCruiseDetail(cruiseId)
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode | null>(null)
  const [lifecycleAction, setLifecycleAction] = useState<'publish' | 'start' | 'complete' | 'cancel' | 'deleteDraft' | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [lifecycleError, setLifecycleError] = useState('')
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const [lifecycleSuccess, setLifecycleSuccess] = useState('')
  const mutationLock = useRef(false)

  async function confirmLifecycle() {
    if (!cruiseId || !lifecycleAction || mutationLock.current || !access.has(lifecyclePermissions[lifecycleAction])) return
    mutationLock.current = true
    setLifecycleSuccess('')
    setLifecycleBusy(true)
    setLifecycleError('')
    try {
      if (lifecycleAction === 'deleteDraft') {
        await cruiseApi.deleteDraft(cruiseId)
        setLifecycleAction(null)
        navigate('/admin/cruises')
        return
      }
      if (lifecycleAction === 'publish') {
        const readiness = await cruiseApi.readiness(cruiseId)
        if (!readiness.ready) throw new Error(readiness.issues?.join(' · ') || 'Chuyến đi chưa đủ điều kiện công bố.')
      }
      if (lifecycleAction === 'cancel') await cruiseApi.cancel(cruiseId, cancelReason.trim())
      else await cruiseApi[lifecycleAction](cruiseId)
      setLifecycleAction(null)
      setCancelReason('')
      await refresh()
      setLifecycleSuccess('Đã cập nhật trạng thái chuyến đi.')
    } catch (error) {
      setLifecycleError(error instanceof Error ? error.message : 'Không cập nhật được trạng thái chuyến đi.')
    } finally {
      mutationLock.current = false
      setLifecycleBusy(false)
    }
  }

  return <CruiseFrame>
    <div className={styles.content}>
      {lifecycleSuccess && <Notice title="Đã cập nhật" tone="success">{lifecycleSuccess}</Notice>}
      {state.status === 'loading' && !state.data && <Loading label="Đang tải chi tiết chuyến đi…" />}
      {state.status === 'error' && <Notice title="Không tải được chuyến đi" tone="error"><p>{state.error}</p><Button onClick={refresh}>Thử lại</Button></Notice>}
      {state.data && (() => {
        const detail = state.data
        const cruise = detail.cruise
        const assignmentReason = detail.ship
          ? detail.assignmentCapabilities.change.reason ?? detail.assignmentCapabilities.unassign.reason
          : detail.assignmentCapabilities.assign.reason
        return <>
          {detail.supplementaryLoading && <Loading label="Đang tải thông tin liên quan đến chuyến…" />}
          {Object.entries(detail.supplementaryErrors ?? {}).map(([key, message]) => <Notice key={key} title={`Chưa tải được ${{ ship: 'tàu', departurePort: 'cảng đi', returnPort: 'cảng về', readiness: 'điều kiện sẵn sàng', capacity: 'sức chứa', issues: 'sự cố', regulations: 'quy định', itinerary: 'lịch trình' }[key] ?? 'thông tin liên quan'}`} tone="error"><p>{message}</p><Button onClick={refresh}>Thử lại</Button></Notice>)}
          <PageHeader breadcrumb="VẬN HÀNH / CHUYẾN ĐI" title={`${cruise.cruiseCode} · ${cruise.cruiseName}`} description={`${formatDateTime(cruise.departureDatetime)} → ${formatDateTime(cruise.returnDatetime)} · ${detail.ship?.shipName ?? (cruise.shipId ? 'Chưa tải được thông tin tàu' : 'Chưa phân công')}`} actions={cruise.status === 'DRAFT' && access.has('CRUISE_UPDATE_DRAFT') && <ButtonLink to={`/admin/cruises/${cruise.cruiseId}/edit`} tone="secondary">Chỉnh sửa chuyến đi</ButtonLink>} />
          <section className={styles.detailMetrics} aria-label="Trạng thái chuyến đi"><div><span>CHUYẾN ĐI</span><CruiseStatusBadge status={cruise.status} /></div><div><span>LỊCH TRÌNH</span><Badge label={detail.itinerary ? itineraryStatusLabels[detail.itinerary.status] : 'Chưa xác định'} tone={detail.readiness.checks.find((check) => check.key === 'ITINERARY')?.state === 'PASS' ? 'success' : 'warning'} /></div><div><span>TÀU</span><Badge label={detail.ship?.shipName ?? (cruise.shipId ? 'Chưa tải được thông tin tàu' : 'Chưa phân công')} tone={detail.ship?.status === 'ACTIVE' ? 'info' : 'warning'} /></div><div><span>HÀNH KHÁCH</span><Badge label={detail.capacity.activePassengerCount === null ? 'Chưa xác định' : `${detail.capacity.activePassengerCount} khách`} tone={detail.bookingHasData ? 'warning' : 'neutral'} /></div></section>
          <div className={styles.detailColumns}>
            <div>
              <Panel title="Thông tin chuyến"><dl className={styles.definitionGrid}><dt>Mã chuyến</dt><dd>{cruise.cruiseCode}</dd><dt>Thời lượng chuyến</dt><dd>{cruiseTypeLabels[cruise.cruiseType]}</dd><dt>Khởi hành</dt><dd>{formatDateTime(cruise.departureDatetime)}</dd><dt>Kết thúc</dt><dd>{formatDateTime(cruise.returnDatetime)}</dd><dt>Cảng đi</dt><dd>{detail.departurePort.portName}</dd><dt>Cảng về</dt><dd>{detail.returnPort.portName}</dd></dl></Panel>
              {access.has('ITINERARY_READ') && <Panel title="Lịch trình" subtitle="Ngày, lần ghé cảng và trạng thái phê duyệt được quản lý trong lịch trình của chuyến đi.">
                {detail.itinerary ? <><p>{detail.itinerary.itineraryName} · {detail.itinerary.startDate} → {detail.itinerary.endDate}</p><ButtonLink to={`/admin/itineraries/${detail.itinerary.itineraryId}`}>Mở lịch trình của chuyến</ButtonLink></>
                  : !detail.supplementaryLoading && !detail.supplementaryErrors?.itinerary ? <><p>Chuyến chưa có lịch trình.</p><ButtonLink to={`/admin/itineraries/new?cruiseId=${cruise.cruiseId}`}>Tạo lịch trình cho chuyến này</ButtonLink></> : <p>Chưa xác định được lịch trình liên kết.</p>}
              </Panel>}
            </div>
            <div>
              {access.can({mode:'ANY',permissions:['SHIP_READ','CRUISE_ASSIGN_SHIP','CRUISE_CHANGE_SHIP','CRUISE_UNASSIGN_SHIP']}) && <Panel title="Tàu được phân công" subtitle={detail.ship ? `${detail.ship.status} · ${detail.ship.totalCapacity} khách` : 'Chuyến đi chưa có tàu'}>
                {!detail.ship && (access.has('CRUISE_ASSIGN_SHIP') ? <Button disabled={!detail.assignmentCapabilities.assign.allowed || !access.has('CRUISE_ASSIGN_SHIP')} onClick={() => setAssignmentMode('assign')}>Phân công tàu</Button> : null)}
                {detail.ship && <>{access.has('CRUISE_CHANGE_SHIP') && <Button disabled={!detail.assignmentCapabilities.change.allowed || !access.has('CRUISE_CHANGE_SHIP')} onClick={() => setAssignmentMode('change')}>Đổi tàu</Button>}{access.has('CRUISE_UNASSIGN_SHIP') && <Button tone="danger" disabled={!detail.assignmentCapabilities.unassign.allowed || !access.has('CRUISE_UNASSIGN_SHIP')} onClick={() => setAssignmentMode('unassign')}>Gỡ tàu</Button>}</>}
                {assignmentReason && <p className={styles.muted}>{assignmentReason}</p>}
              </Panel>}
              <Panel title="Điều khiển vòng đời" subtitle="Mỗi chuyển trạng thái đều cần xác nhận.">
                <div className={styles.lifecycleActions}>
                  {cruise.status === 'DRAFT' && (access.has('CRUISE_PUBLISH') ? <Button disabled={lifecycleBusy || !access.has('CRUISE_PUBLISH') || state.status !== 'ready' || detail.readiness.state !== 'READY'} onClick={() => setLifecycleAction('publish')}>Công bố chuyến đi</Button> : null)}
                  {cruise.status === 'PUBLISHED' && (access.has('CRUISE_START') ? <Button disabled={lifecycleBusy || !access.has('CRUISE_START') || detail.ship?.status !== 'ACTIVE'} onClick={() => setLifecycleAction('start')}>Bắt đầu vận hành</Button> : null)}
                  {cruise.status === 'IN_PROGRESS' && (access.has('CRUISE_COMPLETE') ? <Button disabled={lifecycleBusy || !access.has('CRUISE_COMPLETE')} onClick={() => setLifecycleAction('complete')}>Kết thúc chuyến đi</Button> : null)}
                  {!['COMPLETED', 'CANCELLED'].includes(cruise.status) && (access.has('CRUISE_CANCEL') ? <Button tone="danger" disabled={lifecycleBusy || !access.has('CRUISE_CANCEL')} onClick={() => setLifecycleAction('cancel')}>Hủy chuyến đi</Button> : null)}
                  {cruise.status === 'DRAFT' && (access.has('CRUISE_DELETE_DRAFT') ? <Button tone="danger" disabled={lifecycleBusy || !access.has('CRUISE_DELETE_DRAFT')} onClick={() => setLifecycleAction('deleteDraft')}>Xóa bản nháp</Button> : null)}
                  {['COMPLETED', 'CANCELLED'].includes(cruise.status) && <p className={styles.muted}>Chuyến đi đã kết thúc hoặc đã hủy, không còn thao tác chuyển trạng thái.</p>}
                </div>
              </Panel>
              {access.has('CRUISE_VALIDATE') && <Panel title="Sức chứa hành khách"><div className={styles.capacityValue}>{detail.capacity.activePassengerCount ?? '—'} / {detail.capacity.shipTotalCapacity ?? '—'}</div><p>Còn {detail.capacity.remainingPassengerHeadroom ?? '—'} chỗ theo sức chứa tàu.</p><p className={styles.muted}>Không đồng nghĩa cabin hoặc hạng cabin còn khả dụng.</p></Panel>}
            </div>
          </div>
          {access.has('CRUISE_REGULATION_READ') && <Panel title={`Quy định vận hành${detail.supplementaryLoading || detail.supplementaryErrors?.regulations ? '' : ` · ${detail.regulations.length}`}`} subtitle="Quy định trực tiếp và kế thừa được hiển thị riêng; nguồn kế thừa chỉ đọc tại đây.">
            {detail.regulations.length ? <ul className={styles.compactList}>{detail.regulations.map((regulation) => <li key={regulation.regulationId}><strong>{regulation.code} · {regulation.name}</strong><span>{regulation.source} · {regulation.status}</span></li>)}</ul> : !detail.supplementaryLoading && !detail.supplementaryErrors?.regulations && <Empty title="Chưa có quy định áp dụng" />}
            <ButtonLink to={`/admin/cruises/${cruise.cruiseId}/regulations`}>Quản lý quy định</ButtonLink>
          </Panel>}
          {detail.itinerary?.status === 'OPEN_FOR_SALE' && detail.readiness.checks.some(check => check.key === 'ITINERARY' && check.state === 'BLOCKED') && <Notice title="Lịch trình đã phát hành" tone="warning">Lịch trình đã phát hành nhưng kết quả kiểm tra sẵn sàng chưa chấp nhận trạng thái này. Cần kiểm tra điều kiện hệ thống trước khi công bố chuyến đi.</Notice>}
          {access.can({mode:'ANY',permissions:['CRUISE_STAFF_READ','CRUISE_MANIFEST_READ','CHECKIN_READ','CHECKIN_CREATE','CHECKIN_UPDATE']}) && <CruiseOperations key={cruise.cruiseId} cruiseId={cruise.cruiseId} />}
          {access.has('CRUISE_VALIDATE') && <><CruiseChecks key={cruise.cruiseId} cruiseId={cruise.cruiseId} /><Panel title="Sẵn sàng vận hành" subtitle="Kết quả kiểm tra sẵn sàng mới nhất từ hệ thống."><ul className={styles.compactList}>{detail.readiness.checks.map((check) => <li key={check.key}><span><Badge label={check.state === 'PASS' ? 'Đạt' : check.state === 'BLOCKED' ? 'Chưa đạt' : 'Chưa xác định'} tone={checkTone(check.state)} /> <strong>{check.label}</strong></span><span>{check.reason}</span></li>)}</ul>{detail.readiness.issues?.map((issue) => <Notice key={issue} title="Cần kiểm tra" tone="warning">{issue}</Notice>)}</Panel></>}
          {access.has('OPERATIONAL_ISSUE_READ') && <Panel title={detail.supplementaryLoading || detail.supplementaryErrors?.issues ? 'Sự cố liên quan' : `Sự cố liên quan · ${detail.issues.filter((issue) => issue.status === 'OPEN' || issue.status === 'IN_PROGRESS').length} đang mở`}>
            {detail.issues.length ? <ul className={styles.compactList}>{detail.issues.map((issue) => <li key={issue.issueId}><span><Badge label={issue.severity} tone={issue.severity === 'CRITICAL' ? 'error' : 'warning'} /> <strong>{issue.issueCode}</strong></span><span>{issue.description} · {issue.status}</span></li>)}</ul> : !detail.supplementaryLoading && !detail.supplementaryErrors?.issues && <Empty title="Không có sự cố liên quan" />}
            <Link className={styles.inlineLink} to={`/admin/issues?cruise=${cruise.cruiseId}`}>Xem danh sách sự cố →</Link>
          </Panel>}
          {assignmentMode && access.has(assignmentMode === 'assign' ? 'CRUISE_ASSIGN_SHIP' : assignmentMode === 'change' ? 'CRUISE_CHANGE_SHIP' : 'CRUISE_UNASSIGN_SHIP') && <ShipAssignmentDialog detail={detail} mode={assignmentMode} onClose={() => setAssignmentMode(null)} onChanged={() => { void refresh(); setLifecycleSuccess('Đã cập nhật phân công tàu.') }} />}
          {lifecycleAction && access.has(lifecyclePermissions[lifecycleAction]) && <Modal busy={lifecycleBusy} title={lifecycleAction === 'deleteDraft' ? 'Xác nhận xóa bản nháp' : 'Xác nhận chuyển trạng thái'} onClose={() => { if (!lifecycleBusy) setLifecycleAction(null) }} footer={<div className={styles.dialogActions}>
<Button tone="secondary" disabled={lifecycleBusy} onClick={() => setLifecycleAction(null)} data-overlay-dismiss>Quay lại</Button>
<Button tone={['cancel', 'deleteDraft'].includes(lifecycleAction) ? 'danger' : 'primary'} disabled={lifecycleBusy || (lifecycleAction === 'cancel' && !cancelReason.trim())} onClick={() => void confirmLifecycle()}>{lifecycleBusy ? 'Đang xử lý…' : 'Xác nhận'}</Button>
</div>}>
            <p>{cruise.cruiseCode} · {lifecycleAction === 'deleteDraft' ? 'Xóa bản nháp chuyến đi khỏi hệ thống. Thao tác này không thể hoàn tác.' : ({publish:'Công bố chuyến đi',start:'Bắt đầu vận hành',complete:'Kết thúc chuyến đi',cancel:'Hủy chuyến đi'}[lifecycleAction])}</p>
            {lifecycleAction === 'cancel' && <Field htmlFor="cancel-reason" label="Lý do hủy"><textarea id="cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} /></Field>}
            {lifecycleError && <Notice title="Không thể cập nhật" tone="error"><p>{lifecycleError}</p></Notice>}

          </Modal>}
        </>
      })()}
    </div>
  </CruiseFrame>
}
