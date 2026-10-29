import {businessCopy} from '@/shared/i18n/business-copy'
import {Button, Panel} from '@/shared/ui'
import {allowedDepartureSections, type DepartureSection} from '../model/preparation'
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
 return <Panel title={manager?'Bước 2 · Hoàn thiện hồ sơ':businessCopy('cruise.plan.workspace.title')}>
  <p>{manager?'Hoàn thiện lịch thực tế, tàu, chương trình, khung thời gian và chính sách giá. Sau đó chuyển sang bước 3 để xem lại và gửi OPS phê duyệt.':businessCopy('cruise.plan.workspace.instructions')}</p>
  <nav className={styles.workspaceNav} aria-label={businessCopy('cruise.plan.workspace.inputs')}>
   {([['schedule','cruise.plan.workspace.schedule'],['resources','cruise.plan.workspace.ship'],['program','cruise.plan.workspace.program']] as const)
    .filter(([section])=>sections.includes(section))
    .map(([section,key],index)=><Button key={section} tone="secondary" onClick={()=>onSection(section)}>{manager&&<span className={styles.stepNumber} aria-hidden="true">0{index+1}</span>}{manager?allowedDepartureSections(access).find(([candidate])=>candidate===section)?.[1]:businessCopy(key)}</Button>)}
  </nav>
  <CruisePlanReview cruiseId={cruiseId} refreshKey={refreshKey} onChanged={onChanged} mode={manager?'prepare':'all'}/>
  <DeparturePricingPolicy cruiseId={cruiseId} onChanged={onChanged}/>
  {manager&&onReview&&<div className={styles.planActions}><Button onClick={onReview}>Tiếp tục: Kiểm tra và gửi duyệt</Button></div>}
 </Panel>
}
