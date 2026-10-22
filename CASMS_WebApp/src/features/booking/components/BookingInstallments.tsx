import type { BookingDetail } from '../api/real-booking-api'
import { bookingMoney } from '../model/booking-presentation'
import { bookingWhen } from '../model/real-booking-view'
import styles from './LiveBooking.module.css'

export function BookingInstallments({ booking }: { booking: BookingDetail }) {
  const installments = [...booking.installments].sort((a,b)=>a.sequenceNo-b.sequenceNo)
  if (!installments.length) return <p>Chưa có lịch thanh toán. Liên hệ bộ phận đặt chỗ để được hỗ trợ.</p>
  return <ol className={styles.installments} aria-label="Các đợt thanh toán">
    {installments.map((item,index)=><li key={item.sequenceNo}>
      <span className={styles.installmentNumber} aria-hidden="true">{item.sequenceNo}</span>
      <div><p className={styles.helper}>Đợt {item.sequenceNo} · {item.status==='Cancelled'?'Đã hủy':'Theo lịch hợp đồng'}</p>
        <h3>{booking.paymentPlan==='STAGES'&&installments.length===3 ? ['Đặt cọc','Thanh toán giữa kỳ','Thanh toán còn lại'][index] : item.installmentType==='FinalFare'?(booking.paymentPlan==='FULL'?'Thanh toán toàn bộ':'Thanh toán còn lại'):'Đặt cọc'}</h3>
        <strong>{bookingMoney(item.requiredAmount,item.currency)}</strong>
        <p>Hạn thanh toán: {bookingWhen(item.dueAt)}</p>
      </div>
    </li>)}
  </ol>
}
