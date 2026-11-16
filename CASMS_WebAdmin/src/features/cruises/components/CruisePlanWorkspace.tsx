import { useCallback, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { businessCopy } from '@/shared/i18n/business-copy'
import { Button, Panel } from '@/shared/ui'
import { type DepartureSection } from '../model/preparation'
import { CruisePlanReview } from './CruisePlanReview'
import { DeparturePricingPolicy } from './DeparturePricingPolicy'
import { useSessionAccess } from '@/shared/auth'
import { StaffingPreparation } from '../staffing/StaffingPreparation'
import { OperatingBudget } from './OperatingBudget'
import { CruiseWorkHandoff } from './CruiseWorkHandoff'
import { preparationApi } from '../api/preparation-api'
import styles from './ManagerWorkspace.module.css'

function StepCircle({ step }: { step: number }) {
  return <span className={styles.prepWorkflowBadge}>{step}</span>
}

/** One Cruise context and one instance of each editor; approvals remain separate commands. */
export function CruisePlanWorkspace({
  cruiseId,
  refreshKey,
  onChanged,
  onSection,
  sections,
  itineraryMode,
  coordinator,
}: {
  cruiseId: string
  refreshKey: string
  onChanged: () => void
  onSection: (section: DepartureSection) => void
  sections: readonly DepartureSection[]
  itineraryMode?: 'FIXED' | 'CUSTOM'
  coordinator: boolean
}) {
  const access = useSessionAccess()
  const [budgetChanges, setBudgetChanges] = useState(0)
  const canPrepare = coordinator && access.canDo('CRUISE_PREPARATION_SUBMIT')
  const budget = useReadQuery(
    `operating-budget:${access.userId}:${cruiseId}:${refreshKey}:${canPrepare}`,
    useCallback(
      signal => (canPrepare ? preparationApi.operatingBudget(cruiseId, signal) : Promise.resolve(null)),
      [cruiseId, canPrepare],
    ),
  )

  if (coordinator) {
    return (
      <section className={styles.planWorkspace} aria-label="Chuẩn bị tour">
        <header className={styles.planWorkspaceHeader}>
          <div>
            <h2>Điều phối chuẩn bị chuyến khởi hành</h2>
            <p className={styles.sectionMeta}>
              Thực hiện theo trình tự: (1) Thiết lập ngân sách vận hành → (2) Giao việc và theo dõi phản hồi của 3 bộ phận → (3) Cấu hình khung giờ nhận đặt chỗ và chọn gói trình duyệt.
            </p>
          </div>
        </header>

        {canPrepare && (
          <div className={styles.prepWorkflowStack}>
            {/* BƯỚC 1: NGÂN SÁCH VẬN HÀNH */}
            <section className={styles.prepWorkflowStep} aria-labelledby="prep-step-budget">
              <div className={styles.prepWorkflowStepHead}>
                <StepCircle step={1} />
                <div>
                  <h3 id="prep-step-budget">Thiết lập ngân sách vận hành dự kiến</h3>
                  <p className={styles.sectionMeta}>
                    Cần chốt ngân sách vận hành trước khi gửi yêu cầu chuẩn bị cho bộ phận Dịch vụ, Tàu và Nhân sự.
                  </p>
                </div>
              </div>
              <OperatingBudget
                key={cruiseId}
                cruiseId={cruiseId}
                budget={budget.data}
                loading={budget.loading}
                loadError={budget.error}
                retry={budget.retry}
                onSaved={() => {
                  budget.retry()
                  setBudgetChanges(count => count + 1)
                }}
              />
            </section>

            {/* BƯỚC 2: PHỐI HỢP 3 BỘ PHẬN CHUYÊN MÔN */}
            <section className={styles.prepWorkflowStep} aria-labelledby="department-work-heading">
              <div className={styles.prepWorkflowStepHead}>
                <StepCircle step={2} />
                <div>
                  <h3 id="department-work-heading">Giao việc và theo dõi tiến độ các bộ phận chuyên môn</h3>
                  <p className={styles.sectionMeta}>
                    Gửi yêu cầu chuẩn bị đến Quản lý dịch vụ (ASM), Quản lý tàu (Ship Manager) và Bộ phận Nhân sự (HR).
                  </p>
                </div>
              </div>
              <div className={styles.departmentGrid}>
                <CruiseWorkHandoff
                  key={'handoff:' + cruiseId}
                  cruiseId={cruiseId}
                  budgetAmount={budget.data?.amountVnd ?? null}
                  budgetLoading={budget.loading}
                  budgetUnavailable={Boolean(budget.error)}
                />
                <StaffingPreparation
                  key={cruiseId}
                  cruiseId={cruiseId}
                  refreshKey={`${refreshKey}:${budgetChanges}`}
                />
              </div>
            </section>
          </div>
        )}

        {/* BƯỚC 3: KHUNG GIỜ NHẬN ĐẶT CHỖ & GÓI DU THUYỀN TRÌNH DUYỆT */}
        <section className={styles.prepWorkflowStep} aria-labelledby="prep-step-windows">
          <div className={styles.prepWorkflowStepHead}>
            <StepCircle step={canPrepare ? 3 : 1} />
            <div>
              <h3 id="prep-step-windows">Khung thời gian nhận đặt chỗ & Sản phẩm trình duyệt</h3>
              <p className={styles.sectionMeta}>
                Kiểm tra khung thời gian mở/đóng đặt chỗ, buổi hướng dẫn an toàn trước chuyến và gói du thuyền đưa vào hồ sơ.
              </p>
            </div>
          </div>
          <CruisePlanReview
            embedded
            itineraryMode={itineraryMode}
            onSection={onSection}
            cruiseId={cruiseId}
            refreshKey={refreshKey}
            onChanged={onChanged}
            mode="prepare"
          />
        </section>
      </section>
    )
  }

  return (
    <Panel title={businessCopy('cruise.plan.workspace.title')}>
      <nav className={styles.workspaceNav} aria-label={businessCopy('cruise.plan.workspace.inputs')}>
        {(
          [
            ['schedule', 'cruise.plan.workspace.schedule'],
            ['resources', 'cruise.plan.workspace.ship'],
            ['program', 'cruise.plan.workspace.program'],
          ] as const
        )
          .filter(([section]) => sections.includes(section))
          .map(([section, key]) => (
            <Button key={section} tone="secondary" onClick={() => onSection(section)}>
              {businessCopy(key)}
            </Button>
          ))}
      </nav>
      <CruisePlanReview cruiseId={cruiseId} refreshKey={refreshKey} onChanged={onChanged} mode="prepare" />
      <DeparturePricingPolicy readOnly cruiseId={cruiseId} onChanged={onChanged} />
    </Panel>
  )
}
