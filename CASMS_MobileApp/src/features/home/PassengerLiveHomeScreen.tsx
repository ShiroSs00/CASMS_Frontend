import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerListItem } from '@/components/passenger/PassengerListItem';
import { PassengerSheet, SectionHeading, EmptyState, ui } from '@/components/passenger/PassengerUI';
import { VoyageEntrance } from '@/components/passenger/VoyageEntrance';
import { ErrorNotice, Loading } from '@/features/passenger-actions/PassengerActionUI';
import { passengerApi, usePassengerQuery } from '@/features/passenger-actions/passenger-hooks';
import { dateTime } from '@/features/passenger-actions/passenger-model';
import { InfoRow } from '@/features/itinerary/ItineraryUI';
import { selectVoyage, useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { formatDay, statusLabel } from '@/features/itinerary/api-format';
import { brand } from '@/constants/ocevie';
import { VoyageSummaryCard, homeStyles } from './VoyageHomeParts';

const phase: Record<string, string> = { PUBLISHED: 'Sắp khởi hành', IN_PROGRESS: 'Đang diễn ra', COMPLETED: 'Đã kết thúc', CANCELLED: 'Đã hủy' };

export function PassengerLiveHomeScreen() {
  const catalog = useSelectedItinerary();
  const { context, voyage, cruise } = catalog;
  const bookingId = voyage?.bookingId ?? '';
  const booking = usePassengerQuery(['booking', bookingId], signal => passengerApi.booking(bookingId, signal), 'BOOKING_READ', !!bookingId);
  const inbox = usePassengerQuery(['notifications'], passengerApi.notifications, 'NOTIFICATION_READ');
  const [showChoices, setShowChoices] = useState(false);
  const person = !booking.error && booking.data?.bookingStatus === 'Confirmed'
    ? booking.data.passengers.find(item => item.bookingPassengerId === voyage?.bookingPassengerId) : undefined;
  const unread = !inbox.error ? inbox.data?.find(item => !item.readAt) : undefined;
  const status = cruise?.status ?? voyage?.cruiseStatus;
  function refresh() {
    void context.me.refetch();
    if (context.can('BOOKING_READ')) void catalog.refetch();
    if (bookingId && context.can('BOOKING_READ')) void booking.refetch();
    if (voyage && context.can('CRUISE_READ')) void catalog.refetchCruise();
    if (context.can('NOTIFICATION_READ')) void inbox.refetch();
  }
  return <PassengerScaffold selected="home">
    <ScrollView contentContainerStyle={homeStyles.content} refreshControl={<RefreshControl
      refreshing={catalog.isRefetching || inbox.isRefetching} onRefresh={refresh} tintColor={brand.teal} />}>
      <View style={homeStyles.greeting}><Text accessibilityRole="header" style={homeStyles.title}>Chào {person?.fullName ?? context.auth.session?.user.username ?? 'bạn'}.</Text></View>
      <ErrorNotice error={context.error ?? catalog.error} retry={refresh} />
      {context.live && !context.error && (!context.ready || (context.can('BOOKING_READ') && catalog.isPending)) &&
        <View style={ui.card} accessibilityState={{ busy: true }}>
          <View accessible={false} style={{ width: '65%', height: 12, borderRadius: 6, backgroundColor: brand.navySoft }} />
          <Loading text="Đang tải chuyến đi của bạn…" />
        </View>}
      {voyage && <VoyageEntrance key={voyage.bookingId}>
        <VoyageSummaryCard title={voyage.cruiseName} ship={cruise?.shipName ?? booking.data?.shipName ?? 'OceVie Cruises'}
          dates={cruise?.departureDatetime || booking.data?.departureDatetime ? dateTime(cruise?.departureDatetime ?? booking.data?.departureDatetime)
            : voyage.startDate ? formatDay(voyage.startDate) : 'Chưa có giờ khởi hành'}
          label={status ? phase[status] ?? statusLabel(status) : 'Chuyến đi của bạn'}
          cabin={person?.cabinNumber ? `${person.cabinNumber}${person.deckNumber != null ? ` · Tầng ${person.deckNumber}` : ''}` : undefined}
          onPress={() => router.push('/cruise')} />
      </VoyageEntrance>}
      {(catalog.voyages.length > 1 || (catalog.voyages.length === 1 && !voyage)) &&
        <PassengerButton label={voyage ? 'Chọn chuyến khác' : 'Chọn chuyến đi'} variant="text" onPress={() => setShowChoices(true)} />}
      {context.ready && context.can('BOOKING_READ') && catalog.isSuccess && !catalog.voyages.length &&
        <EmptyState title="Chưa có chuyến đi đã xác nhận" description="Đặt chỗ nháp và các đơn khác có trong Đặt chỗ của tôi."
          action="Xem đặt chỗ" onPress={() => router.navigate('/bookings')} />}
      {context.ready && !context.can('BOOKING_READ') && <EmptyState title="Chưa xem được chuyến đi" description="Liên hệ OceVie để kiểm tra quyền truy cập đặt chỗ." />}
      {context.can('NOTIFICATION_READ') && <PassengerListItem title="Thông báo của bạn"
        supporting={unread?.title ?? 'Xem tin nhắn và cập nhật chuyến đi'} icon="notifications" onPress={() => router.push('/notifications')} />}
      <View style={{ gap: 12 }}><SectionHeading title="Hành trình của bạn" />
        {context.can('BOOKING_READ') && <PassengerListItem title="Đặt chỗ của tôi" supporting="Phòng, người đồng hành và thanh toán" icon="sailing" onPress={() => router.navigate('/bookings')} />}
        {!!catalog.itineraryId && <PassengerListItem title="Hải trình" supporting="Cảng ghé, tour tham quan và giờ tàu" icon="sailing" onPress={() => router.navigate('/itinerary')} />}
        {context.can('CHECKIN_READ') && <PassengerListItem title="Check-in" supporting="Chuẩn bị trước khi lên tàu" icon="assignment_ind" onPress={() => router.push('/check-in')} />}
        {(context.can('ACTIVITY_READ') || context.can('EXCURSION_READ')) && <PassengerListItem title="Hoạt động và tour" supporting="Khám phá và quản lý trải nghiệm" icon="explore"
          onPress={() => router.push({ pathname: '/passenger-activities', params: bookingId ? { bookingId } : {} })} />}
        {context.can('SERVICE_READ') && <PassengerListItem title="Dịch vụ trên tàu" supporting="Xem dịch vụ và quản lý yêu cầu" icon="room_service" onPress={() => router.navigate('/services')} />}
      </View>
      <PassengerListItem title="Trung tâm hỗ trợ" supporting="Giải đáp thắc mắc và hướng dẫn an toàn" icon="support_agent" onPress={() => router.push('/support')} />
    </ScrollView>
    <PassengerSheet visible={showChoices} title="Chọn chuyến đi" onClose={() => setShowChoices(false)}>
      {catalog.voyages.map(item => <InfoRow key={item.bookingId} title={item.cruiseName}
        subtitle={`${phase[item.cruiseStatus] ?? statusLabel(item.cruiseStatus)}${item.startDate ? ` · ${formatDay(item.startDate)}` : ''}`}
        icon={voyage?.bookingId === item.bookingId ? 'check_circle' : 'sailing'} onPress={() => {
          if (catalog.userId) selectVoyage(catalog.userId, item.bookingId);
          setShowChoices(false);
        }} />)}
    </PassengerSheet>
  </PassengerScaffold>;
}
