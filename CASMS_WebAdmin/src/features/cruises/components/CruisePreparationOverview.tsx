import { journeyTime } from '@/shared/lib/journey-time'
import { Badge, Loading, Notice, Panel, RecordFacts } from '@/shared/ui'
import { Button } from '@/shared/ui'
import type { PlanView } from '../api/mainflow-api'
import { cruiseStatusLabels, type CruiseDetailView } from '../model/cruise-view'
import { planReviewStates } from '../model/plan-review'

export function CruisePreparationOverview({ detail, plan, loading, error, onRetry }: {
  detail: CruiseDetailView
  plan: PlanView | null | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  const { cruise } = detail
  const state = !loading && !error && plan ? planReviewStates[plan.planStatus] : null
  const source = [cruise.sourceTripCode, cruise.sourceVersionNumber != null ? `Phiên bản ${cruise.sourceVersionNumber}` : null].filter(Boolean).join(' · ')
  return <Panel title="Tổng quan chuẩn bị chuyến">
    <RecordFacts entries={[
      ['Mã chuyến khởi hành', cruise.cruiseCode],
      ['Tàu', detail.ship?.shipName ?? 'Chưa đọc được thông tin tàu'],
      ['Khởi hành', journeyTime(cruise.departureDatetime)],
      ['Kết thúc', journeyTime(cruise.returnDatetime)],
      ['Lịch trình nguồn', source || 'Chưa có thông tin lịch trình nguồn'],
      ['Trạng thái chuyến', cruiseStatusLabels[cruise.status]],
    ]}/>
    {loading && <Loading label="Đang tải tiến độ hồ sơ…"/>}
    {error != null && <Notice title="Chưa đọc được hồ sơ" tone="error"><Button tone="secondary" onClick={onRetry}>Tải lại hồ sơ</Button></Notice>}
    {state && plan && <div>
      <Badge label={state.title} tone={state.tone}/>
      <p>{state.description}</p>
      {plan.planStatus === 'REVISION_REQUESTED' && plan.reason && <p>Yêu cầu chỉnh sửa từ Quản lý vận hành: {plan.reason}</p>}
    </div>}
  </Panel>
}
