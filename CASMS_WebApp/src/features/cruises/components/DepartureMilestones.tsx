import styles from './Cruises.module.css'
import {businessCopy} from '@/shared/i18n/business-copy'
export function DepartureMilestones({creating=false,receivingBookings=false}:{creating?:boolean;receivingBookings?:boolean}){
 const current=receivingBookings?2:1
 return <ol className={styles.departureMilestones} aria-label="Từ lịch trình nguồn đến nhận đặt chỗ">
   <li><span>✓</span>{businessCopy('trip.template.PUBLISHED')}</li>
   <li aria-current={current===1?'step':undefined}><span>{receivingBookings?'✓':'2'}</span>{creating?'Tạo lần khởi hành':'Hoàn thiện hồ sơ lần khởi hành'}</li>
   <li aria-current={current===2?'step':undefined}><span>3</span>{receivingBookings?'Kiểm tra phạm vi nhận đặt chỗ':'Kiểm tra và xác nhận mở bán'}</li>
 </ol>
}
