import {businessCopy} from '@/shared/i18n/business-copy'
import {Button, Panel} from '@/shared/ui'
import type {DepartureSection} from '../model/preparation'
import {CruisePlanReview} from './CruisePlanReview'
import {DeparturePricingPolicy} from './DeparturePricingPolicy'
import {useSessionAccess} from '@/shared/auth'
import styles from './ManagerWorkspace.module.css'

/** One Cruise context and one instance of each editor; approvals remain separate commands. */
export function CruisePlanWorkspace({cruiseId,refreshKey,onChanged,onSection,sections}:{
 cruiseId:string;refreshKey:string;onChanged:()=>void;
 onSection:(section:DepartureSection)=>void;sections:readonly DepartureSection[]
}) {
 const access=useSessionAccess()
 const manager=access.roles.includes('CRUISE_MANAGER')&&!access.roles.includes('OPERATIONS_MANAGER')
 return <Panel title={businessCopy('cruise.plan.workspace.title')}>

  <nav className={styles.workspaceNav} aria-label={businessCopy('cruise.plan.workspace.inputs')}>
   {([['schedule','cruise.plan.workspace.schedule'],['resources','cruise.plan.workspace.ship'],['program','cruise.plan.workspace.program']] as const)
    .filter(([section])=>sections.includes(section))
    .map(([section,key],index)=><Button key={section} tone="secondary" onClick={()=>onSection(section)}>{manager&&<span className={styles.stepNumber} aria-hidden="true">0{index+1}</span>}{businessCopy(key)}</Button>)}
  </nav>
  <DeparturePricingPolicy cruiseId={cruiseId} onChanged={onChanged}/>
  <CruisePlanReview cruiseId={cruiseId} refreshKey={refreshKey}/>
 </Panel>
}
