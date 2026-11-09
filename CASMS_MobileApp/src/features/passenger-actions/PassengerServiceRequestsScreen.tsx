import { ApiError } from '@/lib/api';
import { useNow } from '@/hooks/use-now';
import { useAuth } from '@/features/auth/session-store';
import { readServiceOperation, beginServiceOperation, clearServiceOperation, newServiceOperationKey, type PendingServiceOperation } from './service-operation-store';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { EmptyState, FilterChips, SearchField, ui } from '@/components/passenger/PassengerUI';
import { Choice, BookingSelection, ConfirmAction, ErrorNotice, Input, PageIntro, LivePage, Loading, StatusBadge } from './PassengerActionUI';
import { passengerApi, useBookingSelection, usePassengerAction, usePassengerContext, usePassengerQuery } from './passenger-hooks';
import { dateTime, money, positiveQuantity, serviceRequestActions, serviceRequestInput, statusText } from './passenger-model';
import type { Service, ServiceRequest, ServiceSchedule } from './passenger-types';

function scheduleLabel(slot: ServiceSchedule) {
  const zone = slot.timeZoneId;
  if (!zone) return `${dateTime(slot.startsAt)} – ${dateTime(slot.endsAt)} · Giờ thiết bị · ${slot.location}`;
  try {
    const format = new Intl.DateTimeFormat('vi-VN', { timeZone: zone, dateStyle: 'short', timeStyle: 'short' });
    return `${format.format(new Date(slot.startsAt))} – ${format.format(new Date(slot.endsAt))} · ${zone} · ${slot.location}`;
  } catch { return 'Lịch phục vụ chưa có múi giờ hợp lệ'; }
}

type Operation = { kind: 'create'; service: Service } | { kind: 'edit'; request: ServiceRequest } | { kind: 'cancel'; request: ServiceRequest };
export function PassengerServiceRequestsScreen({ embedded = false }: { embedded?: boolean }) {
  const { auth, owner } = usePassengerContext();
  return <ServiceRequestsWorkspace key={`${owner}:${auth.session?.signedInAt}`} embedded={embedded} />;
}

function ServiceRequestsWorkspace({ embedded }: { embedded: boolean }) {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const selection = useBookingSelection('confirmed', typeof params.bookingId === 'string' ? params.bookingId : '');
  const context = usePassengerContext();
  const services = usePassengerQuery(['services'], passengerApi.services, 'SERVICE_READ');
  const requestPermissions = ['SERVICE_REQUEST_READ', 'SERVICE_REQUEST_CREATE'] as const;
  const requests = usePassengerQuery(['service-requests'], passengerApi.requests, requestPermissions);
  const now = useNow();
  const [tab, setTab] = useState<'catalog' | 'requests'>('catalog'); const [search, setSearch] = useState('');
  const [operation, setOperation] = useState<Operation | null>(null); const [quantity, setQuantity] = useState('1'); const [note, setNote] = useState(''); const [validation, setValidation] = useState<unknown>(null);
  const action = usePassengerAction();
  const [slotId, setSlotId] = useState('');
  const [pendingOperation, setPendingOperation] = useState<PendingServiceOperation | null>(null);
  const [operationLoaded, setOperationLoaded] = useState(false);
  const pendingRef = useRef<PendingServiceOperation | null>(null);
  const payloadRef = useRef<string | null>(null), submitLock = useRef(false);
  const serviceId = operation?.kind === 'create' ? operation.service.id : '';
  const slots = usePassengerQuery(['service-slots', serviceId],
    useCallback(signal => passengerApi.serviceSchedules(serviceId, signal), [serviceId]),
    'SERVICE_READ', Boolean(serviceId));
  const matchingSlots = slots.data?.filter(slot => slot.cruiseId === selection.cruiseId);
  useEffect(() => {
    let current = true;
    if (!context.ready || !context.owner) return;
    void readServiceOperation(context.owner).then(value => {
      if (!current) return;
      pendingRef.current = value;
      setPendingOperation(value);
      setOperationLoaded(true);
    }).catch(error => { if (current) setValidation(error); });
    return () => { current = false; };
  }, [context.ready, context.owner]);
  async function recover() {
    const owner = context.owner, pending = pendingRef.current;
    if (!owner || !pending || submitLock.current) return;
    submitLock.current = true;
    setValidation(null);
    try {
      const saved = await passengerApi.requestByOperationKey(pending.key);
      if (useAuth.getState().session?.user.id !== owner) return;
      if (saved.serviceId !== pending.serviceId || saved.bookingPassengerId !== pending.bookingPassengerId)
        throw new Error('Yêu cầu đã lưu chưa khớp thao tác của bạn.');
      await clearServiceOperation(owner, pending.key);
      pendingRef.current = null; payloadRef.current = null; setPendingOperation(null);
      selection.choose(saved.bookingId ?? pending.bookingId);
      selection.choosePerson(pending.bookingPassengerId);
      setOperation(null); setTab('requests'); await requests.refetch();
    } catch (error) {
      setValidation(error instanceof ApiError && error.status === 404
        ? new Error('Chưa thấy yêu cầu đã lưu. Bạn có thể mở lại dịch vụ bên dưới và gửi lại với cùng mã thao tác.')
        : error);
    } finally { submitLock.current = false; }
  }

  const active = (services.data ?? []).filter(s => s.status === 'ACTIVE' && `${s.name} ${s.description ?? ''}`.toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN')));
  const visibleRequests = (requests.data ?? []).filter(r => r.bookingId === selection.bookingId);
  const selectedPerson = selection.people.find(p => p.bookingPassengerId === selection.bookingPassengerId);
  const canCreate = selection.ready;
  function open(value: Operation) {
    if (submitLock.current) return;
    action.reset(); setValidation(null); setSlotId(''); setQuantity(value.kind === 'create' ? '1' : String(value.request.quantity)); setNote(value.kind === 'create' ? '' : value.request.note ?? ''); setOperation(value);
  }
  function submit() {
    if (!operation || action.isPending || submitLock.current || !operationLoaded || !context.can('SERVICE_REQUEST_CREATE')) return;
    let amount = 1;
    try { if (operation.kind !== 'cancel') amount = positiveQuantity(quantity); if (note.length > 500) throw new Error('Ghi chú tối đa 500 ký tự.'); }
    catch (error) { setValidation(error); return; }
    const captured = operation; const person = selection.bookingPassengerId;
    if (captured.kind === 'create') {
      const service = captured.service;
      if (service.canBuyPreCruise === false) { setValidation(new Error('Dịch vụ không nhận yêu cầu trước chuyến.')); return; }
      if ((service.requiresSchedule || service.preCruiseUsagePolicy === 'PER_DAY') && !slotId) {
        setValidation(new Error('Chọn lịch phục vụ cho dịch vụ này.')); return;
      }
      if (slotId && (slots.isFetching || slots.error || !matchingSlots?.some(slot => slot.id === slotId
          && slot.status === 'OPEN' && slot.remainingCapacity >= amount && Date.parse(slot.endsAt) > Date.now()))) {
        setValidation(new Error('Lịch đã chọn không còn đủ chỗ hoặc đã kết thúc.')); return;
      }
    }
    if (captured.kind === 'create' && !canCreate) { setValidation(new Error('Vui lòng chọn hồ sơ trong đặt chỗ đã xác nhận.')); return; }
    if (captured.kind !== 'cancel') {
      const service = captured.kind === 'create' ? captured.service : services.data?.find(s => s.id === captured.request.serviceId);
      if (!service) { setValidation(new Error('Vui lòng tải lại thông tin dịch vụ trước khi sửa yêu cầu.')); return; }
      try { amount = serviceRequestInput(
        (captured.kind === 'create' ? Boolean(slotId) : Boolean(captured.request.scheduleId))
          ? { ...service, capacity: null } : service, quantity, note).quantity; } catch (error) { setValidation(error); return; }
    }
    setValidation(null);
    submitLock.current = true;
    action.mutate(async assertCurrent => {
      const owner = context.owner;
      if (!owner || useAuth.getState().session?.user.id !== owner)
        throw new Error('Phiên hành khách đã thay đổi.');
      if (captured.kind === 'cancel') return passengerApi.cancelRequest(captured.request.id);
      if (captured.kind === 'edit') return passengerApi.updateRequest(captured.request.id, amount, note);
      if (!slotId && !pendingRef.current) {
        const capacity = await passengerApi.serviceAvailability(captured.service.id, amount);
        assertCurrent();
        if (capacity.serviceId !== captured.service.id || capacity.requestedQuantity !== amount || capacity.available !== true) {
          throw new Error('Dịch vụ không còn đủ khả năng tiếp nhận số lượng này.');
        }
      }
      const payload = JSON.stringify({ serviceId: captured.service.id, person, quantity: amount, note: note.trim(), slotId });
      if (payloadRef.current && payloadRef.current !== payload)
        throw new Error('Giữ nguyên nội dung của yêu cầu đang chờ đối chiếu.');
      let pending = pendingRef.current;
      if (pending && (pending.serviceId !== captured.service.id || pending.bookingPassengerId !== person))
        throw new Error('Đối chiếu yêu cầu trước trước khi tạo yêu cầu cho dịch vụ khác.');
      if (!pending) pending = { key: newServiceOperationKey(), serviceId: captured.service.id,
        bookingId: selection.bookingId, bookingPassengerId: person };
      pending = await beginServiceOperation(owner, pending);
      pendingRef.current = pending; setPendingOperation(pending);
      if (pending.serviceId !== captured.service.id || pending.bookingPassengerId !== person)
        throw new Error('Đang có yêu cầu khác cần đối chiếu. Kiểm tra yêu cầu đã lưu trước khi gửi tiếp.');
      pendingRef.current = pending; payloadRef.current = payload; setPendingOperation(pending);
      if (useAuth.getState().session?.user.id !== owner)
        throw new Error('Phiên hành khách đã thay đổi.');
      assertCurrent();
      let saved: ServiceRequest;
      try {
        saved = await passengerApi.createRequest(captured.service.id, person, amount, note, slotId || undefined, pending.key);
      } catch (error) {
        if (error instanceof ApiError && [400, 403, 422].includes(error.status)) {
          await clearServiceOperation(owner, pending.key);
          pendingRef.current = null; payloadRef.current = null; setPendingOperation(null);
        }
        throw error;
      }
      if (saved.serviceId !== captured.service.id || saved.bookingPassengerId !== person
          || saved.quantity !== amount || (saved.scheduleId ?? '') !== slotId)
        throw new Error('Chưa đối chiếu được kết quả gửi yêu cầu.');
      await clearServiceOperation(owner, pending.key);
      pendingRef.current = null; payloadRef.current = null; setPendingOperation(null);
      return saved;
    }, { onSuccess: () => { setOperation(null); setTab('requests'); },
      onSettled: () => { submitLock.current = false; } });
  }

  return <LivePage title="Dịch vụ trên tàu" permission="SERVICE_READ" detail={!embedded}>
    <PageIntro title="Dịch vụ trên tàu" icon="room_service" />
    <PassengerButton label="Hoạt động và tour" variant="secondary" onPress={() => router.push('/passenger-activities')} />
    <BookingSelection selection={selection} />
    {pendingOperation && <View style={ui.card}>
      <Text style={ui.sectionTitle}>Yêu cầu cần đối chiếu</Text>
      <Text style={ui.body}>Hệ thống cần xác định kết quả lần gửi trước trước khi tạo yêu cầu tiếp.</Text>
      <PassengerButton label="Kiểm tra yêu cầu đã lưu" disabled={action.isPending} onPress={() => { void recover(); }} />
    </View>}
    <ErrorNotice error={validation} />
    <FilterChips items={[{ key: 'catalog', label: 'Dịch vụ' }, { key: 'requests', label: 'Yêu cầu của tôi' }]} selected={tab} onSelect={setTab} />
    {tab === 'catalog' ? <>
      <SearchField placeholder="Tìm dịch vụ trên tàu" value={search} onChangeText={setSearch} />
      <ErrorNotice error={services.error} retry={() => { void services.refetch(); }} />
      {services.isPending && <Loading />}
      {!services.isPending && !services.error && !active.length && <EmptyState title="Chưa có dịch vụ phù hợp" description="Thử từ khóa khác hoặc kiểm tra lại sau." />}
      {active.map(service => <View key={service.id} style={ui.card}><Text style={ui.caption}>{statusText(service.type ?? 'Dịch vụ trên tàu')}</Text><Text style={ui.sectionTitle}>{service.name}</Text>
        {!!service.description && <Text style={ui.body}>{service.description}</Text>}<Text style={ui.body}>Giá tham chiếu {money(service.price, service.currency)}</Text>
        {context.can('SERVICE_REQUEST_CREATE') && <PassengerButton label="Gửi yêu cầu dịch vụ" disabled={!canCreate || !operationLoaded || service.canBuyPreCruise === false || Boolean(pendingOperation && (pendingOperation.serviceId !== service.id || pendingOperation.bookingPassengerId !== selection.bookingPassengerId))} onPress={() => open({ kind: 'create', service })} />}
      </View>)}
      <PassengerButton label="Cập nhật dịch vụ" variant="text" loading={services.isFetching} onPress={() => { void services.refetch(); }} />
    </> : !requestPermissions.some(context.can) ? <Text style={ui.body}>Tài khoản chưa có quyền xem yêu cầu dịch vụ.</Text> : <>
      <ErrorNotice error={requests.error} retry={() => { void requests.refetch(); }} />{requests.isPending && <Loading />}
      {!selection.source.isPending && !selection.source.error && !!selection.bookingId && !requests.isPending && !requests.error && !visibleRequests.length && <EmptyState title="Chưa có yêu cầu" description="Các yêu cầu dịch vụ của chuyến đi này sẽ xuất hiện tại đây." />}
      {visibleRequests.map(request => <View key={request.id} style={ui.card}>
        <Text style={ui.sectionTitle}>{services.data?.find(s => s.id === request.serviceId)?.name ?? 'Yêu cầu dịch vụ'}</Text>
        <StatusBadge status={request.status} />{request.bookingPassengerId && <Text style={ui.caption}>{selection.booking.data?.passengers.find(p => p.bookingPassengerId === request.bookingPassengerId)?.fullName ?? 'Hành khách trong chuyến đi'}</Text>}<Text style={ui.body}>Số lượng {request.quantity}</Text><Text style={ui.caption}>{dateTime(request.requestTime)}</Text>
        {request.fareBenefitSnapshotId && <Text style={ui.body}>Đã liên kết quyền lợi gói du thuyền.</Text>}
        <Text style={ui.body}>Đã phục vụ {request.fulfilledQuantity ?? 'chưa ghi nhận'} {request.fulfillmentUnitCode ?? ''}</Text>
        <Text style={ui.caption}>Kênh sử dụng {request.usageMode === 'PRE_CRUISE' ? 'trước chuyến' : request.usageMode === 'ONBOARD' ? 'trên tàu' : 'yêu cầu cũ'}</Text>
        {request.usagePolicySnapshot && <Text style={ui.caption}>Định mức đã áp dụng {request.usagePolicySnapshot}{request.usageLimitSnapshot == null ? '' : ` · ${request.usageLimitSnapshot}`}{request.usageTimeZoneSnapshot ? ` · ${request.usageTimeZoneSnapshot}` : ''}</Text>}
        {request.unitPriceSnapshot != null && <Text style={ui.caption}>Giá tham chiếu lúc yêu cầu {money(request.unitPriceSnapshot, request.currencySnapshot ?? null)}</Text>}
        {!!request.completedAt && <Text style={ui.caption}>Hoàn tất {dateTime(request.completedAt)}</Text>}
        {!!request.note && <Text style={ui.body}>{request.note}</Text>}
        {context.can('SERVICE_REQUEST_CREATE') && request.usageMode !== 'ONBOARD' && serviceRequestActions(request.status).includes('edit') && !!services.data?.some(s => s.id === request.serviceId && s.status === 'ACTIVE') && <PassengerButton label="Sửa yêu cầu" variant="secondary" onPress={() => open({ kind: 'edit', request })} />}
        {context.can('SERVICE_REQUEST_CREATE') && serviceRequestActions(request.status).includes('cancel') && <PassengerButton label="Hủy yêu cầu" variant="text" onPress={() => open({ kind: 'cancel', request })} />}
      </View>)}
      <PassengerButton label="Cập nhật yêu cầu" variant="text" loading={requests.isFetching} onPress={() => { void requests.refetch(); }} />
    </>}
    <ConfirmAction visible={!!operation} title={operation?.kind === 'create' ? 'Xác nhận gửi yêu cầu' : operation?.kind === 'edit' ? 'Lưu thay đổi yêu cầu' : 'Xác nhận hủy yêu cầu'} description={operation?.kind === 'cancel' ? 'Yêu cầu này sẽ được hủy nếu trạng thái hiện tại cho phép.' : 'Đội ngũ trên tàu sẽ tiếp nhận yêu cầu. Gửi yêu cầu chưa có nghĩa là dịch vụ đã được xác nhận hoặc thanh toán.'} onClose={() => { if (!submitLock.current) setOperation(null); }} onConfirm={submit} pending={action.isPending} disabled={!operationLoaded} error={action.error}>
      {operation?.kind === 'create' && <View style={ui.card}><Text style={ui.sectionTitle}>{operation.service.name}</Text><Text style={ui.body}>{selectedPerson?.fullName}{selectedPerson?.cabinNumber ? ` · Phòng ${selectedPerson.cabinNumber}` : ''}</Text><Text style={ui.caption}>Đơn giá {money(operation.service.price, operation.service.currency)}</Text></View>}
      {!!operation && operation.kind !== 'create' && <Text style={ui.sectionTitle}>{services.data?.find(s => s.id === operation.request.serviceId)?.name ?? 'Yêu cầu dịch vụ'}</Text>}
      {operation?.kind === 'create' && <>
        {slots.isPending && <Loading text="Đang tải lịch phục vụ…" />}
        <ErrorNotice error={slots.error} retry={() => { void slots.refetch(); }} />
        <Choice label="Lịch phục vụ của chuyến" value={slotId}
          items={[...(!operation.service.requiresSchedule && operation.service.preCruiseUsagePolicy !== 'PER_DAY'
            ? [{ id: '', label: 'Không chọn khung giờ' }] : []),
            ...(matchingSlots ?? []).filter(slot => slot.remainingCapacity >= Number(quantity) && Date.parse(slot.endsAt) > now && slot.status === 'OPEN')
              .map(slot => ({ id: slot.id, label: scheduleLabel(slot) }))]}
          onChange={setSlotId} disabled={action.isPending || slots.isFetching || Boolean(slots.error)} />
      </>}
      {operation?.kind !== 'cancel' && <><Input label="Số lượng" value={quantity} onChange={setQuantity} numeric maxLength={10} disabled={action.isPending} /><Input label="Ghi chú nếu có" value={note} onChange={setNote} multiline maxLength={500} disabled={action.isPending} /></>}
      <ErrorNotice error={validation} />
    </ConfirmAction>
  </LivePage>;
}
