import { VoyageEntrance } from '@/components/passenger/VoyageEntrance';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { PassengerSheet } from '@/components/passenger/PassengerSheet';
import { motion } from '@/constants/motion';

import { PassengerButton } from '@/components/passenger/PassengerButton';
import { Choice } from '@/features/passenger-actions/PassengerActionUI';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';
import { passengerApi, usePassengerContext, usePassengerQuery } from '@/features/passenger-actions/passenger-hooks';
import { dateTime } from '@/features/passenger-actions/passenger-model';
import { useAuth } from '@/features/auth/session-store';
import { queryClient } from '@/lib/query-client';
import { getApiUrl, readErrorMessage } from '@/lib/api';
import { dateAt, formatDay, formatTime, statusLabel, stopsForDay, timeZoneLabel, validTimeZone } from './api-format';
import { itineraryApi, selectVoyage, useLiveItinerary, type StopDto, type TourDto } from './itinerary-api';
import { Facts, InfoRow, Notice, SheetHeading, SmallButton, styles } from './ItineraryUI';

type Sheet = 'port' | 'tour' | 'groups' | 'group' | 'history' | 'clock';
export function PassengerLiveItineraryScreen() {
  const { detail: detailParam } = useLocalSearchParams<{ detail?: string }>();
  const auth = useAuth();
  const context = usePassengerContext();
  const canReadGroups = context.can('TOUR_GROUP_READ');
  const { catalog, detail, canRead } = useLiveItinerary();
  const [dayId, setDayId] = useState<string>();
  const [stopId, setStopId] = useState<string>();
  const [tourId, setTourId] = useState<string>();
  const [groupId, setGroupId] = useState<string>();
  const [layout, setLayout] = useState<'daily' | 'ports'>('daily');
  const [localSheet, setSheet] = useState<Sheet | null>(null);
  const [selectedItinerary, setSelectedItinerary] = useState(catalog.itineraryId);
  if (selectedItinerary !== catalog.itineraryId) {
    setSelectedItinerary(catalog.itineraryId);
    setDayId(undefined); setStopId(undefined); setTourId(undefined); setGroupId(undefined); setSheet(null);
  }
  const data = detail.data;
  const day = data?.days.find(value => value.itineraryDayId === dayId) ?? data?.days[0];
  const dayStops = day && data ? stopsForDay(day, data.stops) : [];
  const stop = dayStops.find(value => value.cruiseStopId === stopId) ?? dayStops[0];
  const zone = validTimeZone(day?.shipTimeZoneId);
  const personalActivities = day ? (catalog.voyage?.registeredActivities ?? []).filter(item => dateAt(item.startTime, zone) === day.date) : [];
  const zoneLabel = timeZoneLabel(zone, day?.date ? `${day.date}T12:00:00Z` : undefined);
  const time = (value?: string | null, date = false) => formatTime(value, zone, date);
  function stopTime(value: string | null | undefined, item: StopDto, side: 'arrival' | 'departure') {
    const dayId = side === 'arrival' ? item.arrivalItineraryDayId : item.departureItineraryDayId;
    const eventDay = data?.days.find(entry => entry.itineraryDayId === dayId);
    return dateTime(value, validTimeZone(eventDay?.shipTimeZoneId) ?? validTimeZone(item.shipTimeZoneId) ?? 'UTC');
  }
  function stopSummary(item: StopDto) {
    return `${stopTime(item.plannedArrival, item, 'arrival')} – ${stopTime(item.plannedDeparture, item, 'departure')} · ${statusLabel(item.status)}`;
  }
  function tourTime(value: string | null | undefined) {
    const eventDays = stop && data ? data.days.filter(entry =>
      dateAt(value, validTimeZone(entry.shipTimeZoneId)) === entry.date && stopsForDay(entry, [stop]).length > 0) : [];
    const eventZone = eventDays.length === 1 ? validTimeZone(eventDays[0]?.shipTimeZoneId) : null;
    return dateTime(value, eventZone ?? validTimeZone(stop?.shipTimeZoneId) ?? 'UTC');
  }
  const cancelled = data?.itinerary.status === 'CANCELLED' || data?.cruise?.status === 'CANCELLED';
  const inactiveStop = stop?.status === 'OMITTED' || stop?.status === 'SUBSTITUTED';
  const canLoadTours = context.can('EXCURSION_READ') && !!data && !!stop && !inactiveStop && !cancelled && day?.dayType !== 'SEA_DAY';
  const selectedStopId = stop?.cruiseStopId ?? '';
  const tours = useQuery({ queryKey: ['live', auth.session?.user.id, getApiUrl(), 'tours', stop?.cruiseStopId], queryFn: ({ signal }) => itineraryApi.tours(selectedStopId, signal), enabled: canLoadTours && !!auth.session });
  const tour = tours.error ? undefined : tours.data?.find(value => value.shoreExcursionId === tourId);
  const sheet = localSheet ?? (detailParam === 'history' ? 'history' : null);
  const inbox = usePassengerQuery(['notifications'], passengerApi.notifications, 'NOTIFICATION_READ', sheet === 'history');
  const changes = inbox.data?.filter(item => item.notificationType === 'CRUISE_SCHEDULE_CHANGE') ?? [];
  // Group browsing is read-only and does not establish a passenger assignment.
  const selectedTourId = tour?.shoreExcursionId ?? '';
  const groups = useQuery({ queryKey: ['live', auth.session?.user.id, getApiUrl(), 'groups', tour?.shoreExcursionId], queryFn: ({ signal }) => itineraryApi.groups(selectedTourId, signal), enabled: canReadGroups && !!tour && !!auth.session && (sheet === 'groups' || sheet === 'group') });
  const group = groups.error ? undefined : groups.data?.find(value => value.tourGroupId === groupId);
  function close() { setSheet(null); if (detailParam) router.setParams({ detail: '' }); }
  function openStop(value: StopDto) { setDayId(value.arrivalItineraryDayId); setStopId(value.cruiseStopId); setTourId(undefined); setGroupId(undefined); setSheet('port'); }
  function openTour(value: TourDto) { setTourId(value.shoreExcursionId); setGroupId(undefined); setSheet('tour'); }
  function refresh() {
    void context.me.refetch();
    if (context.can('BOOKING_READ')) void catalog.refetch();
    void queryClient.invalidateQueries({ queryKey: ['live', auth.session?.user.id] });
  }
  const heading = (title: string, subtitle: string) => <SheetHeading title={title} subtitle={subtitle} />;
  function modalContent(): ReactNode {
    if (sheet === 'history') return <>
      {heading('Cập nhật lịch trình', 'Thông báo gửi riêng cho tài khoản của bạn')}
      {!context.can('NOTIFICATION_READ') ? <Notice text="Bạn chưa xem được thông báo trên tài khoản này." />
        : inbox.error ? <><Notice tone="error" text="Chưa tải được thông báo thay đổi." /><PassengerButton label="Tải lại" onPress={() => { void inbox.refetch(); }} /></>
          : inbox.isPending ? <Notice text="Đang tải thông báo…" />
            : changes.length ? changes.map(item => <View style={styles.change} key={item.notificationId}>
              <Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.small}>{dateTime(item.createdAt)}</Text>
              <Text style={styles.bodyText}>{item.content}</Text>
            </View>) : <Notice text="Bạn chưa nhận được thông báo thay đổi lịch trình." />}
    </>;
    if (sheet === 'clock') return <>
      {heading('Giờ trên tàu', zoneLabel)}
      <Notice text={zone ? `Các mốc thời gian hiển thị theo ${zone}.` : 'Chưa có múi giờ tàu. Các mốc thời gian đang hiển thị theo UTC.'} />
      <Facts items={[[zone ? 'Giờ tàu hiện tại' : 'Giờ UTC hiện tại', formatTime(new Date().toISOString(), zone)], ['Ngày hải trình', day ? formatDay(day.date) : 'Chưa có ngày']]} />
    </>;
    if (sheet === 'port' && stop) return <>
      {heading(stop.destinationName ?? stop.portName ?? 'Điểm dừng', `${stop.portName ?? 'Cảng chưa cập nhật'} · ${statusLabel(stop.status)}`)}
      {(stop.status === 'OMITTED' || stop.status === 'SUBSTITUTED') ? <Notice text={stop.cancellationReason ?? 'Điểm dừng này không còn áp dụng. Kiểm tra điểm dừng thay thế trong hải trình.'} /> : <>
        <Facts items={[
          ['Đến dự kiến', stopTime(stop.plannedArrival, stop, 'arrival')],
          ['Rời bến dự kiến', stopTime(stop.plannedDeparture, stop, 'departure')],
          ['Hạn có mặt trên tàu', stopTime(stop.allAboardTime, stop, 'departure')],
          ['Đến thực tế', stopTime(stop.actualArrival, stop, 'arrival')],
          ['Rời bến thực tế', stopTime(stop.actualDeparture, stop, 'departure')],
        ]} />
        {stop.notes && <Notice text={stop.notes} />}
        <Text style={styles.sectionTitle}>Tour tại điểm dừng</Text>{tourList()}
      </>}
    </>;
    if (sheet === 'tour' && tour) return <>
      {heading(tour.excursionName, `${tour.excursionCode} · ${statusLabel(tour.status)}`)}
      {tour.status === 'CANCELLED' ? <Notice text={tour.cancellationReason ?? 'Tour này đã bị hủy.'} /> : <Facts items={[['Khởi hành', tourTime(tour.startTime)], ['Dự kiến quay về', tourTime(tour.plannedReturnTime)]]} />}
      <InfoRow title={tour.meetingPoint ?? 'Điểm tập trung chưa cập nhật'} subtitle="Giờ tập trung cụ thể được ghi theo từng nhóm tour" icon="explore" />
      {canReadGroups ? <InfoRow title="Các nhóm tour" subtitle="Xem giờ tập trung và thông tin nhóm" icon="assignment_ind" onPress={() => setSheet('groups')} /> : null}
      <InfoRow title={tour.supplierName ?? 'Chưa cập nhật đơn vị tổ chức'} subtitle="Đơn vị cung cấp tour" icon="room_service" />
    </>;
    if (sheet === 'groups') return <>
      {heading('Các nhóm tour', tour?.excursionName ?? 'Tour đang chọn')}
      {!canReadGroups ? <Notice text="Tài khoản chưa được cấp quyền xem nhóm tour." /> : groups.isPending ? <Notice text="Đang tải nhóm tour…" /> : groups.error ? <><Notice text={readErrorMessage(groups.error, 'nhóm tour')} /><PassengerButton label="Thử lại" onPress={() => { void groups.refetch(); }} /></>
        : !groups.data?.length ? <Notice text="Tour chưa có nhóm nào." /> : groups.data.map(item => <InfoRow key={item.tourGroupId} title={item.groupCode} subtitle={`${item.assignedPassengers}/${item.maximumCapacity} hành khách · ${statusLabel(item.status)}`} icon="assignment_ind" onPress={() => { setGroupId(item.tourGroupId); setSheet('group'); }} />)}
    </>;
    if (sheet === 'group' && group) return <>
      {heading(`Nhóm ${group.groupCode}`, `Nhóm đang xem · ${statusLabel(group.status)}`)}
      <Facts items={[['Tập trung', tourTime(group.assemblyTime)], ['Khởi hành dự kiến', tourTime(group.plannedDepartureTime)], ['Quay về dự kiến', tourTime(group.plannedReturnTime)], ['Nhóm khởi hành thực tế', tourTime(group.actualDepartureTime)], ['Nhóm quay về thực tế', tourTime(group.actualReturnTime)]]} />
      <InfoRow title={group.meetingPoint ?? 'Điểm tập trung chưa cập nhật'} subtitle={`${group.assignedPassengers}/${group.maximumCapacity} hành khách`} icon="explore" />
      <Notice text={group.guideId ? 'Đã phân hướng dẫn viên.' : 'Chưa phân hướng dẫn viên.'} />
    </>;
    return <Notice text="Thông tin đang cập nhật hoặc không còn khả dụng. Vui lòng tải lại hải trình." />;
  }
  function tourList() {
    if (!canLoadTours) return <Notice text="Không có tour khả dụng tại điểm dừng này." />;
    if (tours.isPending) return <Notice text="Đang tải tour tại điểm dừng…" />;
    if (tours.error) return <><Notice text={readErrorMessage(tours.error, 'tour tại điểm dừng')} /><PassengerButton label="Tải lại tour" onPress={() => { void tours.refetch(); }} /></>;
    if (!tours.data?.length) return <Notice text="Điểm dừng này chưa có tour tham quan." />;
    return tours.data.map(item => <InfoRow key={item.shoreExcursionId} title={item.excursionName} subtitle={`${tourTime(item.startTime)} – ${tourTime(item.plannedReturnTime)} · ${statusLabel(item.status)}`} icon="explore" onPress={() => openTour(item)} />);
  }
  const error = context.error ?? catalog.error ?? detail.error;
  return <PassengerScaffold selected="itinerary">
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={catalog.isRefetching || detail.isRefetching} onRefresh={refresh} tintColor={colors.primary} />}>
      <View style={styles.heading}><Text style={styles.title}>Lịch trình chuyến đi</Text></View>
      {error && <><Notice tone="error" text={`${error.message}${data ? ' Đang hiển thị dữ liệu đã tải trước đó.' : ''}`} /><PassengerButton label="Thử lại" onPress={refresh} /></>}
      {(catalog.voyages.length > 1 || (catalog.voyages.length === 1 && !catalog.voyage)) && <Choice label="Chuyến đi" value={catalog.voyage?.bookingId ?? ''}
        items={catalog.voyages.map(item => ({ id: item.bookingId, label: `${item.cruiseName} · ${item.bookingReference}` }))}
        onChange={bookingId => { if (catalog.userId) selectVoyage(catalog.userId, bookingId); }} />}
      {!error && (auth.status === 'restoring' || (context.live && !context.ready)
        || (context.can('BOOKING_READ') && catalog.isPending) || (catalog.itineraryId && canRead && detail.isPending))
        ? <Notice text="Đang tải hải trình…" />
        : !error && (!context.can('BOOKING_READ') || !canRead)
          ? <Notice text="Tài khoản chưa có quyền xem hải trình." />
          : !catalog.itineraryId && !error && <Notice text={catalog.voyage
            ? 'Lịch trình của chuyến này đang được cập nhật.' : catalog.voyages.length
              ? 'Chọn chuyến để xem hải trình.' : 'Hải trình sẽ xuất hiện khi tài khoản có chuyến đi đã xác nhận.'} />}
      {data && <>
        {data.accessErrors.map(message => <Notice key={message} text={message} />)}
        <View style={styles.cruise}><Text style={styles.ship}>{data.itinerary.itineraryName}</Text><Text style={styles.cruiseText}>{data.cruise?.shipName ?? data.cruise?.cruiseName ?? 'Thông tin chuyến tàu chưa khả dụng'}</Text><Text style={styles.cruiseText}>{formatDay(data.itinerary.startDate)} – {formatDay(data.itinerary.endDate)}</Text><Text style={styles.chip}>{statusLabel(data.itinerary.status)}</Text></View>
        <View style={styles.tools}>{context.can('NOTIFICATION_READ') && <SmallButton label="Cập nhật lịch" icon="notifications" onPress={() => setSheet('history')} />}<SmallButton label={zoneLabel} icon="explore" onPress={() => setSheet('clock')} /></View>
        <View style={styles.segmented} accessibilityRole="tablist">{([['daily', 'Theo ngày'], ['ports', 'Điểm dừng']] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="tab" aria-selected={layout === key} accessibilityState={{ selected: layout === key }} onPress={() => setLayout(key)} style={[styles.segment, layout === key && styles.selectedSegment]}><Text style={[styles.segmentText, layout === key && { color: colors.onSecondaryContainer }]}>{label}</Text></Pressable>)}</View>
        {cancelled ? <Notice tone="warning" text="Hải trình/chuyến đi đã hủy. Không sử dụng lịch cũ để rời tàu. Vui lòng xem thông báo thay đổi và liên hệ nhân sự hỗ trợ." />
          : layout === 'ports' ? data.stops.length ? data.stops.map(value => <InfoRow key={value.cruiseStopId} title={value.portName ?? value.destinationName ?? 'Điểm dừng'} subtitle={stopSummary(value)} icon="directions_boat" onPress={() => openStop(value)} />) : data.stopsDenied ? null : <Notice text="Hải trình chưa có điểm dừng." />
            : <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist" accessibilityLabel="Chọn ngày hải trình">{data.days.map(value => <Pressable key={value.itineraryDayId} accessibilityRole="tab" aria-selected={day?.itineraryDayId === value.itineraryDayId} accessibilityState={{ selected: day?.itineraryDayId === value.itineraryDayId }} onPress={() => { setDayId(value.itineraryDayId); setStopId(undefined); setTourId(undefined); }} style={[styles.dayInner, { minWidth: 82, borderRadius: 14, backgroundColor: day?.itineraryDayId === value.itineraryDayId ? colors.secondaryContainer : colors.surfaceContainerLow }]}><Text style={[styles.rowTitle, day?.itineraryDayId === value.itineraryDayId && { color: colors.onSecondaryContainer }]}>Ngày {value.dayNumber}</Text><Text style={[styles.small, day?.itineraryDayId === value.itineraryDayId && { color: colors.onSecondaryContainer }]}>{formatDay(value.date)}</Text></Pressable>)}</ScrollView>
              {!day ? data.daysDenied ? null : <Notice text="Lịch từng ngày chưa được cập nhật." /> : <VoyageEntrance key={day.itineraryDayId} duration={motion.content}><View style={styles.panel}>
                <Text style={styles.sectionTitle}>{day.dayType === 'SEA_DAY' ? 'Ngày trên biển' : `Ngày ${day.dayNumber} · ${formatDay(day.date)}`}</Text>
                {day.description && <Text style={styles.bodyText}>{day.description}</Text>}
                {personalActivities.length > 0 && <>
                  <Text style={styles.sectionTitle}>Trải nghiệm bạn đã đăng ký</Text>
                  {personalActivities.map(item => <InfoRow key={item.registrationId} title={item.name} icon="explore"
                    subtitle={`${time(item.startTime)} – ${time(item.endTime)} · ${statusLabel(item.activityStatus === 'CANCELLED' ? 'CANCELLED' : item.registrationStatus)}${item.location ? ` · ${item.location}` : ''}`} />)}
                </>}
                {day.dayType === 'SEA_DAY' ? <Notice text="Tàu di chuyển trên biển. Không ghé cảng trong ngày này." /> : <>
                  {dayStops.length ? dayStops.map(value => <InfoRow key={value.cruiseStopId} title={value.portName ?? value.destinationName ?? 'Điểm dừng'} subtitle={stopSummary(value)} icon="directions_boat" onPress={() => openStop(value)} />) : data.stopsDenied ? null : <Notice text="Chưa cấu hình điểm dừng cho ngày này." />}
                  {stop && !inactiveStop && <>
                    <Text style={styles.sectionTitle}>Tour tại {stop.destinationName ?? stop.portName ?? 'điểm dừng'}</Text>
                    {dayStops.length > 1 && <View style={styles.tools}>{dayStops.map(value => <SmallButton key={value.cruiseStopId} label={`${value.cruiseStopId === stop.cruiseStopId ? '● ' : ''}${value.portName ?? `Điểm ${value.stopOrder}`}`} icon="directions_boat" onPress={() => { setStopId(value.cruiseStopId); setTourId(undefined); }} />)}</View>}
                    {tourList()}
                    {!!stop.allAboardTime && <InfoRow title="Hạn có mặt trên tàu" subtitle={`${stopTime(stop.allAboardTime, stop, 'departure')} · Rời bến ${stopTime(stop.plannedDeparture, stop, 'departure')}`} icon="sailing" onPress={() => setSheet('port')} />}
                  </>}
                </>}
              </View></VoyageEntrance>}
            </>}
      </>}
    </ScrollView>
    <PassengerSheet expanded contentKey={sheet ?? undefined} visible={!!sheet} title="Chi tiết hải trình" onClose={close}>
      <View style={styles.panel}>{modalContent()}</View>
      {sheet === 'group' && <PassengerButton label="Quay lại danh sách nhóm" variant="text" onPress={() => setSheet('groups')} />}
      {sheet === 'groups' && <PassengerButton label="Quay lại chi tiết tour" variant="text" onPress={() => setSheet('tour')} />}
      {sheet === 'tour' && context.can('EXCURSION_BOOKING') && !!catalog.voyage && <PassengerButton label="Xem tour trong chuyến này" variant="secondary" onPress={() => {
        close();
        router.push({ pathname: '/passenger-activities', params: { view: 'excursions', bookingId: catalog.voyage?.bookingId } });
      }} />}
      <PassengerButton label="Quay lại hải trình" onPress={close} />
    </PassengerSheet>
  </PassengerScaffold>;
}
