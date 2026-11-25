import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PassengerListItem } from '@/components/passenger/PassengerListItem';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerSheet, SectionHeading, ui } from '@/components/passenger/PassengerUI';
import { brand, spacing, typeScale } from '@/constants/ocevie';
import { useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { ErrorNotice, LivePage, Loading } from '@/features/passenger-actions/PassengerActionUI';
import { voyageAllowsActions } from '@/features/passenger-actions/passenger-model';
import { PassengerVoyageChooser } from '@/features/home/PassengerVoyageChooser';
import { voyageLabel } from '@/features/home/voyage-home-model';
import { authActions } from './session-store';

export function PassengerAccountScreen() {
  const catalog = useSelectedItinerary();
  const { context, voyage, person, cruise, booking } = catalog;
  const profile = context.ready ? context.me.data : undefined;
  const name = profile?.fullName ?? profile?.username ?? 'Hành khách';
  const canUseVoyage = voyageAllowsActions(cruise?.status ?? voyage?.cruiseStatus)
    && !booking.error && !catalog.error && (!booking.data || !!person);
  const [sheet, setSheet] = useState<'profile' | 'logout' | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);

  return <LivePage title="Tài khoản" detail={false} selected="account">
    <View style={styles.identity}>
      <View style={styles.avatar} accessible={false}><Text style={styles.initial}>{name.trim().slice(0, 1).toUpperCase()}</Text></View>
      <View style={styles.identityText}><Text accessibilityRole="header" style={styles.name}>{name}</Text>
        {!!profile?.email && <Text selectable style={ui.caption}>{profile.email}</Text>}</View>
    </View>
    <View style={styles.section}><SectionHeading title="Chuyến đi của bạn" />
      <ErrorNotice error={catalog.error} retry={() => { void catalog.refetch(); }} />
      <ErrorNotice error={booking.error ?? catalog.cruiseError} retry={() => {
        if (booking.error) void booking.refetch(); else void catalog.refetchCruise();
      }} />
      {catalog.fetchStatus === 'paused' && <Text style={ui.body}>Đang chờ kết nối để tải chuyến đi.</Text>}
      {context.can('BOOKING_READ') && catalog.isLoading && <Loading text="Đang tải chuyến đi…" />}
      {voyage && <PassengerListItem title={voyage.cruiseName}
        supporting={[voyageLabel[cruise?.status ?? voyage.cruiseStatus], person?.cabinNumber && `Phòng ${person.cabinNumber}`].filter(Boolean).join(' · ')}
        icon="sailing" onPress={() => router.push('/cruise')} />}
      {context.can('BOOKING_READ') && catalog.isSuccess && !catalog.voyages.length && <Text style={ui.body}>Chưa có chuyến đi khả dụng.</Text>}
      {(catalog.voyages.length > 1 || (!voyage && catalog.voyages.length === 1)) && <PassengerButton
        label={voyage ? 'Đổi chuyến đi' : 'Chọn chuyến đi'} variant="secondary" onPress={() => setChoosing(true)} />}
      {context.can('BOOKING_READ') && <PassengerListItem compact title="Chuyến đi của tôi" supporting="" icon="sailing" onPress={() => router.push('/passenger-bookings')} />}
      {canUseVoyage && voyage && (context.can('ACTIVITY_READ') || context.can('EXCURSION_READ')) && <PassengerListItem compact
        title="Hoạt động và tour của tôi" supporting="" icon="explore"
        onPress={() => router.push({ pathname: '/passenger-activities', params: { bookingId: voyage.bookingId } })} />}
      {context.can('BOOKING_READ') && <PassengerListItem compact title="Quyền lợi đã mua" supporting="" icon="restaurant" onPress={() => router.push('/passenger-packages')} />}
      {canUseVoyage && voyage && context.can('CHECKIN_READ') && <PassengerListItem title="Check-in trước chuyến"
        supporting="Xem tình trạng và hoàn tất hồ sơ" icon="assignment_ind"
        onPress={() => router.push({ pathname: '/check-in', params: { bookingId: voyage.bookingId } })} />}
      {context.can('NOTIFICATION_READ') && <PassengerListItem title="Thông báo" supporting="Tin nhắn dành cho tài khoản của bạn" icon="notifications" onPress={() => router.push('/notifications')} />}
      {voyage && <PassengerListItem compact title="Chi tiêu trên tàu" supporting="Sao kê tại quầy dịch vụ" icon="room_service" onPress={() => router.push('/spending')} />}
    </View>
    <View style={styles.section}><SectionHeading title="Tài khoản & hỗ trợ" />
      <PassengerListItem compact title="Thông tin cá nhân" supporting="" icon="assignment_ind" onPress={() => setSheet('profile')} />
      <PassengerListItem compact title="Trung tâm hỗ trợ" supporting="" icon="support_agent" onPress={() => router.push('/support')} />
      <PassengerListItem compact title="An toàn trên tàu" supporting="Hướng dẫn khẩn cấp" icon="error" onPress={() => router.push({ pathname: '/support', params: { topic: 'safety' } })} />
    </View>
    <PassengerButton label="Đăng xuất" variant="text" onPress={() => setSheet('logout')} />
    <PassengerVoyageChooser catalog={catalog} visible={choosing} onClose={() => setChoosing(false)} />
    <PassengerSheet dismissible={!busy} visible={sheet !== null}
      title={sheet === 'profile' ? 'Thông tin cá nhân' : 'Kết thúc phiên?'} onClose={() => setSheet(null)}>
      {sheet === 'profile' ? <>
        <View style={ui.card}>
          <Text style={ui.caption}>{profile?.fullName ? 'Họ tên' : 'Tên đăng nhập'}</Text>
          <Text selectable style={ui.sectionTitle}>{name}</Text>
          <Text style={ui.caption}>Email</Text><Text selectable style={ui.body}>{profile?.email ?? 'Chưa có thông tin email'}</Text>
          {!!profile?.phoneNumber && <><Text style={ui.caption}>Số điện thoại</Text><Text selectable style={ui.body}>{profile.phoneNumber}</Text></>}
        </View>
        <PassengerButton label="Trung tâm hỗ trợ" variant="secondary" onPress={() => { setSheet(null); router.push('/support'); }} />
      </> : <>
        <Text style={ui.body}>Bạn sẽ cần đăng nhập lại để xem thông tin chuyến đi.</Text>
        <PassengerButton label="Đăng xuất" loading={busy} onPress={() => { setBusy(true); void authActions.logout(); }} />
        <PassengerButton label="Tiếp tục sử dụng" variant="text" disabled={busy} onPress={() => setSheet(null)} />
      </>}
    </PassengerSheet>
  </LivePage>;
}
const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: brand.navy, alignItems: 'center', justifyContent: 'center' },
  initial: { ...typeScale.title, color: brand.pearl },
  identityText: { flex: 1, gap: spacing.xs }, name: { ...typeScale.title, color: brand.navy },
  section: { gap: spacing.md },
});
