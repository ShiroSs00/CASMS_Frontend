import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerListItem } from '@/components/passenger/PassengerListItem';
import { PassengerSheet, SectionHeading, EmptyState } from '@/components/passenger/PassengerUI';
import { useAuth } from '@/features/auth/session-store';
import { InfoRow, Notice } from '@/features/itinerary/ItineraryUI';
import { selectItinerary, useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { formatDay, statusLabel } from '@/features/itinerary/api-format';
import { brand } from '@/constants/ocevie';
import { VoyageSummaryCard, homeStyles } from './VoyageHomeParts';

export function PassengerLiveHomeScreen() {
  const auth = useAuth(); const catalog = useSelectedItinerary();
  const [showChoices, setShowChoices] = useState(false);
  return <PassengerScaffold selected="home">
    <ScrollView contentContainerStyle={homeStyles.content} refreshControl={<RefreshControl refreshing={catalog.isRefetching} onRefresh={() => { void catalog.refetch(); }} tintColor={brand.teal} />}>
      <View style={homeStyles.greeting}><Text accessibilityRole="header" style={homeStyles.title}>Chào {auth.session?.user.username ?? 'bạn'}.</Text></View>
      {catalog.isPending && <Notice text="Đang tìm thông tin chuyến đi…" />}
      {catalog.error && <><Notice tone="error" text={`${catalog.error.message}${catalog.data ? ' Bạn đang xem dữ liệu đã tải trước đó.' : ''}`} /><PassengerButton label="Thử lại" onPress={() => { void catalog.refetch(); }} /></>}
      {catalog.cruiseError && <Notice tone="error" text={catalog.cruiseError.message} />}
      {catalog.itinerary && <>
        <VoyageSummaryCard title={catalog.itinerary.itineraryName} ship={catalog.cruise?.shipName ?? catalog.cruise?.cruiseName ?? 'Thông tin tàu đang cập nhật'} dates={`${formatDay(catalog.itinerary.startDate)} – ${formatDay(catalog.itinerary.endDate)}`} label={`HẢI TRÌNH ĐANG XEM · ${statusLabel(catalog.itinerary.status)}`} onPress={() => router.push('/cruise')} />
        {(catalog.data?.itineraries.length ?? 0) > 1 && <PassengerButton label="Chọn hải trình khác" variant="text" onPress={() => setShowChoices(true)} />}
        <PassengerListItem title="Hải trình" supporting="Cảng ghé, tour tham quan và giờ tàu" icon="sailing" onPress={() => router.navigate('/itinerary')} />
        <PassengerListItem title="Cập nhật chuyến đi" supporting="Các thay đổi hải trình đã được công bố" icon="notifications" onPress={() => router.push('/notifications')} />
      </>}
      {catalog.isSuccess && !catalog.itinerary && <EmptyState title="Chưa có chuyến đi để hiển thị" description="Thông tin hành trình sẽ xuất hiện khi được cung cấp cho tài khoản của bạn." action="Tìm hỗ trợ" onPress={() => router.push('/support')} />}
      <View style={{ gap: 12 }}><SectionHeading title="Hành trình của bạn" />
        <PassengerListItem title="Đặt chỗ của tôi" supporting="Phòng, người đồng hành và thông tin đặt chỗ" icon="sailing" onPress={() => router.push('/passenger-bookings')} />
        <PassengerListItem title="Hoạt động và tour đã đăng ký" supporting="Khám phá và quản lý trải nghiệm của bạn" icon="explore" onPress={() => router.push('/passenger-activities')} />
      </View>
      <PassengerListItem title="Dịch vụ trên tàu" supporting="Xem dịch vụ và quản lý yêu cầu" icon="room_service" onPress={() => router.navigate('/services')} />
      <PassengerListItem title="Cần hỗ trợ trong chuyến đi?" supporting="Hướng dẫn sử dụng & an toàn trên tàu" icon="support_agent" onPress={() => router.push('/support')} />
    </ScrollView>
    <PassengerSheet visible={showChoices} title="Chọn hải trình" onClose={() => setShowChoices(false)}>
      {catalog.data?.itineraries.map(item => <InfoRow key={item.itineraryId} title={item.itineraryName} subtitle={`${formatDay(item.startDate)} – ${formatDay(item.endDate)} · ${statusLabel(item.status)}`} icon={catalog.itinerary?.itineraryId === item.itineraryId ? 'check_circle' : 'sailing'} onPress={() => { if (catalog.userId) selectItinerary(catalog.userId, item.itineraryId); setShowChoices(false); }} />)}
    </PassengerSheet>
  </PassengerScaffold>;
}
