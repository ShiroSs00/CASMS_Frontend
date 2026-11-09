import { router } from 'expo-router';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState } from '@/components/passenger/PassengerUI';
import { LivePage } from '@/features/passenger-actions/PassengerActionUI';

export default function SpendingRoute() {
  return <LivePage title="Chi tiêu trên tàu">
    <EmptyState title="Xem sao kê tại quầy dịch vụ"
      description="Bạn có thể nhờ quầy dịch vụ hành khách kiểm tra các khoản sử dụng trên tàu. Thanh toán tiền chuyến đi nằm trong chi tiết đặt chỗ." />
    <PassengerButton label="Xem đặt chỗ và thanh toán" onPress={() => router.dismissTo('/bookings')} />
    <PassengerButton label="Trung tâm hỗ trợ" variant="text" onPress={() => router.push('/support')} />
  </LivePage>;
}
