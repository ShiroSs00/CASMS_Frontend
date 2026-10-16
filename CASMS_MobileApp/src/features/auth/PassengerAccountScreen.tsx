import { router } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { Notice, styles } from '@/features/itinerary/ItineraryUI';
import { getApiUrl } from '@/lib/api';
import { authActions, useAuth } from './session-store';

export function PassengerAccountScreen() {
  const auth = useAuth();
  return <PassengerScaffold detail title="Tài khoản Aurora">
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{auth.session?.user.username ?? 'Trải nghiệm mẫu'}</Text>
      {auth.session?.user.email && <Text style={styles.bodyText}>{auth.session.user.email}</Text>}
      <Text style={styles.bodyText}>Vai trò: {auth.session?.user.roles.join(', ') ?? 'Giao diện mẫu'}</Text>
      <Notice text="Hải trình đang xem được chọn từ các dữ liệu API cho phép đọc. Nhóm và chuyến đi cá nhân chưa được xác nhận cho tài khoản này." />
      {__DEV__ && <Text selectable style={styles.small}>API: {getApiUrl()}</Text>}
      <PassengerButton label="Đăng xuất" onPress={() => { void authActions.logout().then(() => router.replace('/login')); }} />
    </ScrollView>
  </PassengerScaffold>;
}
