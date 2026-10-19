import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaterialIcon } from '@/components/passenger/MaterialIcon';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';
import { useAuth } from '@/features/auth/session-store';
import { queryClient } from '@/lib/query-client';
import { getApiUrl, readErrorMessage } from '@/lib/api';
import { formatDay, formatTime, statusLabel, stopsForDay, validTimeZone } from './api-format';
import { itineraryApi, useLiveItinerary, type StopDto, type TourDto } from './itinerary-api';
import { Facts, InfoRow, Notice, SheetHeading, SmallButton, styles } from './ItineraryUI';

type Sheet = 'port' | 'tour' | 'groups' | 'group' | 'history' | 'clock';
export function PassengerLiveItineraryScreen() {
  const { detail: detailParam } = useLocalSearchParams<{ detail?: string }>();
  const auth = useAuth();
  const { catalog, detail } = useLiveItinerary();
  const [dayId, setDayId] = useState<string>();
  const [stopId, setStopId] = useState<string>();
  const [tourId, setTourId] = useState<string>();
  const [groupId, setGroupId] = useState<string>();
  const [layout, setLayout] = useState<'daily' | 'ports'>('daily');
  const [localSheet, setSheet] = useState<Sheet | null>(null);
  const data = detail.data;
  const day = data?.days.find(value => value.itineraryDayId === dayId) ?? data?.days[0];
  const dayStops = day && data ? stopsForDay(day, data.stops) : [];
  const stop = dayStops.find(value => value.cruiseStopId === stopId) ?? dayStops[0];
  const zone = validTimeZone(day?.shipTimeZoneId);
  const time = (value?: string | null, date = false) => formatTime(value, zone, date);
  const cancelled = data?.itinerary.status === 'CANCELLED' || data?.cruise?.status === 'CANCELLED';
  const inactiveStop = stop?.status === 'OMITTED' || stop?.status === 'SUBSTITUTED';
  const canLoadTours = !!data && !!stop && !inactiveStop && !cancelled && day?.dayType !== 'SEA_DAY';
  const tours = useQuery({ queryKey: ['live', auth.session?.user.id, getApiUrl(), 'tours', stop?.cruiseStopId], queryFn: ({ signal }) => itineraryApi.tours(stop!.cruiseStopId, signal), enabled: canLoadTours && !!auth.session });
  const tour = tours.error ? undefined : tours.data?.find(value => value.shoreExcursionId === tourId);
  const sheet = localSheet ?? (detailParam === 'history' ? 'history' : null);
  // Group browsing is read-only and does not establish a passenger assignment.
  const groups = useQuery({ queryKey: ['live', auth.session?.user.id, getApiUrl(), 'groups', tour?.shoreExcursionId], queryFn: ({ signal }) => itineraryApi.groups(tour!.shoreExcursionId, signal), enabled: !!tour && !!auth.session && (sheet === 'groups' || sheet === 'group') });
  const group = groups.error ? undefined : groups.data?.find(value => value.tourGroupId === groupId);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  function close() { setSheet(null); if (detailParam) router.setParams({ detail: '' }); }
  function openStop(value: StopDto) { setDayId(value.arrivalItineraryDayId); setStopId(value.cruiseStopId); setTourId(undefined); setGroupId(undefined); setSheet('port'); }
  function openTour(value: TourDto) { setTourId(value.shoreExcursionId); setGroupId(undefined); setSheet('tour'); }
  function refresh() { void queryClient.invalidateQueries({ queryKey: ['live', auth.session?.user.id] }); }
  const heading = (title: string, subtitle: string) => <SheetHeading title={title} subtitle={subtitle} />;
  function modalContent(): ReactNode {
    if (sheet === 'history') return <>
      {heading('Thay đổi hải trình', data?.itinerary.itineraryName ?? 'Hải trình đang chọn')}
      {!data ? <Notice text={detail.error?.message ?? catalog.error?.message ?? 'Đang tải lịch sử…'} /> : data.history.error ? <><Notice text={data.history.error} /><PassengerButton label="Tải lại lịch sử" onPress={() => { void detail.refetch(); }} /></>
        : data.history.items.length ? data.history.items.map(item => <View style={styles.change} key={item.changeHistoryId}>
          <Text style={styles.rowTitle}>{item.changeSummary ?? item.changeType}</Text><Text style={styles.small}>{time(item.changedAt, true)}</Text>
          {item.reason && <Text style={styles.bodyText}>{item.reason}</Text>}
        </View>) : <Notice text="Chưa có bản ghi thay đổi cho hải trình này." />}
    </>;
    if (sheet === 'clock') return <>
      {heading('Giờ trên tàu', zone ?? 'Múi giờ chưa được cấu hình')}
      <Notice text={zone ? `Các mốc thời gian hiển thị theo ${zone}.` : 'Backend chưa cung cấp múi giờ hợp lệ cho ngày này. Tạm hiển thị thời gian UTC.'} />
      <Facts items={[[zone ? 'Giờ tàu hiện tại' : 'Giờ UTC hiện tại', formatTime(new Date().toISOString(), zone)], ['Ngày hải trình', day ? formatDay(day.date) : 'Chưa có ngày']]} />
    </>;
    if (sheet === 'port' && stop) return <>
      {heading(stop.destinationName ?? stop.portName ?? 'Điểm dừng', `${stop.portName ?? 'Cảng chưa cập nhật'} · ${statusLabel(stop.status)}`)}
      {(stop.status === 'OMITTED' || stop.status === 'SUBSTITUTED') ? <Notice text={stop.cancellationReason ?? 'Điểm dừng này không còn áp dụng. Kiểm tra điểm dừng thay thế trong hải trình.'} /> : <>
        <Facts items={[["Đến dự kiến", time(stop.plannedArrival, true)], ['Rời bến dự kiến', time(stop.plannedDeparture, true)], ['Hạn có mặt trên tàu', time(stop.allAboardTime, true)], ['Đến thực tế', time(stop.actualArrival, true)], ['Rời bến thực tế', time(stop.actualDeparture, true)]]} />
        {stop.notes && <Notice text={stop.notes} />}
        <Text style={styles.sectionTitle}>Tour tại điểm dừng</Text>{tourList()}
      </>}
    </>;
    if (sheet === 'tour' && tour) return <>
      {heading(tour.excursionName, `${tour.excursionCode} · ${statusLabel(tour.status)}`)}
      {tour.status === 'CANCELLED' ? <Notice text={tour.cancellationReason ?? 'Tour này đã bị hủy.'} /> : <Facts items={[["Khởi hành", time(tour.startTime, true)], ['Dự kiến quay về', time(tour.plannedReturnTime, true)]]} />}
      <InfoRow title={tour.meetingPoint ?? 'Điểm tập trung chưa cập nhật'} subtitle="Giờ tập trung cụ thể được ghi theo từng nhóm tour" icon="explore" />
      <InfoRow title="Các nhóm tour" subtitle="Xem giờ tập trung và thông tin nhóm" icon="assignment_ind" onPress={() => setSheet('groups')} />
      <InfoRow title={tour.supplierName ?? 'Chưa cập nhật đơn vị tổ chức'} subtitle="Đơn vị cung cấp tour" icon="room_service" />
      <Notice text="Chưa xác nhận nhóm cá nhân cho tài khoản này. Nhóm được chọn để xem không đồng nghĩa với nhóm bạn đã được phân." />
    </>;
    if (sheet === 'groups') return <>
      {heading('Các nhóm tour', tour?.excursionName ?? 'Tour đang chọn')}
      {groups.isPending ? <Notice text="Đang tải nhóm tour…" /> : groups.error ? <><Notice text={readErrorMessage(groups.error, 'nhóm tour')} /><PassengerButton label="Thử lại" onPress={() => { void groups.refetch(); }} /></>
        : !groups.data?.length ? <Notice text="Tour chưa có nhóm nào." /> : groups.data.map(item => <InfoRow key={item.tourGroupId} title={item.groupCode} subtitle={`${item.assignedPassengers}/${item.maximumCapacity} hành khách · ${statusLabel(item.status)}`} icon="assignment_ind" onPress={() => { setGroupId(item.tourGroupId); setSheet('group'); }} />)}
    </>;
    if (sheet === 'group' && group) return <>
      {heading(`Nhóm ${group.groupCode}`, `Nhóm đang xem · ${statusLabel(group.status)}`)}
      <Facts items={[["Tập trung", time(group.assemblyTime, true)], ['Khởi hành dự kiến', time(group.plannedDepartureTime, true)], ['Quay về dự kiến', time(group.plannedReturnTime, true)], ['Nhóm khởi hành thực tế', time(group.actualDepartureTime, true)], ['Nhóm quay về thực tế', time(group.actualReturnTime, true)]]} />
      <InfoRow title={group.meetingPoint ?? 'Điểm tập trung chưa cập nhật'} subtitle={`${group.assignedPassengers}/${group.maximumCapacity} hành khách`} icon="explore" />
      <Notice text={group.guideId ? 'Đã phân hướng dẫn viên. Backend chưa cung cấp tên để hiển thị.' : 'Chưa phân hướng dẫn viên.'} />
      <Text style={styles.bodyText}>Không hiển thị danh sách hoặc điểm danh cá nhân của các hành khách khác.</Text>
    </>;
    return <Notice text="Thông tin đang cập nhật hoặc không còn khả dụng. Vui lòng tải lại hải trình." />;
  }
  function tourList() {
    if (!canLoadTours) return <Notice text="Không có tour khả dụng tại điểm dừng này." />;
    if (tours.isPending) return <Notice text="Đang tải tour tại điểm dừng…" />;
    if (tours.error) return <><Notice text={readErrorMessage(tours.error, 'tour tại điểm dừng')} /><PassengerButton label="Tải lại tour" onPress={() => { void tours.refetch(); }} /></>;
    if (!tours.data?.length) return <Notice text="Điểm dừng này chưa có tour tham quan." />;
    return tours.data.map(item => <InfoRow key={item.shoreExcursionId} title={item.excursionName} subtitle={`${time(item.startTime)} – ${time(item.plannedReturnTime)} · ${statusLabel(item.status)}`} icon="explore" onPress={() => openTour(item)} />);
  }
  const error = catalog.error ?? detail.error;
  return <PassengerScaffold selected="itinerary">
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={catalog.isRefetching || detail.isRefetching} onRefresh={refresh} tintColor={colors.primary} />}>
      <View style={styles.heading}><Text style={styles.title}>Lịch trình chuyến đi</Text><Text style={styles.chip}>Dữ liệu API</Text></View>
      {error && <><Notice tone="error" text={`${error.message}${data ? ' Đang hiển thị dữ liệu đã tải trước đó.' : ''}`} /><PassengerButton label="Thử lại" onPress={refresh} /></>}
      {catalog.isPending || (catalog.itinerary && detail.isPending) ? <Notice text="Đang tải hải trình…" /> : !catalog.itinerary && !error ? <Notice text="Chưa có hải trình mà tài khoản này được phép xem." /> : null}
      {data && <>
        {data.accessErrors.map(message => <Notice key={message} text={message} />)}
        <View style={styles.cruise}><Text style={styles.ship}>{data.itinerary.itineraryName}</Text><Text style={styles.cruiseText}>{data.cruise?.shipName ?? data.cruise?.cruiseName ?? 'Thông tin chuyến tàu chưa khả dụng'}</Text><Text style={styles.cruiseText}>{formatDay(data.itinerary.startDate)} – {formatDay(data.itinerary.endDate)}</Text><Text style={styles.chip}>{statusLabel(data.itinerary.status)}</Text></View>
        <View style={styles.tools}><SmallButton label="Thay đổi lịch" icon="notifications" onPress={() => setSheet('history')} /><SmallButton label={zone ?? 'Giờ UTC · Chưa có múi giờ'} icon="explore" onPress={() => setSheet('clock')} /></View>
        <View style={styles.segmented} accessibilityRole="tablist">{([['daily', 'Theo ngày'], ['ports', 'Điểm dừng']] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="tab" aria-selected={layout === key} accessibilityState={{ selected: layout === key }} onPress={() => setLayout(key)} style={[styles.segment, layout === key && styles.selectedSegment]}><Text style={[styles.segmentText, layout === key && { color: colors.onSecondaryContainer }]}>{label}</Text></Pressable>)}</View>
        {cancelled ? <Notice tone="warning" text="Hải trình/chuyến đi đã hủy. Không sử dụng lịch cũ để rời tàu. Vui lòng xem thông báo thay đổi và liên hệ nhân sự hỗ trợ." />
          : layout === 'ports' ? data.stops.length ? data.stops.map(value => <InfoRow key={value.cruiseStopId} title={value.destinationName ?? value.portName ?? 'Điểm dừng'} subtitle={`${time(value.plannedArrival, true)} – ${time(value.plannedDeparture, true)} · ${statusLabel(value.status)}`} icon="directions_boat" onPress={() => openStop(value)} />) : data.stopsDenied ? null : <Notice text="Hải trình chưa có điểm dừng." />
            : <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist" accessibilityLabel="Chọn ngày hải trình">{data.days.map(value => <Pressable key={value.itineraryDayId} accessibilityRole="tab" aria-selected={day?.itineraryDayId === value.itineraryDayId} accessibilityState={{ selected: day?.itineraryDayId === value.itineraryDayId }} onPress={() => { setDayId(value.itineraryDayId); setStopId(undefined); setTourId(undefined); }} style={[styles.dayInner, { minWidth: 82, borderRadius: 14, backgroundColor: day?.itineraryDayId === value.itineraryDayId ? colors.secondaryContainer : colors.surfaceContainerLow }]}><Text style={[styles.rowTitle, day?.itineraryDayId === value.itineraryDayId && { color: colors.onSecondaryContainer }]}>Ngày {value.dayNumber}</Text><Text style={[styles.small, day?.itineraryDayId === value.itineraryDayId && { color: colors.onSecondaryContainer }]}>{formatDay(value.date)}</Text></Pressable>)}</ScrollView>
              {!day ? data.daysDenied ? null : <Notice text="Backend chưa tạo ngày cho hải trình này." /> : <Animated.View key={day.itineraryDayId} entering={reduceMotion ? undefined : FadeInDown.duration(220)} style={styles.panel}>
                <Text style={styles.sectionTitle}>{day.dayType === 'SEA_DAY' ? 'Ngày trên biển' : `Ngày ${day.dayNumber} · ${formatDay(day.date)}`}</Text>
                {day.description && <Text style={styles.bodyText}>{day.description}</Text>}
                {day.dayType === 'SEA_DAY' ? <Notice text="Tàu di chuyển trên biển. Không ghé cảng trong ngày này." /> : <>
                  {dayStops.length ? dayStops.map(value => <InfoRow key={value.cruiseStopId} title={value.destinationName ?? value.portName ?? 'Điểm dừng'} subtitle={`${time(value.plannedArrival, true)} – ${time(value.plannedDeparture, true)} · ${statusLabel(value.status)}`} icon="directions_boat" onPress={() => openStop(value)} />) : data.stopsDenied ? null : <Notice text="Chưa cấu hình điểm dừng cho ngày này." />}
                  {stop && !inactiveStop && <>
                    <Text style={styles.sectionTitle}>Tour tại {stop.destinationName ?? stop.portName ?? 'điểm dừng'}</Text>
                    {dayStops.length > 1 && <View style={styles.tools}>{dayStops.map(value => <SmallButton key={value.cruiseStopId} label={`${value.cruiseStopId === stop.cruiseStopId ? '● ' : ''}${value.portName ?? `Điểm ${value.stopOrder}`}`} icon="directions_boat" onPress={() => { setStopId(value.cruiseStopId); setTourId(undefined); }} />)}</View>}
                    {tourList()}
                    <InfoRow title={`${time(stop.allAboardTime)} · Hạn có mặt trên tàu`} subtitle={stop.allAboardTime ? `Rời bến ${time(stop.plannedDeparture)}` : 'Backend chưa cập nhật hạn lên tàu'} icon="sailing" onPress={() => setSheet('port')} />
                  </>}
                </>}
              </Animated.View>}
            </>}
      </>}
    </ScrollView>
    <Modal visible={!!sheet} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={close}>
      <View style={styles.modal}><Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Đóng chi tiết" onPress={close} />
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(260).easing(Easing.bezier(.2, 0, 0, 1))} style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom) }]} accessibilityViewIsModal>
          <View style={styles.handle} /><View style={styles.sheetBar}><Text style={styles.chip}>Dữ liệu từ backend</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng bảng chi tiết" style={styles.close} onPress={close}><MaterialIcon name="arrow_back" color={colors.onSurface} /></Pressable></View>
          <ScrollView contentContainerStyle={styles.sheetContent} bounces={false}>
            <Animated.View key={`${sheet}-${tourId}-${groupId}`} entering={reduceMotion ? undefined : FadeIn.duration(180)} style={styles.panel}>{modalContent()}</Animated.View>
            {sheet === 'group' && <PassengerButton label="Quay lại danh sách nhóm" variant="text" onPress={() => setSheet('groups')} />}
            {sheet === 'groups' && <PassengerButton label="Quay lại chi tiết tour" variant="text" onPress={() => setSheet('tour')} />}
            <PassengerButton label="Quay lại hải trình" onPress={close} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  </PassengerScaffold>;
}
