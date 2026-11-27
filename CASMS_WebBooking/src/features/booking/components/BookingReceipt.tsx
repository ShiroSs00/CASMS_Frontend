import { useState, type Ref } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Notice } from '@/shared/ui'
import type { BookingDetail } from '../api/real-booking-api'
import { BookingRecord } from '../pages/RealBookingPages'
import styles from './BookingParty.module.css'

export function BookingReceipt({ booking, headingRef, onNew }: { booking: BookingDetail; headingRef: Ref<HTMLHeadingElement>; onNew: () => void }) {
  const [copied, setCopied] = useState('')
  const access = useSessionAccess()
  const isPassenger = access.status === 'ready' && access.roles.includes('PASSENGER')
  const canPayVnd = booking.bookingStatus !== 'Cancelled' && booking.currency === 'VND' && (booking.outstandingBalance == null || booking.outstandingBalance > 0)

  return <div className={styles.flow}>
    <section className={styles.receiptHero} aria-label="Xác nhận tiếp nhận đặt chỗ">
      <div className={styles.receiptHeroTop}>
        <span className={styles.receiptCheck} aria-hidden="true">✓</span>
        <div>
          <h1 ref={headingRef} tabIndex={-1}>Đã tiếp nhận đặt chỗ</h1>
          <p>Lưu lại mã đặt chỗ bên dưới để tra cứu lịch trình, ký hợp đồng và theo dõi thanh toán.</p>
        </div>
      </div>

      <div className={styles.receiptCodeBox}>
        <div>
          <span className={styles.receiptCodeLabel}>Mã đặt chỗ của bạn</span>
          <p className={styles.receiptCodeValue}>{booking.bookingReference}</p>
        </div>
        <Button
          tone="secondary"
          autoWidth
          onClick={() => {
            void navigator.clipboard.writeText(booking.bookingReference).then(
              () => setCopied('Đã sao chép mã đặt chỗ.'),
              () => setCopied('Bạn có thể chọn và sao chép mã phía trên.'),
            )
          }}
        >
          Sao chép mã
        </Button>
      </div>
      {copied && <p role="status">{copied}</p>}

      <div className={styles.receiptActions}>
        {canPayVnd && isPassenger && (
          <ButtonLink to={`/my-bookings/${booking.bookingId}`}>Thanh toán qua VietQR</ButtonLink>
        )}
        {canPayVnd && !isPassenger && (
          <ButtonLink to={`/login?next=${encodeURIComponent(`/my-bookings/${booking.bookingId}`)}&reference=${encodeURIComponent(booking.bookingReference)}`}>Đăng nhập để thanh toán VietQR</ButtonLink>
        )}
        <ButtonLink tone="secondary" to={'/booking/lookup?reference=' + encodeURIComponent(booking.bookingReference)}>Tra cứu đặt chỗ</ButtonLink>
        <Button tone="secondary" autoWidth onClick={onNew}>Đặt thêm chuyến khác</Button>
      </div>
    </section>

    <BookingRecord
      booking={booking}
      paymentAction={
        canPayVnd && !isPassenger ? (
          <Notice title="Tiếp tục thanh toán qua VietQR" tone="info">
            OceVie đã gửi tên đăng nhập và mật khẩu tạm qua email người đại diện (hoặc bạn có thể dùng tài khoản hành khách đã có). Hãy đăng nhập để tạo mã VietQR và theo dõi thanh toán cho đặt chỗ này.
          </Notice>
        ) : null
      }
    />
  </div>
}
