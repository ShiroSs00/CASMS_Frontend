import styles from './Cruises.module.css'
import {businessCopy} from '@/shared/i18n/business-copy'
export function DepartureMilestones({creating=false,receivingBookings=false,activeStep,onStepChange,operationsStep,onOperationsStepChange,sourceConfigured=true}:{sourceConfigured?:boolean;creating?:boolean;receivingBookings?:boolean;operationsStep?:1|2|3;onOperationsStepChange?:(step:1|2|3)=>void;activeStep?:2|3;onStepChange?:(step:2|3)=>void}){
 if(operationsStep&&onOperationsStepChange)return <ol className={`${styles.departureMilestones} ${styles.interactiveMilestones}`} aria-label="Tiến trình xử lý lần khởi hành của OPS">
  {([[1,'Đối chiếu kế hoạch'],[2,'Xét duyệt kế hoạch và giá'],[3,'Kiểm tra và mở bán']] as const).map(([step,label])=><li key={step}><button type="button" aria-current={operationsStep===step?'step':undefined} onClick={()=>onOperationsStepChange(step)}><span aria-hidden="true">{step}</span>{label}</button></li>)}
 </ol>
 if(activeStep&&onStepChange)return <ol className={`${styles.departureMilestones} ${styles.interactiveMilestones}`} aria-label="Chuẩn bị và gửi duyệt lần khởi hành">
  <li><span aria-hidden="true">1</span>{sourceConfigured?businessCopy('trip.template.PUBLISHED'):'Lịch trình nhập trực tiếp'}</li>
  <li><button type="button" aria-current={activeStep===2?'step':undefined} onClick={()=>onStepChange(2)}><span aria-hidden="true">2</span>Hoàn thiện kế hoạch</button></li>
  <li><button type="button" aria-current={activeStep===3?'step':undefined} onClick={()=>onStepChange(3)}><span aria-hidden="true">3</span>Kiểm tra và gửi OPS</button></li>
 </ol>
 const current=receivingBookings?2:1
 return <ol className={styles.departureMilestones} aria-label="Từ lịch trình nguồn đến nhận đặt chỗ">
   <li><span>✓</span>{businessCopy('trip.template.PUBLISHED')}</li>
   <li aria-current={current===1?'step':undefined}><span>{receivingBookings?'✓':'2'}</span>{creating?'Tạo lần khởi hành':'Hoàn thiện hồ sơ lần khởi hành'}</li>
   <li aria-current={current===2?'step':undefined}><span>3</span>{receivingBookings?'Kiểm tra phạm vi nhận đặt chỗ':'Kiểm tra và gửi OPS'}</li>
 </ol>
}
