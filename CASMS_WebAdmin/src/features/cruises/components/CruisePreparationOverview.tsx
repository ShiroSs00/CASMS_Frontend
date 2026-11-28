import { domainStatus } from '@/shared/i18n/business-copy'
import { journeyTime } from '@/shared/lib/journey-time'
import { Badge, Button, Loading, Notice, Panel } from '@/shared/ui'
import type { PlanView } from '../api/mainflow-api'
import { type CruiseDetailView } from '../model/cruise-view'
import { planReviewStates } from '../model/plan-review'
import styles from './DeparturePreparation.module.css'

export function CruisePreparationOverview({
  detail,
  plan,
  loading,
  error,
  onRetry,
}: {
  detail: CruiseDetailView
  plan: PlanView | null | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  const { cruise } = detail
  const baseState = !loading && !error && plan ? plan.planStatus === 'APPROVED' &&
    ((plan.planBlockers?.length ?? 0) > 0 || plan.readyBlockers?.includes('PLAN_APPROVAL_REQUIRED'))
    ? { title: 'Kế hoạch cần đối chiếu lại', tone: 'warning' as const }
    : planReviewStates[plan.planStatus] : null
  const state = (() => {
    if (cruise.status === 'PUBLISHED' && cruise.stoppedAt) {
      return { title: 'Đã tạm dừng mở bán', tone: 'error' as const }
    }
    if (cruise.status === 'PUBLISHED' && cruise.openedForSaleAt) {
      return { title: 'Đang mở bán', tone: 'success' as const }
    }
    if (cruise.status === 'IN_PROGRESS') {
      return { title: 'Đang vận hành', tone: 'info' as const }
    }
    if (cruise.status === 'COMPLETED') {
      return { title: 'Hoàn thành', tone: 'success' as const }
    }
    if (cruise.status === 'CANCELLED') {
      return { title: 'Đã hủy', tone: 'error' as const }
    }
    return baseState ? { title: baseState.title, tone: baseState.tone } : null
  })()

  const durationSummary = [
    domainStatus('cruise.duration', cruise.cruiseType),
    detail.itinerary?.itineraryType ? domainStatus('route.type', detail.itinerary.itineraryType) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Panel className={styles.managerOverview}>
      <div className={styles.managerOverviewHeading}>
        <h2>Thông tin chuyến khởi hành</h2>
        {state && <Badge label={state.title} tone={state.tone} />}
      </div>
      {loading && <Loading label="Đang tải tiến độ hồ sơ…" />}
      {error != null && (
        <Notice title="Chưa đọc được hồ sơ" tone="error">
          <Button tone="secondary" onClick={onRetry}>
            Tải lại hồ sơ
          </Button>
        </Notice>
      )}
      {plan?.planStatus === 'REVISION_REQUESTED' && plan.reason && (
        <p className={styles.overviewRevisionAlert} style={{ marginBottom: '12px' }}>
          Quản lý vận hành yêu cầu bổ sung: {plan.reason}
        </p>
      )}
      <dl className={styles.managerJourney}>
        <div>
          <dt>Khởi hành · giờ Việt Nam</dt>
          <dd><strong>{journeyTime(cruise.departureDatetime)}</strong><span>{detail.departurePort.portName}</span></dd>
        </div>
        <div>
          <dt>Kết thúc · giờ Việt Nam</dt>
          <dd><strong>{journeyTime(cruise.returnDatetime)}</strong><span>{detail.returnPort.portName}</span></dd>
        </div>
        <div>
          <dt>Tàu được phân công</dt>
          <dd><strong>{detail.ship?.shipName ?? (detail.supplementaryLoading ? 'Đang tải…' : cruise.shipId ? 'Chưa tải được thông tin tàu' : 'Chưa gán tàu')}</strong></dd>
        </div>
      </dl>
      <dl className={styles.managerReference}>
        <div><dt>Số hành khách dự kiến</dt><dd>{cruise.expectedPassengerCount == null ? 'Chưa nhập' : `${cruise.expectedPassengerCount} hành khách`}</dd></div>
        <div><dt>Thời lượng</dt><dd>{durationSummary || 'Chưa có thông tin'}</dd></div>
        {cruise.sourceTripCode && <div><dt>Lịch trình mẫu</dt><dd>{cruise.sourceTripCode}{cruise.sourceVersionNumber != null ? ` · Phiên bản ${cruise.sourceVersionNumber}` : ''}</dd></div>}
      </dl>
    </Panel>
  )
}
