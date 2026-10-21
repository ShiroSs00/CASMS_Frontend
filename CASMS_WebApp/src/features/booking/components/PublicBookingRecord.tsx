import { Badge, DataTable, Panel } from '@/shared/ui'
import type { BookingDetail } from '../api/real-booking-api'
import { bookingMoney } from '../model/booking-presentation'
import { bookingStatusName, bookingWhen, bookingPlanName } from '../model/real-booking-view'
import styles from './LiveBooking.module.css'

export function PublicBookingRecord({ booking, showPassengerDetails = false }: { booking: BookingDetail; showPassengerDetails?: boolean }) {
  const contract = booking.contractStatus ? ({ Draft: 'Bản nháp', Accepted: 'Đã chấp thuận', Cancelled: 'Đã hủy' } as Record<string, string>)[booking.contractStatus] ?? booking.contractStatus : 'Chưa có trạng thái'
  const plan = bookingPlanName(booking.paymentPlan)
  return <div className={styles.publicRecord}>
    <Panel title="Trạng thái đặt chỗ"><div className={styles.sectionHeading}><h3>{booking.cruiseName}</h3><Badge label={bookingStatusName[booking.bookingStatus]} /></div><dl className={styles.recordFacts}>
      <div><dt>Mã đặt chỗ</dt><dd>{booking.bookingReference}</dd></div><div><dt>Thời gian · giờ Việt Nam</dt><dd>{bookingWhen(booking.departureDatetime)} → {bookingWhen(booking.returnDatetime)}</dd></div>
      <div><dt>Hợp đồng</dt><dd>{booking.contractReference ?? 'Chưa có'} · {contract}</dd></div><div><dt>Kế hoạch thanh toán</dt><dd>{plan}</dd></div>
    </dl>{booking.cancellationReason && <p>Lý do hủy: {booking.cancellationReason}</p>}</Panel>
    <Panel title="Giá vé & lịch thanh toán"><dl className={styles.recordFacts}>
      <div><dt>Giá vé từ hệ thống</dt><dd>{bookingMoney(booking.agreedFareAmount, booking.currency)}</dd></div><div><dt>Cọc yêu cầu</dt><dd>{bookingMoney(booking.requiredDepositAmount, booking.currency)}</dd></div><div><dt>Hạn thanh toán cuối</dt><dd>{bookingWhen(booking.finalPaymentDueAt)}</dd></div>
    </dl>{booking.installments.length > 0 ? <DataTable label="Các đợt thanh toán" headers={['Đợt', 'Số tiền yêu cầu', 'Hạn · giờ Việt Nam', 'Trạng thái']}>{booking.installments.map(item => <tr key={item.sequenceNo}><td>{item.sequenceNo} · {item.description}</td><td>{bookingMoney(item.requiredAmount, item.currency)}</td><td>{bookingWhen(item.dueAt)}</td><td>{item.status === 'Scheduled' ? 'Theo lịch' : item.status === 'Cancelled' ? 'Đã hủy' : item.status}</td></tr>)}</DataTable> : <p>Hệ thống chưa trả về lịch thanh toán.</p>}
      <p className={styles.helper}>Lịch yêu cầu thanh toán không phải bằng chứng đã thu tiền. Chưa hỗ trợ thanh toán hoặc ký hợp đồng trực tuyến tại đây.</p>
      {booking.contractSigningInstructions && <div className={styles.selection}><strong>Hướng dẫn hợp đồng</strong><p>{booking.contractSigningInstructions}</p></div>}
    </Panel>
    <Panel title="Hành khách & phòng"><DataTable label="Hành khách đặt chỗ" headers={['Hành khách', 'Phòng', 'Gói dịch vụ', 'Tham gia']}>{booking.passengers.map(person => <tr key={person.bookingPassengerId}><td>{person.fullName}</td><td>{person.cabinNumber ?? 'Chưa gán phòng'}</td><td>{person.tourPackageName ?? 'Chưa chọn gói'}</td><td>{person.participationStatus === 'Active' ? 'Tham gia' : 'Đã hủy'}</td></tr>)}</DataTable></Panel>
    {showPassengerDetails && <Panel title="Thông tin hành khách đã ghi nhận">{booking.passengers.map(person => <section key={person.bookingPassengerId}><h3>{person.fullName}</h3><dl className={styles.recordFacts}><div><dt>Ngày sinh</dt><dd>{person.dateOfBirth ?? 'Chưa cung cấp'}</dd></div><div><dt>Quốc tịch</dt><dd>{person.nationality ?? 'Chưa cung cấp'}</dd></div><div><dt>Email</dt><dd>{person.email ?? 'Chưa cung cấp'}</dd></div><div><dt>Số điện thoại</dt><dd>{person.phoneNumber ?? 'Chưa cung cấp'}</dd></div></dl></section>)}<p className={styles.helper}>Thông tin chỉ đọc. Số giấy tờ được bảo vệ không hiển thị tại đây.</p></Panel>}
  </div>
}
