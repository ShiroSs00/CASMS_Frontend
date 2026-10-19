import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { PassengerListItem } from '@/components/passenger/PassengerListItem';
import { EmptyState, ui } from '@/components/passenger/PassengerUI';
import { Notice } from '@/features/itinerary/ItineraryUI';
import { useAuth } from '@/features/auth/session-store';
import { brand, lightTheme } from '@/constants/ocevie';
import { demoCruise as cruise, type HomeStatus } from './home-model';
import { PassengerLiveHomeScreen } from './PassengerLiveHomeScreen';
import { HomeDiscovery, TodayTimeline, VoyageSummaryCard, homeStyles } from './VoyageHomeParts';

export function PassengerHomeScreen({ initialStatus = 'default' }: { initialStatus?: HomeStatus }) {
  const mode = useAuth(state => state.mode);
  return mode === 'live' ? <PassengerLiveHomeScreen /> : <PassengerHomeDemoScreen initialStatus={initialStatus} />;
}
function PassengerHomeDemoScreen({ initialStatus }: { initialStatus: HomeStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const blocked = ['expired', 'empty', 'error', 'loading'].includes(status);
  const retry = () => { setStatus('default'); router.setParams({ state: 'default' }); };
  return <PassengerScaffold selected="home">
    <ScrollView contentContainerStyle={homeStyles.content}>
      {blocked ? status === 'loading' ? <View accessibilityLabel="Đang tải hành trình" accessibilityState={{ busy: true }} style={{ gap: 16 }}>{[72, 224, 160].map(height => <View key={height} style={{ height, backgroundColor: lightTheme.surfaceHover, borderRadius: 20 }} />)}</View>
        : <EmptyState icon={status === 'expired' ? 'lock' : status === 'empty' ? 'sailing' : 'error'}
          title={status === 'expired' ? 'Đăng nhập để tiếp tục' : status === 'empty' ? 'Chuyến đi đang chờ bạn' : 'Chưa thể tải chuyến đi'}
          description={status === 'expired' ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : status === 'empty' ? 'Chưa có chuyến đi gắn với tài khoản. Đội ngũ OceVie có thể giúp bạn kiểm tra thông tin.' : 'Kiểm tra kết nối và thử lại để xem lịch trình mới nhất.'}
          action={status === 'expired' ? 'Đăng nhập lại' : status === 'empty' ? 'Tìm hỗ trợ' : 'Thử lại'}
          onPress={() => status === 'expired' ? router.replace('/login') : status === 'empty' ? router.push('/support') : retry()} /> : <>
        <View style={homeStyles.greeting}><Text style={ui.eyebrow}>THỨ HAI, 19 THÁNG 10</Text><Text accessibilityRole="header" style={homeStyles.title}>Chào {cruise.passengerName}.</Text><Text style={ui.body}>Một ngày mới, một câu chuyện trên biển.</Text></View>
        {status === 'offline' && <Notice text={`Ngoại tuyến · Bản minh họa cập nhật ${cruise.lastUpdated}`} />}
        {status === 'success' && <Notice tone="success" text="Đã hoàn tất check-in. Chúc bạn một hành trình tuyệt vời!" />}
        <VoyageSummaryCard title="Hạ Long — Lan Hạ — Cát Bà" ship={cruise.ship} dates={cruise.dates} label="CHUYẾN ĐI MINH HỌA · NGÀY 2 / 4" cabin={cruise.cabin} onPress={() => router.push('/cruise')} />
        <PassengerListItem title={status === 'success' ? 'Hồ sơ đã hoàn tất' : 'Sẵn sàng cho chuyến đi?'} supporting={status === 'success' ? 'Thông tin check-in đã được bổ sung' : 'Kiểm tra thông tin và hoàn tất check-in'} icon={status === 'success' ? 'check_circle' : 'assignment_ind'} disabled={status === 'success'} onPress={() => router.push('/check-in')} />
        <TodayTimeline />
        <HomeDiscovery />
        <View style={styles.help}><Text style={ui.sectionTitle}>Luôn có OceVie bên bạn</Text><Text style={ui.caption}>Tìm hướng dẫn và trợ giúp trong chuyến đi.</Text><PassengerListItem title="Trung tâm hỗ trợ" supporting="Câu hỏi thường gặp & an toàn trên tàu" icon="support_agent" onPress={() => router.push('/support')} /></View>
        {status === 'disabled' && <Notice text="Thẻ lên tàu chưa khả dụng. Vui lòng liên hệ đội ngũ OceVie." />}
        <Text style={styles.preview}>BẢN TRẢI NGHIỆM · DỮ LIỆU MINH HỌA</Text>
      </>}
    </ScrollView>
  </PassengerScaffold>;
}
const styles = StyleSheet.create({
  help: { gap: 10, paddingTop: 4 }, preview: { color: brand.teal, fontSize: 12, letterSpacing: 1, lineHeight: 18, textAlign: 'center' },
});
