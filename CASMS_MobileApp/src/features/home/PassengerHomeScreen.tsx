import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MaterialIcon } from '@/components/passenger/MaterialIcon';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerListItem } from '@/components/passenger/PassengerListItem';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';

import { demoCruise as cruise, type HomeStatus } from './home-model';

export function PassengerHomeScreen({ initialStatus = 'default' }: { initialStatus?: HomeStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const restricted = status === 'expired' || status === 'empty' || status === 'error' || status === 'loading';

  return (
    <PassengerScaffold selected="home" locked={restricted}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        {status === 'loading' ? <LoadingSkeleton />
          : restricted ? <HomeFallback status={status} onRetry={() => {
            setStatus('default');
            router.setParams({ state: 'default' });
          }} />
            : <>
              <View style={styles.greeting}>
                <Text style={styles.demo}>DỮ LIỆU MINH HỌA</Text>
                <Text style={styles.title} accessibilityRole="header">Chào {cruise.passengerName}</Text>
                <Text style={styles.description}>Hành trình của bạn đã sẵn sàng.</Text>
              </View>

              {status === 'offline' && <Notice text={`Đang ngoại tuyến · Bản lưu minh họa\nCập nhật lần cuối: ${cruise.lastUpdated}`} icon="wifi_off" />}
              {status === 'success' && <Notice text="Đã hoàn tất check-in. Chúc bạn một hành trình tuyệt vời!" icon="check_circle" />}

              <View style={styles.cruiseCard}>
                <View style={styles.cruiseTitle}>
                  <MaterialIcon name="sailing" color={colors.primary} />
                  <Text style={styles.ship}>{cruise.ship}</Text>
                </View>
                <Text style={styles.cruiseText}>{cruise.location} · {cruise.dates}</Text>
                <Text style={styles.cruiseText}>Cabin {cruise.cabin} · {cruise.package}</Text>
              </View>

              <View style={styles.qr}>
                <PassengerButton label="Mở thẻ QR của tôi" icon="qr_code_2" disabled={status === 'disabled'}
                  onPress={() => router.navigate('/passenger-qr')} />
                {status === 'disabled' && <Text style={styles.explanation}>Thẻ QR chưa khả dụng. Vui lòng liên hệ CASMS để được hỗ trợ.</Text>}
              </View>

              <PassengerListItem title={status === 'success' ? 'Check-in đã hoàn tất' : 'Hoàn tất check-in'}
                supporting={status === 'success' ? 'Hồ sơ hành khách đã được bổ sung' : 'Còn 1 bước: bổ sung hồ sơ hành khách'}
                icon={status === 'success' ? 'check_circle' : 'assignment_ind'} disabled={status === 'success'}
                onPress={() => router.push('/check-in')} />

              <View style={styles.section}>
                <Text style={styles.sectionTitle} accessibilityRole="header">Lịch hôm nay</Text>
                <PassengerListItem title={cruise.event} supporting={cruise.eventLocation}
                  icon="restaurant" onPress={() => router.navigate('/itinerary')} />
              </View>

              <View style={styles.connected}>
                <PassengerListItem title="Khám phá dịch vụ" supporting="Ẩm thực, spa và trải nghiệm trên tàu"
                  icon="spa" connected="first" onPress={() => router.navigate('/services')} />
                <PassengerListItem title={`Chi tiêu hiện tại · ${cruise.spending}`} supporting="Xem các giao dịch trong chuyến đi"
                  icon="account_balance_wallet" connected="last" onPress={() => router.navigate('/spending')} />
              </View>
            </>}
      </ScrollView>
    </PassengerScaffold>
  );
}

function Notice({ text, icon }: { text: string; icon: 'wifi_off' | 'check_circle' }) {
  return <View style={styles.notice}>
    <MaterialIcon name={icon} color={colors.onSecondaryContainer} size={20} />
    <Text accessibilityLiveRegion="polite" style={styles.noticeText}>{text}</Text>
  </View>;
}

function HomeFallback({ status, onRetry }: { status: HomeStatus; onRetry: () => void }) {
  const expired = status === 'expired';
  const empty = status === 'empty';
  return <View style={styles.fallback}>
    <View style={styles.fallbackIcon}>
      <MaterialIcon name={expired ? 'lock' : empty ? 'sailing' : 'error'} color={colors.primary} size={40} />
    </View>
    <Text style={styles.title} accessibilityRole="header">{expired ? 'Phiên đăng nhập đã hết hạn' : empty ? 'Chưa có chuyến đi' : 'Chưa thể tải hành trình'}</Text>
    <Text style={[styles.description, styles.center]}>{expired ? 'Đăng nhập lại để tiếp tục hành trình của bạn.'
      : empty ? 'Bạn chưa được gán chuyến đi. Liên hệ CASMS để được hỗ trợ.'
        : 'Đã xảy ra lỗi khi tải thông tin. Vui lòng thử lại.'}</Text>
    <PassengerButton label={expired ? 'Đăng nhập lại' : empty ? 'Liên hệ CASMS' : 'Thử lại'}
      icon={expired ? 'arrow_forward' : empty ? 'support_agent' : undefined}
      onPress={() => {
        if (expired) router.replace({ pathname: '/login', params: { state: 'expired' } });
        else if (empty) router.push('/support');
        else onRetry();
      }} />
  </View>;
}

function LoadingSkeleton() {
  return <View style={styles.skeletonGroup} accessible accessibilityLabel="Đang tải hành trình" accessibilityState={{ busy: true }}>
    <View style={[styles.skeleton, styles.skeletonTitle]} />
    <View style={[styles.skeleton, styles.skeletonSubtitle]} />
    <View style={[styles.skeleton, { height: 120 }]} />
    <View style={[styles.skeleton, { height: 56, borderRadius: 28 }]} />
    {[0, 1, 2, 3].map(item => <View key={item} style={[styles.skeleton, { height: 80 }]} />)}
  </View>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 16, gap: 16, width: '100%', maxWidth: 520, alignSelf: 'center' },
  greeting: { gap: 6 },
  demo: { fontSize: 10, lineHeight: 14, letterSpacing: 1.5, fontWeight: '600', color: colors.onSurfaceVariant },
  title: { fontSize: 28, lineHeight: 38, fontWeight: '700', color: colors.onSurface },
  description: { fontSize: 16, lineHeight: 24, color: colors.onSurfaceVariant },
  cruiseCard: { minHeight: 120, borderRadius: 20, padding: 20, gap: 4, justifyContent: 'center', backgroundColor: colors.surfaceContainerHighest },
  cruiseTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  ship: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: colors.onSurface, flexShrink: 1 },
  cruiseText: { fontSize: 14, lineHeight: 20, color: colors.onSecondaryContainer },
  qr: { gap: 8 },
  explanation: { fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant, paddingHorizontal: 12 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: colors.onSurface },
  connected: { gap: 3 },
  notice: { padding: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.secondaryContainer },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.onSecondaryContainer },
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, paddingVertical: 40 },
  fallbackIcon: { width: 88, height: 88, borderRadius: 28, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  skeletonGroup: { gap: 16 },
  skeleton: { borderRadius: 20, backgroundColor: colors.surfaceContainerHigh },
  skeletonTitle: { width: '70%', height: 36 },
  skeletonSubtitle: { width: '90%', height: 20 },
});
