import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { PassengerSheet, SearchField, FilterChips, EmptyState, ui } from '@/components/passenger/PassengerUI';
import { MaterialIcon } from '@/components/passenger/MaterialIcon';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { VoyageArt } from '@/components/passenger/VoyageArt';
import { brand, lightTheme } from '@/constants/ocevie';
import { serviceCategories, filterServiceGuides, type ServiceCategory, type ServiceGuide } from './service-model';

export function PassengerServicesScreen() {
  const [category, setCategory] = useState<ServiceCategory>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ServiceGuide | null>(null);
  const results = filterServiceGuides(category, search);
  return <PassengerScaffold selected="services">
    <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <View style={styles.intro}><Text style={ui.eyebrow}>LÀM ĐẦY NHỮNG KHOẢNH KHẮC</Text><Text accessibilityRole="header" style={ui.title}>Trải nghiệm theo cách bạn.</Text><Text style={ui.body}>Từ hương vị bản địa đến những phút giây thảnh thơi trên biển.</Text></View>
      <SearchField value={search} onChangeText={setSearch} placeholder="Tìm ẩm thực, spa, tour…" />
      <FilterChips items={serviceCategories} selected={category} onSelect={setCategory} />
      <Text style={ui.caption} accessibilityLiveRegion="polite">{results.length} gợi ý khám phá · Thông tin giới thiệu</Text>
      <View style={styles.results}>
        {results.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Tìm hiểu ${item.subtitle}`} onPress={() => setSelected(item)} style={({ pressed }) => [styles.service, pressed && styles.pressed]}>
          <View style={[styles.art, item.category === 'wellness' && styles.wellness, item.category === 'experience' && styles.experience]}>
            <MaterialIcon name={item.icon} color={brand.teal} size={36} />
            <Text style={styles.artCaption}>{item.tag}</Text>
          </View>
          <View style={styles.copy}><Text style={ui.caption}>{item.subtitle}</Text><Text style={styles.name}>{item.title}</Text><View style={styles.discover}><Text style={ui.link}>Tìm hiểu thêm</Text><MaterialIcon name="arrow_forward" color={brand.teal} size={18} /></View></View>
        </Pressable>)}
        {!results.length && <EmptyState title="Chưa tìm thấy trải nghiệm" description="Thử từ khóa khác hoặc xem lại tất cả danh mục." action="Xóa bộ lọc" onPress={() => { setSearch(''); setCategory('all'); }} />}
      </View>
      <View style={styles.concierge}><MaterialIcon name="support_agent" color={brand.teal} size={28} /><View style={{ flex: 1, gap: 4 }}><Text style={styles.name}>Để OceVie giúp bạn</Text><Text style={ui.caption}>Xác nhận lịch phục vụ và dịch vụ trên chuyến đi.</Text></View></View>
      <PassengerButton label="Đến trung tâm hỗ trợ" variant="secondary" onPress={() => router.push('/support')} />
    </ScrollView>
    <PassengerSheet visible={!!selected} title={selected?.subtitle ?? 'Trải nghiệm'} onClose={() => setSelected(null)}>
      <VoyageArt compact scene="services" />
      <Text accessibilityRole="header" style={ui.title}>{selected?.title}</Text><Text style={ui.body}>{selected?.description}</Text>
      <View style={ui.card}><Text style={ui.caption}>Giá, thời gian và chỗ trống chưa được cung cấp trong ứng dụng. Vui lòng xác nhận với nhân sự trên tàu trước khi đặt dịch vụ.</Text></View>
      <PassengerButton label={selected?.id === 'shore' ? 'Xem tour trong hải trình' : 'Tìm hỗ trợ dịch vụ'} variant="secondary" onPress={() => { const shore = selected?.id === 'shore'; setSelected(null); router.navigate(shore ? '/itinerary' : '/support'); }} />
    </PassengerSheet>
  </PassengerScaffold>;
}
const styles = StyleSheet.create({
  intro: { gap: 10 }, results: { gap: 14 },
  service: { flexDirection: 'row', backgroundColor: lightTheme.surface, borderWidth: 1, borderColor: lightTheme.divider, borderRadius: 20, overflow: 'hidden', minHeight: 148 },
  art: { width: 104, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: brand.tealSoft, padding: 12 },
  wellness: { backgroundColor: brand.goldSoft }, experience: { backgroundColor: brand.navySoft },
  artCaption: { fontSize: 12, lineHeight: 15, letterSpacing: .8, color: brand.tealDark, fontWeight: '600', textAlign: 'center' },
  copy: { flex: 1, padding: 18, justifyContent: 'center', gap: 8 }, name: { fontSize: 17, lineHeight: 25, fontWeight: '600', color: brand.navy },
  discover: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  concierge: { flexDirection: 'row', gap: 14, alignItems: 'center' }, pressed: { opacity: .75 },
});
