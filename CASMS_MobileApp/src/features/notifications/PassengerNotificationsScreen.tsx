import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { PassengerListItem } from '@/components/passenger/PassengerListItem';
import { PassengerSheet, EmptyState, ui } from '@/components/passenger/PassengerUI';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { useLiveItinerary } from '@/features/itinerary/itinerary-api';
import { deviceTimeZone, formatTime, timeZoneLabel } from '@/features/itinerary/api-format';
import { Notice } from '@/features/itinerary/ItineraryUI';
import { brand } from '@/constants/ocevie';

type Update = { id: string; title: string; date: string; description: string };
export function PassengerNotificationsScreen() {
  const { catalog, detail } = useLiveItinerary();
  const [selected, setSelected] = useState<Update | null>(null);
  const zone = deviceTimeZone();
  const items: Update[] = (detail.data?.history.items ?? []).map(item => ({ id: item.changeHistoryId, title: item.changeSummary ?? item.changeType, date: formatTime(item.changedAt, zone, true), description: item.reason ?? '' }));
  const error = catalog.error?.message ?? detail.error?.message ?? detail.data?.history.error;
  const loading = catalog.isPending || (!!catalog.itinerary && detail.isPending);
  function refresh() { void catalog.refetch(); if (catalog.itinerary) void detail.refetch(); }
  return <PassengerScaffold detail title="Cập nhật hải trình">
    <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={catalog.isRefetching || detail.isRefetching} onRefresh={refresh} tintColor={brand.teal} />}>
      {error && <><Notice tone="error" text={error} /><PassengerButton label="Thử lại" onPress={refresh} /></>}
      {loading ? <Notice text="Đang tải cập nhật…" /> : items.length ? <View style={{ gap: 12 }}>
        <Text style={ui.caption}>Giờ thiết bị · {timeZoneLabel(zone)}</Text>
        {items.map(item => <PassengerListItem key={item.id} title={item.title} supporting={item.date} icon="notifications" onPress={() => setSelected(item)} />)}
      </View> : !error && <EmptyState icon="notifications" title="Chưa có cập nhật mới" description="Các thay đổi của hải trình sẽ xuất hiện tại đây." />}
    </ScrollView>
    <PassengerSheet visible={!!selected} title="Cập nhật hải trình" onClose={() => setSelected(null)}>
      <Text style={ui.caption}>{selected?.date}</Text><Text style={ui.sectionTitle}>{selected?.title}</Text>{!!selected?.description && <Text style={ui.body}>{selected.description}</Text>}
      <PassengerButton label="Đóng" onPress={() => setSelected(null)} />
    </PassengerSheet>
  </PassengerScaffold>;
}
