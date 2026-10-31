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
  <section className={styles.planWorkspace} aria-label="Hoàn thiện kế hoạch">
   <h2>Hoàn thiện kế hoạch</h2>
   <nav className={styles.planTaskList} aria-label="Nội dung kế hoạch">
    {([
     ['schedule','Lịch khởi hành','Ngày thực tế và các lần ghé cảng','Xem lịch'],
     ['resources','Tàu được phân công','Tàu áp dụng cho chuyến khởi hành này','Xem tàu'],
     ['program','Chương trình và dịch vụ','Hoạt động, tour và gói dịch vụ','Xem chương trình'],
    ] as const).filter(([section])=>sections.includes(section)).map(([section,title,description,label])=><div className={styles.planTaskRow} key={section}><div><h3>{title}</h3><p>{description}</p></div><Button tone="secondary" onClick={()=>onSection(section)}>{label}</Button></div>)}
   </nav>
   <details className={styles.workspaceDisclosure}><summary>Chính sách giá</summary><div className={styles.workspaceBody}><DeparturePricingPolicy embedded cruiseId={cruiseId} refreshKey={refreshKey} onChanged={onChanged}/></div></details>
   <details className={styles.workspaceDisclosure}><summary>Nhận đặt chỗ và hướng dẫn trước chuyến</summary><div className={styles.workspaceBody}><CruisePlanReview embedded cruiseId={cruiseId} refreshKey={refreshKey} onChanged={onChanged} mode="prepare"/></div></details>
  </section>
  {onReview&&<div className={styles.workspaceFooter}><Button onClick={onReview}>Kiểm tra và gửi hồ sơ</Button></div>}
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
