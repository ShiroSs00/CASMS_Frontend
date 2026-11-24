import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerListItem } from '@/components/passenger/PassengerListItem';
import { SectionHeading, EmptyState, ui } from '@/components/passenger/PassengerUI';
import { ErrorNotice, Loading } from '@/features/passenger-actions/PassengerActionUI';
import { passengerApi, usePassengerQuery } from '@/features/passenger-actions/passenger-hooks';
import { dateTime, voyageAllowsActions } from '@/features/passenger-actions/passenger-model';
import { useLiveItinerary } from '@/features/itinerary/itinerary-api';
import { formatDay, stopsForDay } from '@/features/itinerary/api-format';
import { useNow } from '@/hooks/use-now';
import { brand } from '@/constants/ocevie';
import { VoyageSummaryCard, homeStyles } from './VoyageHomeParts';
import { PassengerVoyageChooser } from './PassengerVoyageChooser';
import { itineraryToday, nextRegisteredActivity, voyageLabel } from './voyage-home-model';

export function PassengerLiveHomeScreen() {
  const { catalog, detail, canRead } = useLiveItinerary();
  const { context, voyage, cruise, booking, person } = catalog;
  const bookingId = voyage?.bookingId ?? '';
  const canReadBooking = context.can('BOOKING_READ');
  const bookings = usePassengerQuery(['bookings'], passengerApi.bookings, 'BOOKING_READ', catalog.isSuccess && !catalog.voyages.length);
  const inbox = usePassengerQuery(['notifications'], passengerApi.notifications, 'NOTIFICATION_READ');
  const [showChoices, setShowChoices] = useState(false);
  const now = useNow(60000);
  const today = itineraryToday(detail.data?.days ?? [], now);
  const next = nextRegisteredActivity(voyage, now);
  const unread = inbox.error ? undefined : inbox.data?.find(item => !item.readAt);
  const status = cruise?.status ?? voyage?.cruiseStatus;
  const canUseVoyage = voyageAllowsActions(status) && !booking.error && !catalog.error && (!booking.data || !!person);
  const canReadActivities = context.can('ACTIVITY_READ') || context.can('EXCURSION_READ');
  const profile = context.ready ? context.me.data : undefined;
  const paused = context.me.fetchStatus === 'paused' || catalog.fetchStatus === 'paused';
  const needsChoice = catalog.voyages.length > 1 || (catalog.voyages.length === 1 && !voyage);
  const hasBookings = !!(bookings.data?.length || catalog.data?.length);
  const emptyDescription = catalog.data?.length && catalog.data.every(row => row.bookingStatus === 'Cancelled')
    ? 'Các đặt chỗ liên kết với chuyến đi đã bị hủy.'
    : catalog.data?.length && catalog.data.every(row => row.participationStatus === 'Cancelled')
      ? 'Hồ sơ hành khách đã hủy tham gia các chuyến được liên kết.'
      : hasBookings ? 'Xem trạng thái đặt chỗ và hồ sơ hành khách của bạn.'
        : 'Chuyến đi sẽ xuất hiện sau khi đặt chỗ được xác nhận và liên kết với tài khoản.';

  function refresh() {
    void context.me.refetch();
    if (canReadBooking) void catalog.refetch();
    if (bookingId && canReadBooking) void booking.refetch();
    if (voyage && context.can('CRUISE_READ')) void catalog.refetchCruise();
    if (catalog.itineraryId && canRead) void detail.refetch();
    if (!catalog.voyages.length && canReadBooking) void bookings.refetch();
    if (context.can('NOTIFICATION_READ')) void inbox.refetch();
  }

  return <PassengerScaffold selected="home">
    <ScrollView contentContainerStyle={homeStyles.content} refreshControl={<RefreshControl
      refreshing={catalog.isRefetching || booking.isRefetching || inbox.isRefetching} onRefresh={refresh} tintColor={brand.teal} />}>
      <View style={homeStyles.greeting}>
        <Text accessibilityRole="header" style={homeStyles.title}>{person?.fullName ?? profile?.fullName ?? profile?.username ?? 'Chuyến đi của bạn'}</Text>
      </View>
      <ErrorNotice error={context.error ?? catalog.error} retry={refresh} />
      {paused ? <EmptyState title="Đang chờ kết nối" description="Kiểm tra mạng để tải chuyến đi." /> :
        context.live && !context.error && (!context.ready || (canReadBooking && catalog.isPending)) &&
        <Loading text="Đang tải chuyến đi của bạn…" />}
      {voyage && <>
        <VoyageSummaryCard title={voyage.cruiseName}
          ship={cruise?.shipName ?? (person ? booking.data?.shipName : null) ?? (catalog.cruiseError || booking.error ? 'Chưa tải được thông tin tàu' : 'Chưa có thông tin tàu')}
          dates={cruise?.departureDatetime || booking.data?.departureDatetime ? dateTime(cruise?.departureDatetime ?? booking.data?.departureDatetime)
            : voyage.startDate ? formatDay(voyage.startDate) : 'chưa cập nhật'}
          returnDate={cruise?.returnDatetime || booking.data?.returnDatetime ? dateTime(cruise?.returnDatetime ?? booking.data?.returnDatetime)
            : voyage.endDate ? formatDay(voyage.endDate) : undefined}
          label={voyageLabel[status ?? voyage.cruiseStatus]}
          cabin={person?.cabinNumber ? `Phòng ${person.cabinNumber}${person.deckNumber != null ? ` · Tầng ${person.deckNumber}` : ''}`
            : person?.cabinId ? 'Đã gán phòng, chưa có số phòng' : person ? 'Chưa được gán phòng' : undefined}
          onPress={() => router.push('/cruise')} />
        <ErrorNotice error={booking.error ?? catalog.cruiseError} retry={refresh} />
        {booking.isLoading && <Loading text="Đang tải hành khách và phòng…" />}
        {booking.isSuccess && !booking.error && !person &&
          <Text style={ui.body}>Hồ sơ hành khách không còn khớp với chuyến đã chọn. Hãy tải lại thông tin đặt chỗ.</Text>}
      </>}
      {needsChoice && <PassengerButton label={voyage ? 'Đổi chuyến đi' : 'Chọn chuyến đi'}
        variant={voyage ? 'secondary' : 'filled'} onPress={() => setShowChoices(true)} />}
      {canReadBooking && catalog.isSuccess && !catalog.error && !catalog.voyages.length && <>
        <ErrorNotice error={bookings.error} retry={() => { void bookings.refetch(); }} />
        {bookings.fetchStatus === 'paused' && <Text style={ui.body}>Đang chờ kết nối để kiểm tra đặt chỗ.</Text>}
        {bookings.isLoading && <Loading text="Đang kiểm tra đặt chỗ…" />}
        {(bookings.isSuccess || catalog.data?.length) ? <EmptyState title={hasBookings ? 'Chưa có chuyến đi khả dụng' : 'Chưa có đặt chỗ'}
          description={emptyDescription} action={hasBookings ? 'Xem đặt chỗ' : 'Liên hệ hỗ trợ'}
          onPress={() => router.push(hasBookings ? '/passenger-bookings' : '/support')} /> : null}
      </>}
      {context.ready && !canReadBooking && <EmptyState title="Chưa có quyền xem chuyến đi" description="Liên hệ OceVie để kiểm tra quyền truy cập đặt chỗ." />}
      {voyage && <View style={homeStyles.section}>
        <SectionHeading title="Lịch trình hôm nay" />
        {!catalog.itineraryId ? <Text style={ui.body}>Hải trình chưa khả dụng.</Text>
          : !canRead ? <Text style={ui.body}>Tài khoản chưa có quyền xem hải trình.</Text>
            : detail.error ? <ErrorNotice error={detail.error} retry={() => { void detail.refetch(); }} />
              : detail.fetchStatus === 'paused' ? <Text style={ui.body}>Đang chờ kết nối để tải lịch trình.</Text>
                : detail.isLoading ? <Loading text="Đang tải lịch trình hôm nay…" />
                : detail.data?.daysDenied ? <Text style={ui.body}>Không có quyền xem lịch theo ngày.</Text>
                  : today ? <PassengerListItem title={`Ngày ${today.dayNumber} · ${formatDay(today.date)}`}
                    supporting={today.description || stopsForDay(today, detail.data?.stops ?? []).map(stop => stop.portName ?? stop.destinationName).filter(Boolean).join(' · ')}
                    icon="sailing" onPress={() => router.navigate('/itinerary')} />
                    : detail.isSuccess ? <Text style={ui.body}>Chưa xác định được lịch hôm nay theo múi giờ của tàu.</Text> : null}
        {next && canReadActivities && <PassengerListItem title={next.name} supporting={`Hoạt động đã xác nhận · ${dateTime(next.startTime)}`}
          icon="explore" onPress={() => router.push({ pathname: '/passenger-activities', params: { bookingId } })} />}
      </View>}
      {context.can('NOTIFICATION_READ') && <PassengerListItem title="Thông báo của bạn"
        supporting={inbox.error ? 'Chưa tải được thông báo' : unread?.title ?? ''} icon="notifications" onPress={() => router.push('/notifications')} />}
      {canUseVoyage && <View style={homeStyles.section}><SectionHeading title="Tiện ích chuyến đi" />
        {context.can('CHECKIN_READ') && <PassengerListItem compact title="Check-in" supporting="" icon="assignment_ind"
          onPress={() => router.push({ pathname: '/check-in', params: { bookingId } })} />}
        {canReadActivities && <PassengerListItem compact title="Hoạt động và tour" supporting="" icon="explore"
          onPress={() => router.push({ pathname: '/passenger-activities', params: { bookingId } })} />}
        {context.can('SERVICE_READ') && <PassengerListItem compact title="Dịch vụ trên tàu" supporting="" icon="room_service"
          onPress={() => router.navigate('/services')} />}
      </View>}
      {canReadBooking && (voyage || needsChoice) && <PassengerListItem compact title="Tất cả đặt chỗ" supporting="" icon="sailing" onPress={() => router.push('/passenger-bookings')} />}
      <PassengerListItem compact title="Trung tâm hỗ trợ" supporting="" icon="support_agent" onPress={() => router.push('/support')} />
    </ScrollView>
    <PassengerVoyageChooser catalog={catalog} visible={showChoices} onClose={() => setShowChoices(false)} />
  </PassengerScaffold>;
}
