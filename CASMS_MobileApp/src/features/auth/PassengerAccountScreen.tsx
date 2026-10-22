import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { PassengerListItem } from '@/components/passenger/PassengerListItem';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerSheet, SectionHeading, ui } from '@/components/passenger/PassengerUI';
import { brand, lightTheme } from '@/constants/ocevie';
import { authActions, useAuth } from './session-store';

export function PassengerAccountScreen() {
  const auth = useAuth();
  const name = auth.session?.user.username ?? 'Hành khách';
  const [sheet, setSheet] = useState<'profile' | 'logout' | null>(null);
  const [busy, setBusy] = useState(false);
  return <PassengerScaffold selected="account">
    <ScrollView contentContainerStyle={ui.content}>
      <View style={styles.identity}>
        <View style={styles.avatar}><Text style={styles.initial}>{name.trim().slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.identityText}><Text style={ui.eyebrow}>CHÀO MỪNG TRỞ LẠI</Text><Text style={styles.name}>{name}</Text>
          <Text style={ui.caption}>{auth.session?.user.email ?? 'Hành khách OceVie'}</Text></View>
      </View>
      <View style={styles.section}><SectionHeading title="Chuyến đi của bạn" />
          <PassengerListItem title="Đặt chỗ của tôi" supporting="Hành khách, phòng và chi phí của từng đơn" icon="sailing" onPress={() => router.push('/passenger-bookings')} />
          <PassengerListItem title="Hoạt động và tour của tôi" supporting="Đăng ký và quản lý lượt tham gia" icon="explore" onPress={() => router.push('/passenger-activities')} />
          <PassengerListItem title="Gói dịch vụ" supporting="Quyền lợi và gói đã chọn cho đơn nháp" icon="restaurant" onPress={() => router.push('/passenger-packages')} />
        <PassengerListItem title="Thông tin chuyến đi" supporting="Tàu, thời gian và thông tin hành trình" icon="sailing" onPress={() => router.push('/cruise')} />
      </View>
      <View style={styles.section}><SectionHeading title="Tài khoản & hỗ trợ" />
        <PassengerListItem title="Thông tin cá nhân" supporting="Xem thông tin tài khoản đang đăng nhập" icon="assignment_ind" onPress={() => setSheet('profile')} />
        <PassengerListItem title="Trung tâm hỗ trợ" supporting="Giải đáp thắc mắc trong chuyến đi" icon="support_agent" onPress={() => router.push('/support')} />
        <PassengerListItem title="An toàn trên tàu" supporting="Hướng dẫn khi cần trợ giúp khẩn cấp" icon="error" onPress={() => router.push({ pathname: '/support', params: { topic: 'safety' } })} />
      </View>
      <PassengerButton label="Đăng xuất" variant="text" onPress={() => setSheet('logout')} />
    </ScrollView>
    <PassengerSheet dismissible={!busy} visible={sheet !== null} title={sheet === 'profile' ? 'Thông tin cá nhân' : 'Kết thúc phiên?'} onClose={() => { if (!busy) setSheet(null); }}>
      {sheet === 'profile' ? <>
        <View style={ui.card}><Text style={ui.caption}>Tên hiển thị</Text><Text style={ui.sectionTitle}>{name}</Text><Text style={ui.caption}>Email</Text><Text style={ui.body}>{auth.session?.user.email ?? 'Chưa có thông tin email'}</Text></View>
        <Text style={ui.body}>Cần điều chỉnh thông tin? Vui lòng liên hệ đội ngũ OceVie để được hỗ trợ.</Text>
        <PassengerButton label="Đến trung tâm hỗ trợ" variant="secondary" onPress={() => { setSheet(null); router.push('/support'); }} />
      </> : <><Text style={ui.body}>Bạn sẽ cần đăng nhập lại để xem thông tin chuyến đi.</Text>
        <PassengerButton label="Đăng xuất" loading={busy} onPress={() => { setBusy(true); void authActions.logout().then(() => router.replace('/login')).finally(() => setBusy(false)); }} />
        <PassengerButton label="Tiếp tục sử dụng" variant="text" disabled={busy} onPress={() => setSheet(null)} /></>}
    </PassengerSheet>
  </PassengerScaffold>;
}
const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 },
  avatar: { width: 72, height: 72, borderRadius: 24, backgroundColor: brand.navy, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 32, fontWeight: '600', color: brand.pearl },
  identityText: { flex: 1, gap: 5 }, name: { fontSize: 25, lineHeight: 34, fontWeight: '700', color: brand.navy },
  section: { gap: 10 }, version: { fontSize: 12, lineHeight: 18, letterSpacing: 1.4, color: lightTheme.textSecondary, textAlign: 'center' },
});
