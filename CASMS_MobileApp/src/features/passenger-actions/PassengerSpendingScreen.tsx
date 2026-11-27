import { router } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { AmountRow, EmptyState, ui } from '@/components/passenger/PassengerUI';
import { useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { brand, lightTheme, spacing } from '@/constants/ocevie';
import { ApiError } from '@/lib/api';
import { LivePage, Loading, ErrorNotice } from './PassengerActionUI';
import { passengerApi, usePassengerQuery } from './passenger-hooks';
import { dateTime } from './passenger-model';
import { financialMoney } from './booking-financials';
const money = (amount: number, currency: string) => financialMoney(amount, currency, { signed: true });

const accountLabels: Record<string, string> = { ACTIVE: 'Đang hoạt động', PENDING_ACTIVATION: 'Chờ kích hoạt', POSTING_BLOCKED: 'Tạm ngừng ghi chi tiêu', SUSPENDED: 'Tạm khóa', CLOSED: 'Đã đóng' };
const typeLabels: Record<string, string> = { CHARGE: 'Chi phí', PAYMENT: 'Thanh toán', REFUND: 'Hoàn tiền', REVERSAL: 'Đảo giao dịch', VOID: 'Hủy ghi nhận', ADJUSTMENT: 'Điều chỉnh' };
const statusLabels: Record<string, string> = { POSTED: 'Đã ghi sổ', PENDING: 'Đang chờ', VOIDED: 'Đã hủy', REVERSED: 'Đã đảo', FAILED: 'Không thành công', CANCELLED: 'Đã hủy' };
export function PassengerSpendingScreen() {
  const trip = useSelectedItinerary();
  const { voyage, person } = trip;
  const bookingId = voyage?.bookingId, cruiseId = voyage?.cruiseId, passengerId = person?.passengerId;
  const ready = !!voyage && !!person && !trip.error && !trip.booking.error && !trip.isFetching && !trip.booking.isFetching;
  const scope = [bookingId, voyage?.bookingPassengerId, cruiseId, passengerId];
  const account = usePassengerQuery(['folio-account', ...scope], signal => {
    if (!bookingId || !cruiseId) throw new Error('Chọn chuyến đi trước khi xem chi tiêu.');
    return passengerApi.folioAccount(bookingId, cruiseId, signal);
  }, 'BOOKING_READ', ready);
  const onboardAccount = account.data;
  const statement = usePassengerQuery(['passenger-folio', ...scope, onboardAccount?.onboardAccountId], signal => {
    if (!onboardAccount || !passengerId) throw new Error('Cần xác minh hồ sơ hành khách trước khi tải sao kê.');
    return passengerApi.passengerFolio(onboardAccount, passengerId, signal);
  }, 'BOOKING_READ', ready && !!onboardAccount && !account.error);
  const data = ready && !account.error && !statement.error ? statement.data : undefined;
  const error = trip.error ?? trip.booking.error ?? account.error ?? statement.error;
  const missing = account.error instanceof ApiError && account.error.status === 404;
  const statementUnavailable = statement.error instanceof ApiError && statement.error.status === 404;
  const denied = error instanceof ApiError && [401,403].includes(error.status);
  const waiting = account.fetchStatus === 'paused' || statement.fetchStatus === 'paused';
  const loading = trip.isLoading || trip.booking.isLoading || account.isLoading || statement.isLoading;
  const displayError = error instanceof ApiError && ['FOLIO_CURRENCY','FOLIO_LEDGER_UNRECONCILED'].includes(error.code ?? '')
    ? new Error('Sao kê có số liệu hoặc loại tiền cần đối soát. Vui lòng liên hệ quầy để kiểm tra.')
    : error instanceof ApiError ? error : new Error('Chưa xác minh được sao kê của bạn. Vui lòng tải lại hoặc liên hệ quầy.');
  const refresh = () => { void trip.refetch(); void trip.booking.refetch(); if (ready) { void account.refetch(); if (account.data) void statement.refetch(); } };
  return <LivePage title="Chi tiêu của tôi" permission="BOOKING_READ" scroll={false}>
    <FlatList data={data?.transactions ?? []} keyExtractor={item => item.transactionId} contentContainerStyle={ui.content}
      style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic" initialNumToRender={12}
      refreshing={trip.isRefetching || account.isRefetching || statement.isRefetching} onRefresh={refresh}
      ListHeaderComponent={<View style={{ gap: spacing.lg }}>
        {voyage && <View style={ui.card}><Text style={ui.sectionTitle}>{voyage.cruiseName}</Text>
          {account.data && !account.error && <Text style={ui.body}>{accountLabels[account.data.accountStatus]}</Text>}
          {voyage.cruiseStatus === 'COMPLETED' && <Text style={ui.caption}>Chuyến đã kết thúc. Bạn có thể xem lại sao kê.</Text>}
        </View>}
        {!voyage && !loading && !error && <EmptyState title="Chọn chuyến đi" description="Chọn chuyến đã đặt để xem chi tiêu cá nhân." />}
        {loading && !data && <Loading text="Đang tải chi tiêu cá nhân…" />}
        {waiting && <EmptyState title="Đang chờ kết nối" description="Kết nối mạng để cập nhật sao kê." />}
        {missing ? <EmptyState title="Chưa có tài khoản chi tiêu" description="Tài khoản chi tiêu của chuyến này chưa khả dụng. Bạn có thể kiểm tra lại hoặc liên hệ quầy." />
          : statementUnavailable ? <EmptyState title="Sao kê chưa khả dụng" description="Chưa tải được sao kê của tài khoản trong chuyến này. Vui lòng kiểm tra lại hoặc liên hệ quầy." />
          : denied ? <EmptyState title="Chưa xem được sao kê" description="Phiên hoặc quyền xem hồ sơ đã thay đổi. Vui lòng kiểm tra tài khoản." />
          : error ? <ErrorNotice error={displayError} retry={refresh} /> : null}
        {data && <>
          <Text accessibilityRole="header" style={ui.sectionTitle}>Hạn mức cá nhân</Text>
          {!data.memberLimits.length && <EmptyState title="Chưa có hạn mức cá nhân" description="Chưa có hạn mức được cung cấp cho hồ sơ của bạn." />}
          {data.memberLimits.length > 1 && <Text style={ui.caption}>Các hạn mức được hiển thị riêng theo sao kê, không cộng gộp.</Text>}
          {data.memberLimits.map((limit, index) => <View key={`${limit.passengerId}:${index}`} style={ui.card}>
            {data.memberLimits.length > 1 && <Text style={ui.caption}>Hạn mức {index + 1}</Text>}
            <AmountRow label="Hạn mức cá nhân" value={money(limit.limitAmount, data.currency)} />
            <AmountRow label="Đã sử dụng" value={money(limit.spentAmount, data.currency)} />
            <AmountRow label="Còn khả dụng" value={money(limit.remainingAmount, data.currency)} />
            {limit.limitAmount > 0 && limit.spentAmount >= 0 && <View accessibilityRole="progressbar" accessibilityLabel="Tỷ lệ hạn mức đã sử dụng"
              accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(limit.spentAmount / limit.limitAmount * 100)) }}
              style={{ height: spacing.sm, borderRadius: spacing.xs, backgroundColor: lightTheme.divider, overflow: 'hidden' }}>
              <View style={{ width: `${Math.min(100, limit.spentAmount / limit.limitAmount * 100)}%`, height: '100%', backgroundColor: brand.teal }} />
            </View>}
          </View>)}
          <Text style={ui.caption}>Hạn mức còn lại là khả năng chi tiêu, không phải tiền gửi. Thông tin số tiền cần thanh toán chưa khả dụng.</Text>
          <Text accessibilityRole="header" style={ui.sectionTitle}>Lịch sử chi tiêu</Text>
          <Text style={ui.caption}>Cập nhật {dateTime(data.statementAsOf)}</Text>
        </>}
      </View>}
      ListEmptyComponent={data ? <EmptyState title="Chưa có giao dịch" description="Sao kê cá nhân chưa có giao dịch được ghi nhận." /> : undefined}
      renderItem={({ item }) => <View style={ui.card}>
        <Text style={ui.sectionTitle}>{item.description || typeLabels[item.transactionType] || 'Giao dịch chi tiêu'}</Text>
        {!!item.outletOrLocation && <Text style={ui.caption}>{item.outletOrLocation}</Text>}
        <Text style={ui.caption}>{dateTime(item.transactionTime)}</Text>
        <AmountRow label={typeLabels[item.transactionType] ?? 'Loại giao dịch chưa xác định'} value={money(item.amount, item.currency)} />
        <Text style={ui.body}>{statusLabels[item.status] ?? 'Trạng thái chưa xác định'}</Text>
      </View>}
      ListFooterComponent={<PassengerButton label="Chọn chuyến đi" variant="secondary" onPress={() => router.dismissTo('/passenger-bookings')} />}
    />
  </LivePage>;
}
