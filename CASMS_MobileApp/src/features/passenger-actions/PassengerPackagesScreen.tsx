import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState, ui } from '@/components/passenger/PassengerUI';
import { BookingSelection, ConfirmAction, ErrorNotice, PageIntro, LivePage, Loading } from './PassengerActionUI';
import { passengerApi, useBookingSelection, usePassengerAction, usePassengerContext, usePassengerQuery } from './passenger-hooks';
import { money, packageFits, statusText } from './passenger-model';
import type { Package } from './passenger-types';

export function PassengerPackagesScreen() {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const context = usePassengerContext();
  const selection = useBookingSelection('draft', typeof params.bookingId === 'string' ? params.bookingId : '');
  const packages = usePassengerQuery(['packages'], passengerApi.packages, 'TOUR_PACKAGE_ASSIGN');
  const assignments = usePassengerQuery(['package-assignments', selection.bookingId], signal => passengerApi.assignments(selection.people.map(person => person.bookingPassengerId), signal), 'TOUR_PACKAGE_ASSIGN', !!selection.booking.data);
  const [selected, setSelected] = useState<Package | null>(null); const [confirm, setConfirm] = useState<'save' | 'remove' | null>(null);
  const selectedId = selected?.id ?? '';
  const benefits = usePassengerQuery(['package-benefits', selectedId], signal => passengerApi.benefits(selectedId, signal), 'TOUR_PACKAGE_ASSIGN', !!selectedId);
  const serviceNames = usePassengerQuery(['services'], passengerApi.services, 'SERVICE_READ', !!selected);
  const activityNames = usePassengerQuery(['activities'], passengerApi.activities, 'ACTIVITY_READ', !!selected);
  const excursionNames = usePassengerQuery(['package-excursion-names', selected?.id], signal => Promise.all((benefits.data?.excursions ?? []).map(e => passengerApi.excursion(e.excursionId, signal))), 'EXCURSION_READ', !!benefits.data && !!selected);
  const action = usePassengerAction();
  const assignment = assignments.data?.find(a => a.bookingPassengerId === selection.bookingPassengerId);
  const currentPackage = packages.data?.find(p => p.id === assignment?.packageId);
  const valid = !!selection.booking.data && selection.booking.data.bookingStatus === 'Draft' && !!selection.bookingPassengerId && !selection.booking.error && !selection.bookings.error;
  const fits = selected && selection.booking.data ? packageFits(selected, selection.booking.data) : false;
  return <LivePage title="Gói dịch vụ" permission="TOUR_PACKAGE_ASSIGN">
    <PageIntro title="Gói dịch vụ" icon="restaurant" />
    <Text style={ui.body}>Bạn có thể chọn hoặc đổi gói khi đơn còn ở trạng thái nháp. Gói của đơn đã xác nhận được hiển thị trong chi tiết đặt chỗ.</Text>
    <BookingSelection selection={selection} draft />
    <ErrorNotice error={assignments.error} retry={() => { if (selection.bookingId) void assignments.refetch(); }} />
    {selection.bookingId && assignments.isPending && <Loading text="Đang tải gói đã chọn…" />}
    {assignment && <View style={ui.card}><Text style={ui.sectionTitle}>Gói đang chọn</Text><Text style={ui.body}>{currentPackage?.name ?? 'Gói dịch vụ đã liên kết'}</Text><Text style={ui.body}>Giá đã ghi nhận: {money(assignment.agreedPrice, assignment.currency)}</Text>
      <PassengerButton label="Bỏ gói đã chọn" variant="text" disabled={!valid || !!assignments.error} onPress={() => { action.reset(); setConfirm('remove'); }} />
    </View>}
    <ErrorNotice error={packages.error} retry={() => { void packages.refetch(); }} />{packages.isPending && <Loading />}
    {!packages.isPending && !packages.error && !packages.data?.some(p => p.status === 'ACTIVE') && <EmptyState title="Chưa có gói dịch vụ" description="Các gói đang hoạt động sẽ xuất hiện tại đây." />}
    {packages.data?.filter(p => p.status === 'ACTIVE').map(item => <View key={item.id} style={ui.card}>
      <Text style={ui.caption}>{statusText(item.type)}</Text><Text style={ui.sectionTitle}>{item.name}</Text>{!!item.description && <Text style={ui.body}>{item.description}</Text>}
      <Text style={ui.body}>{money(item.price, item.currency)}</Text>
      {(item.startDate || item.endDate) && <Text style={ui.caption}>Áp dụng {item.startDate ?? 'không giới hạn đầu kỳ'} – {item.endDate ?? 'không giới hạn cuối kỳ'}</Text>}
      <PassengerButton label="Xem quyền lợi" variant="secondary" onPress={() => { setSelected(item); setConfirm(null); action.reset(); }} />
    </View>)}
    {selected && <View style={ui.card}><Text style={ui.sectionTitle}>Quyền lợi {selected.name}</Text>
      <ErrorNotice error={benefits.error} retry={() => { void benefits.refetch(); }} />{benefits.isPending && <Loading />}
      {benefits.data && <><Text style={ui.body}>{benefits.data.services.length} dịch vụ · {benefits.data.activities.length} hoạt động · {benefits.data.excursions.length} tour</Text>
        <ErrorNotice error={serviceNames.error ?? activityNames.error ?? excursionNames.error} />
        {benefits.data.services.map(row => <Text key={row.serviceId} style={ui.body}>{serviceNames.data?.find(s => s.id === row.serviceId)?.name ?? 'Dịch vụ trong gói'} · {statusText(row.benefitType)}</Text>)}
        {benefits.data.activities.map(row => <Text key={row.activityId} style={ui.body}>{activityNames.data?.find(a => a.id === row.activityId)?.name ?? 'Hoạt động trong gói'} · {statusText(row.benefitType)}</Text>)}
        {benefits.data.excursions.map(row => <Text key={row.excursionId} style={ui.body}>{excursionNames.data?.find(e => e.shoreExcursionId === row.excursionId)?.excursionName ?? 'Tour trên bờ trong gói'} · {statusText(row.benefitType)}</Text>)}
        {!context.can('SERVICE_READ') && benefits.data.services.length > 0 && <Text style={ui.caption}>Tài khoản chưa có quyền xem tên dịch vụ trong gói.</Text>}
      </>}
      {valid && !fits && <Text style={ui.body}>Gói này không áp dụng cho toàn bộ thời gian chuyến đi đã chọn.</Text>}
      <PassengerButton label={assignment ? 'Đổi sang gói này' : 'Chọn gói này'} disabled={!valid || !fits || assignments.isPending || !!assignments.error || !!benefits.error || benefits.isPending || assignment?.packageId === selected.id} onPress={() => { action.reset(); setConfirm('save'); }} />
    </View>}
    <PassengerButton label="Cập nhật gói dịch vụ" variant="text" loading={packages.isFetching || assignments.isFetching} onPress={() => { void packages.refetch(); if (selection.bookingId) void assignments.refetch(); }} />
    <ConfirmAction visible={!!confirm} title={confirm === 'remove' ? 'Xác nhận bỏ gói' : 'Xác nhận chọn gói'} description={confirm === 'remove' ? 'Bỏ gói đang liên kết với hồ sơ đã chọn trong đơn nháp.' : `${selected?.name ?? ''} · ${money(selected?.price, selected?.currency)}. Giá gói được ghi nhận theo phản hồi của hệ thống; đây chưa phải giao dịch thanh toán.`} onClose={() => setConfirm(null)} pending={action.isPending} error={action.error} onConfirm={() => {
      if (!valid || action.isPending || (confirm === 'save' && !selectedId)) return;
      const person = selection.bookingPassengerId;
      action.mutate(() => confirm === 'remove' ? passengerApi.removePackage(person) : passengerApi.savePackage(person, selectedId, !!assignment), { onSuccess: () => setConfirm(null) });
    }} />
  </LivePage>;
}
