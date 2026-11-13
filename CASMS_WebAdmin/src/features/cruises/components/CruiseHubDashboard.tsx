import { useCallback } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, Notice, Panel, RecordFacts } from '@/shared/ui'
import { departureApi } from '../api/departure-api'
import type { PlanView } from '../api/mainflow-api'
import type { CruiseDetailView } from '../model/cruise-view'
import { cruiseStatusLabels } from '../model/cruise-view'
import { planEvidence } from '../model/plan-evidence'
import { planReviewStates } from '../model/plan-review'
import { type DepartureSection } from '../model/preparation'
import { readinessMessage } from '../model/readiness-copy'
import styles from './CruiseHubDashboard.module.css'

type Query<T> = { data: T | null | undefined; loading: boolean; error: unknown; retry: () => void }

export function CruiseHubDashboard({
  detail, salePlan, sellability, sections, onNavigate, onReview, onSale, onStop,
}: {
  detail: CruiseDetailView
  salePlan: Query<PlanView>
  sellability: Query<Awaited<ReturnType<typeof departureApi.publicSellability>>>
  sections: readonly DepartureSection[]
  onNavigate: (section: DepartureSection) => void
  onReview: () => void
  onSale: () => void
  onStop?: () => void
}) {
  const access = useSessionAccess()
  const { cruise } = detail
  const id = cruise.cruiseId
  const canRead = sections.includes('departure-start')
  const departure = useReadQuery(
    JSON.stringify(['ops-departure-readiness', access.userId, id, cruise.revision, canRead]),
    useCallback(signal => canRead ? departureApi.departureReadiness(id, signal) : Promise.resolve(null), [id, canRead]),
  )
  const plan = salePlan.loading || salePlan.error ? null : salePlan.data
  const publicState = sellability.loading || sellability.error ? null : sellability.data?.publicSaleState
  const saleState = publicState === 'OPEN_FOR_SALE' ? 'Đang mở bán'
    : publicState === 'STOPPED' || cruise.stoppedAt ? 'Đã dừng bán'
    : publicState === 'SOLD_OUT' ? 'Hết chỗ' : publicState ? 'Chưa mở bán' : 'Chưa xác định'
  const gate = departure.loading || departure.error ? null : departure.data
  const packageCount = planEvidence(plan?.submittedSnapshot).packages.length
  const issues = detail.issues.filter(issue => issue.status === 'OPEN' || issue.status === 'IN_PROGRESS')
  const link = (section: DepartureSection, label: string) => sections.includes(section)
    ? <Button key={section} tone="secondary" autoWidth onClick={() => onNavigate(section)}>{label}</Button> : null

  return <section className={styles.dashboard} aria-label="Tổng quan vận hành">
    <Panel title="Tình trạng chuyến">
      <RecordFacts entries={[
        ['Chuyến khởi hành', cruiseStatusLabels[cruise.status]],
        ['Trạng thái bán công khai', saleState],
        ['Điều kiện sẵn sàng mở bán', salePlan.loading ? 'Đang kiểm tra' : plan?.readyStatus === 'READY' ? 'Đã xác nhận' : plan ? 'Chưa xác nhận' : 'Chưa xác định'],
        ['Điều kiện sẵn sàng khởi hành', departure.loading ? 'Đang kiểm tra' : gate?.ready === true ? 'Đạt' : gate?.status === 'NOT_READY' ? 'Còn việc cần xử lý' : 'Chưa xác định'],
      ]}/>
      {cruise.stoppedAt && cruise.stopReason && <Notice title="Lý do dừng bán">{cruise.stopReason}</Notice>}
      {sellability.error != null && <Notice title="Chưa đọc được trạng thái bán" tone="error"><Button tone="secondary" onClick={sellability.retry}>Tải lại trạng thái bán</Button></Notice>}
      {departure.error && <Notice title="Chưa đọc được điều kiện khởi hành" tone="error"><Button tone="secondary" onClick={departure.retry}>Tải lại điều kiện khởi hành</Button></Notice>}
      {gate?.blockers?.length ? <ul>{[...new Set(gate.blockers)].map(code => <li key={code}>{readinessMessage(code)}</li>)}</ul> : null}
    </Panel>
    <div className={styles.workGrid}>
      <Panel title="Thương mại và xét duyệt">
        <p>{plan ? <Badge label={planReviewStates[plan.planStatus].title} tone={planReviewStates[plan.planStatus].tone}/> : salePlan.loading ? 'Đang tải hồ sơ…' : 'Chưa đọc được hồ sơ'}</p>
        {plan?.submittedSnapshot != null && <p>{packageCount ? `${packageCount} gói trong hồ sơ đã gửi` : 'Hồ sơ đã gửi chưa có gói du thuyền'}</p>}
        {salePlan.error != null && <Button tone="secondary" onClick={salePlan.retry}>Tải lại hồ sơ</Button>}
        <div className={styles.actions}>
          {plan && <Button autoWidth onClick={onReview}>{packageCount ? 'Xem hồ sơ, gói và giá đã gửi' : 'Xem hồ sơ xét duyệt'}</Button>}
          {link('transaction-policy', 'Xem chính sách giao dịch')}
          {link('resources', 'Xem tàu và quy định')}
          {sections.includes('checks') && <Button tone="secondary" autoWidth onClick={onSale}>Quản lý mở bán</Button>}
          {onStop && <Button tone="danger" autoWidth onClick={onStop}>Dừng bán</Button>}
        </div>
      </Panel>
      <Panel title="Chuẩn bị và vận hành khởi hành">
        {sections.includes('operation') && <p>{detail.supplementaryLoading ? 'Đang tải sự cố…' : detail.supplementaryErrors?.issues ? 'Chưa đọc được sự cố' : `${issues.length} sự cố đang xử lý`}</p>}
        <div className={styles.actions}>
          {link('schedule', 'Xem lịch thực tế')}
          {link('staff', 'Nhân sự chuyến khởi hành')}
          {link('preparation', 'Hồ sơ chuẩn bị')}
          {link('guidance', 'Hướng dẫn trước chuyến')}
          {link('operation', 'Vận hành và sự cố')}
          {link('changes', 'Theo dõi thay đổi lịch')}
          {link('sales', 'Xem tồn cabin')}
          {['PUBLISHED', 'IN_PROGRESS', 'COMPLETED'].includes(cruise.status) && link('departure-start', 'Điều kiện khởi hành')}
        </div>
      </Panel>
    </div>
  </section>
}
