import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { AdminFrame, Badge, Button, ButtonLink, Empty, Loading, Notice, PageHeader, Panel } from '@/shared/ui'

import { CruiseStatusBadge, CruiseTopbar } from '../components/CruiseUI'
import { ShipAssignmentDialog, type AssignmentMode } from '../components/ShipAssignmentDialog'
import styles from '../components/Cruises.module.css'
import { useCruiseDetail } from '../hooks/useCruiseDetail'
import { cruiseTypeLabels, itineraryStatusLabels, type ReadinessCheck } from '../model/cruise-view'

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

  return <AdminFrame className={styles.cruiseShell} topbar={<CruiseTopbar />}>
    <div className={styles.content}>
      {state.status === 'loading' && !state.data && <Loading label="Đang tải chi tiết cruise…" />}
      {state.status === 'error' && <Notice title="Không tải được cruise" tone="error"><p>{state.error}</p><Button onClick={refresh}>Thử lại</Button></Notice>}
      {state.data && (() => {
        const detail = state.data
        const cruise = detail.cruise
        const assignmentReason = detail.ship
          ? detail.assignmentCapabilities.change.reason ?? detail.assignmentCapabilities.unassign.reason
          : detail.assignmentCapabilities.assign.reason
        return <>
          <PageHeader breadcrumb="VẬN HÀNH / CRUISE" title={`${cruise.cruiseCode} · ${cruise.cruiseName}`} description={`${formatDateTime(cruise.departureDatetime)} → ${formatDateTime(cruise.returnDatetime)} · ${detail.ship?.shipName ?? 'Chưa phân công'}`} actions={<ButtonLink to={`/admin/cruises/${cruise.cruiseId}/edit`} tone="secondary">Chỉnh sửa cruise</ButtonLink>} />
          <section className={styles.detailMetrics} aria-label="Trạng thái cruise"><div><span>CRUISE</span><CruiseStatusBadge status={cruise.status} /></div><div><span>HẢI TRÌNH</span><Badge label={detail.itinerary ? itineraryStatusLabels[detail.itinerary.status] : 'Chưa có'} tone={detail.itinerary?.status === 'OPEN_FOR_SALE' ? 'success' : 'warning'} /></div><div><span>TÀU</span><Badge label={detail.ship?.shipName ?? 'Chưa phân công'} tone={detail.ship?.status === 'ACTIVE' ? 'info' : 'warning'} /></div><div><span>BOOKING</span><Badge label={detail.bookingHasData ? 'Có dữ liệu' : 'Chưa có'} tone={detail.bookingHasData ? 'warning' : 'neutral'} /></div></section>
          <div className={styles.detailColumns}>
            <div>
              <Panel title="Thông tin chuyến"><dl className={styles.definitionGrid}><dt>Mã chuyến</dt><dd>{cruise.cruiseCode}</dd><dt>Loại chuyến</dt><dd>{cruiseTypeLabels[cruise.cruiseType]} · {cruise.cruiseType}</dd><dt>Khởi hành</dt><dd>{formatDateTime(cruise.departureDatetime)}</dd><dt>Kết thúc</dt><dd>{formatDateTime(cruise.returnDatetime)}</dd><dt>Cảng đi</dt><dd>{detail.departurePort.portName}</dd><dt>Cảng về</dt><dd>{detail.returnPort.portName}</dd></dl></Panel>
              <Panel title="Lịch trình" subtitle={detail.itinerary?.routeLabel ?? 'Chưa có dữ liệu hải trình'}>{detail.itinerary?.schedule.length ? <ol className={styles.schedule}>{detail.itinerary.schedule.map((item) => <li key={item.day}><strong>Ngày {item.day} · {item.label}</strong><span>Planned: {item.planned}</span><span>Actual: {item.actual ?? 'Chưa cập nhật'}</span></li>)}</ol> : <Empty title="Chưa có chi tiết ngày/điểm dừng" />}</Panel>
            </div>
            <div>
              <Panel title="Tàu được phân công" subtitle={detail.ship ? `${detail.ship.status} · ${detail.ship.totalCapacity} khách` : 'Cruise chưa có tàu'}>
                {!detail.ship && <Button disabled={!detail.assignmentCapabilities.assign.allowed} onClick={() => setAssignmentMode('assign')}>Phân công tàu</Button>}
                {detail.ship && <><Button disabled={!detail.assignmentCapabilities.change.allowed} onClick={() => setAssignmentMode('change')}>Đổi tàu</Button><Button tone="danger" disabled={!detail.assignmentCapabilities.unassign.allowed} onClick={() => setAssignmentMode('unassign')}>Gỡ tàu</Button></>}
                {assignmentReason && <p className={styles.muted}>{assignmentReason}</p>}
              </Panel>
              <Panel title="Sức chứa hành khách"><div className={styles.capacityValue}>{detail.capacity.activePassengerCount} / {detail.capacity.shipTotalCapacity ?? '—'}</div><p>Còn {detail.capacity.remainingPassengerHeadroom ?? '—'} chỗ theo sức chứa tàu.</p><p className={styles.muted}>Không đồng nghĩa cabin hoặc hạng cabin còn khả dụng.</p></Panel>
            </div>
          </div>
          <Panel title={`Quy định vận hành · ${detail.regulations.length}`} subtitle="Quy định trực tiếp và kế thừa được hiển thị riêng; nguồn kế thừa chỉ đọc tại đây.">
            {detail.regulations.length ? <ul className={styles.compactList}>{detail.regulations.map((regulation) => <li key={regulation.regulationId}><strong>{regulation.code} · {regulation.name}</strong><span>{regulation.source} · {regulation.status}</span></li>)}</ul> : <Empty title="Chưa có quy định áp dụng" />}
            <ButtonLink to={`/admin/cruises/${cruise.cruiseId}/regulations`}>Quản lý quy định</ButtonLink>
          </Panel>
          <Panel title={`Sẵn sàng vận hành · ${detail.readiness.state}`} subtitle="Kết quả do adapter/backend precheck cung cấp; UI không tự suy luận READY."><ul className={styles.compactList}>{detail.readiness.checks.map((check) => <li key={check.key}><span><Badge label={check.state} tone={checkTone(check.state)} /> <strong>{check.label}</strong></span><span>{check.reason}</span></li>)}</ul></Panel>
          <Panel title={`Sự cố liên quan · ${detail.issues.filter((issue) => issue.status === 'OPEN' || issue.status === 'IN_PROGRESS').length} đang mở`}>
            {detail.issues.length ? <ul className={styles.compactList}>{detail.issues.map((issue) => <li key={issue.issueId}><span><Badge label={issue.severity} tone={issue.severity === 'CRITICAL' ? 'error' : 'warning'} /> <strong>{issue.issueCode}</strong></span><span>{issue.description} · {issue.status}</span></li>)}</ul> : <Empty title="Không có sự cố liên quan" />}
            <Link className={styles.inlineLink} to={`/admin/issues?cruise=${cruise.cruiseId}`}>Xem danh sách sự cố →</Link>
          </Panel>
          {assignmentMode && <ShipAssignmentDialog detail={detail} mode={assignmentMode} onClose={() => setAssignmentMode(null)} onChanged={refresh} />}
        </>
      })()}
    </div>
  </AdminFrame>
}
