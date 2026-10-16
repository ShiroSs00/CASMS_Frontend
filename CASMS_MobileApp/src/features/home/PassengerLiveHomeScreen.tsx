import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { useAuth } from '@/features/auth/session-store';
import { InfoRow, Notice } from '@/features/itinerary/ItineraryUI';
import { selectItinerary, useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { formatDay, statusLabel } from '@/features/itinerary/api-format';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';
import { VoyageEntrance } from '@/components/passenger/VoyageEntrance';
import { VoyageHero, homeStyles } from './VoyageHomeParts';

export function PassengerLiveHomeScreen() {
  const auth = useAuth();
  const catalog = useSelectedItinerary();
  const [showChoices, setShowChoices] = useState(false);
  return <PassengerScaffold selected="home">
    <ScrollView contentContainerStyle={homeStyles.content} refreshControl={<RefreshControl refreshing={catalog.isRefetching} onRefresh={() => { void catalog.refetch(); }} tintColor={colors.primary} />}>
      <VoyageEntrance><View style={homeStyles.greeting}>
        <Text style={homeStyles.eyebrow}>CHÀO MỪNG ĐẾN VỚI AURORA</Text>
        <Text style={homeStyles.title} accessibilityRole="header">Chào {auth.session?.user.username},{'\n'}biển đang đợi.</Text>
      </View></VoyageEntrance>
      {catalog.isPending && <Notice text="Đang tải danh sách hải trình…" />}
      {catalog.error && <><Notice text={`${catalog.error.message}${catalog.data ? ' Đang hiển thị dữ liệu đã tải trước đó.' : ''}`} /><PassengerButton label="Thử lại" onPress={() => { void catalog.refetch(); }} /></>}
      {catalog.cruiseError && <Notice text={catalog.cruiseError.message} />}
      {catalog.itinerary && <>
        <VoyageEntrance delay={70}><VoyageHero title={catalog.itinerary.itineraryName} label={`HẢI TRÌNH ĐANG XEM · ${statusLabel(catalog.itinerary.status)}`} subtitle={`${catalog.cruise?.shipName ?? catalog.cruise?.cruiseName ?? 'Chưa cập nhật tàu'}\n${formatDay(catalog.itinerary.startDate)} – ${formatDay(catalog.itinerary.endDate)}`} onPress={() => router.navigate('/itinerary')} /></VoyageEntrance>
        <PassengerButton label={showChoices ? 'Ẩn danh sách hải trình' : 'Chọn hải trình khác'} variant="text" onPress={() => setShowChoices(value => !value)} />
        {showChoices && catalog.data?.itineraries.map(item => <InfoRow key={item.itineraryId} title={item.itineraryName} subtitle={`${formatDay(item.startDate)} – ${formatDay(item.endDate)} · ${statusLabel(item.status)}`} icon="sailing" onPress={() => { selectItinerary(catalog.userId!, item.itineraryId); setShowChoices(false); }} />)}
        <View style={homeStyles.next}>
          <Text style={homeStyles.nextKicker}>MỖI ĐIỂM DỪNG, MỘT CÂU CHUYỆN</Text>
          <Text style={homeStyles.nextTitle}>Đi theo nhịp biển.</Text>
          <Text style={homeStyles.nextSubtitle}>Xem lịch từng ngày, thời gian ghé cảng và các tour tham quan trong hải trình đang chọn.</Text>
          <PassengerButton label="Xem lịch theo ngày" icon="arrow_forward" onPress={() => router.navigate('/itinerary')} />
        </View>
        <View style={homeStyles.section}><Text style={homeStyles.sectionTitle}>Chuẩn bị cho chuyến đi</Text>
          <InfoRow title="Thẻ hành khách" subtitle="Thông tin thẻ và hỗ trợ hành khách" icon="qr_code" onPress={() => router.navigate('/passenger-qr')} />
          <InfoRow title="Thay đổi hải trình" subtitle="Các cập nhật của hải trình đang xem" icon="notifications" onPress={() => router.navigate({ pathname: '/itinerary', params: { detail: 'history' } })} />
        </View>
      </>}
      {catalog.isSuccess && !catalog.itinerary && <Notice text="API chưa trả hải trình nào cho tài khoản này. Vui lòng kiểm tra dữ liệu và quyền trên backend." />}
      <InfoRow title="Tài khoản & kết nối" subtitle="Xem vai trò, địa chỉ API hoặc đăng xuất" icon="assignment_ind" onPress={() => router.push('/cruise')} />
    </ScrollView>
  </PassengerScaffold>;
}
