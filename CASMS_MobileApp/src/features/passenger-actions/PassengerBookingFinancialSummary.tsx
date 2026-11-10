import { Text, View } from 'react-native';
import { AmountRow, ui } from '@/components/passenger/PassengerUI';
import type { BookingDetail } from './passenger-types';
import { bookingFinancialMoney, bookingPaymentState } from './booking-financials';
import { dateTime } from './passenger-model';

export function PassengerBookingFinancialSummary({ booking }: { booking: BookingDetail }) {
  return <>
    <View style={ui.card}>
      <Text accessibilityRole="header" style={ui.sectionTitle}>Thanh toán</Text>
      <AmountRow label="Tổng giá vé" value={bookingFinancialMoney(booking.agreedFareAmount, booking.currency)} prominent />
      <AmountRow label="Đã thanh toán" value={bookingFinancialMoney(booking.totalPaidAmount, booking.currency)} />
      <AmountRow label="Còn phải thanh toán" value={bookingFinancialMoney(booking.outstandingBalance, booking.currency)} />
      <Text style={ui.caption}>Trạng thái thanh toán</Text><Text style={ui.body}>{bookingPaymentState(booking.fullyPaid)}</Text>
      <AmountRow label="Cọc yêu cầu" value={bookingFinancialMoney(booking.requiredDepositAmount, booking.currency)} />
      {booking.bookingStatus === 'Cancelled' && <Text style={ui.body}>Đặt chỗ đã hủy. Số dư hiển thị không phải yêu cầu thanh toán hoặc xác nhận hoàn tiền.</Text>}
    </View>
    <View style={ui.card}>
      <Text accessibilityRole="header" style={ui.sectionTitle}>Hợp đồng</Text>
      <Text style={ui.body}>{booking.contractStatus === 'Accepted' ? 'Đã chấp thuận' : booking.contractStatus === 'Draft' ? 'Chưa chấp thuận' : booking.contractStatus === 'Cancelled' ? 'Đã hủy' : 'Chưa cập nhật'}</Text>
      {!!booking.contractReference && <Text selectable style={ui.caption}>{booking.contractReference}</Text>}
      {booking.bookingStatus === 'Draft' && <Text style={ui.body}>Thanh toán đủ chưa đồng nghĩa đặt chỗ đã được xác nhận. Cần ghi nhận đủ điều kiện thanh toán và hợp đồng bản ký.</Text>}
    </View>
    <Text accessibilityRole="header" style={ui.sectionTitle}>Lịch thanh toán từng đợt</Text>
    {!booking.installments.length && <Text style={ui.body}>Chưa có lịch thanh toán.</Text>}
    {[...booking.installments].sort((a, b) => a.sequenceNo - b.sequenceNo).map(part => <View key={part.sequenceNo} style={ui.card}>
      <Text style={ui.sectionTitle}>Đợt {part.sequenceNo}{part.status === 'Cancelled' ? ' · Đã hủy' : ''}</Text>
      <AmountRow label="Số tiền theo lịch" value={bookingFinancialMoney(part.requiredAmount, part.currency)} />
      <AmountRow label="Đã thanh toán" value={bookingFinancialMoney(part.paidAmount, part.currency)} />
      <AmountRow label="Còn phải thanh toán" value={bookingFinancialMoney(part.outstandingAmount, part.currency)} />
      <Text style={ui.body}>{bookingPaymentState(part.paid)}</Text>
      <Text style={ui.caption}>Hạn thanh toán: {dateTime(part.dueAt)}</Text>
      {!!part.description && <Text style={ui.caption}>{part.description}</Text>}
    </View>)}
  </>;
}
