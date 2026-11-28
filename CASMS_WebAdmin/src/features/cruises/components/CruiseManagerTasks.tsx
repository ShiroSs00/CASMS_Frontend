import { Button, Loading, Notice } from '@/shared/ui'
import type { PlanQuery } from '../hooks/plan-workspace-context'
import type { DepartureSection } from '../model/preparation'
import styles from './ManagerWorkspace.module.css'

export function CruiseManagerTasks({ plan, onSection, canOpenDossier }: {
  plan: PlanQuery; onSection: (section: DepartureSection) => void; canOpenDossier: boolean
}) {
  if (plan.loading) return <Loading label="Đang đọc tiến độ kế hoạch…" />
  if (plan.error || !plan.data) return <Notice title="Chưa tải được tiến độ kế hoạch" tone="error"><Button onClick={plan.retry}>Tải lại</Button></Notice>
  const data = plan.data
  const editable = ['DRAFT', 'WITHDRAWN', 'REVISION_REQUESTED'].includes(data.planStatus)
  return <section className={styles.overviewPlan} aria-label="Tiến độ hồ sơ kế hoạch">
    <div><h3>Hồ sơ kế hoạch chuyến</h3>
      <p>{data.planStatus === 'SUBMITTED' ? 'Quản lý vận hành đang xét duyệt.' : editable ? 'Chuẩn bị chương trình, gói du thuyền và lịch nhận đặt chỗ.' : 'Theo dõi quyết định và phản hồi trong hồ sơ.'}</p>
    </div>
    {canOpenDossier && <Button tone="secondary" autoWidth onClick={() => onSection('preparation')}>{editable ? 'Hoàn thiện hồ sơ kế hoạch' : 'Xem hồ sơ và phản hồi'}</Button>}
  </section>
}
