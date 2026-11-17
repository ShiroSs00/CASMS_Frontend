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
          <h2>Chuẩn bị tour</h2>
          {sections.includes('preparation') && (
            <Button tone="secondary" onClick={() => onSection('preparation')}>
              Xem hồ sơ xét duyệt
            </Button>
          )}
        </header>

        {canPrepare && (
          <div className={styles.prepWorkflowStack}>
            <section className={styles.prepWorkflowStep} aria-labelledby="prep-budget-heading">
              <div className={styles.prepWorkflowStepHead}>
                <h3 id="prep-budget-heading">Ngân sách vận hành</h3>
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

            <section className={styles.prepWorkflowStep} aria-labelledby="department-work-heading">
              <div className={styles.prepWorkflowStepHead}>
                <div>
                  <h3 id="department-work-heading">Yêu cầu chuẩn bị</h3>
                  <p className={styles.sectionMeta}>
                    Sau khi lưu ngân sách, bạn có thể gửi yêu cầu riêng cho từng bộ phận.
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

        <section className={styles.prepWorkflowStep} aria-labelledby="prep-booking-heading">
          <div className={styles.prepWorkflowStepHead}>
            <h3 id="prep-booking-heading">Nhận đặt chỗ và gói trình duyệt</h3>
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
