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
    <h1 ref={headingRef} tabIndex={-1}>Đã tiếp nhận đặt chỗ</h1>
    <section aria-label="Mã đặt chỗ"><h2>{booking.bookingReference}</h2><div className={styles.actions}>
      <Button onClick={() => { void navigator.clipboard.writeText(booking.bookingReference).then(() => setCopied('Đã sao chép mã đặt chỗ.'), () => setCopied('Bạn có thể chọn và sao chép mã phía trên.')) }}>Sao chép mã đặt chỗ</Button>
      {canPayVnd && isPassenger && (
        <ButtonLink to={`/my-bookings/${booking.bookingId}`}>Thanh toán qua VietQR</ButtonLink>
      )}
      {canPayVnd && !isPassenger && (
        <ButtonLink to={`/login?next=${encodeURIComponent(`/my-bookings/${booking.bookingId}`)}&reference=${encodeURIComponent(booking.bookingReference)}`}>Đăng nhập để thanh toán VietQR</ButtonLink>
      )}
      <ButtonLink tone="secondary" to={'/booking/lookup?reference=' + encodeURIComponent(booking.bookingReference)}>Tra cứu đặt chỗ</ButtonLink>
    </div>{copied && <p role="status">{copied}</p>}</section>
    <BookingRecord
      booking={booking}
      paymentAction={
        canPayVnd && !isPassenger ? (
          <Notice title="Tiếp tục thanh toán qua VietQR" tone="info">
            Kiểm tra email kích hoạt tài khoản hoặc đăng nhập tài khoản hành khách đã có để tạo mã VietQR cho đặt chỗ này.
          </Notice>
        ) : null
      }
    />
    <div><Button tone="secondary" onClick={onNew}>Bắt đầu đặt chỗ khác</Button></div>
  </div>
}
