import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MaterialIcon, type MaterialIconName } from '@/components/passenger/MaterialIcon';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerListItem } from '@/components/passenger/PassengerListItem';
import { PassengerScaffold, type PassengerTab } from '@/components/passenger/PassengerScaffold';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';

import { demoCruise as cruise } from './home-model';
import { useAuth } from '@/features/auth/session-store';
import { PassengerAccountScreen } from '@/features/auth/PassengerAccountScreen';
import { voyage } from '@/constants/voyage';
import { VoyageArt } from '@/components/passenger/VoyageArt';

const views = {
  itinerary: { title: 'Hải trình', icon: 'explore', tab: 'itinerary', text: 'Lịch trình trong chuyến đi của bạn.' },
  qr: { title: 'Thẻ QR của tôi', icon: 'qr_code_2', tab: 'qr', text: 'Thẻ QR chưa được cấp. Thẻ hành khách sẽ xuất hiện tại đây khi được Aurora xác nhận.' },
  services: { title: 'Khám phá dịch vụ', icon: 'spa', tab: 'services', text: 'Ẩm thực, spa và trải nghiệm trên tàu.' },
  spending: { title: 'Chi tiêu', icon: 'account_balance_wallet', tab: 'spending', text: 'Chi tiết giao dịch sẽ được bổ sung khi tài khoản chi tiêu được kết nối.' },
  notifications: { title: 'Thông báo', icon: 'notifications', tab: 'home', text: 'Chưa có thông báo. Các cập nhật về chuyến đi sẽ xuất hiện tại đây.' },
  checkIn: { title: 'Hoàn tất check-in', icon: 'assignment_ind', tab: 'home', text: 'Còn 1 bước: bổ sung hồ sơ hành khách. Bạn sẽ có thể bổ sung hồ sơ tại đây khi check-in được mở.' },
  cruise: { title: 'Chuyến đi của bạn', icon: 'sailing', tab: 'home', text: 'Thông tin chuyến đi hiện tại.' },
} as const satisfies Record<string, { title: string; icon: MaterialIconName; tab: PassengerTab; text: string }>;

/** Service placeholders remain explicit until the corresponding APIs are connected. */
export function PassengerDestinationScreen({ view }: { view: keyof typeof views }) {
  const mode = useAuth(state => state.mode);
  const config = views[view];
  const detail = view === 'notifications' || view === 'checkIn' || view === 'cruise';
  if (mode === 'live' && view === 'cruise') return <PassengerAccountScreen />;
  if (mode === 'live' && view === 'notifications') return <LiveHistoryRedirect />;
  if (mode === 'live') return <PassengerScaffold title={detail ? config.title : 'aurora'} selected={config.tab} detail={detail}>
    <ScrollView contentContainerStyle={styles.content}>
      {view === 'services' && <VoyageArt compact scene="services" />}
      <Text style={styles.demo}>TRẢI NGHIỆM CÙNG AURORA</Text>
      <Text style={styles.title} accessibilityRole="header">{config.title}</Text>
      <Text style={styles.description}>{view === 'qr' ? 'Thẻ hành khách chưa khả dụng. Aurora sẽ cập nhật tại đây khi thông tin thẻ được xác nhận.' : 'Thông tin đang được cập nhật. Liên hệ Aurora để được hỗ trợ trong chuyến đi.'}</Text>
      <PassengerButton label="Liên hệ Aurora" icon="support_agent" variant="text" onPress={() => router.push('/support')} />
    </ScrollView>
  </PassengerScaffold>;
  return (
    <PassengerScaffold title={detail ? config.title : 'aurora'} selected={config.tab} detail={detail}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.demo}>BẢN XEM TRƯỚC</Text>
        {view === 'services' && <VoyageArt compact scene="services" />}
        <View style={styles.hero}>
          <View style={styles.icon}>
            <MaterialIcon name={config.icon} color={colors.primary} size={40} />
          </View>
          <Text style={styles.title} accessibilityRole="header">{config.title}</Text>
          <Text style={styles.description}>{config.text}</Text>
        </View>
        {view === 'itinerary' && <PassengerListItem title={cruise.event} supporting={cruise.eventLocation} icon="restaurant" />}
        {view === 'cruise' && <View style={styles.card}>
          <Text style={styles.cardTitle}>{cruise.ship}</Text>
          <Text style={styles.description}>{cruise.location} · {cruise.dates}</Text>
          <Text style={styles.description}>Cabin {cruise.cabin} · {cruise.package}</Text>
        </View>}
        {view === 'spending' && <View style={styles.card}>
          <Text style={styles.description}>Chi tiêu minh họa hiện tại</Text>
          <Text style={styles.title}>{cruise.spending}</Text>
        </View>}
        {view === 'services' && <View style={styles.services}>
          <PassengerListItem title="Ẩm thực" supporting="Thông tin dịch vụ sẽ được bổ sung" icon="restaurant" connected="first" />
          <PassengerListItem title="Spa và trải nghiệm" supporting="Thông tin dịch vụ sẽ được bổ sung" icon="spa" connected="last" />
        </View>}
        {(view === 'qr' || view === 'checkIn') && <PassengerButton label="Liên hệ Aurora" icon="support_agent"
          onPress={() => router.push('/support')} />}
        <Text style={styles.note}>Dữ liệu và điểm đến minh họa. Các dịch vụ trong chuyến đi chưa được kết nối.</Text>
      </ScrollView>
    </PassengerScaffold>
  );
}

function LiveHistoryRedirect() {
  return <PassengerScaffold detail title="Thông báo"><View style={styles.content}><Text style={styles.description}>Xem các thay đổi đã công bố của hải trình đang chọn.</Text><PassengerButton label="Mở lịch sử hải trình" onPress={() => router.replace({ pathname: '/itinerary', params: { detail: 'history' } })} /></View></PassengerScaffold>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22, gap: 20, width: '100%', maxWidth: 520, alignSelf: 'center' },
  demo: { fontSize: 11, lineHeight: 18, letterSpacing: 1.5, color: colors.onSurfaceVariant, fontWeight: '600' },
  hero: { gap: 16, paddingVertical: 24 },
  icon: { width: 80, height: 80, borderRadius: 28, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: voyage.serif, fontSize: 36, lineHeight: 44, color: colors.onSurface },
  description: { fontSize: 16, lineHeight: 24, color: colors.onSurfaceVariant },
  card: { padding: 20, gap: 8, borderRadius: 20, backgroundColor: colors.surfaceContainerHighest },
  cardTitle: { fontFamily: voyage.serif, fontSize: 28, lineHeight: 36, color: colors.onSurface },
  services: { gap: 3 },
  note: { fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant, marginTop: 12 },
});
