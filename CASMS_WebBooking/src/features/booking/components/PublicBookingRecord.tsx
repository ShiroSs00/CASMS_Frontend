import { BookingInstallments } from './BookingInstallments'
import { Badge, DataTable, Notice, Panel } from '@/shared/ui'
import type { BookingDetail } from '../api/real-booking-api'
import { bookingMoney } from '../model/booking-presentation'
import { financialMoney, paymentState } from '../model/booking-financials'
import { bookingStatusName, bookingWhen, bookingPlanName } from '../model/real-booking-view'
import styles from './LiveBooking.module.css'

export function PublicBookingRecord({ booking, showPassengerDetails = false }: { booking: BookingDetail; showPassengerDetails?: boolean }) {
  const contract = booking.contractStatus ? ({ Draft: 'Bản nháp', Accepted: 'Đã chấp thuận', Cancelled: 'Đã hủy' } as Record<string, string>)[booking.contractStatus] ?? booking.contractStatus : 'Chưa có trạng thái'
  const plan = bookingPlanName(booking.paymentPlan)
  return <div className={styles.publicRecord}>
    {booking.bookingStatus === 'Draft' && <Notice title="Đặt chỗ đang chờ xác nhận" tone="info">Thanh toán thành công chưa đồng nghĩa đặt chỗ đã được xác nhận. Đặt chỗ chỉ được xác nhận khi khoản thanh toán yêu cầu và hợp đồng bản ký đã được ghi nhận đầy đủ.</Notice>}
    {booking.bookingStatus === 'Confirmed' && <Notice title="Đặt chỗ đã được xác nhận" tone="success">Bạn có thể nhận email xác nhận kèm tên đăng nhập và hướng dẫn thiết lập mật khẩu cho tài khoản mới. Nếu chưa nhận được email, vui lòng liên hệ hỗ trợ. Tài khoản đã có giữ nguyên mật khẩu.</Notice>}
    <Panel title="Trạng thái đặt chỗ"><div className={styles.sectionHeading}><h3>{booking.cruiseName}</h3><Badge label={bookingStatusName[booking.bookingStatus]} /></div><dl className={styles.recordFacts}>
      <div><dt>Mã đặt chỗ</dt><dd>{booking.bookingReference}</dd></div><div><dt>Thời gian · giờ Việt Nam</dt><dd>{bookingWhen(booking.departureDatetime)} → {bookingWhen(booking.returnDatetime)}</dd></div>
      <div><dt>Hợp đồng</dt><dd>{booking.contractReference ?? 'Chưa có'} · {contract}</dd></div><div><dt>Kế hoạch thanh toán</dt><dd>{plan}</dd></div>
    </dl>{booking.cancellationReason && <p>Lý do hủy: {booking.cancellationReason}</p>}</Panel>
    <Panel title="Thanh toán"><dl className={`${styles.recordFacts} ${styles.financialFacts}`}>
      <div><dt>Tổng giá vé</dt><dd>{bookingMoney(booking.agreedFareAmount, booking.currency)}</dd></div>
      <div><dt>Đã thanh toán</dt><dd>{financialMoney(booking.totalPaidAmount, booking.currency)}</dd></div>
      <div><dt>Còn phải thanh toán</dt><dd>{financialMoney(booking.outstandingBalance, booking.currency)}</dd></div>
      <div><dt>Trạng thái thanh toán</dt><dd>{paymentState(booking.fullyPaid)}</dd></div>
      <div><dt>Cọc yêu cầu</dt><dd>{bookingMoney(booking.requiredDepositAmount, booking.currency)}</dd></div><div><dt>Hạn thanh toán cuối</dt><dd>{bookingWhen(booking.finalPaymentDueAt)}</dd></div>
    </dl>
      {booking.bookingStatus === 'Cancelled' && <p>Đặt chỗ đã hủy. Số dư hiển thị không phải yêu cầu thanh toán hoặc xác nhận hoàn tiền.</p>}
      <BookingInstallments booking={booking} />
      <p className={styles.helper}>Thực hiện thanh toán theo hướng dẫn hợp đồng và lưu chứng từ để đối soát.</p>
      {booking.contractSigningInstructions && <div className={styles.selection}><strong>Hướng dẫn hợp đồng</strong><p>{booking.contractSigningInstructions}</p></div>}
    </Panel>
    <Panel title="Hành khách & phòng"><DataTable label="Hành khách đặt chỗ" headers={['Hành khách', 'Phòng', 'Gói dịch vụ', 'Tham gia']}>{booking.passengers.map(person => <tr key={person.bookingPassengerId}><td>{person.fullName}</td><td>{person.cabinNumber ?? 'Chưa gán phòng'}</td><td>{person.tourPackageName ?? 'Chưa chọn gói'}</td><td>{person.participationStatus === 'Active' ? 'Tham gia' : 'Đã hủy'}</td></tr>)}</DataTable></Panel>
    {showPassengerDetails && <Panel title="Thông tin hành khách đã ghi nhận">{booking.passengers.map(person => <section key={person.bookingPassengerId}><h3>{person.fullName}</h3><dl className={styles.recordFacts}><div><dt>Ngày sinh</dt><dd>{person.dateOfBirth ?? 'Chưa cung cấp'}</dd></div><div><dt>Quốc tịch</dt><dd>{person.nationality ?? 'Chưa cung cấp'}</dd></div><div><dt>Email</dt><dd>{person.email ?? 'Chưa cung cấp'}</dd></div><div><dt>Số điện thoại</dt><dd>{person.phoneNumber ?? 'Chưa cung cấp'}</dd></div></dl></section>)}<p className={styles.helper}>Liên hệ bộ phận đặt chỗ nếu cần cập nhật thông tin hành khách.</p></Panel>}
  </div>
}
