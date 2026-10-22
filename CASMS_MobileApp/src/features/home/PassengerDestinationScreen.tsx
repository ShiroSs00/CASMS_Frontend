import { Redirect, router } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState, ui } from '@/components/passenger/PassengerUI';
import { useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { formatDay, statusLabel } from '@/features/itinerary/api-format';
import { Notice, Facts } from '@/features/itinerary/ItineraryUI';
import { PassengerServicesScreen } from '@/features/services/PassengerServicesScreen';
import { PassengerNotificationsScreen } from '@/features/notifications/PassengerNotificationsScreen';
import { PassengerItineraryScreen } from '@/features/itinerary/PassengerItineraryScreen';

export function PassengerDestinationScreen({ view }: { view: 'qr' | 'services' | 'spending' | 'checkIn' | 'cruise' | 'notifications' | 'itinerary' }) {
  if (view === 'services') return <PassengerServicesScreen />;
  if (view === 'notifications') return <PassengerNotificationsScreen />;
  if (view === 'itinerary') return <PassengerItineraryScreen />;
  if (view !== 'cruise') return <Redirect href={view === 'qr' ? '/passenger-bookings' : '/support'} />;
  return <VoyageScreen />;
}
function VoyageScreen() {
  const catalog = useSelectedItinerary();
  return <PassengerScaffold detail title="Thông tin chuyến đi"><ScrollView contentContainerStyle={ui.content}>
    <Text accessibilityRole="header" style={ui.title}>{catalog.cruise?.shipName ?? catalog.cruise?.cruiseName ?? 'Chuyến đi'}</Text>
    {catalog.isPending && <Notice text="Đang tải chuyến đi…" />}
    {catalog.error && <><Notice tone="error" text={catalog.error.message} /><PassengerButton label="Thử lại" onPress={() => { void catalog.refetch(); }} /></>}
    {catalog.cruiseError && <Notice tone="error" text={catalog.cruiseError.message} />}
    {catalog.itinerary ? <><Text style={ui.body}>{catalog.itinerary.itineraryName}</Text><Facts items={[["Khởi hành", formatDay(catalog.itinerary.startDate)], ['Kết thúc', formatDay(catalog.itinerary.endDate)], ['Trạng thái', statusLabel(catalog.itinerary.status)]]} /><PassengerButton label="Xem hải trình" onPress={() => router.dismissTo('/itinerary')} /></>
      : !catalog.isPending && !catalog.error && <EmptyState title="Chưa có chuyến đi" description="Chọn hoặc tạo đặt chỗ để bắt đầu hành trình." action="Xem đặt chỗ" onPress={() => router.push('/passenger-bookings')} />}
  </ScrollView></PassengerScaffold>;
}
