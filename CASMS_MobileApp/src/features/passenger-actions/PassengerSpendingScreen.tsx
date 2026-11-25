import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState, ui } from '@/components/passenger/PassengerUI';
import { useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { ApiError } from '@/lib/api';
import { LivePage, Loading } from './PassengerActionUI';
import { spendingCopy, spendingFoundationState } from './spending-foundation';

export function PassengerSpendingScreen() {
  const trip = useSelectedItinerary();
  const state = spendingFoundationState({ allowed: trip.context.can('BOOKING_READ'),
    pending: trip.isPending || trip.isFetching, paused: trip.fetchStatus === 'paused',
    error: !!trip.error, errorStatus: trip.error instanceof ApiError ? trip.error.status : undefined,
    cruiseStatus: trip.voyage?.cruiseStatus });
  const copy = spendingCopy[state];
  const confirmedContext = ['unavailable','ended'].includes(state) ? trip.voyage : undefined;
  return <LivePage title="Chi tiêu trên tàu" permission="BOOKING_READ"
    onRefresh={() => { void trip.refetch(); }} refreshing={trip.isRefetching}>
    {confirmedContext && <View style={ui.card}>
      <Text accessibilityRole="header" style={ui.sectionTitle}>Chuyến đi của bạn</Text>
      <Text style={ui.body}>{confirmedContext.cruiseName}</Text>
      <Text style={ui.caption}>Sao kê được kiểm tra theo hồ sơ hành khách trong chuyến đã chọn.</Text>
    </View>}
    {state === 'loading' ? <Loading text={copy.title} /> : <EmptyState title={copy.title} description={copy.description} />}
    {['error','offline'].includes(state) && <PassengerButton label="Tải lại chuyến đi" variant="secondary" onPress={() => { void trip.refetch(); }} />}
    <Text style={ui.body}>Hạn mức chi tiêu không phải số tiền cần thanh toán. Quyền lợi gói và số lượt dịch vụ được xem riêng trong mục Quyền lợi gói.</Text>
    <PassengerButton label={state === 'missing-voyage' ? 'Chọn chuyến đi' : 'Xem đặt chỗ của bạn'} onPress={() => router.dismissTo('/passenger-bookings')} />
    <PassengerButton label="Quyền lợi gói" variant="secondary" onPress={() => router.push('/passenger-packages')} />
    <PassengerButton label="Trung tâm hỗ trợ" variant="text" onPress={() => router.push('/support')} />
  </LivePage>;
}
