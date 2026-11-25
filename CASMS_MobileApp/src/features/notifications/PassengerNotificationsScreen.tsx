import { notificationDestination } from './notification-contracts';
import { syncStatusText, useNotificationSyncStatus } from './NotificationSync';
import { useSelectedItinerary, selectVoyage } from '@/features/itinerary/itinerary-api';
import { getApiUrl } from '@/lib/api';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerListItem } from '@/components/passenger/PassengerListItem';
import { PassengerSheet, EmptyState, ui } from '@/components/passenger/PassengerUI';
import { ErrorNotice, LivePage, Loading } from '@/features/passenger-actions/PassengerActionUI';
import { passengerApi, passengerKey, usePassengerAction, usePassengerQuery } from '@/features/passenger-actions/passenger-hooks';
import { dateTime } from '@/features/passenger-actions/passenger-model';
import type { PassengerNotification } from '@/features/passenger-actions/passenger-api';
import { useAuth } from '@/features/auth/session-store';

export function PassengerNotificationsScreen({ embedded = false }: { embedded?: boolean }) {
  const inbox = usePassengerQuery(['notifications'], passengerApi.notifications, 'NOTIFICATION_READ');
  const trip = useSelectedItinerary();
  const unread = usePassengerQuery(['notification-unread'], passengerApi.notificationUnread, 'NOTIFICATION_READ');
  const syncStatus = useNotificationSyncStatus();
  const allRead = usePassengerAction<number>();
  const read = usePassengerAction<PassengerNotification>();
  const cache = useQueryClient();
  const lock = useRef(false);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = !inbox.error ? inbox.data?.find(item => item.notificationId === selectedId) : undefined;
  async function markRead(notificationId: string) {
    if (lock.current) return;
    lock.current = true;
    const original = useAuth.getState().session, backend = getApiUrl();
    try {
      const { result, owner } = await read.mutateAsync(() => passengerApi.markNotificationRead(notificationId));
      const current = useAuth.getState().session;
      if (getApiUrl() === backend && current && current.user.id === owner && current.signedInAt === original?.signedInAt) {
        cache.setQueryData<PassengerNotification[]>(passengerKey(owner, current.signedInAt, 'notifications'), items =>
          items?.map(item => item.notificationId === result.notificationId ? { ...item, readAt: result.readAt } : item));
      }
    }
    catch { /* Keep the message open and show the mutation error. */ }
    finally { lock.current = false; }
  }
  const destination = selected ? notificationDestination(selected, trip.voyages, trip.voyage?.bookingPassengerId) : undefined;
  const refresh = () => { void inbox.refetch(); void unread.refetch(); };
  async function markAllRead() {
    if (lock.current) return; lock.current = true;
    try { await allRead.mutateAsync(() => passengerApi.markAllNotificationsRead()); }
    catch { /* GET reconciliation remains available; never auto retry PATCH. */ }
    finally { lock.current = false; }
  }
  return <LivePage title="Thông báo" permission="NOTIFICATION_READ" detail={!embedded} selected="notifications" scroll={false}>
    <FlatList data={!inbox.error ? inbox.data ?? [] : []} keyExtractor={item => item.notificationId}
      style={{ flex: 1 }} contentContainerStyle={ui.content} contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled" initialNumToRender={12} onRefresh={refresh} refreshing={inbox.isRefetching || unread.isRefetching}
      ListHeaderComponent={<View style={{ gap: 16 }}>
    <Text accessibilityLiveRegion="polite" style={ui.caption}>{syncStatusText[syncStatus]}</Text>
    {typeof unread.data === 'number' && !unread.error && <Text style={ui.sectionTitle}>Chưa đọc: {unread.data}</Text>}
    <ErrorNotice error={unread.error} retry={refresh} />
    <ErrorNotice error={allRead.error} retry={refresh} />
    <PassengerButton label="Đánh dấu tất cả đã đọc" variant="secondary" disabled={!unread.data || !!unread.error || read.isPending || unread.isFetching}
      loading={allRead.isPending} onPress={() => { void markAllRead(); }} />
    {inbox.fetchStatus === 'paused' && <EmptyState title="Đang chờ kết nối" description="Kết nối mạng rồi kéo xuống để tải lại thông báo." />}
    <ErrorNotice error={inbox.error} retry={() => { void inbox.refetch(); }} />
    {inbox.isPending && inbox.fetchStatus !== 'paused' ? <Loading text="Đang tải thông báo…" /> : inbox.isSuccess && !inbox.error && !inbox.data?.length &&
      <EmptyState icon="notifications" title="Chưa có thông báo" />}
    </View>}
    renderItem={({ item }) => <PassengerListItem compact title={item.title}
      supporting={`${item.readAt ? 'Đã đọc' : 'Chưa đọc'} · ${dateTime(item.createdAt)}`} icon="notifications"
      disabled={read.isPending || allRead.isPending} onPress={() => {
        if (lock.current) return;
        read.reset();
        setSelectedId(item.notificationId);
        if (!item.readAt) void markRead(item.notificationId);
      }} />}
    />
    <PassengerSheet visible={!!selected} title="Chi tiết thông báo" onClose={() => setSelectedId(undefined)}>
      <View style={{ gap: 8 }}>
        <Text style={ui.caption}>{dateTime(selected?.createdAt)}</Text>
        <Text accessibilityRole="header" style={ui.sectionTitle}>{selected?.title}</Text>
        <Text selectable style={ui.body}>{selected?.content}</Text>
        <ErrorNotice error={read.error} />
        {selected && !selected.readAt && <PassengerButton label="Đánh dấu đã đọc" loading={read.isPending}
          onPress={() => { void markRead(selected.notificationId); }} />}
        {selected?.notificationType === 'CRUISE_SCHEDULE_CHANGE' && <Text style={ui.caption}>Đánh dấu đã đọc không thay thế xác nhận điều chỉnh chuyến đi với quầy dịch vụ.</Text>}
        {destination?.kind !== 'unavailable' && destination && trip.context.ready && !trip.error && !trip.isFetching
          && (trip.context.can('ITINERARY_READ') || trip.context.can('CRUISE_READ')) &&
          <PassengerButton label={destination.kind === 'switch' ? 'Chuyển sang chuyến liên quan và xem lịch' : 'Xem lịch trình liên quan'}
            variant="secondary" onPress={() => {
              if (destination.kind === 'switch' && !selectVoyage(trip.userId!, destination.voyage.bookingId, destination.voyage.bookingPassengerId)) return;
              setSelectedId(undefined); router.dismissTo('/itinerary');
            }} />}
        {destination?.kind === 'unavailable' && <Text style={ui.body}>Thông báo chưa có liên kết hồ sơ đủ để mở chi tiết. Chọn đúng chuyến trong Đặt chỗ hoặc liên hệ quầy dịch vụ.</Text>}
        <PassengerButton label="Trung tâm hỗ trợ" variant="text" onPress={() => { setSelectedId(undefined); router.push('/support'); }} />
      </View>
    </PassengerSheet>
  </LivePage>;
}
