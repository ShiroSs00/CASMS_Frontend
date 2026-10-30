import {businessCopy} from '@/shared/i18n/business-copy'
import {Button, Panel} from '@/shared/ui'
import {type DepartureSection} from '../model/preparation'
import {CruisePlanReview} from './CruisePlanReview'
import {DeparturePricingPolicy} from './DeparturePricingPolicy'
import {useSessionAccess} from '@/shared/auth'
import styles from './ManagerWorkspace.module.css'

/** One Cruise context and one instance of each editor; approvals remain separate commands. */
export function CruisePlanWorkspace({cruiseId,refreshKey,onChanged,onSection,sections,onReview}:{
 cruiseId:string;refreshKey:string;onChanged:()=>void;
 onSection:(section:DepartureSection)=>void;sections:readonly DepartureSection[];onReview?:()=>void
}) {
 const access=useSessionAccess()
 const manager=access.roles.includes('CRUISE_MANAGER')&&!access.roles.includes('OPERATIONS_MANAGER')
 if(manager)return <>
  <CruisePlanReview cruiseId={cruiseId} refreshKey={refreshKey} mode="summary" onReview={onReview}/>
  <CruisePlanReview cruiseId={cruiseId} refreshKey={refreshKey} onChanged={onChanged} mode="prepare"/>
  <DeparturePricingPolicy cruiseId={cruiseId} refreshKey={refreshKey} onChanged={onChanged}/>
 </>
 if(access.roles.includes('OPERATIONS_MANAGER'))return <>
  <CruisePlanReview cruiseId={cruiseId} refreshKey={refreshKey} onChanged={onChanged} mode="prepare"/>
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
