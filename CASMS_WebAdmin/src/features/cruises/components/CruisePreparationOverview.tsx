import { journeyTime } from '@/shared/lib/journey-time'
import { Badge, Button, Loading, Notice, Panel, RecordFacts } from '@/shared/ui'
import type { PlanView } from '../api/mainflow-api'
import { cruiseStatusLabels, type CruiseDetailView } from '../model/cruise-view'
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
  const baseState = !loading && !error && plan ? planReviewStates[plan.planStatus] : null
  const state = (() => {
    if (cruise.status === 'PUBLISHED' && cruise.stoppedAt) {
      return { title: 'Đã tạm dừng mở bán', tone: 'error' as const, description: 'Chuyến khởi hành đã tạm dừng nhận đặt chỗ mới.' }
    }
    if (cruise.status === 'PUBLISHED' && cruise.openedForSaleAt) {
      return { title: 'Đang mở bán', tone: 'success' as const, description: 'Hồ sơ đã được phê duyệt và chuyến khởi hành đang mở bán cho hành khách.' }
    }
    if (cruise.status === 'IN_PROGRESS') {
      return { title: 'Đang vận hành', tone: 'info' as const, description: 'Chuyến khởi hành đang trong hành trình thực tế.' }
    }
    if (cruise.status === 'COMPLETED') {
      return { title: 'Hoàn thành', tone: 'success' as const, description: 'Chuyến khởi hành đã hoàn tất.' }
    }
    if (cruise.status === 'CANCELLED') {
      return { title: 'Đã hủy', tone: 'error' as const, description: 'Chuyến khởi hành đã bị hủy.' }
    }
    return baseState
  })()
  const source = [
    cruise.sourceTripCode,
    cruise.sourceVersionNumber != null ? `Phiên bản ${cruise.sourceVersionNumber}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Panel title="Tình trạng hồ sơ">
      {loading && <Loading label="Đang tải tiến độ hồ sơ…" />}
      {error != null && (
        <Notice title="Chưa đọc được hồ sơ" tone="error">
          <Button tone="secondary" onClick={onRetry}>
            Tải lại hồ sơ
          </Button>
        </Notice>
      )}
      {state && plan && (
        <div className={styles.overviewStatusBanner}>
          <div className={styles.overviewStatusHeader}>
            <Badge label={state.title} tone={state.tone} />
          </div>
          <p>{state.description}</p>
          {plan.planStatus === 'REVISION_REQUESTED' && plan.reason && (
            <p className={styles.overviewRevisionAlert}>
              Quản lý vận hành yêu cầu bổ sung: {plan.reason}
            </p>
          )}
        </div>
      )}
      <RecordFacts
        entries={[
          ['Mã chuyến khởi hành', cruise.cruiseCode],
          ['Tàu', detail.ship?.shipName ?? (detail.supplementaryLoading ? 'Đang tải thông tin tàu…' : cruise.shipId ? 'Chưa tải được thông tin tàu' : 'Chưa phân công tàu')],
          ['Khởi hành', journeyTime(cruise.departureDatetime)],
          ['Kết thúc', journeyTime(cruise.returnDatetime)],
          ['Lịch trình nguồn', source || 'Chưa có thông tin lịch trình nguồn'],
          ['Trạng thái chuyến', cruiseStatusLabels[cruise.status]],
        ]}
      />
    </Panel>
  )
}
