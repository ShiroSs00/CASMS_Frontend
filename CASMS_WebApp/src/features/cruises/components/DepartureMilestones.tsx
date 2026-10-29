import styles from './Cruises.module.css'
import {businessCopy} from '@/shared/i18n/business-copy'
export function DepartureMilestones({creating=false,receivingBookings=false,activeStep,onStepChange}:{creating?:boolean;receivingBookings?:boolean;activeStep?:2|3;onStepChange?:(step:2|3)=>void}){
 if(activeStep&&onStepChange)return <ol className={`${styles.departureMilestones} ${styles.interactiveMilestones}`} aria-label="Chuẩn bị và gửi duyệt lần khởi hành">
  <li><span aria-hidden="true">✓</span>{businessCopy('trip.template.PUBLISHED')}</li>
  <li><button type="button" aria-current={activeStep===2?'step':undefined} onClick={()=>onStepChange(2)}><span aria-hidden="true">2</span>Hoàn thiện hồ sơ lần khởi hành</button></li>
  <li><button type="button" aria-current={activeStep===3?'step':undefined} onClick={()=>onStepChange(3)}><span aria-hidden="true">3</span>Kiểm tra và gửi duyệt</button></li>
 </ol>
 const current=receivingBookings?2:1
 return <ol className={styles.departureMilestones} aria-label="Từ lịch trình nguồn đến nhận đặt chỗ">
   <li><span>✓</span>{businessCopy('trip.template.PUBLISHED')}</li>
   <li aria-current={current===1?'step':undefined}><span>{receivingBookings?'✓':'2'}</span>{creating?'Tạo lần khởi hành':'Hoàn thiện hồ sơ lần khởi hành'}</li>
   <li aria-current={current===2?'step':undefined}><span>3</span>{receivingBookings?'Kiểm tra phạm vi nhận đặt chỗ':'Kiểm tra và gửi duyệt'}</li>
 </ol>
}
