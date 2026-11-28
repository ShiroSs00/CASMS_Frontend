import { useCallback, useState } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { businessCopy } from '@/shared/i18n/business-copy'
import { Button, Panel } from '@/shared/ui'
import { type DepartureSection } from '../model/preparation'
import { CruisePlanReview } from './CruisePlanReview'
import { DeparturePricingPolicy } from './DeparturePricingPolicy'
import { useSessionAccess } from '@/shared/auth'
import { StaffingPreparation } from '../staffing/StaffingPreparation'
import { OperatingBudget } from './OperatingBudget'
import { CruiseWorkHandoff, type Work } from './CruiseWorkHandoff'
import { staffingApi } from '../staffing/staffing-api'
import { CruisePreparationProgress } from './CruisePreparationProgress'
import { preparationApi } from '../api/preparation-api'
import { usePlanQuery } from '../hooks/usePlanQuery'
import { CruiseManagerTasks } from './CruiseManagerTasks'
import styles from './ManagerWorkspace.module.css'

/** Task workspace: CRM's plan inputs and cross-team coordination have separate outcomes. */
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
  const [handoffChanges, setHandoffChanges] = useState(0)
  const canPrepare = coordinator && access.canDo('CRUISE_PREPARATION_SUBMIT')
  const plan = usePlanQuery(cruiseId, refreshKey, coordinator && access.has('CRUISE_READ'))
  const budget = useReadQuery(
    `operating-budget:${access.userId}:${cruiseId}:${refreshKey}:${canPrepare}`,
    useCallback(
      signal => (canPrepare ? preparationApi.operatingBudget(cruiseId, signal) : Promise.resolve(null)),
      [cruiseId, canPrepare],
    ),
  )

  const staffing = useReadQuery(`crm-preparation:${access.userId}:${cruiseId}:${refreshKey}:${budgetChanges}:${canPrepare}`,
    useCallback(signal => canPrepare ? staffingApi.preparation(cruiseId, signal) : Promise.resolve(null), [canPrepare, cruiseId]))
  const work = useReadQuery(`crm-work:${access.userId}:${cruiseId}:${refreshKey}:${handoffChanges}:${canPrepare}`,
    useCallback(signal => canPrepare ? apiRequest<Work>(`/cruise-work/${encodeURIComponent(cruiseId)}`, {signal}) : Promise.resolve(null), [canPrepare, cruiseId]))

  if (coordinator) {
    return (
      <section className={styles.planWorkspace} aria-label="Chuẩn bị chuyến khởi hành">
        <header className={styles.planWorkspaceHeader}>
          <h2>Việc cần chuẩn bị cho chuyến</h2>
        </header>

        <div className={styles.overviewLayout}><div className={styles.overviewMain}>
        {canPrepare && <section className={`${styles.overviewBudget} ${budget.data && !budget.data.amountVnd ? styles.budgetPriority : ''}`} aria-labelledby="prep-budget-heading">
          <div className={styles.overviewTaskLabel}><h3 id="prep-budget-heading">Ngân sách vận hành</h3><p>Ngân sách dự kiến cho các bộ phận chuẩn bị chuyến.</p></div>
          <OperatingBudget key={cruiseId} cruiseId={cruiseId} budget={budget.data} loading={budget.loading}
            loadError={budget.error} retry={budget.retry} prioritizeEntry
            onSaved={() => { budget.retry(); setBudgetChanges(count => count + 1); onChanged() }} />
        </section>}
        <CruiseManagerTasks plan={plan} onSection={onSection} canOpenDossier={sections.includes('preparation')} />
        {canPrepare && <section className={styles.overviewCoordination} aria-labelledby="department-work-heading">
          <div className={styles.prepWorkflowStepHead}><h3 id="department-work-heading">Phối hợp các bộ phận</h3></div>
          <div className={styles.departmentGrid}>
            <StaffingPreparation providedQuery={staffing} key={cruiseId} cruiseId={cruiseId} refreshKey={`${refreshKey}:${budgetChanges}`}
              onStarted={() => { staffing.retry(); work.retry(); setHandoffChanges(count => count + 1); onChanged() }} onBudgetRequired={budget.retry} />
            <CruiseWorkHandoff providedQuery={work} coordinated key={`handoff:${cruiseId}:${handoffChanges}`} cruiseId={cruiseId}
              budgetAmount={budget.data?.amountVnd ?? null} budgetLoading={budget.loading} budgetUnavailable={Boolean(budget.error)} />
          </div>
        </section>}
        </div><CruisePreparationProgress budget={budget} plan={plan} staffing={staffing} work={work}/></div>
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
      <CruisePlanReview itineraryMode={itineraryMode} cruiseId={cruiseId} refreshKey={refreshKey} onChanged={onChanged} mode="prepare" />
      <DeparturePricingPolicy readOnly cruiseId={cruiseId} onChanged={onChanged} />
    </Panel>
  )
}
