import { Button } from '@/shared/ui'
import type { OperatingBudget } from '../api/preparation-api'
import type { PlanQuery } from '../hooks/plan-workspace-context'
import { planReviewStates } from '../model/plan-review'
import { staffingStatusLabel, type Preparation } from '../staffing/staffing-api'
import type { Work } from './CruiseWorkHandoff'
import styles from './ManagerWorkspace.module.css'

type Read<T> = { data:T|null; loading:boolean; error:Error|null; retry:()=>void }
export function CruisePreparationProgress({ budget, plan, staffing, work }: {
  budget: Read<OperatingBudget>; plan:PlanQuery; staffing:Read<Preparation>; work:Read<Work>
}) {
  const rows = [
    { title:'Ngân sách vận hành', role:'Quản lý lịch trình · Quản lý vận hành xét duyệt', query:budget,
      status:budget.data?.amountVnd ? ({DRAFT:'Đã lưu dự kiến',SUBMITTED:'Chờ duyệt ngân sách',APPROVED:'Đã duyệt ngân sách',REJECTED:'Cần điều chỉnh ngân sách'} as const)[budget.data.status] : 'Chưa nhập ngân sách' },
    { title:'Hồ sơ kế hoạch chuyến', role:'Quản lý lịch trình → Quản lý vận hành', query:plan,
      status:plan.data ? plan.data.planStatus === 'APPROVED' && (plan.data.planBlockers.length > 0 || plan.data.readyBlockers.includes('PLAN_APPROVAL_REQUIRED'))
        ? 'Kế hoạch cần đối chiếu lại' : planReviewStates[plan.data.planStatus].title : '' },
    { title:'Phối hợp chuẩn bị chuyến', role:'Dịch vụ · Tàu · Nhân sự', query:staffing,
      status:staffing.data?.request ? staffingStatusLabel(staffing.data.request) : staffing.data?.requiresReplanning ? 'Cần lập lại phương án' : 'Chưa bắt đầu phối hợp' },
    { title:'Quản lý tàu của chuyến', role:'Quản lý nhân sự phân công', query:work,
      status:work.data?.shipAssigned ? 'Đã phân công Quản lý tàu' : 'Chưa phân công Quản lý tàu' },
  ]
  return <aside className={styles.progressSidebar} aria-label="Tình hình chuẩn bị chuyến">
    <h3>Tình hình chuẩn bị</h3>
    <ul>{rows.map(row=><li key={row.title}><strong>{row.title}</strong><span className={styles.progressRole}>{row.role}</span>
      <span className={styles.progressState}>{row.query.loading?'Đang kiểm tra…':row.query.error?'Chưa tải được trạng thái':row.query.data?row.status:'Chưa xác minh được trạng thái'}</span>
      {row.query.error&&<Button tone="text" size="compact" autoWidth onClick={row.query.retry}>Tải lại trạng thái</Button>}
    </li>)}</ul>
  </aside>
}
