import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaterialIcon } from '@/components/passenger/MaterialIcon';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';
import { LaunchIndicator } from '@/features/launch/LaunchIndicator';

import { InfoRow, SmallButton, Facts, SheetHeading, Notice, styles } from './ItineraryUI';

import { getChanges, getItineraryDay, scenarios, stopDuration, tourStatusLabels, type ItineraryScenario } from './itinerary-model';

type Sheet = 'port' | 'tour' | 'meeting' | 'group' | 'boarding' | 'history' | 'clock' | 'destination' | 'supplier' | 'participation';
function sheetFromParam(value: string | string[] | undefined): Sheet | null {
  return typeof value === 'string' && ['tour', 'boarding', 'history'].includes(value) ? value as Sheet : null;
}

export function PassengerItineraryDemoScreen() {
  const { detail } = useLocalSearchParams<{ detail?: string | string[] }>();
  const [dayIndex, setDayIndex] = useState(1);
  const [layout, setLayout] = useState<'daily' | 'ports'>('daily');
  const [scenario, setScenario] = useState<ItineraryScenario>('normal');
  const [localSheet, setSheet] = useState<Sheet | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const urlSheet = sheetFromParam(detail);
  const selectedDay = urlSheet ? 1 : dayIndex;
  const sheet = localSheet ?? urlSheet;
  const day = getItineraryDay(selectedDay, scenario);
  const tour = day.tour;
  const cancelled = scenario === 'cancelled';
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const changes = getChanges(scenario);
  function close() {
    setDayIndex(selectedDay);
    setSheet(null);
    if (urlSheet) router.setParams({ detail: '' });
  }
  function selectDay(index: number) { setDayIndex(index); setShowPast(false); }
  const fact = (left: string, leftValue: string, right: string, rightValue: string) => <Facts items={[[left, leftValue], [right, rightValue]]} />;
  function sheetContent(): ReactNode {
    switch (sheet) {
      case 'history': return <>
        <SheetHeading title="Thay đổi hải trình" subtitle="Các cập nhật đã công bố · Dữ liệu mẫu" />
        {changes.map(change => <View style={styles.change} key={change.title}>
          <Text style={styles.rowTitle}>{change.title}</Text><Text style={styles.small}>{change.published}</Text>
          <Text style={styles.small}>Áp dụng: {change.applies}</Text><Text style={styles.bodyText}>{change.description}</Text>
        </View>)}
      </>;
      case 'clock': return <>
        <SheetHeading title="Giờ trên tàu" subtitle="UTC+7 · Việt Nam" />
        {fact('Giờ tàu minh họa', '09:20', 'Giờ tại điểm dừng', '09:20')}
        <Text style={styles.bodyText}>Các ngày, giờ tập trung và hạn có mặt đều dùng múi giờ của ngày hải trình. Toàn chuyến mẫu sử dụng UTC+7.</Text>
      </>;
      case 'boarding': return <>
        <SheetHeading title="Hạn có mặt trên tàu" subtitle={`${day.destination} · ${day.date}/10/2026`} />
        {fact('Phải có mặt', day.allAboard ?? 'Không áp dụng', 'Tàu rời bến', day.departure)}
        <Text style={styles.bodyText}>Hãy trở lại tàu trước hạn có mặt. {tour && `Giờ tour quay về ${tour.returnTime} là một mốc riêng trong lịch tham quan.`}</Text>
        <Notice text="Giờ tàu UTC+7 · Việt Nam" />
      </>;
      case 'destination': return <>
        <SheetHeading title={day.destination} subtitle="Thông tin điểm đến" />
        <InfoRow icon="directions_boat" title={day.port} subtitle="Cảng/bến phục vụ điểm dừng của chuyến này" />
        <Notice text="Vịnh và đảo ven biển miền Bắc Việt Nam. Điểm đón trả khách có thể thay đổi theo thông báo của tàu." />
        <InfoRow icon="notifications" title="Thay đổi điểm dừng" subtitle="Xem thông báo đã công bố" onPress={() => setSheet('history')} />
      </>;
      case 'port': return <>
        <SheetHeading title={day.destination} subtitle={`Ngày ${selectedDay + 1} · ${day.date}/10/2026 · UTC+7`} />
        {day.sea ? <Notice text="Tàu di chuyển trên biển. Không có cảng ghé, hạn lên tàu hay tour bờ trong ngày này." /> : <>
          {fact('Tàu đến dự kiến', day.arrival, 'Tàu rời bến', day.departure)}
          <InfoRow title={day.port} subtitle="Cảng/bến đón trả khách · Xem điểm đến" icon="directions_boat" onPress={() => setSheet('destination')} />
          {day.allAboard && <InfoRow title={`${day.allAboard} · Hạn có mặt trên tàu`} subtitle={`Tàu rời bến ${day.departure}`} icon="sailing" onPress={() => setSheet('boarding')} />}
          <Notice text={`Thời gian dừng dự kiến: ${stopDuration(day.arrival, day.departure)}. ${day.actualArrival ? `Đến thực tế ${day.actualArrival}. Chưa ghi nhận tàu rời bến.` : 'Giờ thực tế sẽ được cập nhật khi có xác nhận.'}`} />
          {tour ? <InfoRow title={tour.title} subtitle={`${tour.departure}–${tour.returnTime} · ${tourStatusLabels[tour.status]}`} icon="explore" onPress={() => setSheet('tour')} />
            : <Text style={styles.bodyText}>Không có tour tham quan được phân trong ngày này.</Text>}
        </>}
      </>;
      case 'supplier': return <>
        <SheetHeading title="Đơn vị tổ chức" subtitle="Dịch vụ tham quan bờ" />
        <InfoRow icon="room_service" title="Đội tour Ocean Aurora" subtitle="Nhà cung cấp minh họa · Đã xác nhận phục vụ" />
        <Notice text="Cần hỗ trợ về tour hoặc điểm tập trung? Vui lòng gặp quầy dịch vụ trên tàu." />
      </>;
      case 'participation': return tour && <>
        <SheetHeading title="Chuyến tham quan của bạn" subtitle={`${tour.title} · ${tour.group ?? 'Chưa phân nhóm'}`} />
        <Text style={styles.chip}>{tourStatusLabels[tour.status]}</Text>
        {fact('Ghi nhận khởi hành', ['started', 'completed'].includes(tour.status) ? tour.departure : 'Chưa ghi nhận', 'Ghi nhận quay về', tour.status === 'completed' ? tour.returnTime : 'Chưa ghi nhận')}
        <Text style={styles.bodyText}>Thông tin do nhân sự phụ trách cập nhật. Nếu ghi nhận chưa đúng, hãy liên hệ hướng dẫn viên của nhóm.</Text>
      </>;
      case 'group': return tour && <>
        <SheetHeading title={tour.group ? `Nhóm ${tour.group}` : 'Thông tin nhóm tour'} subtitle={tour.title} />
        {fact('Phân nhóm', tour.group ? 'Đã xác nhận' : 'Chờ cập nhật', 'Số hành khách', tour.passengers ? `${tour.passengers} người` : 'Chưa cập nhật')}
        <InfoRow icon="assignment_ind" title={tour.guide ? `Hướng dẫn viên: ${tour.guide}` : 'Hướng dẫn viên chưa được phân'} subtitle="Thông tin minh họa" />
        <InfoRow icon="explore" title={`${tour.meetingTime} · Tập trung`} subtitle={tour.meeting} onPress={() => setSheet('meeting')} />
        <Text style={styles.bodyText}>Chỉ hiển thị nhóm bạn tham gia, không hiển thị danh sách hành khách khác.</Text>
      </>;
      case 'meeting': return tour && <>
        <SheetHeading title="Giờ & điểm tập trung" subtitle={tour.title} />
        {fact('Có mặt lúc', tour.meetingTime, 'Khởi hành', tour.departure)}
        <InfoRow title={tour.meeting} subtitle="Điểm tập trung của nhóm" icon="explore" />
        <Notice text={`Dự kiến quay về ${tour.returnTime}. Giờ tàu UTC+7.`} />
      </>;
      case 'tour': return tour && <>
        <SheetHeading title={tour.title} subtitle={`${day.destination} · ${day.date}/10/2026 · UTC+7`} />
        <Text style={[styles.chip, tour.status === 'cancelled' && styles.errorChip]}>{tourStatusLabels[tour.status]}</Text>
        {tour.status === 'cancelled' ? <Notice text="Tour đã hủy do thời tiết. Các mốc giờ tàu vẫn áp dụng. Liên hệ quầy dịch vụ để được hỗ trợ." /> : fact('Khởi hành', tour.departure, 'Dự kiến quay về', tour.returnTime)}
        {tour.status !== 'cancelled' && <InfoRow icon="explore" title={`${tour.meetingTime} · Tập trung`} subtitle={tour.meeting} onPress={() => setSheet('meeting')} />}
        <InfoRow icon="assignment_ind" title={tour.group ? `Nhóm ${tour.group}` : 'Thông tin nhóm'} subtitle={tour.passengers ? `${tour.passengers} hành khách · Nhóm của bạn` : 'Chờ cập nhật phân nhóm'} onPress={() => setSheet('group')} />
        <InfoRow icon="check_circle" title="Trạng thái tham gia của bạn" subtitle="Xem ghi nhận khởi hành & quay về" onPress={() => setSheet('participation')} />
        <InfoRow icon="room_service" title="Đơn vị tổ chức" subtitle="Thông tin phục vụ chuyến tham quan" onPress={() => setSheet('supplier')} />
        <Notice text="Khám phá cảnh quan và đời sống địa phương cùng hướng dẫn viên. Mang giày dễ đi, nước uống và thẻ Passenger. Nội dung tour minh họa." />
      </>;
      default: return null;
    }
  }
  const blocked = ['loading', 'error', 'cancelled'].includes(scenario);
  return <PassengerScaffold selected="itinerary">
    <ScrollView contentContainerStyle={styles.content} bounces={false}>
      <View style={styles.heading}><Text style={styles.title} accessibilityRole="header">Hải trình</Text><Text style={styles.chip}>Dữ liệu mẫu</Text></View>
      <View style={styles.cruise}>
        <Text style={styles.ship}>Ocean Aurora</Text><Text style={styles.cruiseText}>18–21/10/2026 · 4 ngày 3 đêm</Text>
        <Text style={styles.route}>Hạ Long → {scenario === 'substitute' ? 'Bái Tử Long' : 'Lan Hạ'} → Cát Bà</Text>
      </View>
      <View style={styles.tools}>
        <SmallButton label="Thay đổi lịch" icon="notifications" onPress={() => setSheet('history')} />
        <SmallButton label="Giờ tàu · UTC+7" icon="explore" onPress={() => setSheet('clock')} />
      </View>
      <View style={styles.segmented} accessibilityRole="tablist">
        {([['daily', 'Theo ngày'], ['ports', 'Điểm dừng']] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="tab" aria-selected={layout === key} accessibilityState={{ selected: layout === key }} onPress={() => setLayout(key)} style={[styles.segment, layout === key && styles.selectedSegment]}><Text style={[styles.segmentText, layout === key && { color: colors.onPrimary }]}>{label}</Text></Pressable>)}
      </View>
      {scenario === 'offline' && <Notice text="Ngoại tuyến · Đang xem bản lưu minh họa lúc 09:00, 19/10/2026. Kiểm tra lại giờ với nhân sự trên tàu." />}
      {['changed', 'substitute', 'tour-cancelled', 'sea'].includes(scenario) && <InfoRow title={changes[0].title} subtitle="Xem chi tiết thay đổi đã công bố" icon="notifications" onPress={() => setSheet('history')} />}
      {scenario === 'loading' ? <View style={styles.empty} accessibilityState={{ busy: true }}><LaunchIndicator /><Text style={styles.bodyText}>Đang tải lịch trình…</Text></View>
        : scenario === 'error' ? <View style={styles.empty}><Text style={styles.sectionTitle}>Chưa thể tải hải trình</Text><Text style={styles.bodyText}>Không tải được dữ liệu mẫu. Vui lòng thử lại.</Text><PassengerButton label="Thử lại" onPress={() => setScenario('normal')} /></View>
          : cancelled ? <View style={styles.empty}><MaterialIcon name="error" color={colors.error} size={40} /><Text style={styles.sectionTitle}>Hải trình đã hủy</Text><Text style={styles.centerText}>Vui lòng liên hệ quầy dịch vụ trên tàu để được hỗ trợ.</Text><PassengerButton label="Xem thông báo thay đổi" onPress={() => setSheet('history')} /></View>
            : layout === 'ports' ? <View style={styles.ports}>
              {[0, 1, 2, 3].map(index => { const stop = getItineraryDay(index, scenario); return <InfoRow key={index} title={`${stop.date}/10 · ${stop.destination}`} subtitle={stop.sea ? 'Ngày trên biển · Không ghé cảng' : `${stop.arrival}–${stop.departure} · ${stop.tour?.group ? `Nhóm ${stop.tour.group}` : 'Thông tin trong ngày'}`} icon="directions_boat" onPress={() => { selectDay(index); setSheet('port'); }} />; })}
            </View> : <>
              <View style={styles.days} accessibilityRole="tablist" accessibilityLabel="Chọn ngày trong hải trình">
                {[0, 1, 2, 3].map(index => <DayButton key={index} index={index} selected={selectedDay === index} onPress={() => selectDay(index)} />)}
              </View>
              <Animated.View key={`${selectedDay}-${scenario}`} entering={reduceMotion ? undefined : FadeInDown.duration(220)} style={styles.panel}>
                <View style={styles.heading}><Text style={styles.sectionTitle}>{day.destination}</Text><Text style={styles.small}>Ngày {selectedDay + 1} · {day.date}/10</Text></View>
                {day.sea ? <Notice text="Tàu di chuyển trên biển, không có điểm dừng hay tour bờ trong ngày này." /> : <>
                  {tour ? <View style={styles.tourCard}>
                    <View style={styles.heading}><Text style={styles.eyebrow}>TOUR CỦA BẠN</Text><Text style={styles.eyebrow}>{tour.group ?? 'TRÊN TÀU'}</Text></View>
                    <Text style={styles.sectionTitle}>{tour.title}</Text><Text style={styles.small}>{tourStatusLabels[tour.status]}</Text>
                    <View style={styles.tourBottom}><View style={styles.grow}><Text style={styles.rowTitle}>{tour.meetingTime} · Tập trung</Text><Text style={styles.small}>{tour.meeting}</Text></View><PassengerButton label={tour.status === 'cancelled' ? 'Xem lý do' : 'Xem tour'} icon="arrow_forward" onPress={() => setSheet('tour')} /></View>
                  </View> : <Notice text={selectedDay === 3 ? 'Ngày kết thúc hành trình. Không có tour tham quan.' : 'Chưa có tour được phân. Thông tin tour và nhóm sẽ xuất hiện khi được xác nhận.'} />}
                  <SmallButton label={showPast ? 'Ẩn thông tin tàu đến' : `Tàu đến ${day.arrival} · Xem chi tiết`} icon="directions_boat" onPress={() => setShowPast(value => !value)} />
                  {showPast && <InfoRow title={`${day.arrival} · Tàu đến`} subtitle={day.port} icon="directions_boat" onPress={() => setSheet('port')} />}
                  {tour && tour.status !== 'cancelled' && <InfoRow title={`${tour.returnTime} · Quay lại tàu`} subtitle="Dự kiến kết thúc chuyến tham quan" icon="explore" onPress={() => setSheet('tour')} />}
                  {day.allAboard && <InfoRow title={`${day.allAboard} · Có mặt trên tàu`} subtitle={`Hạn lên tàu · Rời bến ${day.departure}`} icon="sailing" onPress={() => setSheet('boarding')} />}
                  <InfoRow title={`${day.departure} · ${selectedDay === 3 ? 'Kết thúc hành trình' : 'Tàu rời điểm dừng'}`} subtitle={day.port} icon="directions_boat" onPress={() => setSheet('port')} />
                </>}
              </Animated.View>
            </>}
      {__DEV__ && <View style={styles.demo}>
        <SmallButton label={showDemo ? 'Ẩn tình huống mẫu' : 'Dữ liệu minh họa · Đổi tình huống'} icon="explore" onPress={() => setShowDemo(value => !value)} />
        {showDemo && <View style={styles.tools}>{scenarios.map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: scenario === key }} onPress={() => { setScenario(key); setDayIndex(1); }} style={[styles.demoChip, scenario === key && styles.selectedSegment]}><Text style={styles.small}>{label}</Text></Pressable>)}</View>}
      </View>}
    </ScrollView>
    <Modal visible={!!sheet} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={close}>
      <View style={styles.modal}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Đóng chi tiết" onPress={close} />
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(320).easing(Easing.bezier(.2, 0, 0, 1))} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.sheetBar}><Text style={styles.chip}>Thông tin minh họa</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng bảng chi tiết" onPress={close} style={styles.close}><MaterialIcon name="arrow_back" color={colors.onSurface} /></Pressable></View>
          <ScrollView contentContainerStyle={styles.sheetContent} bounces={false}>
            <Animated.View key={sheet} entering={reduceMotion ? undefined : FadeIn.duration(180)} style={styles.panel}>{!blocked || sheet === 'history' || sheet === 'clock' ? sheetContent() : <Notice text="Thông tin chi tiết không khả dụng trong trạng thái này." />}</Animated.View>
            {sheet && !['tour', 'history', 'port', 'clock', 'boarding'].includes(sheet) && tour && <PassengerButton label="Quay lại chi tiết tour" variant="text" onPress={() => setSheet('tour')} />}
            <PassengerButton label="Quay lại hải trình" onPress={close} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  </PassengerScaffold>;
}

function DayButton({ index, selected, onPress }: { index: number; selected: boolean; onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ borderRadius: withTiming(selected ? 26 : 18, { duration: reduceMotion ? 0 : 220 }), backgroundColor: withTiming(selected ? colors.primary : colors.surfaceContainerLow, { duration: reduceMotion ? 0 : 220 }) }));
  return <Animated.View style={[styles.day, animated]}><Pressable accessibilityRole="tab" aria-selected={selected} accessibilityLabel={`Ngày ${index + 1}, ${18 + index} tháng 10`} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.dayInner, pressed && styles.pressed]}><Text style={[styles.small, selected && { color: colors.onPrimary }]}>Ngày {index + 1}</Text><Text style={styles.dayNumber}>{18 + index}</Text><Text style={[styles.small, selected && { color: colors.onPrimary }]}>Tháng 10</Text></Pressable></Animated.View>;
}
