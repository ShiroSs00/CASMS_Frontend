import { useState, type Ref } from 'react'
import { Button, ButtonLink } from '@/shared/ui'
import type { BookingDetail } from '../api/real-booking-api'
import { BookingRecord } from '../pages/RealBookingPages'
import styles from './BookingParty.module.css'

export function BookingReceipt({ booking, headingRef, onNew }: { booking: BookingDetail; headingRef: Ref<HTMLHeadingElement>; onNew: () => void }) {
  const [copied, setCopied] = useState('')
  return <div className={styles.flow}>
    <h1 ref={headingRef} tabIndex={-1}>Đã tiếp nhận đặt chỗ</h1>
    <section aria-label="Mã đặt chỗ"><h2>{booking.bookingReference}</h2><div className={styles.actions}>
      <Button onClick={() => { void navigator.clipboard.writeText(booking.bookingReference).then(() => setCopied('Đã sao chép mã đặt chỗ.'), () => setCopied('Bạn có thể chọn và sao chép mã phía trên.')) }}>Sao chép mã đặt chỗ</Button>
      <ButtonLink tone="secondary" to={'/booking/lookup?reference=' + encodeURIComponent(booking.bookingReference)}>Tra cứu đặt chỗ</ButtonLink>
    </div>{copied && <p role="status">{copied}</p>}</section>
    <BookingRecord booking={booking} />
    <div><Button tone="secondary" onClick={onNew}>Bắt đầu đặt chỗ khác</Button></div>
  </div>
}
