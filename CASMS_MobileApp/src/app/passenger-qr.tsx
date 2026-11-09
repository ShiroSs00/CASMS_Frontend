import { router, useLocalSearchParams } from 'expo-router';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState } from '@/components/passenger/PassengerUI';
import { LivePage } from '@/features/passenger-actions/PassengerActionUI';

export default function PassengerQrRoute() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  return <LivePage title="Thẻ lên tàu">
    <EmptyState icon="assignment_ind" title="Nhận thẻ lên tàu tại quầy"
      description="Ứng dụng chưa cấp thẻ lên tàu. Bạn có thể xem tình trạng check-in trước khi đến quầy dịch vụ hành khách." />
    <PassengerButton label="Xem tình trạng check-in" onPress={() => router.dismissTo({
      pathname: '/check-in', params: typeof bookingId === 'string' ? { bookingId } : {},
    })} />
    <PassengerButton label="Trung tâm hỗ trợ" variant="text" onPress={() => router.push('/support')} />
  </LivePage>;
}
