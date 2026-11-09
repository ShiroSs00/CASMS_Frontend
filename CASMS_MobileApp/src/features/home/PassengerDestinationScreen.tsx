import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState, ui } from '@/components/passenger/PassengerUI';
import { useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { Facts } from '@/features/itinerary/ItineraryUI';
import { formatDay, statusLabel } from '@/features/itinerary/api-format';
import { ErrorNotice, LivePage, Loading } from '@/features/passenger-actions/PassengerActionUI';
import { passengerApi, usePassengerQuery } from '@/features/passenger-actions/passenger-hooks';
import { dateTime } from '@/features/passenger-actions/passenger-model';

export function PassengerDestinationScreen() {
  const catalog = useSelectedItinerary();
  const { voyage, cruise, context } = catalog;
  const shipId = cruise?.shipId ?? '';
  const decks = usePassengerQuery(['decks', shipId], signal => passengerApi.decks(shipId, signal), 'DECK_READ', !!shipId);
  const refresh = () => {
    void catalog.refetch();
    if (voyage && context.can('CRUISE_READ')) void catalog.refetchCruise();
    if (shipId && context.can('DECK_READ')) void decks.refetch();
  };
  return <LivePage title="Thông tin chuyến đi" permission="BOOKING_READ" onRefresh={refresh}
    refreshing={catalog.isRefetching || decks.isRefetching}>
    <ErrorNotice error={catalog.error ?? catalog.cruiseError} retry={refresh} />
    {catalog.isPending && <Loading text="Đang tải chuyến đi…" />}
    {voyage ? <>
      <Text style={ui.eyebrow}>{voyage.bookingReference}</Text>
      <Text accessibilityRole="header" style={ui.title}>{voyage.cruiseName}</Text>
      {!!cruise?.shipName && <Text style={ui.sectionTitle}>{cruise.shipName}</Text>}
      <Facts items={[
        ['Khởi hành', cruise?.departureDatetime ? dateTime(cruise.departureDatetime) : voyage.startDate ? formatDay(voyage.startDate) : 'Chưa cập nhật'],
        ['Kết thúc', cruise?.returnDatetime ? dateTime(cruise.returnDatetime) : voyage.endDate ? formatDay(voyage.endDate) : 'Chưa cập nhật'],
        ['Trạng thái', statusLabel(cruise?.status ?? voyage.cruiseStatus)],
      ]} />
      {!!catalog.itineraryId && <PassengerButton label="Xem hải trình" onPress={() => router.dismissTo('/itinerary')} />}
      <PassengerButton label="Xem đặt chỗ và cabin" variant="secondary"
        onPress={() => router.push({ pathname: '/passenger-bookings/[bookingId]', params: { bookingId: voyage.bookingId } })} />
      {!!shipId && context.can('DECK_READ') && <>
        <Text accessibilityRole="header" style={ui.sectionTitle}>Các tầng trên tàu</Text>
        <ErrorNotice error={decks.error} retry={() => { void decks.refetch(); }} />
        {decks.isPending && <Loading text="Đang tải thông tin tầng…" />}
        {decks.data?.filter(deck => deck.shipId === shipId).sort((a, b) => a.deckNumber - b.deckNumber).map(deck =>
          <View key={deck.deckId} style={ui.card}>
            <Text style={ui.eyebrow}>Tầng {deck.deckNumber}</Text>
            {!!deck.deckName && <Text style={ui.body}>{deck.deckName}</Text>}
          </View>)}
        {decks.isSuccess && !decks.data?.some(deck => deck.shipId === shipId) && <Text style={ui.body}>Thông tin tầng đang được cập nhật.</Text>}
      </>}
    </> : catalog.isSuccess && <EmptyState title="Chưa có chuyến đi đã xác nhận"
      description="Chuyến đi và cabin của bạn sẽ xuất hiện sau khi đặt chỗ được xác nhận."
      action="Xem đặt chỗ" onPress={() => router.dismissTo('/bookings')} />}
  </LivePage>;
}
