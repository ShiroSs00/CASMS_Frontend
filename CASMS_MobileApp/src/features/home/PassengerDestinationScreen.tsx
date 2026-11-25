import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { readPublicModel } from './ship-information';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState, ui } from '@/components/passenger/PassengerUI';
import { useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { Facts } from '@/features/itinerary/ItineraryUI';
import { formatDay, statusLabel } from '@/features/itinerary/api-format';
import { ErrorNotice, LivePage, Loading } from '@/features/passenger-actions/PassengerActionUI';
import { passengerApi, passengerKey, usePassengerQuery } from '@/features/passenger-actions/passenger-hooks';
import { dateTime } from '@/features/passenger-actions/passenger-model';

export function PassengerDestinationScreen() {
  const catalog = useSelectedItinerary();
  const { voyage, cruise, context } = catalog;
  const cabin = catalog.person;
  const shipId = cruise?.shipId ?? '';
  const scope = JSON.stringify(passengerKey(context.owner, context.auth.session?.signedInAt, shipId, voyage?.bookingPassengerId));
  const [modelScope, setModelScope] = useState('');
  const model = usePassengerQuery(['public-ship-model', shipId], async signal => readPublicModel(
    await api.request(`/ships/${shipId}/public-model`, { signal, authenticated: false }), shipId), 'BOOKING_READ', !!shipId && modelScope === scope);
  const decks = usePassengerQuery(['decks', shipId], signal => passengerApi.decks(shipId, signal), 'DECK_READ', !!shipId);
  const refresh = () => {
    void catalog.refetch();
    if (voyage && context.can('CRUISE_READ')) void catalog.refetchCruise();
    if (shipId && context.can('DECK_READ')) void decks.refetch();
    if (modelScope === scope && shipId) void model.refetch();
  };
  return <LivePage title="Thông tin chuyến đi" permission="BOOKING_READ" onRefresh={refresh}
    refreshing={catalog.isRefetching || decks.isRefetching}>
    <ErrorNotice error={catalog.error ?? catalog.cruiseError} retry={refresh} />
    {catalog.isLoading && <Loading text="Đang tải chuyến đi…" />}
    {catalog.fetchStatus === 'paused' && <Text style={ui.body}>Đang chờ kết nối để tải chuyến đi.</Text>}
    {voyage ? <>
      <Text style={ui.eyebrow}>{voyage.bookingReference}</Text>
      <Text accessibilityRole="header" style={ui.title}>{voyage.cruiseName}</Text>
      {!!cruise?.shipName && <Text style={ui.sectionTitle}>{cruise.shipName}</Text>}
      <Facts items={[
        ['Phòng', cabin?.cabinNumber ?? (cabin?.cabinId ? 'Đã gán, chưa có số phòng' : cabin ? 'Chưa được gán' : 'Chưa xác minh được')],
        ...(cabin?.deckNumber != null ? [['Tầng', String(cabin.deckNumber)] as [string, string]] : []),
        ['Khởi hành', cruise?.departureDatetime ? dateTime(cruise.departureDatetime) : voyage.startDate ? formatDay(voyage.startDate) : 'Chưa cập nhật'],
        ['Kết thúc', cruise?.returnDatetime ? dateTime(cruise.returnDatetime) : voyage.endDate ? formatDay(voyage.endDate) : 'Chưa cập nhật'],
        ['Trạng thái', statusLabel(cruise?.status ?? voyage.cruiseStatus)],
      ]} />
      {!!catalog.itineraryId && <PassengerButton label="Xem hải trình" onPress={() => router.dismissTo('/itinerary')} />}
      <PassengerButton label="Xem đặt chỗ và cabin" variant="secondary"
        onPress={() => router.push({ pathname: '/passenger-bookings/[bookingId]', params: { bookingId: voyage.bookingId } })} />
      {!!shipId && <>
        <PassengerButton label="Kiểm tra sơ đồ tàu đã công bố" variant="secondary" onPress={() => { if (modelScope === scope) void model.refetch(); else setModelScope(scope); }} />
        {modelScope === scope && <>
          {model.isLoading && <Loading text="Đang kiểm tra thông tin sơ đồ tàu…" />}
          {model.fetchStatus === 'paused' && <Text style={ui.body}>Đang chờ kết nối để kiểm tra sơ đồ tàu.</Text>}
          {model.error instanceof ApiError && model.error.status === 404 ? <EmptyState title="Sơ đồ tàu chưa được công bố" /> : <ErrorNotice error={model.error} />}
          {!model.error && model.data && <View style={ui.card}>
            <Text style={ui.sectionTitle}>{model.data.manifest.name}</Text>
            <Text style={ui.caption}>Phiên bản công bố: {model.data.manifest.revision}</Text>
            <Text style={ui.body}>Hiện chưa có chế độ xem sơ đồ tương tác trong ứng dụng. Thông tin tầng và cabin được hiển thị bên dưới theo hồ sơ chuyến đi.</Text>
          </View>}
        </>}
      </>}
      {!!shipId && context.can('DECK_READ') && <>
        <Text accessibilityRole="header" style={ui.sectionTitle}>Các tầng trên tàu</Text>
        <ErrorNotice error={decks.error} retry={() => { void decks.refetch(); }} />
        {decks.isLoading && <Loading text="Đang tải thông tin tầng…" />}
        {decks.fetchStatus === 'paused' && <Text style={ui.body}>Đang chờ kết nối để tải thông tin tầng.</Text>}
        {decks.data?.filter(deck => deck.shipId === shipId).sort((a, b) => a.deckNumber - b.deckNumber).map(deck =>
          <View key={deck.deckId} style={ui.card}>
            <Text style={ui.eyebrow}>Tầng {deck.deckNumber}</Text>
            {!!deck.deckName && <Text style={ui.body}>{deck.deckName}</Text>}
          </View>)}
        {decks.isSuccess && !decks.data?.some(deck => deck.shipId === shipId) && <Text style={ui.body}>Thông tin tầng đang được cập nhật.</Text>}
      </>}
    </> : catalog.isSuccess && <EmptyState title={catalog.voyages.length ? 'Hãy chọn chuyến đi để xem chi tiết' : 'Chưa có chuyến đi đã xác nhận'}
      action={catalog.voyages.length ? 'Về trang chủ' : 'Chuyến đi của tôi'}
      onPress={() => router.dismissTo(catalog.voyages.length ? '/home' : '/passenger-bookings')} />}
  </LivePage>;
}
