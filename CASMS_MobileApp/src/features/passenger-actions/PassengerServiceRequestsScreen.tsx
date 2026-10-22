import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState, FilterChips, SearchField, ui } from '@/components/passenger/PassengerUI';
import { BookingSelection, ConfirmAction, ErrorNotice, Input, PageIntro, LivePage, Loading, StatusBadge } from './PassengerActionUI';
import { passengerApi, useBookingSelection, usePassengerAction, usePassengerContext, usePassengerQuery } from './passenger-hooks';
import { dateTime, money, positiveQuantity, serviceRequestActions, serviceRequestInput, statusText } from './passenger-model';
import type { Service, ServiceRequest } from './passenger-types';

type Operation = { kind: 'create'; service: Service } | { kind: 'edit'; request: ServiceRequest } | { kind: 'cancel'; request: ServiceRequest };
export function PassengerServiceRequestsScreen({ embedded = false }: { embedded?: boolean }) {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const selection = useBookingSelection('confirmed', typeof params.bookingId === 'string' ? params.bookingId : '');
  const context = usePassengerContext();
  const services = usePassengerQuery(['services'], passengerApi.services, 'SERVICE_READ');
  const requests = usePassengerQuery(['service-requests'], passengerApi.requests, 'SERVICE_REQUEST_CREATE');
  const [tab, setTab] = useState<'catalog' | 'requests'>('catalog'); const [search, setSearch] = useState('');
  const [operation, setOperation] = useState<Operation | null>(null); const [quantity, setQuantity] = useState('1'); const [note, setNote] = useState(''); const [validation, setValidation] = useState<unknown>(null);
  const action = usePassengerAction();
  const active = (services.data ?? []).filter(s => s.status === 'ACTIVE' && `${s.name} ${s.description ?? ''}`.toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN')));
  const visibleRequests = (requests.data ?? []).filter(r => r.bookingId === selection.bookingId);
  const selectedPerson = selection.people.find(p => p.bookingPassengerId === selection.bookingPassengerId);
  const canCreate = !!selectedPerson && !selection.booking.error && !selection.bookings.error && !selection.booking.isFetching && !selection.bookings.isFetching;
  function open(value: Operation) {
    action.reset(); setValidation(null); setQuantity(value.kind === 'create' ? '1' : String(value.request.quantity)); setNote(value.kind === 'create' ? '' : value.request.note ?? ''); setOperation(value);
  }
  function submit() {
    if (!operation || action.isPending) return;
    let amount = 1;
    try { if (operation.kind !== 'cancel') amount = positiveQuantity(quantity); if (note.length > 500) throw new Error('Ghi chú tối đa 500 ký tự.'); }
    catch (error) { setValidation(error); return; }
    const captured = operation; const person = selection.bookingPassengerId;
    if (captured.kind === 'create' && !canCreate) { setValidation(new Error('Vui lòng chọn hồ sơ trong đặt chỗ đã xác nhận.')); return; }
    if (captured.kind !== 'cancel') {
      const service = captured.kind === 'create' ? captured.service : services.data?.find(s => s.id === captured.request.serviceId);
      if (!service) { setValidation(new Error('Vui lòng tải lại thông tin dịch vụ trước khi sửa yêu cầu.')); return; }
      try { amount = serviceRequestInput(service, quantity, note).quantity; } catch (error) { setValidation(error); return; }
    }
    setValidation(null);
    action.mutate(async () => {
      if (captured.kind === 'cancel') return passengerApi.cancelRequest(captured.request.id);
      if (captured.kind === 'edit') {
        const capacity = await passengerApi.serviceAvailability(captured.request.serviceId, amount);
        if (capacity.available !== true) throw new Error('Dịch vụ không còn đủ khả năng tiếp nhận số lượng này.');
        return passengerApi.updateRequest(captured.request.id, amount, note);
      }
      const capacity = await passengerApi.serviceAvailability(captured.service.id, amount);
      if (capacity.available !== true) throw new Error('Dịch vụ không còn đủ khả năng tiếp nhận số lượng này.');
      return passengerApi.createRequest(captured.service.id, person, amount, note);
    }, { onSuccess: () => { setOperation(null); setTab('requests'); } });
  }
  return <LivePage title="Dịch vụ trên tàu" permission="SERVICE_READ" detail={!embedded}>
    <PageIntro title="Dịch vụ trên tàu" icon="room_service" />
    <PassengerButton label="Hoạt động và tour" variant="secondary" onPress={() => router.push('/passenger-activities')} />
    <BookingSelection selection={selection} />
    <FilterChips items={[{ key: 'catalog', label: 'Dịch vụ' }, { key: 'requests', label: 'Yêu cầu của tôi' }]} selected={tab} onSelect={setTab} />
    {tab === 'catalog' ? <>
      <SearchField placeholder="Tìm dịch vụ trên tàu" value={search} onChangeText={setSearch} />
      <ErrorNotice error={services.error} retry={() => { void services.refetch(); }} />
      {services.isPending && <Loading />}
      {!services.isPending && !services.error && !active.length && <EmptyState title="Chưa có dịch vụ phù hợp" description="Thử từ khóa khác hoặc kiểm tra lại sau." />}
      {active.map(service => <View key={service.id} style={ui.card}><Text style={ui.caption}>{statusText(service.type ?? 'Dịch vụ trên tàu')}</Text><Text style={ui.sectionTitle}>{service.name}</Text>
        {!!service.description && <Text style={ui.body}>{service.description}</Text>}<Text style={ui.body}>{money(service.price, service.currency)}</Text>
        {context.can('SERVICE_REQUEST_CREATE') && <PassengerButton label="Gửi yêu cầu dịch vụ" disabled={!canCreate} onPress={() => open({ kind: 'create', service })} />}
      </View>)}
      <PassengerButton label="Cập nhật dịch vụ" variant="text" loading={services.isFetching} onPress={() => { void services.refetch(); }} />
    </> : !context.can('SERVICE_REQUEST_CREATE') ? <Text style={ui.body}>Tài khoản chưa có quyền xem và gửi yêu cầu dịch vụ.</Text> : <>
      <ErrorNotice error={requests.error} retry={() => { void requests.refetch(); }} />{requests.isPending && <Loading />}
      {!selection.bookings.isPending && !selection.booking.isPending && !selection.bookings.error && !selection.booking.error && !!selection.bookingId && !requests.isPending && !requests.error && !visibleRequests.length && <EmptyState title="Chưa có yêu cầu" description="Các yêu cầu dịch vụ của chuyến đi này sẽ xuất hiện tại đây." />}
      {visibleRequests.map(request => <View key={request.id} style={ui.card}>
        <Text style={ui.sectionTitle}>{services.data?.find(s => s.id === request.serviceId)?.name ?? 'Yêu cầu dịch vụ'}</Text>
        <StatusBadge status={request.status} />{request.bookingPassengerId && <Text style={ui.caption}>{selection.booking.data?.passengers.find(p => p.bookingPassengerId === request.bookingPassengerId)?.fullName ?? 'Hành khách trong chuyến đi'}</Text>}<Text style={ui.body}>Số lượng {request.quantity}</Text><Text style={ui.caption}>{dateTime(request.requestTime)}</Text>
        {!!request.completedAt && <Text style={ui.caption}>Hoàn tất {dateTime(request.completedAt)}</Text>}
        {!!request.note && <Text style={ui.body}>{request.note}</Text>}
        {serviceRequestActions(request.status).includes('edit') && !!services.data?.some(s => s.id === request.serviceId && s.status === 'ACTIVE') && <PassengerButton label="Sửa yêu cầu" variant="secondary" onPress={() => open({ kind: 'edit', request })} />}
        {serviceRequestActions(request.status).includes('cancel') && <PassengerButton label="Hủy yêu cầu" variant="text" onPress={() => open({ kind: 'cancel', request })} />}
      </View>)}
      <PassengerButton label="Cập nhật yêu cầu" variant="text" loading={requests.isFetching} onPress={() => { void requests.refetch(); }} />
    </>}
    <ConfirmAction visible={!!operation} title={operation?.kind === 'create' ? 'Xác nhận gửi yêu cầu' : operation?.kind === 'edit' ? 'Lưu thay đổi yêu cầu' : 'Xác nhận hủy yêu cầu'} description={operation?.kind === 'cancel' ? 'Yêu cầu này sẽ được hủy nếu trạng thái hiện tại cho phép.' : 'Đội ngũ trên tàu sẽ tiếp nhận yêu cầu. Gửi yêu cầu chưa có nghĩa là dịch vụ đã được xác nhận hoặc thanh toán.'} onClose={() => setOperation(null)} onConfirm={submit} pending={action.isPending} error={action.error}>
      {operation?.kind === 'create' && <View style={ui.card}><Text style={ui.sectionTitle}>{operation.service.name}</Text><Text style={ui.body}>{selectedPerson?.fullName}{selectedPerson?.cabinNumber ? ` · Phòng ${selectedPerson.cabinNumber}` : ''}</Text><Text style={ui.caption}>Đơn giá {money(operation.service.price, operation.service.currency)}</Text></View>}
      {!!operation && operation.kind !== 'create' && <Text style={ui.sectionTitle}>{services.data?.find(s => s.id === operation.request.serviceId)?.name ?? 'Yêu cầu dịch vụ'}</Text>}
      {operation?.kind !== 'cancel' && <><Input label="Số lượng" value={quantity} onChange={setQuantity} numeric maxLength={10} disabled={action.isPending} /><Input label="Ghi chú nếu có" value={note} onChange={setNote} multiline maxLength={500} disabled={action.isPending} /></>}
      <ErrorNotice error={validation} />
    </ConfirmAction>
  </LivePage>;
}
