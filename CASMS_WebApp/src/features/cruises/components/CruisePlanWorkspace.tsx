import {businessCopy} from '@/shared/i18n/business-copy'
import {Button, Panel} from '@/shared/ui'
import type {DepartureSection} from '../model/preparation'
import {CruisePlanReview} from './CruisePlanReview'
import {DeparturePricingPolicy} from './DeparturePricingPolicy'

/** One Cruise context and one instance of each editor; approvals remain separate commands. */
export function CruisePlanWorkspace({cruiseId,refreshKey,onChanged,onSection,sections}:{
 cruiseId:string;refreshKey:string;onChanged:()=>void;
 onSection:(section:DepartureSection)=>void;sections:readonly DepartureSection[]
}) {
 return <Panel title={businessCopy('cruise.plan.workspace.title')}>
  <p>{businessCopy('cruise.plan.workspace.instructions')}</p>
  <nav aria-label={businessCopy('cruise.plan.workspace.inputs')}>
   {([['schedule','cruise.plan.workspace.schedule'],['resources','cruise.plan.workspace.ship'],['program','cruise.plan.workspace.program']] as const)
    .filter(([section])=>sections.includes(section))
    .map(([section,key])=><Button key={section} tone="secondary" onClick={()=>onSection(section)}>{businessCopy(key)}</Button>)}
  </nav>
  <CruisePlanReview cruiseId={cruiseId} refreshKey={refreshKey}/>
  <DeparturePricingPolicy cruiseId={cruiseId} onChanged={onChanged}/>
 </Panel>
}
