import type { ReactNode } from 'react'
import { Badge, DataTable, Empty, Panel, RecordFacts } from '@/shared/ui'
import type { BookingDetail } from '../api/real-booking-api'
import { bookingMoney } from '../model/booking-presentation'
import { bookingBirthDate, bookingContractStatus, bookingNationalityName, bookingStatusName, bookingWhen } from '../model/real-booking-view'
import { BookingInstallments } from './BookingInstallments'
import styles from './BookingAgent.module.css'

export function BookingStatusBadge({ status }: { status: BookingDetail['bookingStatus'] }) {
  return <Badge label={bookingStatusName[status]} tone={status === 'Confirmed' ? 'success' : status === 'Cancelled' ? 'neutral' : 'warning'} />
}

export function BookingPaymentFacts({ booking }: { booking: BookingDetail }) {
  const money = (amount?: number | null) => amount == null ? 'Chưa cung cấp' : bookingMoney(amount, booking.currency)
  return <dl className={styles.financialSummary} aria-label="Số tiền theo đặt chỗ">
    <div><dt>Tổng giá trị đặt chỗ</dt><dd>{money(booking.agreedFareAmount)}</dd></div>
    <div><dt>Đã ghi nhận thanh toán</dt><dd>{money(booking.totalPaidAmount)}</dd></div>
    <div><dt>Còn phải thu</dt><dd>{money(booking.outstandingBalance)}</dd></div>
    <div><dt>Mức đặt cọc yêu cầu</dt><dd>{money(booking.requiredDepositAmount)}</dd></div>
  </dl>
}

export function BookingRecord({ booking, contractAction, summaryInHeader = false }:
  { booking: BookingDetail; contractAction?: ReactNode; summaryInHeader?: boolean }) {
  return <div className={styles.sections}>
    <Panel title="Thông tin chuyến">
      <RecordFacts entries={[
        ...(!summaryInHeader ? [
          ['Mã đặt chỗ', booking.bookingReference],
          ['Trạng thái', <BookingStatusBadge status={booking.bookingStatus} />],
          ['Chuyến khởi hành', booking.cruiseName],
        ] as const : []),
        ['Mã chuyến', booking.cruiseCode ?? 'Chưa cung cấp'],
        ['Tàu', booking.shipName ?? 'Chưa cung cấp'],
        ['Khởi hành', bookingWhen(booking.departureDatetime)],
        ['Kết thúc', bookingWhen(booking.returnDatetime)],
        ...(booking.bookingStatus === 'Draft' && booking.holdExpiresAt ? [['Hạn giữ chỗ', bookingWhen(String(booking.holdExpiresAt))]] as const : []),
      ]} />
      {booking.cancellationReason && <p>Lý do hủy: {booking.cancellationReason}</p>}
    </Panel>
    <Panel title="Hành khách và cabin" className={styles.table}>
      {booking.passengers.length ? <DataTable label="Hành khách đặt chỗ" headers={['Hành khách', 'Ngày sinh / Quốc tịch', 'Liên hệ', 'Cabin', 'Gói đã chọn', 'Trạng thái']}>
        {booking.passengers.map(person => <tr key={person.bookingPassengerId}>
          <th scope="row">{person.fullName}{booking.representativeBookingPassengerId === person.bookingPassengerId && <small className={styles.helper}>Người đại diện đặt chỗ</small>}</th>
          <td>{bookingBirthDate(person.dateOfBirth)}<br />{bookingNationalityName(person.nationality)}</td>
          <td>{person.email ?? 'Chưa cung cấp'}<br />{person.phoneNumber ?? 'Chưa cung cấp'}</td>
          <td>{person.cabinNumber ?? (person.cabinSelectionMode === 'CATEGORY_HOLD' ? 'Giữ chỗ theo hạng' : 'Chưa phân cabin')}</td>
          <td>{person.selectedFare?.templateName ?? person.tourPackageName ?? 'Chưa chọn gói'}</td>
          <td><Badge label={person.participationStatus === 'Active' ? 'Tham gia' : 'Đã hủy'} tone={person.participationStatus === 'Active' ? 'success' : 'neutral'} /></td>
        </tr>)}
      </DataTable> : <Empty title="Chưa có thông tin hành khách" />}
    </Panel>
    <Panel id={summaryInHeader ? 'booking-contract' : undefined} title="Hợp đồng">
      <RecordFacts entries={[
        ['Trạng thái hợp đồng', bookingContractStatus(booking.contractStatus)],
        ['Mã hợp đồng', booking.contractReference ?? 'Chưa cung cấp'],
        ['Mã hồ sơ bản ký', booking.contractDocumentReference ?? 'Chưa cung cấp'],
        ['Ghi nhận bản ký lúc', bookingWhen(booking.contractAcceptedAt)],
      ]} />
      {booking.contractSigningInstructions && <p>{booking.contractSigningInstructions}</p>}
      {contractAction}
    </Panel>
    <Panel id={summaryInHeader ? 'booking-payment' : undefined} title="Thanh toán">
      <BookingPaymentFacts booking={booking} />
      {booking.finalPaymentDueAt && <p>Hạn thanh toán phần còn lại: {bookingWhen(booking.finalPaymentDueAt)}</p>}
      <BookingInstallments booking={booking} showContract={false} />
    </Panel>
  </div>
}
