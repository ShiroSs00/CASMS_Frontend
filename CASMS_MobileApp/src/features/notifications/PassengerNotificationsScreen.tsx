import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { PassengerListItem } from '@/components/passenger/PassengerListItem';
import { PassengerSheet, FilterChips, EmptyState, ui } from '@/components/passenger/PassengerUI';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { useAuth } from '@/features/auth/session-store';
import { useLiveItinerary } from '@/features/itinerary/itinerary-api';
import { getChanges } from '@/features/itinerary/itinerary-model';
import { formatTime } from '@/features/itinerary/api-format';
import { Notice } from '@/features/itinerary/ItineraryUI';
import { brand } from '@/constants/ocevie';

type Notification = { id: string; title: string; date: string; description: string };
const filters = [{ key: 'all', label: 'Tất cả' }, { key: 'journey', label: 'Hải trình' }, { key: 'services', label: 'Dịch vụ' }] as const;
export function PassengerNotificationsScreen() {
  const mode = useAuth(state => state.mode); const { catalog, detail } = useLiveItinerary();
  const [filter, setFilter] = useState<'all' | 'journey' | 'services'>('all');
  const [selected, setSelected] = useState<Notification | null>(null);
  const demo = mode === 'demo';
  const items: Notification[] = demo ? getChanges('normal').map((item, index) => ({ id: String(index), title: item.title, date: item.published, description: `${item.description} Áp dụng: ${item.applies}.` }))
    : (detail.data?.history.items ?? []).map(item => ({ id: item.changeHistoryId, title: item.changeSummary ?? item.changeType, date: formatTime(item.changedAt, 'Asia/Ho_Chi_Minh', true), description: item.reason ?? 'Vui lòng xem hải trình và trao đổi với đội ngũ trên tàu nếu bạn cần thêm thông tin.' }));
  const shown = filter === 'services' ? [] : items;
  const error = catalog.error?.message ?? detail.error?.message ?? detail.data?.history.error;
  const loading = !demo && (catalog.isPending || (!!catalog.itinerary && detail.isPending));
  return <PassengerScaffold detail title="Thông báo">
    <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={!demo && (catalog.isRefetching || detail.isRefetching)} onRefresh={() => { if (!demo) { void catalog.refetch(); if (catalog.itinerary) void detail.refetch(); } }} tintColor={brand.teal} />}>
      <View style={{ gap: 8 }}><Text style={ui.eyebrow}>THÔNG TIN TRONG CHUYẾN ĐI</Text><Text accessibilityRole="header" style={ui.title}>Luôn theo kịp hành trình.</Text><Text style={ui.body}>Các cập nhật đã công bố và thông tin cần lưu ý.</Text></View>
      <FilterChips items={filters} selected={filter} onSelect={setFilter} />
      {demo && <Notice text="Thông báo bên dưới là dữ liệu minh họa." />}
      {!demo && error && <><Notice tone="error" text={error} /><PassengerButton label="Tải lại thông báo" onPress={() => { void catalog.refetch(); if (catalog.itinerary) void detail.refetch(); }} /></>}
      {loading ? <Notice text="Đang tải cập nhật chuyến đi…" /> : shown.length ? <View style={{ gap: 12 }}>
        <Text style={ui.caption}>{shown.length} cập nhật hải trình · Giờ Việt Nam (UTC+7)</Text>
        {shown.map(item => <PassengerListItem key={item.id} title={item.title} supporting={item.date} icon="notifications" onPress={() => setSelected(item)} />)}
      </View> : !error && <EmptyState icon="notifications" title={filter === 'services' ? 'Chưa có thông báo dịch vụ' : 'Chưa có cập nhật mới'} description="Các thông tin được công bố sẽ xuất hiện tại đây. Bạn có thể kéo xuống để kiểm tra lại." />}
    </ScrollView>
    <PassengerSheet visible={!!selected} title="Cập nhật hải trình" onClose={() => setSelected(null)}>
      <Text style={ui.caption}>{selected?.date}</Text><Text style={ui.sectionTitle}>{selected?.title}</Text><Text style={ui.body}>{selected?.description}</Text>
      <PassengerButton label="Đã hiểu" onPress={() => setSelected(null)} />
    </PassengerSheet>
  </PassengerScaffold>;
}
