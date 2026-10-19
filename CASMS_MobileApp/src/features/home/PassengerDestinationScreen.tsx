import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerListItem } from '@/components/passenger/PassengerListItem';
import { BoardingPassPending } from '@/components/passenger/BoardingPassPending';
import { EmptyState, SectionHeading, ui } from '@/components/passenger/PassengerUI';
import { useAuth } from '@/features/auth/session-store';
import { useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { formatDay, statusLabel } from '@/features/itinerary/api-format';
import { Notice, Facts } from '@/features/itinerary/ItineraryUI';
import { demoCruise as cruise } from './home-model';
import { PassengerServicesScreen } from '@/features/services/PassengerServicesScreen';
import { PassengerNotificationsScreen } from '@/features/notifications/PassengerNotificationsScreen';
import { PassengerItineraryScreen } from '@/features/itinerary/PassengerItineraryScreen';

export function PassengerDestinationScreen({ view }: { view: 'qr' | 'services' | 'spending' | 'checkIn' | 'cruise' | 'notifications' | 'itinerary' }) {
  switch (view) {
    case 'qr': return <BoardingScreen />;
    case 'services': return <PassengerServicesScreen />;
    case 'notifications': return <PassengerNotificationsScreen />;
    case 'itinerary': return <PassengerItineraryScreen />;
    case 'spending': return <SpendingScreen />;
    case 'checkIn': return <CheckInScreen />;
    case 'cruise': return <VoyageScreen />;
  }
}
function BoardingScreen() {
  const demo = useAuth(state => state.mode === 'demo');
  return <PassengerScaffold selected="qr"><ScrollView contentContainerStyle={ui.content}>
    <View style={{ gap: 8 }}><Text style={ui.eyebrow}>MỘT CHẠM, SẴN SÀNG KHỞI HÀNH</Text><Text style={ui.body}>Thẻ hành khách của bạn, ngay trong tầm tay.</Text></View>
    <BoardingPassPending />
    <View style={{ gap: 12 }}><SectionHeading title="Trước khi lên tàu" />
      <PassengerListItem title="1. Kiểm tra thông tin" supporting="Họ tên và giấy tờ phải khớp với đặt chỗ" icon="assignment_ind" onPress={() => router.push('/check-in')} />
      <PassengerListItem title="2. Chờ cấp thẻ lên tàu" supporting="Mã QR xuất hiện sau khi hồ sơ được xác nhận" icon="qr_code_2" />
    </View>
    <PassengerButton label="Hỗ trợ thẻ hành khách" variant="secondary" icon="support_agent" onPress={() => router.push('/support')} />
    {demo && <Text style={ui.caption}>Bản trải nghiệm chưa có mã QR được cấp.</Text>}
  </ScrollView></PassengerScaffold>;
}
function CheckInScreen() {
  return <PassengerScaffold detail title="Check-in"><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.eyebrow}>CHUẨN BỊ TRƯỚC CHUYẾN ĐI</Text><Text accessibilityRole="header" style={ui.title}>Sẵn sàng lên tàu.</Text>
    <View style={ui.card}><Text style={ui.sectionTitle}>Thông tin bạn cần chuẩn bị</Text><Text style={ui.body}>• Giấy tờ tùy thân sử dụng khi đặt chuyến đi.</Text><Text style={ui.body}>• Thông tin xác nhận đặt chỗ.</Text><Text style={ui.body}>• Thông tin hành khách đi cùng, nếu có.</Text></View>
    <Notice text="Check-in trực tuyến chưa được mở trong ứng dụng. Vui lòng hoàn tất với đội ngũ OceVie tại quầy." />
    <PassengerButton label="Xem hướng dẫn hỗ trợ" variant="secondary" onPress={() => router.push('/support')} />
  </ScrollView></PassengerScaffold>;
}
function SpendingScreen() {
  const demo = useAuth(state => state.mode === 'demo');
  return <PassengerScaffold detail title="Chi tiêu trên tàu" selected="account"><ScrollView contentContainerStyle={ui.content}>
    <View style={ui.card}><Text style={ui.eyebrow}>{demo ? 'TỔNG CHI TIÊU MINH HỌA' : 'TỔNG CHI TIÊU'}</Text><Text accessibilityRole="header" style={ui.title}>{demo ? cruise.spending : 'Chưa có dữ liệu'}</Text><Text style={ui.caption}>{demo ? 'Số liệu mẫu, không phải khoản cần thanh toán.' : 'Tài khoản chi tiêu chưa được kết nối với ứng dụng.'}</Text></View>
    <SectionHeading title="Lịch sử giao dịch" /><EmptyState icon="account_balance_wallet" title="Chưa có giao dịch chi tiết" description="Các giao dịch sẽ hiển thị khi được đồng bộ. Liên hệ quầy dịch vụ để kiểm tra chi tiêu thực tế." />
    <PassengerButton label="Hỗ trợ về chi tiêu" variant="secondary" onPress={() => router.push('/support')} />
  </ScrollView></PassengerScaffold>;
}
function VoyageScreen() {
  const demo = useAuth(state => state.mode === 'demo'); const catalog = useSelectedItinerary();
  return <PassengerScaffold detail title="Thông tin chuyến đi"><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.eyebrow}>{demo ? 'CHUYẾN ĐI MINH HỌA' : 'HẢI TRÌNH ĐANG XEM'}</Text>
    <Text accessibilityRole="header" style={ui.title}>{demo ? cruise.ship : catalog.cruise?.shipName ?? catalog.cruise?.cruiseName ?? 'Thông tin chuyến đi'}</Text>
    {!demo && catalog.isPending && <Notice text="Đang tải thông tin chuyến đi…" />}
    {!demo && catalog.error && <><Notice tone="error" text={catalog.error.message} /><PassengerButton label="Thử lại" onPress={() => { void catalog.refetch(); }} /></>}
    {!demo && catalog.cruiseError && <Notice tone="error" text={catalog.cruiseError.message} />}
    {demo ? <><Text style={ui.body}>Hạ Long — Lan Hạ — Cát Bà</Text><Facts items={[["Thời gian", cruise.dates], ['Hạng phòng', cruise.package], ['Cabin', cruise.cabin], ['Hành khách', cruise.passengerName]]} /></>
      : catalog.itinerary ? <><Text style={ui.body}>{catalog.itinerary.itineraryName}</Text><Facts items={[["Khởi hành", formatDay(catalog.itinerary.startDate)], ['Kết thúc', formatDay(catalog.itinerary.endDate)], ['Trạng thái', statusLabel(catalog.itinerary.status)]]} /><Notice text="Đây là hải trình đang xem. Cabin và đặt chỗ cá nhân chưa được xác nhận cho tài khoản này." /></>
        : !catalog.isPending && !catalog.error && <EmptyState title="Chưa có thông tin chuyến đi" description="Thông tin sẽ xuất hiện khi chuyến đi được cung cấp cho tài khoản." />}
    {(demo || catalog.itinerary) && <PassengerButton label="Xem lịch trình chi tiết" icon="arrow_forward" onPress={() => router.dismissTo('/itinerary')} />}
    <PassengerListItem title="Cần điều chỉnh thông tin?" supporting="Liên hệ đội ngũ hỗ trợ hành khách" icon="support_agent" onPress={() => router.push('/support')} />
  </ScrollView></PassengerScaffold>;
}
