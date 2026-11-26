import type { ReactNode } from 'react'
import { BookingInstallments } from './BookingInstallments'
import { UsdReference } from './UsdReference'
import { Badge, DataTable, Notice, Panel } from '@/shared/ui'
import type { BookingDetail } from '../api/real-booking-api'
import { bookingMoney } from '../model/booking-presentation'
import { financialMoney, paymentState } from '../model/booking-financials'
import { bookingBirthDate, bookingNationalityName, bookingStatusName, bookingWhen, bookingPlanName } from '../model/real-booking-view'
import styles from './LiveBooking.module.css'

export function PublicBookingRecord({
  booking,
  showPassengerDetails = false,
  paymentAction,
}: {
  booking: BookingDetail
  showPassengerDetails?: boolean
  paymentAction?: ReactNode
}) {
  const contract = booking.contractStatus
    ? ({ Draft: 'Bản nháp', Accepted: 'Đã chấp thuận', Cancelled: 'Đã hủy' } as Record<string, string>)[booking.contractStatus] ?? booking.contractStatus
    : 'Chưa có trạng thái'
  const plan = bookingPlanName(booking.paymentPlan)
  const cancellationReason = booking.cancellationReason === 'HOLD_EXPIRED' ? 'Hết thời hạn giữ chỗ' : booking.cancellationReason
  const depositCoveredWaitingContract =
    booking.bookingStatus === 'Draft'
    && booking.contractStatus !== 'Accepted'
    && booking.totalPaidAmount != null
    && booking.requiredDepositAmount > 0
    && booking.totalPaidAmount >= booking.requiredDepositAmount

  return (
    <div className={styles.publicRecord}>
      {booking.bookingStatus === 'Draft' && (
        <Notice title="Đặt chỗ đang chờ xác nhận" tone="info">
          {depositCoveredWaitingContract
            ? 'OceVie đã tiếp nhận đủ khoản cọc yêu cầu. Bước tiếp theo: hoàn tất ký hợp đồng bản cứng theo hướng dẫn bên dưới để đặt chỗ chuyển sang Đã xác nhận.'
            : 'Đặt chỗ sẽ được xác nhận khi OceVie nhận khoản thanh toán yêu cầu và hợp đồng đã ký.'}
        </Notice>
      )}
      {booking.bookingStatus === 'Confirmed' && (
        <Notice title="Đặt chỗ đã được xác nhận" tone="success">
          {showPassengerDetails
            ? 'Đặt chỗ của bạn đã được xác nhận. Bạn có thể theo dõi lịch thanh toán, hợp đồng và thực hiện check-in trực tuyến ngay trên trang này.'
            : 'Bạn có thể nhận email xác nhận kèm thông tin truy cập tài khoản. Nếu chưa nhận được email, vui lòng liên hệ hỗ trợ.'}
          {booking.fullyPaid === false && booking.outstandingBalance != null && booking.outstandingBalance > 0 && (
            <> Đặt chỗ vẫn còn số dư {bookingMoney(booking.outstandingBalance, booking.currency)} theo lịch thanh toán bên dưới.</>
          )}
        </Notice>
      )}
      <Panel title="Trạng thái đặt chỗ">
        <div className={styles.sectionHeading}>
          <h3>{booking.cruiseName}</h3>
          <Badge
            label={bookingStatusName[booking.bookingStatus]}
            tone={booking.bookingStatus === 'Confirmed' ? 'success' : booking.bookingStatus === 'Cancelled' ? 'neutral' : 'warning'}
          />
        </div>
        <dl className={styles.recordFacts}>
          <div>
            <dt>Mã đặt chỗ</dt>
            <dd>{booking.bookingReference}</dd>
          </div>
          <div>
            <dt>Thời gian · giờ Việt Nam</dt>
            <dd>
              {bookingWhen(booking.departureDatetime)} → {bookingWhen(booking.returnDatetime)}
            </dd>
          </div>
          <div>
            <dt>Hợp đồng</dt>
            <dd>
              {booking.contractReference ?? 'Chưa có'} · {contract}
            </dd>
          </div>
          <div>
            <dt>Kế hoạch thanh toán</dt>
            <dd>{plan}</dd>
          </div>
          {booking.bookingStatus === 'Draft' && booking.holdExpiresAt && (
            <div>
              <dt>Hạn giữ chỗ</dt>
              <dd>{bookingWhen(booking.holdExpiresAt)}</dd>
            </div>
          )}
        </dl>
        {cancellationReason && <p>Lý do hủy: {cancellationReason}</p>}
      </Panel>
      <Panel title="Thanh toán">
        <dl className={`${styles.recordFacts} ${styles.financialFacts}`}>
          <div>
            <dt>Tổng tiền đặt chỗ</dt>
            <dd>{bookingMoney(booking.agreedFareAmount, booking.currency)}</dd>
          </div>
          <div>
            <dt>Đã thanh toán</dt>
            <dd>{financialMoney(booking.totalPaidAmount, booking.currency)}</dd>
          </div>
          <div>
            <dt>Còn phải trả</dt>
            <dd>{financialMoney(booking.outstandingBalance, booking.currency)}</dd>
          </div>
          <div>
            <dt>Trạng thái thanh toán</dt>
            <dd>{paymentState(booking.fullyPaid)}</dd>
          </div>
          {booking.installments.length === 0 && booking.finalPaymentDueAt && (
            <div>
              <dt>Hạn thanh toán cuối</dt>
              <dd>{bookingWhen(booking.finalPaymentDueAt)}</dd>
            </div>
          )}
        </dl>
        {paymentAction}
        {booking.bookingStatus !== 'Cancelled' && booking.outstandingBalance != null && booking.outstandingBalance > 0 && (
          <UsdReference amount={booking.outstandingBalance} currency={booking.currency} />
        )}
        {booking.bookingStatus === 'Cancelled' && (
          <p>Đặt chỗ đã hủy. Số dư hiển thị không phải yêu cầu thanh toán hoặc xác nhận hoàn tiền.</p>
        )}
        <BookingInstallments booking={booking} />
        {booking.contractSigningInstructions && booking.contractStatus !== 'Accepted' && (
          <div className={styles.selection}>
            <strong>Hướng dẫn hợp đồng</strong>
            <p>{booking.contractSigningInstructions}</p>
          </div>
        )}
      </Panel>
      <Panel title="Hành khách & phòng">
        <DataTable label="Hành khách đặt chỗ" headers={['Hành khách', 'Phòng', 'Gói đã chọn', 'Tham gia']}>
          {booking.passengers.map(person => (
            <tr key={person.bookingPassengerId}>
              <td>{person.fullName}</td>
              <td>{person.cabinNumber ?? 'Chưa gán phòng'}</td>
              <td>{person.purchasedFare?.fare.templateName ?? person.selectedFare?.templateName ?? person.tourPackageName ?? '—'}</td>
              <td>{person.participationStatus === 'Active' ? 'Tham gia' : 'Đã hủy'}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
      {showPassengerDetails && (
        <Panel title="Thông tin hành khách đã ghi nhận">
          {booking.passengers.map(person => (
            <section key={person.bookingPassengerId}>
              <h3>{person.fullName}</h3>
              <dl className={styles.recordFacts}>
                <div>
                  <dt>Ngày sinh</dt>
                  <dd>{bookingBirthDate(person.dateOfBirth)}</dd>
                </div>
                <div>
                  <dt>Quốc tịch</dt>
                  <dd>{bookingNationalityName(person.nationality)}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{person.email ?? 'Chưa cung cấp'}</dd>
                </div>
                <div>
                  <dt>Số điện thoại</dt>
                  <dd>{person.phoneNumber ?? 'Chưa cung cấp'}</dd>
                </div>
              </dl>
            </section>
          ))}
        </Panel>
      )}
    </div>
  )
}
