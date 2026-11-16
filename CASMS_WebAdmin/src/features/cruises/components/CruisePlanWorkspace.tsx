import {useCallback, useState} from 'react'
import {useReadQuery} from '@/shared/api'
import {businessCopy} from '@/shared/i18n/business-copy'
import {Button, Panel} from '@/shared/ui'
import {type DepartureSection} from '../model/preparation'
import {CruisePlanReview} from './CruisePlanReview'
import {DeparturePricingPolicy} from './DeparturePricingPolicy'
import {useSessionAccess} from '@/shared/auth'
import {StaffingPreparation} from '../staffing/StaffingPreparation'
import {OperatingBudget} from './OperatingBudget'
import {CruiseWorkHandoff} from './CruiseWorkHandoff'
import {preparationApi} from '../api/preparation-api'
import styles from './ManagerWorkspace.module.css'

/** One Cruise context and one instance of each editor; approvals remain separate commands. */
export function CruisePlanWorkspace({cruiseId,refreshKey,onChanged,onSection,sections,itineraryMode,coordinator}:{
 cruiseId:string;refreshKey:string;onChanged:()=>void;
 onSection:(section:DepartureSection)=>void;sections:readonly DepartureSection[];itineraryMode?:'FIXED'|'CUSTOM';coordinator:boolean
}) {
 const access=useSessionAccess()
 const [budgetChanges,setBudgetChanges]=useState(0)
 const canPrepare=coordinator&&access.canDo('CRUISE_PREPARATION_SUBMIT')
 const budget=useReadQuery(`operating-budget:${access.userId}:${cruiseId}:${refreshKey}:${canPrepare}`,
   useCallback(signal=>canPrepare?preparationApi.operatingBudget(cruiseId,signal):Promise.resolve(null),[cruiseId,canPrepare]))
 if(coordinator)return <>
  <section className={styles.planWorkspace} aria-label="Chuẩn bị tour">
   <h2>Chuẩn bị tour</h2>
   <nav className={styles.planTaskList} aria-label="Nội dung kế hoạch">
    {([
     ['schedule','Lịch khởi hành','Xem lịch'],
     ['resources','Tàu và quy định','Xem tàu'],
     ['program','Hoạt động, dịch vụ và tour bờ','Xem hoạt động'],
    ] as const).filter(([section])=>sections.includes(section)).map(([section,title,label])=><div className={styles.planTaskRow} key={section}><h3>{title}</h3><Button tone="secondary" onClick={()=>onSection(section)}>{label}</Button></div>)}
   </nav>
   {canPrepare&&<section className={styles.departmentWork} aria-labelledby="department-work-heading">
    <h3 id="department-work-heading">Gửi yêu cầu cho các bộ phận</h3>
    <OperatingBudget key={cruiseId} cruiseId={cruiseId} budget={budget.data} loading={budget.loading} loadError={budget.error}
      retry={budget.retry} onSaved={()=>{budget.retry();setBudgetChanges(count=>count+1)}}/>
    <CruiseWorkHandoff key={'handoff:'+cruiseId} cruiseId={cruiseId}
      budgetAmount={budget.data?.amountVnd??null} budgetLoading={budget.loading} budgetUnavailable={Boolean(budget.error)}/>
    <StaffingPreparation key={cruiseId} cruiseId={cruiseId} refreshKey={`${refreshKey}:${budgetChanges}`}/>
   </section>}
   <CruisePlanReview embedded itineraryMode={itineraryMode} onSection={onSection} cruiseId={cruiseId} refreshKey={refreshKey} onChanged={onChanged} mode="prepare"/>
  </section>
 </>
 return <Panel title={businessCopy('cruise.plan.workspace.title')}>
  <nav className={styles.workspaceNav} aria-label={businessCopy('cruise.plan.workspace.inputs')}>
   {([['schedule','cruise.plan.workspace.schedule'],['resources','cruise.plan.workspace.ship'],['program','cruise.plan.workspace.program']] as const)
    .filter(([section])=>sections.includes(section))
    .map(([section,key])=><Button key={section} tone="secondary" onClick={()=>onSection(section)}>{businessCopy(key)}</Button>)}
  </nav>
  <CruisePlanReview cruiseId={cruiseId} refreshKey={refreshKey} onChanged={onChanged} mode="prepare"/>
  <DeparturePricingPolicy readOnly cruiseId={cruiseId} onChanged={onChanged}/>
 </Panel>
}
