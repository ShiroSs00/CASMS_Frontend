import { Badge } from '@/shared/ui'
import type { BookingDetail } from '../api/real-booking-api'
import { bookingMoney } from '../model/booking-presentation'
import { financialMoney, paymentState } from '../model/booking-financials'
import { bookingWhen } from '../model/real-booking-view'
import styles from './LiveBooking.module.css'

export function BookingInstallments({ booking }: { booking: BookingDetail }) {
  const installments = [...booking.installments].sort((a, b) => a.sequenceNo - b.sequenceNo)
  const total = booking.agreedFareAmount || 0
  const paid = Math.max(0, booking.totalPaidAmount ?? 0)
  const remaining = Math.max(0, booking.outstandingBalance ?? Math.max(0, total - paid))
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
  const firstUnpaidSeq = installments.find(i => i.status !== 'Cancelled' && !i.paid)?.sequenceNo ?? null

  return (
    <div className={styles.installmentWrap}>
      <div className={styles.paymentProgressCard} role="region" aria-label="Tiến độ thanh toán đặt chỗ">
        <div className={styles.paymentProgressHead}>
          <div>
            <span className={styles.helper}>Tiến độ thanh toán</span>
            <strong>{bookingMoney(paid, booking.currency)} / {bookingMoney(total, booking.currency)}</strong>
          </div>
          <Badge
            label={remaining === 0 ? 'Đã thanh toán đủ' : `Còn lại ${bookingMoney(remaining, booking.currency)}`}
            tone={remaining === 0 ? 'success' : 'info'}
          />
        </div>
        <div className={styles.paymentProgressTrack} aria-hidden="true">
          <div className={styles.paymentProgressFill} style={{ width: `${pct}%` }} />
        </div>
        <p className={styles.helper}>
          Đã hoàn thành <strong>{pct}%</strong> tổng giá trị đặt chỗ
          {booking.holdExpiresAt && remaining > 0 ? ` · Hạn giữ chỗ: ${bookingWhen(booking.holdExpiresAt)}` : ''}
        </p>
      </div>

      <h3>Lịch thanh toán từng đợt ({installments.length} đợt)</h3>
      {!installments.length && <p>Chưa có lịch thanh toán. Liên hệ bộ phận đặt chỗ để được hỗ trợ.</p>}
      <ol className={styles.installmentTimeline} aria-label="Các đợt thanh toán">
        {installments.map((item, index) => {
          const isPaid = Boolean(item.paid)
          const isCancelled = item.status === 'Cancelled'
          const isNextDue = !isPaid && !isCancelled && item.sequenceNo === firstUnpaidSeq
          const title = booking.paymentPlan === 'STAGES' && installments.length === 3
            ? ['Đợt 1 · Đặt cọc giữ chỗ', 'Đợt 2 · Thanh toán giữa kỳ', 'Đợt 3 · Tất toán phần còn lại'][index]
            : item.installmentType === 'FinalFare'
              ? (booking.paymentPlan === 'FULL' ? 'Thanh toán toàn bộ' : 'Đợt 2 · Thanh toán phần còn lại')
              : 'Đợt 1 · Đặt cọc giữ chỗ'
          return (
            <li
              key={item.sequenceNo}
              className={`${styles.installmentRow} ${isPaid ? styles.installmentRowPaid : isNextDue ? styles.installmentRowDue : ''}`}
            >
              <div className={styles.installmentRail} aria-hidden="true">
                <span className={styles.installmentNode}>{isPaid ? '✓' : item.sequenceNo}</span>
              </div>
              <div className={styles.installmentCard}>
                <div className={styles.installmentCardHead}>
                  <div>
                    <p className={styles.helper}>
                      Đợt {item.sequenceNo} · {isCancelled ? 'Đã hủy' : 'Theo lịch hợp đồng'}
                    </p>
                    <h4>{title}</h4>
                  </div>
                  <Badge
                    label={isCancelled ? 'Đã hủy' : isPaid ? 'Đã thanh toán' : isNextDue ? 'Cần thanh toán' : 'Sắp đến hạn'}
                    tone={isCancelled ? 'neutral' : isPaid ? 'success' : isNextDue ? 'warning' : 'info'}
                  />
                </div>
                <div className={styles.installmentCardGrid}>
                  <div>
                    <span className={styles.helper}>Số tiền đợt này</span>
                    <strong className={styles.installmentAmountMain}>{bookingMoney(item.requiredAmount, item.currency)}</strong>
                  </div>
                  <div>
                    <span className={styles.helper}>Hạn thanh toán (Giờ VN)</span>
                    <strong>{bookingWhen(item.dueAt)}</strong>
                  </div>
                  <div>
                    <span className={styles.helper}>Đã thanh toán / Còn lại</span>
                    <strong>
                      {financialMoney(item.paidAmount, item.currency)} / {financialMoney(item.outstandingAmount, item.currency)}
                    </strong>
                  </div>
                </div>
                {!isPaid && !isCancelled && (
                  <p className={styles.helper}>{paymentState(item.paid)}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
