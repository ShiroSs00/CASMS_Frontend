import type { BookingDetail } from '../api/real-booking-api'
import { bookingMoney } from '../model/booking-presentation'
import { financialMoney, paymentState } from '../model/booking-financials'
import { bookingWhen } from '../model/real-booking-view'
import styles from './LiveBooking.module.css'

export function BookingInstallments({ booking }: { booking: BookingDetail }) {
  const installments = [...booking.installments].sort((a,b)=>a.sequenceNo-b.sequenceNo)
  return <>
    <h3>Lịch thanh toán từng đợt</h3>
    <p>Đặt chỗ được xác nhận không đồng nghĩa đã thanh toán đầy đủ.</p>
    {!installments.length && <p>Chưa có lịch thanh toán. Liên hệ bộ phận đặt chỗ để được hỗ trợ.</p>}
    <ol className={styles.installments} aria-label="Các đợt thanh toán">
    {installments.map((item,index)=><li key={item.sequenceNo}>
      <span className={styles.installmentNumber} aria-hidden="true">{item.sequenceNo}</span>
      <div><p className={styles.helper}>Đợt {item.sequenceNo} · {item.status==='Cancelled'?'Đã hủy':'Theo lịch hợp đồng'}</p>
        <h3>{booking.paymentPlan==='STAGES'&&installments.length===3 ? ['Đặt cọc','Thanh toán giữa kỳ','Thanh toán còn lại'][index] : item.installmentType==='FinalFare'?(booking.paymentPlan==='FULL'?'Thanh toán toàn bộ':'Thanh toán còn lại'):'Đặt cọc'}</h3>
        <strong>{bookingMoney(item.requiredAmount,item.currency)}</strong>
        <dl className={styles.installmentAmounts}>
          <div><dt>Đã thanh toán</dt><dd>{financialMoney(item.paidAmount,item.currency)}</dd></div>
          <div><dt>Còn phải thanh toán</dt><dd>{financialMoney(item.outstandingAmount,item.currency)}</dd></div>
        </dl>
        <p>{paymentState(item.paid)}</p>
        <p>Hạn thanh toán: {bookingWhen(item.dueAt)}</p>
      </div>
    </li>)}
  </ol></>
}
