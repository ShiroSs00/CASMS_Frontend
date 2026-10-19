import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcon } from '@/components/passenger/MaterialIcon';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { SectionHeading, ui } from '@/components/passenger/PassengerUI';
import { brand, darkTheme, lightTheme } from '@/constants/ocevie';

export function VoyageSummaryCard({ title, ship, dates, label, cabin, onPress }: { title: string; ship: string; dates: string; label: string; cabin?: string; onPress: () => void }) {
  return <View style={homeStyles.voyage}>
    <View style={homeStyles.topline}><View style={homeStyles.liveDot} /><Text style={homeStyles.cardLabel}>{label}</Text><MaterialIcon name="sailing" color={brand.tealLight} size={24} /></View>
    <Text style={homeStyles.voyageTitle}>{title}</Text><Text style={homeStyles.ship}>{ship}</Text>
    <View style={homeStyles.facts}><View style={homeStyles.fact}><MaterialIcon name="explore" color={brand.tealLight} size={18} /><Text style={homeStyles.factText}>{dates}</Text></View>
      {cabin && <View style={homeStyles.fact}><MaterialIcon name="assignment_ind" color={brand.tealLight} size={18} /><Text style={homeStyles.factText}>Cabin {cabin}</Text></View>}</View>
    <Pressable accessibilityRole="button" accessibilityLabel="Xem thông tin chuyến đi" onPress={onPress} style={({ pressed }) => [homeStyles.voyageAction, pressed && { opacity: .7 }]}>
      <Text style={homeStyles.voyageActionText}>Thông tin chuyến đi</Text><MaterialIcon name="arrow_forward" color={brand.pearl} size={20} />
    </Pressable>
  </View>;
}
export function TodayTimeline() {
  const events: { time: string; title: string; subtitle: string; detail: string }[] = [
    { time: '09:40', title: 'Khám phá làng Việt Hải', subtitle: 'Sảnh chính · Tầng 1 · Nhóm G03', detail: 'tour' },
    { time: '16:30', title: 'Có mặt trên tàu', subtitle: 'Hạn lên tàu · Rời bến lúc 17:00', detail: 'boarding' },
  ];
  return <View style={homeStyles.section}>
    <SectionHeading title="Lịch hôm nay" action="Xem tất cả" onPress={() => router.navigate('/itinerary')} />
    <View style={homeStyles.timeline}>{events.map((event, index) => <Pressable key={event.time} accessibilityRole="button" accessibilityLabel={`${event.time}, ${event.title}. ${event.subtitle}`}
      onPress={() => router.navigate({ pathname: '/itinerary', params: { detail: event.detail } })} style={({ pressed }) => [homeStyles.event, pressed && { backgroundColor: lightTheme.surfaceHover }]}>
      <View style={homeStyles.timeColumn}><Text style={homeStyles.time}>{event.time}</Text></View>
      <View style={homeStyles.track}><View style={[homeStyles.dot, index === 0 && homeStyles.dotActive]} />{index === 0 && <View style={homeStyles.line} />}</View>
      <View style={homeStyles.eventCopy}><Text style={homeStyles.eventTitle}>{event.title}</Text><Text style={ui.caption}>{event.subtitle}</Text>{index === 0 && <Text style={homeStyles.nextBadge}>Tiếp theo</Text>}</View>
      <MaterialIcon name="chevron_right" color={lightTheme.textSecondary} size={20} />
    </Pressable>)}</View><Text style={ui.caption}>Giờ tàu · UTC+7 · Lịch trình minh họa</Text>
  </View>;
}
export function HomeDiscovery() {
  return <View style={homeStyles.section}><SectionHeading title="Dành thời gian cho bạn" />
    <View style={homeStyles.discovery}><View style={homeStyles.discoveryIcon}><MaterialIcon name="spa" color={brand.teal} size={34} /></View>
      <View style={{ flex: 1, gap: 6 }}><Text style={homeStyles.eventTitle}>Tận hưởng hành trình</Text><Text style={ui.caption}>Ẩm thực, thư giãn và trải nghiệm trên tàu.</Text></View></View>
    <PassengerButton label="Khám phá trải nghiệm" variant="secondary" icon="arrow_forward" onPress={() => router.navigate('/services')} />
  </View>;
}
export const homeStyles = StyleSheet.create({
  content: { ...ui.content }, greeting: { gap: 7, paddingVertical: 6 },
  title: { fontSize: 28, lineHeight: 36, letterSpacing: -.6, fontWeight: '700', color: brand.navy },
  voyage: { padding: 22, borderRadius: 24, backgroundColor: brand.navy, gap: 10, overflow: 'hidden' },
  topline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: brand.tealLight },
  cardLabel: { flex: 1, color: brand.tealLight, fontSize: 12, lineHeight: 17, fontWeight: '600', letterSpacing: 1.1 },
  voyageTitle: { color: brand.pearl, fontSize: 25, lineHeight: 34, fontWeight: '600', letterSpacing: -.4 },
  ship: { color: darkTheme.textSecondary, fontSize: 13, lineHeight: 21 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 8, paddingBottom: 12 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 }, factText: { color: brand.pearl, fontSize: 12, lineHeight: 20 },
  voyageAction: { borderTopWidth: 1, borderTopColor: darkTheme.border, minHeight: 48, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  voyageActionText: { fontSize: 13, lineHeight: 20, color: brand.pearl, fontWeight: '600' },
  section: { gap: 14 }, timeline: { backgroundColor: lightTheme.surface, borderRadius: 20, borderWidth: 1, borderColor: lightTheme.divider, overflow: 'hidden' },
  event: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 20, gap: 10, alignItems: 'flex-start' },
  timeColumn: { width: 46, gap: 5 }, time: { color: brand.navy, fontWeight: '700', fontSize: 14, lineHeight: 22, fontVariant: ['tabular-nums'] },
  track: { width: 12, alignSelf: 'stretch', alignItems: 'center', paddingTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: lightTheme.border, backgroundColor: lightTheme.surface },
  dotActive: { backgroundColor: brand.teal, borderColor: brand.teal }, line: { width: 1, backgroundColor: lightTheme.divider, flex: 1, marginTop: 5, marginBottom: -40 },
  eventCopy: { flex: 1, gap: 5 }, eventTitle: { color: brand.navy, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  nextBadge: { color: brand.teal, fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: .5, marginTop: 3 },
  discovery: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  discoveryIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: brand.tealSoft, alignItems: 'center', justifyContent: 'center' },
});
