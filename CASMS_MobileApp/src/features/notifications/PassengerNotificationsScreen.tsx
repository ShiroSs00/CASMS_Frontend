import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerListItem } from '@/components/passenger/PassengerListItem';
import { PassengerSheet, EmptyState, ui } from '@/components/passenger/PassengerUI';
import { ErrorNotice, LivePage, Loading } from '@/features/passenger-actions/PassengerActionUI';
import { passengerApi, usePassengerAction, usePassengerQuery } from '@/features/passenger-actions/passenger-hooks';
import { dateTime } from '@/features/passenger-actions/passenger-model';
import type { PassengerNotification } from '@/features/passenger-actions/passenger-api';
import { useAuth } from '@/features/auth/session-store';
import { getApiUrl } from '@/lib/api';

export function PassengerNotificationsScreen({ embedded = false }: { embedded?: boolean }) {
  const inbox = usePassengerQuery(['notifications'], passengerApi.notifications, 'NOTIFICATION_READ');
  const read = usePassengerAction<PassengerNotification>();
  const cache = useQueryClient();
  const lock = useRef(false);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = inbox.data?.find(item => item.notificationId === selectedId);
  async function markRead(notificationId: string) {
    if (lock.current) return;
    lock.current = true;
    const original = useAuth.getState().session;
    try {
      const { result, owner } = await read.mutateAsync(() => passengerApi.markNotificationRead(notificationId));
      const current = useAuth.getState().session;
      if (current && current.user.id === owner && current.signedInAt === original?.signedInAt) {
        cache.setQueryData<PassengerNotification[]>(['passenger', getApiUrl(), owner, 'notifications'], items =>
          items?.map(item => item.notificationId === result.notificationId ? { ...item, readAt: result.readAt } : item));
      }
    }
    catch { /* Keep the message open and show the mutation error. */ }
    finally { lock.current = false; }
  }
  return <LivePage title="Thông báo" permission="NOTIFICATION_READ" detail={!embedded} selected="notifications" onRefresh={() => { void inbox.refetch(); }} refreshing={inbox.isRefetching}>
    <ErrorNotice error={inbox.error} retry={() => { void inbox.refetch(); }} />
    {inbox.isPending ? <Loading text="Đang tải thông báo…" /> : !inbox.error && !inbox.data?.length &&
      <EmptyState icon="notifications" title="Chưa có thông báo" />}
    {inbox.data?.map(item => <PassengerListItem compact key={item.notificationId} title={item.title}
      supporting={`${item.readAt ? 'Đã đọc' : 'Chưa đọc'} · ${dateTime(item.createdAt)}`} icon="notifications"
      disabled={read.isPending} onPress={() => {
        if (lock.current) return;
        read.reset();
        setSelectedId(item.notificationId);
        if (!item.readAt) void markRead(item.notificationId);
      }} />)}
    <PassengerSheet visible={!!selected} title="Chi tiết thông báo" onClose={() => setSelectedId(undefined)}>
      <View style={{ gap: 8 }}>
        <Text style={ui.caption}>{dateTime(selected?.createdAt)}</Text>
        <Text accessibilityRole="header" style={ui.sectionTitle}>{selected?.title}</Text>
        <Text selectable style={ui.body}>{selected?.content}</Text>
        <ErrorNotice error={read.error} />
        {selected && !selected.readAt && <PassengerButton label="Đánh dấu đã đọc" loading={read.isPending}
          onPress={() => { void markRead(selected.notificationId); }} />}
        <PassengerButton label="Xem hải trình của tôi" variant="text" onPress={() => { setSelectedId(undefined); router.dismissTo('/itinerary'); }} />
      </View>
    </PassengerSheet>
  </LivePage>;
}
