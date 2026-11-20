import type { BookingDetail } from '../api/real-booking-api'
import { bookingMoney } from '../model/booking-presentation'
import { bookingWhen } from '../model/real-booking-view'
import styles from './LiveBooking.module.css'
import { Badge, Notice } from '@/shared/ui'

const contractStatusMap: Record<string, { label: string; tone: 'warning' | 'success' | 'error' | 'neutral' }> = {
  Draft: { label: 'Chưa ghi nhận đã ký', tone: 'warning' },
  Accepted: { label: 'Đã chấp nhận', tone: 'success' },
  Cancelled: { label: 'Đã hủy', tone: 'error' },
}

export function BookingInstallments({ booking, showContract = true }: { booking: BookingDetail; showContract?: boolean }) {
  const installments = [...booking.installments].sort((a,b)=>a.sequenceNo-b.sequenceNo)
  const contractMeta = booking.contractStatus ? contractStatusMap[booking.contractStatus] : undefined
  return <>{showContract && booking.bookingStatus === 'Draft' && booking.contractStatus !== 'Accepted' && <Notice title="Chưa thể xác nhận đặt chỗ" tone="warning">Hợp đồng chưa được ghi nhận chấp nhận. Bộ phận được phân quyền cần đối chiếu bản ký và ghi nhận hợp đồng trước khi xác nhận đặt chỗ.</Notice>}
    <p className={styles.helper}>Các kỳ dưới đây là nghĩa vụ theo lịch hợp đồng, chưa xác nhận đã thanh toán. Đặt chỗ được xác nhận không đồng nghĩa đã thanh toán đầy đủ.</p>
    <dl className={styles.summary}>
      {showContract && <div><dt>Hợp đồng</dt><dd><span className={styles.monoCode}>{booking.contractReference ?? 'Chưa có'}</span> {contractMeta ? <Badge label={contractMeta.label} tone={contractMeta.tone} /> : <Badge label={booking.contractStatus ?? 'Chưa xác định'} tone="neutral" />}</dd></div>}
      <div><dt>Hình thức thanh toán đã chọn</dt><dd>{({ FULL: 'Thanh toán một lần', DEPOSIT: 'Đặt cọc và thanh toán phần còn lại', STAGES: 'Thanh toán theo đợt' } as Record<string, string>)[booking.paymentPlan ?? ''] ?? 'Chưa xác định'}</dd></div>
    </dl>
    {!installments.length && <p className={styles.helper}>Chưa có lịch thanh toán. Liên hệ bộ phận đặt chỗ để được hỗ trợ.</p>}
    {installments.length > 0 && <ol className={styles.installments} aria-label="Các đợt thanh toán">
    {installments.map((item,index)=><li key={item.sequenceNo}>
      <span className={styles.installmentNumber} aria-hidden="true">{item.sequenceNo}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className={styles.installmentHead}>
          <span className={styles.helper}>Đợt {item.sequenceNo}</span>
          <Badge label={item.status === 'Cancelled' ? 'Đã hủy' : 'Theo lịch hợp đồng'} tone={item.status === 'Cancelled' ? 'error' : 'info'} />
        </div>
        <h3>{booking.paymentPlan==='STAGES'&&installments.length===3 ? ['Đặt cọc','Thanh toán giữa kỳ','Thanh toán còn lại'][index] : item.installmentType==='FinalFare'?(booking.paymentPlan==='FULL'?'Thanh toán toàn bộ':'Thanh toán còn lại'):'Đặt cọc'}</h3>
        <strong className={styles.numericCell}>{bookingMoney(item.requiredAmount,item.currency)}</strong>
        <p>Hạn thanh toán: {bookingWhen(item.dueAt)}</p>
      </div>
    </li>)}
  </ol>}</>
}
